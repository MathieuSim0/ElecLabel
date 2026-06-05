// Génère un PDF A4 propre pour une facture : en-tête metadata + image plein cadre.
// Utilise @react-pdf/renderer (déjà présent pour les étiquettes).
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import type { Invoice } from "../types/invoice";
import { formatAmount } from "../types/invoice";

// A4 portrait en points (72 dpi) : 595 × 842 pt
const A4_WIDTH = 595;
const A4_HEIGHT = 842;
const MARGIN = 28; // ~10 mm

const styles = StyleSheet.create({
  page: {
    width: A4_WIDTH,
    height: A4_HEIGHT,
    padding: MARGIN,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  header: {
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    borderBottomStyle: "solid",
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    marginBottom: 5,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginTop: 3,
  },
  metaItem: {
    fontSize: 9,
    color: "#333333",
  },
  metaLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
  },
  imageWrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
  },
  footer: {
    fontSize: 7,
    color: "#9CA3AF",
    textAlign: "right",
    marginTop: 6,
  },
});

interface InvoicePdfProps {
  invoice: Invoice;
}

export function InvoiceDocument({ invoice }: InvoicePdfProps) {
  const hasMeta = Boolean(
    invoice.supplier || invoice.invoiceDate || invoice.reference || invoice.amountCents,
  );
  const title = invoice.supplier?.trim() || "Facture";
  const generatedAt = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {hasMeta ? (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={styles.metaRow}>
              {invoice.invoiceDate ? (
                <Text style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Date : </Text>
                  {formatInvoiceDate(invoice.invoiceDate)}
                </Text>
              ) : null}
              {invoice.reference ? (
                <Text style={styles.metaItem}>
                  <Text style={styles.metaLabel}>N° : </Text>
                  {invoice.reference}
                </Text>
              ) : null}
              {invoice.amountCents !== undefined ? (
                <Text style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Montant : </Text>
                  {formatAmount(invoice.amountCents)}
                </Text>
              ) : null}
              {invoice.notes && invoice.notes.trim() ? (
                <Text style={styles.metaItem}>{invoice.notes.trim()}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.imageWrap}>
          <Image
            src={`data:${invoice.imageMimeType};base64,${invoice.imageBase64}`}
            style={styles.image}
          />
        </View>

        <Text style={styles.footer}>Généré par ElecLabel le {generatedAt}</Text>
      </Page>
    </Document>
  );
}

/** Génère le Blob PDF d'une facture */
export async function generateInvoicePdfBlob(invoice: Invoice): Promise<Blob> {
  return pdf(<InvoiceDocument invoice={invoice} />).toBlob();
}

/** Nom de fichier propre : "2026-05-15_Schneider_142.50EUR.pdf" */
export function defaultInvoiceFilename(invoice: Invoice): string {
  const date = invoice.invoiceDate
    ? invoice.invoiceDate
    : new Date(invoice.createdAt).toISOString().slice(0, 10);
  const supplier = (invoice.supplier ?? "Facture")
    .replace(/[^a-zA-Z0-9À-ÿ\s\-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30);
  const amount = invoice.amountCents !== undefined
    ? `_${(invoice.amountCents / 100).toFixed(2).replace(".", ",")}EUR`
    : "";
  const ref = invoice.reference ? `_${invoice.reference.replace(/[^a-zA-Z0-9\-]/g, "")}` : "";
  return `${date}_${supplier}${ref}${amount}.pdf`;
}

function formatInvoiceDate(iso: string): string {
  // "2026-05-15" → "15/05/2026"
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
