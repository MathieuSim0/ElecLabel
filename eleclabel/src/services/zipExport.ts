// Génère un ZIP contenant N PDFs facture — à envoyer à la comptable en un coup.
// Utilise JSZip (gratuit, MIT) — fonctionne en navigateur et WebView Capacitor.
import JSZip from "jszip";
import type { Invoice } from "../types/invoice";
import { generateInvoicePdfBlob, defaultInvoiceFilename } from "./pdfInvoice";

interface ProgressCallback {
  (current: number, total: number, label: string): void;
}

/**
 * Génère un Blob ZIP contenant 1 PDF par facture.
 * Le caller peut afficher la progression via `onProgress` (utile pour 50+ factures, peut prendre 30s).
 * Nommage : "2026-05-15_Schneider_142.50EUR.pdf" — utilisé pour le tri alpha dans l'archive.
 */
export async function generateInvoicesZip(
  invoices: Invoice[],
  onProgress?: ProgressCallback,
): Promise<Blob> {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];
    onProgress?.(i + 1, invoices.length, invoice.supplier ?? "Facture");
    const blob = await generateInvoicePdfBlob(invoice);
    // Évite les collisions de nom (2 factures même fournisseur même jour)
    let filename = defaultInvoiceFilename(invoice);
    let suffix = 2;
    while (usedNames.has(filename)) {
      const base = filename.replace(/\.pdf$/, "");
      filename = `${base}_${suffix}.pdf`;
      suffix++;
    }
    usedNames.add(filename);
    zip.file(filename, blob);
  }

  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 5 },
  });
}

/** Nom suggéré pour le ZIP d'un mois donné : "Factures_2026-05_Mai.zip" */
export function defaultZipFilenameForMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  if (!y || !m) return `Factures_${monthKey}.zip`;
  const monthName = new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString("fr-FR", { month: "long" })
    .replace(/^./, (c) => c.toUpperCase());
  return `Factures_${y}-${m}_${monthName}.zip`;
}
