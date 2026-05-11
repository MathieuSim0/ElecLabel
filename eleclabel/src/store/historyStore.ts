// Historique des tableaux — local-first avec sync Supabase en arrière-plan.
// Stocké localement dans localStorage (compatibilité existant) + push cloud.
import { create } from "zustand";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { Panel } from "../types/panel";
import { fetchAllPanels, getCurrentUserId } from "../services/cloudSync";
import { enqueue } from "../services/syncQueue";

// L'image originale (plusieurs Mo) ne tient pas dans localStorage et alourdit le cloud.
// On la stocke à part dans IndexedDB (clé pimg-<id>) et on la retire du panel persistant.
function stripImage(panel: Panel): Panel {
  if (!panel.imageBase64) return panel;
  const { imageBase64: _omit, ...rest } = panel;
  return rest;
}
function savePanelImage(id: string, img?: string): void {
  if (img) idbSet(`pimg-${id}`, img).catch(() => {});
}
/** Charge l'image originale d'un tableau depuis IndexedDB (undefined si absente) */
export async function loadPanelImage(id: string): Promise<string | undefined> {
  try {
    return (await idbGet(`pimg-${id}`)) as string | undefined;
  } catch {
    return undefined;
  }
}

export type HistorySource = "photo" | "template" | "manual";

export interface HistoryEntry {
  id: string;
  name: string;
  timestamp: number;
  panel: Panel;
  thumbnail?: string;       // base64 JPEG réduit (max 300px)
  source: HistorySource;
  breakerCount: number;
  rowCount: number;
}

interface HistoryStore {
  entries: HistoryEntry[];
  add: (entry: Omit<HistoryEntry, "id" | "timestamp" | "breakerCount" | "rowCount">) => string;
  update: (id: string, panel: Panel) => void;
  remove: (id: string) => void;
  clear: () => void;
  rename: (id: string, name: string) => void;
  /** Recharge depuis le cloud (override le cache local) */
  refreshFromCloud: () => Promise<void>;
  /** Efface localement seulement — utilisé par migration */
  clearLocal: () => void;
}

const STORAGE_KEY = "eleclabel-history";
const MAX_ENTRIES = 30;

// Génère un UUID v4 (compatible Supabase type uuid)
function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    if (entries.length > 1) saveHistory(entries.slice(0, entries.length - 1));
  }
}

function countBreakers(panel: Panel): number {
  return panel.rows.reduce((s, r) => s + r.breakers.length, 0);
}

// Helpers : enfilent dans la queue offline → push immédiat si réseau, sinon retry plus tard
async function pushEntryToCloud(entry: HistoryEntry): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await enqueue({
    kind: "panel-upsert",
    userId,
    recordId: entry.id,
    record: entry,
  });
}

async function pushUpdateToCloud(id: string, panel: Panel): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await enqueue({
    kind: "panel-data",
    userId,
    recordId: id,
    panel,
    breakerCount: countBreakers(panel),
    rowCount: panel.rows.length,
  });
}

async function pushNameToCloud(id: string, name: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await enqueue({
    kind: "panel-name",
    userId,
    recordId: id,
    name,
  });
}

async function pushDeleteToCloud(id: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await enqueue({
    kind: "panel-delete",
    userId,
    recordId: id,
  });
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  entries: loadHistory(),

  add: (entry) => {
    const id = newId();
    // Image lourde → IndexedDB ; panel stocké/synchronisé sans l'image (léger)
    savePanelImage(id, entry.panel.imageBase64);
    let created: HistoryEntry | null = null;
    set((state) => {
      const newEntry: HistoryEntry = {
        ...entry,
        panel: stripImage(entry.panel),
        id,
        timestamp: Date.now(),
        breakerCount: countBreakers(entry.panel),
        rowCount: entry.panel.rows.length,
      };
      created = newEntry;
      const next = [newEntry, ...state.entries].slice(0, MAX_ENTRIES);
      saveHistory(next);
      return { entries: next };
    });
    if (created) pushEntryToCloud(created);
    return id;
  },

  update: (id, panel) => {
    // Met à jour l'image en cache si présente
    savePanelImage(id, panel.imageBase64);
    const stripped = stripImage(panel);
    set((state) => {
      let changed = false;
      const next = state.entries.map((e) => {
        if (e.id !== id) return e;
        changed = true;
        return {
          ...e,
          panel: stripped,
          timestamp: Date.now(),
          breakerCount: countBreakers(stripped),
          rowCount: stripped.rows.length,
        };
      });
      if (!changed) return state;
      saveHistory(next);
      pushUpdateToCloud(id, stripped);
      return { entries: next };
    });
  },

  remove: (id) =>
    set((state) => {
      const next = state.entries.filter((e) => e.id !== id);
      saveHistory(next);
      idbDel(`pimg-${id}`).catch(() => {});
      pushDeleteToCloud(id);
      return { entries: next };
    }),

  clear: () => {
    const ids = get().entries.map((e) => e.id);
    saveHistory([]);
    set({ entries: [] });
    ids.forEach((id) => pushDeleteToCloud(id));
  },

  rename: (id, name) =>
    set((state) => {
      const next = state.entries.map((e) => (e.id === id ? { ...e, name } : e));
      saveHistory(next);
      pushNameToCloud(id, name);
      return { entries: next };
    }),

  refreshFromCloud: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      const cloud = await fetchAllPanels(userId);
      const sorted = cloud.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_ENTRIES);
      saveHistory(sorted);
      set({ entries: sorted });
    } catch (err) {
      console.warn("[historyStore] refresh failed:", err);
    }
  },

  clearLocal: () => {
    saveHistory([]);
    set({ entries: [] });
  },
}));

// Crée une miniature JPEG réduite depuis un base64 — évite de saturer localStorage
export async function createThumbnail(
  base64: string,
  mimeType: string,
  maxSize = 300,
): Promise<string | undefined> {
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.6).replace(/^data:.+;base64,/, ""));
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = `data:${mimeType};base64,${base64}`;
    });
  } catch {
    return undefined;
  }
}
