// Types TypeScript partagés pour le modèle de données du tableau électrique

export type PoleWidth = 1 | 2 | 3 | 4;

// ── Champs techniques structurés (convention : null/undefined = inconnu) ──
// Jamais de valeur par défaut inventée : un champ non détecté/non saisi reste null.
export type ModuleType =
  | "disjoncteur"
  | "interrupteur_differentiel"
  | "agcp"
  | "parafoudre"
  | "autre";
export type DdrType = "A" | "AC" | "F" | "B";
export type CircuitType = "eclairage" | "prises" | "specialise" | "chauffage" | "autre";

export interface Breaker {
  id: string;
  row: number;
  position: number;
  poles: PoleWidth;
  label: string;
  sublabel?: string;
  /** Emoji explicite choisi via le LabelPicker. Si absent, getCircuitIcon(label) sert de fallback. */
  icon?: string;
  /** true si le label a été suggéré automatiquement (IA n'a pas pu le lire) */
  suggested?: boolean;

  // ── Champs techniques (tous nullable, rétrocompatibles) ──
  /** Nature du module. null = inconnu. */
  type?: ModuleType | null;
  /** Ampérage du calibre (16, 20, 32…). null = inconnu. */
  calibre_A?: number | null;
  /** Type de différentiel — uniquement si type = "interrupteur_differentiel". */
  ddr_type?: DdrType | null;
  /** Sensibilité d'un différentiel en mA (30, 300, 500). */
  sensibilite_mA?: number | null;
  /** Usage du circuit protégé. null = inconnu. */
  circuit_type?: CircuitType | null;
}

export interface PanelRow {
  index: number;
  totalSlots: number;
  breakers: Breaker[];
}

// Métadonnées chantier/client imprimées en en-tête du PDF
export interface ProjectMeta {
  clientName?: string;  // nom du client
  address?: string;     // adresse du chantier
  quoteNumber?: string; // numéro de devis / affaire
  date?: string;        // date d'intervention (format libre)
  notes?: string;       // mention libre (ex: "Tableau garage")
}

// Version du modèle de données. Incrémentée quand la forme du Panel évolue,
// pour piloter d'éventuelles migrations best-effort à la lecture.
//   v2 : champs techniques structurés sur Breaker (type, calibre_A, ddr_type…).
export const MODEL_VERSION = 2;

export interface Panel {
  rows: PanelRow[];
  imageBase64?: string;
  project?: ProjectMeta;
  /** Version du modèle ayant produit/migré ce panel. Absent = legacy (< 2). */
  version?: number;
}
