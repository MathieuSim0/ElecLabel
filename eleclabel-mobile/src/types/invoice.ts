// Types partagés pour la fonction "factures"
// Une facture = 1 image (la photo prise/uploadée) + métadonnées (extraites par OCR ou saisies à la main).

export interface Invoice {
  id: string;
  /** Timestamp de création (epoch ms) — sert au tri et au classement par mois */
  createdAt: number;
  /** Image source en base64 (sans préfixe data:) — stockée dans IndexedDB */
  imageBase64: string;
  imageMimeType: string;
  /** Miniature 300px JPEG base64 pour les listes */
  thumbnail?: string;
  /** Date de la facture (au format ISO yyyy-mm-dd) — extraite par OCR ou saisie */
  invoiceDate?: string;
  /** Nom du fournisseur */
  supplier?: string;
  /** Numéro de facture (référence) */
  reference?: string;
  /** Montant TTC en centimes (pour éviter les flottants) */
  amountCents?: number;
  /** Notes libres */
  notes?: string;
  /** Texte brut extrait par l'OCR — debug, audit, ré-extraction */
  ocrRawText?: string;
  /** L'utilisateur a vérifié/corrigé les champs : passe à true */
  reviewed?: boolean;
}

/** Métadonnées éditables extraites par l'OCR — partiel par nature */
export interface InvoiceMetadata {
  invoiceDate?: string;
  supplier?: string;
  reference?: string;
  amountCents?: number;
  notes?: string;
}

/** Formate un montant centimes en chaîne lisible "142,50 €" */
export function formatAmount(cents: number | undefined): string {
  if (cents === undefined || cents === null) return "";
  const euros = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(euros);
}

/** Convertit "142,50" ou "142.50" en centimes (14250). Retourne undefined si invalide. */
export function parseAmount(input: string): number | undefined {
  const cleaned = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return undefined;
  const m = cleaned.match(/^-?\d+(?:\.\d{1,2})?$/);
  if (!m) return undefined;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Clé YYYY-MM pour grouper par mois — basée sur invoiceDate si dispo, sinon createdAt */
export function monthKey(invoice: Invoice): string {
  const d = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date(invoice.createdAt);
  if (isNaN(d.getTime())) return new Date(invoice.createdAt).toISOString().slice(0, 7);
  return d.toISOString().slice(0, 7);
}

/** Nom de mois lisible : "Mai 2026" depuis "2026-05" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    .replace(/^./, (c) => c.toUpperCase());
}
