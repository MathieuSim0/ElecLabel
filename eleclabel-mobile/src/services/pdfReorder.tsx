// Génère un PDF A4 "liste de réappro" (articles à racheter) ou l'inventaire complet.
// Réutilise @react-pdf/renderer comme les factures et les étiquettes.
import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import { type Article, CATEGORY_LABELS, UNIT_LABELS } from "../types/stock";

const A4_WIDTH = 595;
const MARGIN = 28;

const styles = StyleSheet.create({
  page: { width: A4_WIDTH, padding: MARGIN, backgroundColor: "#FFFFFF", fontFamily: "Helvetica", fontSize: 9 },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  sub: { fontSize: 9, color: "#555555", marginBottom: 12 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#CCCCCC", borderBottomStyle: "solid", paddingVertical: 5 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#000000", borderBottomStyle: "solid", paddingBottom: 5, marginTop: 4 },
  hcell: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#000000" },
  cell: { fontSize: 9, color: "#222222" },
  cNom: { width: "30%", paddingRight: 4 },
  cCat: { width: "16%", paddingRight: 4 },
  cRef: { width: "16%", paddingRight: 4 },
  cStock: { width: "12%", textAlign: "right", paddingRight: 4 },
  cSeuil: { width: "10%", textAlign: "right", paddingRight: 4 },
  cCmd: { width: "16%", textAlign: "right", fontFamily: "Helvetica-Bold" },
  footer: { position: "absolute", bottom: 16, left: MARGIN, right: MARGIN, fontSize: 7, color: "#999999", textAlign: "center" },
  empty: { fontSize: 11, color: "#777777", marginTop: 20, textAlign: "center" },
});

function toOrder(a: Article): number {
  if (a.seuil_alerte == null) return 0;
  return Math.max(0, a.seuil_alerte - a.quantite_stock);
}

interface Opts {
  mode?: "reappro" | "full";
  title?: string;
}

function ReorderDoc({ articles, opts }: { articles: Article[]; opts: Opts }) {
  const mode = opts.mode ?? "reappro";
  const title = opts.title ?? (mode === "reappro" ? "Liste de réapprovisionnement" : "Inventaire matériel");
  const date = new Date().toLocaleDateString("fr-FR");
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          ElecLabel · {date} · {articles.length} article{articles.length > 1 ? "s" : ""}
        </Text>

        <View style={styles.head}>
          <Text style={[styles.hcell, styles.cNom]}>Article</Text>
          <Text style={[styles.hcell, styles.cCat]}>Catégorie</Text>
          <Text style={[styles.hcell, styles.cRef]}>Réf. / fourn.</Text>
          <Text style={[styles.hcell, styles.cStock]}>Stock</Text>
          <Text style={[styles.hcell, styles.cSeuil]}>Seuil</Text>
          <Text style={[styles.hcell, styles.cCmd]}>{mode === "reappro" ? "À cmder" : "Unité"}</Text>
        </View>

        {articles.length === 0 ? (
          <Text style={styles.empty}>Aucun article à racheter.</Text>
        ) : (
          articles.map((a) => (
            <View key={a.id} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.cNom]}>{a.nom}</Text>
              <Text style={[styles.cell, styles.cCat]}>{CATEGORY_LABELS[a.categorie]}</Text>
              <Text style={[styles.cell, styles.cRef]}>{[a.reference, a.fournisseur].filter(Boolean).join(" / ") || "—"}</Text>
              <Text style={[styles.cell, styles.cStock]}>{a.quantite_stock} {UNIT_LABELS[a.unite]}</Text>
              <Text style={[styles.cell, styles.cSeuil]}>{a.seuil_alerte ?? "—"}</Text>
              <Text style={[styles.cell, styles.cCmd]}>
                {mode === "reappro" ? `${toOrder(a)} ${UNIT_LABELS[a.unite]}` : UNIT_LABELS[a.unite]}
              </Text>
            </View>
          ))
        )}

        <Text style={styles.footer} fixed>Généré par ElecLabel — Alain Simon Électricité</Text>
      </Page>
    </Document>
  );
}

export async function generateReorderPdfBlob(articles: Article[], opts: Opts = {}): Promise<Blob> {
  return pdf(<ReorderDoc articles={articles} opts={opts} />).toBlob();
}

export function defaultReorderFilename(mode: "reappro" | "full" = "reappro"): string {
  const d = new Date().toISOString().slice(0, 10);
  return mode === "reappro" ? `reappro-${d}.pdf` : `inventaire-${d}.pdf`;
}
