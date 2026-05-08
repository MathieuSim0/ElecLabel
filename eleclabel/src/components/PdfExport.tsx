// Composant react-pdf pour la génération du document A4 prêt à découper
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { Panel } from "../types/panel";
import { computeRowLayout } from "../utils/labelLayout";
import { getCircuitIcon } from "../utils/circuitIcons";
import { buildIconMap } from "../utils/emojiCanvas";
import {
  getLabelWidthPt,
  mmToPt,
  DEFAULT_LABEL_HEIGHT_MM,
  PAGE_MARGIN_PT,
  PAGE_WIDTH_PT,
  PAGE_HEIGHT_PT,
} from "../utils/pdfLayout";

// Tailles spec (calibrées pour la hauteur de référence 35mm)
const REF_HEIGHT_MM = 35;
const REF_LABEL_FONT_SHORT = 8;     // ≤ 8 caractères
const REF_LABEL_FONT_MEDIUM = 7;    // 9–12 caractères
const REF_LABEL_FONT_LONG = 6;      // > 12 caractères
const REF_SUBLABEL_FONT = 6.5;
const REF_ICON_SIZE_PT = 10;
const PADDING_HORIZONTAL_MM = 3;
const PADDING_VERTICAL_MM = 2;

// Sélection de police selon la longueur du label, scalée par la hauteur réelle
function labelFontFor(label: string, heightMm: number): number {
  const base =
    label.length > 12 ? REF_LABEL_FONT_LONG :
    label.length > 8  ? REF_LABEL_FONT_MEDIUM :
                        REF_LABEL_FONT_SHORT;
  const scale = Math.min(1, heightMm / REF_HEIGHT_MM);
  return Math.max(4, base * scale);
}
function sublabelFontFor(heightMm: number): number {
  return Math.max(3.5, REF_SUBLABEL_FONT * Math.min(1, heightMm / REF_HEIGHT_MM));
}
function iconSizeFor(heightMm: number): number {
  // Capé à 10pt et jamais plus grand qu'un tiers de la hauteur d'étiquette
  const heightPt = mmToPt(heightMm);
  return Math.min(REF_ICON_SIZE_PT, heightPt * 0.3);
}

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH_PT,
    height: PAGE_HEIGHT_PT,
    paddingTop: PAGE_MARGIN_PT,
    paddingBottom: PAGE_MARGIN_PT,
    paddingLeft: PAGE_MARGIN_PT,
    paddingRight: PAGE_MARGIN_PT,
    backgroundColor: "#FFFFFF",
    fontFamily: "Helvetica",
  },
  header: {
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    borderBottomStyle: "solid",
  },
  headerTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    marginBottom: 3,
  },
  headerMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  headerMeta: {
    fontSize: 8,
    fontFamily: "Helvetica",
    color: "#333333",
  },
  headerMetaLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
  },
  row: {
    flexDirection: "row",
    marginBottom: 2,
  },
  cutLine: {
    borderBottomWidth: 0.3,
    borderBottomColor: "#CCCCCC",
    borderBottomStyle: "dashed",
    marginBottom: 2,
  },
  cell: {
    borderWidth: 0.8,
    borderColor: "#000000",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
});

interface PdfDocumentProps {
  panel: Panel;
  iconMap: Record<string, string>;
  /** Hauteur d'étiquette en mm — choisie par l'utilisateur dans la prévisualisation */
  labelHeightMm?: number;
}

function hasProjectHeader(panel: Panel): boolean {
  const p = panel.project;
  if (!p) return false;
  return Boolean(
    (p.clientName && p.clientName.trim()) ||
      (p.address && p.address.trim()) ||
      (p.quoteNumber && p.quoteNumber.trim()) ||
      (p.date && p.date.trim()) ||
      (p.notes && p.notes.trim()),
  );
}

export function PdfDocument({
  panel,
  iconMap,
  labelHeightMm = DEFAULT_LABEL_HEIGHT_MM,
}: PdfDocumentProps) {
  const showHeader = hasProjectHeader(panel);
  const p = panel.project;
  const labelHeightPt = mmToPt(labelHeightMm);
  const padHPt = mmToPt(PADDING_HORIZONTAL_MM);
  const padVPt = mmToPt(PADDING_VERTICAL_MM);
  const iconSize = iconSizeFor(labelHeightMm);
  const sublabelFont = sublabelFontFor(labelHeightMm);
  // Seuils d'affichage : sous une certaine hauteur, on enlève l'icône puis le sublabel
  const showIcon = labelHeightPt >= 28;
  const showSublabelGlobal = labelHeightPt >= 20;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {showHeader && p ? (
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {p.clientName && p.clientName.trim() ? p.clientName.trim() : "Tableau électrique"}
            </Text>
            <View style={styles.headerMetaRow}>
              {p.address && p.address.trim() ? (
                <Text style={styles.headerMeta}>
                  <Text style={styles.headerMetaLabel}>Adresse : </Text>
                  {p.address.trim()}
                </Text>
              ) : null}
              {p.quoteNumber && p.quoteNumber.trim() ? (
                <Text style={styles.headerMeta}>
                  <Text style={styles.headerMetaLabel}>Devis n° </Text>
                  {p.quoteNumber.trim()}
                </Text>
              ) : null}
              {p.date && p.date.trim() ? (
                <Text style={styles.headerMeta}>
                  <Text style={styles.headerMetaLabel}>Date : </Text>
                  {p.date.trim()}
                </Text>
              ) : null}
              {p.notes && p.notes.trim() ? (
                <Text style={styles.headerMeta}>
                  {p.notes.trim()}
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {panel.rows.map((row, rowIndex) => (
          <View key={row.index}>
            {rowIndex > 0 && <View style={styles.cutLine} />}

            <View style={styles.row}>
              {computeRowLayout(row).map((breaker) => {
                const icon = breaker.icon ?? getCircuitIcon(breaker.label);
                const iconSrc = iconMap[icon];
                const labelText = breaker.label || " ";
                const labelFont = labelFontFor(breaker.label, labelHeightMm);
                const showSublabel = showSublabelGlobal && Boolean(breaker.sublabel);
                return (
                  <View
                    key={breaker.id}
                    style={[
                      styles.cell,
                      {
                        width: getLabelWidthPt(breaker.poles),
                        height: labelHeightPt,
                        paddingHorizontal: padHPt,
                        paddingVertical: padVPt,
                      },
                    ]}
                  >
                    {/* Tout est wrappé dans un conteneur overflow:hidden */}
                    <View
                      style={{
                        flex: 1,
                        width: "100%",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      {showIcon && iconSrc ? (
                        <Image
                          src={iconSrc}
                          style={{
                            width: iconSize,
                            height: iconSize,
                            marginBottom: 1,
                          }}
                        />
                      ) : null}

                      <Text
                        style={{
                          fontSize: labelFont,
                          fontFamily: "Helvetica-Bold",
                          textAlign: "center",
                          color: "#000000",
                          lineHeight: 1.1,
                        }}
                      >
                        {labelText}
                      </Text>

                      {showSublabel ? (
                        <Text
                          style={{
                            fontSize: sublabelFont,
                            fontFamily: "Helvetica",
                            textAlign: "center",
                            color: "#444444",
                            marginTop: 1,
                            lineHeight: 1.05,
                          }}
                        >
                          {breaker.sublabel}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ))}
      </Page>
    </Document>
  );
}

// Génère un Blob PDF — pré-rend les icônes emoji avant d'appeler react-pdf
export async function generatePdfBlob(
  panel: Panel,
  labelHeightMm: number = DEFAULT_LABEL_HEIGHT_MM,
): Promise<Blob> {
  const icons = panel.rows.flatMap((row) =>
    row.breakers.map((b) => b.icon ?? getCircuitIcon(b.label)),
  );
  const iconMap = buildIconMap(icons);
  const blob = await pdf(
    <PdfDocument panel={panel} iconMap={iconMap} labelHeightMm={labelHeightMm} />,
  ).toBlob();
  return blob;
}

export default PdfDocument;
