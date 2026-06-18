// Types du module de gestion de stock matériel (dépôt + camion).
// Principe de cohérence : le STOCK FAIT FOI = somme signée des mouvements.
// quantite_stock sur l'article est un cache recalculé depuis le journal des
// mouvements (utile pour l'affichage et la résolution de conflit offline).

export type ArticleCategory =
  | "protection"
  | "cable"
  | "appareillage"
  | "conduit_goulotte"
  | "boite_coffret"
  | "accessoire"
  | "consommable"
  | "autre";

export type ArticleUnit = "piece" | "metre" | "rouleau" | "boite" | "sachet";

export type Emplacement = "camion" | "depot";

export type MovementType = "entree" | "sortie" | "ajustement";

export type MovementSource = "manuel" | "scan";

export interface Article {
  id: string;
  nom: string;
  categorie: ArticleCategory;
  reference?: string | null;
  code_barres?: string | null;
  unite: ArticleUnit;
  /** Cache = somme des mouvements. Recalculé au chargement / sur conflit. */
  quantite_stock: number;
  /** En dessous (<=) → article "à racheter". null = pas d'alerte. */
  seuil_alerte?: number | null;
  emplacement?: Emplacement | null;
  prix_unitaire_ht?: number | null;
  fournisseur?: string | null;
  /** Vignette base64 optionnelle (réutilise le scanner caméra). */
  photo?: string | null;
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StockMovement {
  id: string;
  article_id: string;
  type: MovementType;
  /**
   * Quantité du mouvement. entree/sortie : magnitude positive (le signe vient
   * du type). ajustement : delta signé pour atteindre la valeur recomptée.
   */
  quantite: number;
  /** Epoch ms */
  date: number;
  note?: string | null;
  source: MovementSource;
}

// Libellés FR pour l'UI (catégories / unités)
export const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  protection: "Protection",
  cable: "Câble",
  appareillage: "Appareillage",
  conduit_goulotte: "Conduit / goulotte",
  boite_coffret: "Boîte / coffret",
  accessoire: "Accessoire",
  consommable: "Consommable",
  autre: "Autre",
};

export const UNIT_LABELS: Record<ArticleUnit, string> = {
  piece: "pièce",
  metre: "mètre",
  rouleau: "rouleau",
  boite: "boîte",
  sachet: "sachet",
};

export const EMPLACEMENT_LABELS: Record<Emplacement, string> = {
  camion: "Camion",
  depot: "Dépôt",
};

// Contribution signée d'un mouvement au stock.
export function movementDelta(m: StockMovement): number {
  switch (m.type) {
    case "entree":
      return Math.abs(m.quantite);
    case "sortie":
      return -Math.abs(m.quantite);
    case "ajustement":
      return m.quantite; // déjà signé
  }
}

// Stock = somme signée des mouvements (source de vérité).
export function computeStock(movements: StockMovement[]): number {
  return movements.reduce((s, m) => s + movementDelta(m), 0);
}

// true si l'article est sous (ou à) son seuil d'alerte.
export function isLowStock(a: Article): boolean {
  return !a.archived && a.seuil_alerte != null && a.quantite_stock <= a.seuil_alerte;
}
