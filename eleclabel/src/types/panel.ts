// Types TypeScript partagés pour le modèle de données du tableau électrique

export type PoleWidth = 1 | 2 | 3 | 4;

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

export interface Panel {
  rows: PanelRow[];
  imageBase64?: string;
  project?: ProjectMeta;
}
