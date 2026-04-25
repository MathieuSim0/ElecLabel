// Calcul du layout PDF A4 — dimensions et grille d'impression
import type { PoleWidth } from "../types/panel";

// Dimensions standard en millimètres
export const SLOT_WIDTH_MM = 18;             // Largeur d'un slot 1P (1,8 cm)
export const DEFAULT_LABEL_HEIGHT_MM = 35;   // Hauteur par défaut d'une étiquette (≈ standard cartouche DIN)
export const PAGE_MARGIN_MM = 10;            // Marges A4
export const PAGE_WIDTH_MM = 210;            // Largeur A4 portrait
export const PAGE_HEIGHT_MM = 297;           // Hauteur A4 portrait

// Hauteurs proposées dans le slider de prévisualisation (en mm)
export const LABEL_HEIGHT_PRESETS_MM: readonly number[] = [
  8, 10, 12, 15, 18, 20, 25, 30, 35, 40,
];

// Conversion mm → points PDF (1mm = 2.8346 pt)
export const MM_TO_PT = 2.8346;

// Retourne la largeur en mm d'une étiquette selon son nombre de pôles
export function getLabelWidthMm(poles: PoleWidth): number {
  return SLOT_WIDTH_MM * poles;
}

// Retourne la largeur en points PDF
export function getLabelWidthPt(poles: PoleWidth): number {
  return getLabelWidthMm(poles) * MM_TO_PT;
}

// Convertit une hauteur en mm vers points PDF
export function mmToPt(mm: number): number {
  return mm * MM_TO_PT;
}

export const PAGE_MARGIN_PT = PAGE_MARGIN_MM * MM_TO_PT;
export const PAGE_WIDTH_PT = PAGE_WIDTH_MM * MM_TO_PT;
export const PAGE_HEIGHT_PT = PAGE_HEIGHT_MM * MM_TO_PT;
