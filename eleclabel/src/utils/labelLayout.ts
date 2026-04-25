// Calcul du layout d'étiquettes — positionnement et largeurs en pôles
import type { Breaker, PanelRow, PoleWidth } from "../types/panel";

// Retourne les disjoncteurs d'une rangée triés par position
export function computeRowLayout(row: PanelRow): Breaker[] {
  return [...row.breakers].sort((a, b) => a.position - b.position);
}

// Retourne la largeur CSS en pourcentage pour un disjoncteur selon son nombre de pôles
export function getSlotWidth(poles: PoleWidth, totalSlots: number): string {
  const percent = (poles / totalSlots) * 100;
  return `${percent.toFixed(4)}%`;
}
