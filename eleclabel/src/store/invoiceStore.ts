// Store factures — local-first avec sync Supabase en arrière-plan.
// Lectures depuis IndexedDB (instantané, offline-friendly).
// Mutations : écriture locale immédiate + push vers Supabase en fire-and-forget.
// Au login : pull depuis Supabase pour mettre à jour le cache local.
import { create } from "zustand";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { Invoice, InvoiceMetadata } from "../types/invoice";
import {
  fetchAllInvoices,
  fetchInvoicePhoto,
  getCurrentUserId,
} from "../services/cloudSync";
import { enqueue } from "../services/syncQueue";

const STORAGE_KEY = "eleclabel-invoices";

// Génère un UUID v4 (compatible Supabase type uuid)
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback : pseudo-UUID, accepté par Supabase tant qu'il a le bon format
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface InvoiceStore {
  invoices: Invoice[];
  loading: boolean;

  /** Charge depuis le cloud si possible, sinon depuis le cache local */
  load: () => Promise<void>;
  /** Recharge complète depuis le cloud (override le cache local) */
  refreshFromCloud: () => Promise<void>;
  /** Crée une nouvelle facture (local + push cloud en fire-and-forget) */
  add: (invoice: Omit<Invoice, "id" | "createdAt">) => Promise<string>;
  /** Met à jour les méta-données + push cloud */
  updateMeta: (id: string, meta: InvoiceMetadata & { reviewed?: boolean }) => Promise<void>;
  /** Charge la photo HD depuis Storage à la demande (lazy) */
  loadPhotoIfMissing: (id: string) => Promise<void>;
  /** Supprime une facture (local + Storage + DB) */
  remove: (id: string) => Promise<void>;
  /** Efface toutes les factures (local seulement — utilisé par migration) */
  clearLocal: () => Promise<void>;
}

async function loadFromCache(): Promise<Invoice[]> {
  try {
    const raw = await idbGet(STORAGE_KEY);
    if (!Array.isArray(raw)) return [];
    return raw as Invoice[];
  } catch (err) {
    console.warn("Failed to load invoices from IndexedDB:", err);
    return [];
  }
}

async function saveToCache(invoices: Invoice[]): Promise<void> {
  try {
    await idbSet(STORAGE_KEY, invoices);
  } catch (err) {
    console.error("Failed to save invoices to IndexedDB:", err);
  }
}

export const useInvoiceStore = create<InvoiceStore>((set, get) => ({
  invoices: [],
  loading: true,

  load: async () => {
    set({ loading: true });
    const userId = await getCurrentUserId();

    if (userId) {
      try {
        const cloud = await fetchAllInvoices(userId);
        cloud.sort((a, b) => b.createdAt - a.createdAt);
        set({ invoices: cloud, loading: false });
        await saveToCache(cloud);
        return;
      } catch (err) {
        console.warn("[invoiceStore] cloud fetch failed, using local cache:", err);
      }
    }
    // Fallback : cache local
    const cached = await loadFromCache();
    cached.sort((a, b) => b.createdAt - a.createdAt);
    set({ invoices: cached, loading: false });
  },

  refreshFromCloud: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      const cloud = await fetchAllInvoices(userId);
      cloud.sort((a, b) => b.createdAt - a.createdAt);
      set({ invoices: cloud });
      await saveToCache(cloud);
    } catch (err) {
      console.warn("[invoiceStore] refresh failed:", err);
    }
  },

  add: async (entry) => {
    const id = newId();
    const newInvoice: Invoice = {
      ...entry,
      id,
      createdAt: Date.now(),
    };
    const next = [newInvoice, ...get().invoices];
    set({ invoices: next });
    await saveToCache(next);

    // Enfile l'op dans la queue offline → push immédiat si réseau, sinon attend
    const userId = await getCurrentUserId();
    if (userId) {
      await enqueue({
        kind: "invoice-upsert",
        userId,
        recordId: id,
        record: newInvoice,
      });
    }
    return id;
  },

  updateMeta: async (id, meta) => {
    const next = get().invoices.map((inv) => (inv.id === id ? { ...inv, ...meta } : inv));
    set({ invoices: next });
    await saveToCache(next);

    const updated = next.find((inv) => inv.id === id);
    const userId = await getCurrentUserId();
    if (userId && updated) {
      await enqueue({
        kind: "invoice-meta",
        userId,
        recordId: id,
        record: updated,
      });
    }
  },

  loadPhotoIfMissing: async (id) => {
    const invoice = get().invoices.find((inv) => inv.id === id);
    if (!invoice) return;
    if (invoice.imageBase64 && invoice.imageBase64.length > 0) return;

    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      const base64 = await fetchInvoicePhoto(userId, id, invoice.imageMimeType);
      const next = get().invoices.map((inv) =>
        inv.id === id ? { ...inv, imageBase64: base64 } : inv,
      );
      set({ invoices: next });
      await saveToCache(next);
    } catch (err) {
      console.warn(`[invoiceStore] failed to load photo for ${id}:`, err);
    }
  },

  remove: async (id) => {
    const next = get().invoices.filter((inv) => inv.id !== id);
    set({ invoices: next });
    await saveToCache(next);

    const userId = await getCurrentUserId();
    if (userId) {
      await enqueue({
        kind: "invoice-delete",
        userId,
        recordId: id,
      });
    }
  },

  clearLocal: async () => {
    set({ invoices: [] });
    await idbDel(STORAGE_KEY);
  },
}));
