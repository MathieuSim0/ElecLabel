// Service de sync avec Supabase pour factures et tableaux.
// Toutes les fonctions sont "fail-fast" : elles throw en cas d'erreur réseau,
// c'est aux appelants de catcher pour rester offline-friendly.
import { supabase } from "./supabase";
import type { Invoice } from "../types/invoice";
import type { HistoryEntry, HistorySource } from "../store/historyStore";
import type { Panel } from "../types/panel";

const PHOTOS_BUCKET = "invoices";

// ════════════════════════════════════════════════════════════════════
// Helpers conversion
// ════════════════════════════════════════════════════════════════════

function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r !== "string") return reject(new Error("FileReader failed"));
      const idx = r.indexOf(",");
      resolve(idx >= 0 ? r.slice(idx + 1) : r);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function extFromMime(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

// ════════════════════════════════════════════════════════════════════
// PHOTOS FACTURES — Storage bucket "invoices"
// Path convention : {user_id}/{invoice_id}.{ext}
// ════════════════════════════════════════════════════════════════════

export async function uploadInvoicePhoto(
  userId: string,
  invoiceId: string,
  base64: string,
  mime: string,
): Promise<string> {
  const path = `${userId}/${invoiceId}.${extFromMime(mime)}`;
  const blob = base64ToBlob(base64, mime);
  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, blob, { contentType: mime, upsert: true });
  if (error) throw error;
  return path;
}

export async function downloadInvoicePhoto(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).download(path);
  if (error) throw error;
  return blobToBase64(data);
}

async function deleteInvoicePhotos(userId: string, invoiceId: string): Promise<void> {
  // On essaie les extensions possibles : ne lève pas d'erreur si fichier absent.
  const paths = ["jpg", "png", "webp"].map((ext) => `${userId}/${invoiceId}.${ext}`);
  await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
}

// ════════════════════════════════════════════════════════════════════
// FACTURES — table "invoices"
// ════════════════════════════════════════════════════════════════════

interface InvoiceRow {
  id: string;
  user_id: string;
  supplier: string | null;
  invoice_date: string | null;
  reference: string | null;
  amount_cents: number | null;
  notes: string | null;
  ocr_raw_text: string | null;
  reviewed: boolean;
  thumbnail: string | null;
  image_storage_path: string | null;
  image_mime_type: string;
  created_at: string;
  updated_at: string;
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    imageBase64: "",   // ← lazy : la photo HD n'est chargée qu'à la demande
    imageMimeType: row.image_mime_type,
    thumbnail: row.thumbnail ?? undefined,
    invoiceDate: row.invoice_date ?? undefined,
    supplier: row.supplier ?? undefined,
    reference: row.reference ?? undefined,
    amountCents: row.amount_cents ?? undefined,
    notes: row.notes ?? undefined,
    ocrRawText: row.ocr_raw_text ?? undefined,
    reviewed: row.reviewed,
  };
}

/**
 * Push une facture vers Supabase (upsert) :
 *  - upload la photo dans Storage si fournie (imageBase64 non vide)
 *  - upsert la ligne metadata
 */
export async function pushInvoice(invoice: Invoice, userId: string): Promise<void> {
  let imagePath: string | null = null;
  if (invoice.imageBase64 && invoice.imageBase64.length > 0) {
    imagePath = await uploadInvoicePhoto(userId, invoice.id, invoice.imageBase64, invoice.imageMimeType);
  }
  const row = {
    id: invoice.id,
    user_id: userId,
    supplier: invoice.supplier ?? null,
    invoice_date: invoice.invoiceDate ?? null,
    reference: invoice.reference ?? null,
    amount_cents: invoice.amountCents ?? null,
    notes: invoice.notes ?? null,
    ocr_raw_text: invoice.ocrRawText ?? null,
    reviewed: invoice.reviewed ?? false,
    thumbnail: invoice.thumbnail ?? null,
    image_storage_path: imagePath,
    image_mime_type: invoice.imageMimeType,
    created_at: new Date(invoice.createdAt).toISOString(),
  };
  const { error } = await supabase.from("invoices").upsert(row);
  if (error) throw error;
}

/** Push uniquement la metadata (pas de re-upload photo) — utilisé sur les éditions */
export async function pushInvoiceMetadata(invoice: Invoice, userId: string): Promise<void> {
  const { error } = await supabase
    .from("invoices")
    .update({
      supplier: invoice.supplier ?? null,
      invoice_date: invoice.invoiceDate ?? null,
      reference: invoice.reference ?? null,
      amount_cents: invoice.amountCents ?? null,
      notes: invoice.notes ?? null,
      reviewed: invoice.reviewed ?? false,
    })
    .eq("id", invoice.id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function pushDeleteInvoice(invoiceId: string, userId: string): Promise<void> {
  await deleteInvoicePhotos(userId, invoiceId);
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) throw error;
}

/**
 * Récupère TOUTES les factures de l'utilisateur — sans les photos HD (juste metadata + thumbnails).
 * La photo HD est téléchargée à la demande via fetchInvoicePhoto.
 */
export async function fetchAllInvoices(userId: string): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data) return [];
  return (data as InvoiceRow[]).map(rowToInvoice);
}

/** Télécharge la photo HD d'une facture depuis Storage */
export async function fetchInvoicePhoto(userId: string, invoiceId: string, mime: string): Promise<string> {
  const path = `${userId}/${invoiceId}.${extFromMime(mime)}`;
  return downloadInvoicePhoto(path);
}

// ════════════════════════════════════════════════════════════════════
// TABLEAUX — table "panels"
// (panel_data en JSONB inclut imageBase64 → on stocke tout dans la table,
//  pas de Storage séparé pour ce volume moindre)
// ════════════════════════════════════════════════════════════════════

interface PanelRow {
  id: string;
  user_id: string;
  name: string;
  source: string;
  panel_data: Panel;
  thumbnail: string | null;
  breaker_count: number;
  row_count: number;
  created_at: string;
  updated_at: string;
}

function rowToHistoryEntry(row: PanelRow): HistoryEntry {
  return {
    id: row.id,
    name: row.name,
    timestamp: new Date(row.created_at).getTime(),
    panel: row.panel_data,
    thumbnail: row.thumbnail ?? undefined,
    source: row.source as HistorySource,
    breakerCount: row.breaker_count,
    rowCount: row.row_count,
  };
}

export async function pushPanel(entry: HistoryEntry, userId: string): Promise<void> {
  const row = {
    id: entry.id,
    user_id: userId,
    name: entry.name,
    source: entry.source,
    panel_data: entry.panel,
    thumbnail: entry.thumbnail ?? null,
    breaker_count: entry.breakerCount,
    row_count: entry.rowCount,
    created_at: new Date(entry.timestamp).toISOString(),
  };
  const { error } = await supabase.from("panels").upsert(row);
  if (error) throw error;
}

/** Met à jour le panel d'une entrée existante (auto-save depuis l'éditeur) */
export async function pushPanelData(
  entryId: string,
  userId: string,
  panel: Panel,
  breakerCount: number,
  rowCount: number,
): Promise<void> {
  const { error } = await supabase
    .from("panels")
    .update({
      panel_data: panel,
      breaker_count: breakerCount,
      row_count: rowCount,
    })
    .eq("id", entryId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function pushPanelName(entryId: string, userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("panels")
    .update({ name })
    .eq("id", entryId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function pushDeletePanel(entryId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("panels")
    .delete()
    .eq("id", entryId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function fetchAllPanels(userId: string): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from("panels")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data) return [];
  return (data as PanelRow[]).map(rowToHistoryEntry);
}

// ════════════════════════════════════════════════════════════════════
// Helper : récupère l'user_id courant (ou null si pas auth)
// ════════════════════════════════════════════════════════════════════

export async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}
