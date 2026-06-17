// Enrichissement best-effort des champs techniques d'un module à partir des
// libellés existants (migration des tableaux d'avant le modèle v2).
//
// Règles d'or :
//  - NON DESTRUCTIF : on ne remplit un champ que s'il est null/undefined.
//    Une valeur déjà présente (détectée par la Vision ou saisie) n'est jamais écrasée.
//  - PAS D'INVENTION : si rien n'est lisible dans le texte, le champ reste null.
//    On ne devine pas arbitrairement `type = "disjoncteur"`.
import type { Breaker, Panel, DdrType } from "../types/panel";
import { MODEL_VERSION } from "../types/panel";

// "16 A", "20A", "C16" → 16. Exclut les "30 mA" (le A est précédé de "m").
function extractCalibre(text: string): number | null {
  // Calibre précédé d'un éventuel "C"/"D" (courbe) ou autonome, suivi de A (ampères).
  const ampMatch = text.match(/\b[CD]?(\d{1,3})\s?A\b/i);
  if (ampMatch) {
    const v = Number(ampMatch[1]);
    if (v >= 1 && v <= 125) return v;
  }
  return null;
}

function extractSensibilite(text: string): number | null {
  const m = text.match(/(\d{2,3})\s?mA\b/i);
  if (m) {
    const v = Number(m[1]);
    if (v === 30 || v === 100 || v === 300 || v === 500) return v;
  }
  return null;
}

function extractDdrType(text: string): DdrType | null {
  // "type AC" doit être testé avant "type A" (sinon AC matché comme A).
  if (/type\s*ac\b/i.test(text)) return "AC";
  if (/type\s*a\b/i.test(text)) return "A";
  if (/type\s*f\b/i.test(text)) return "F";
  if (/type\s*b\b/i.test(text)) return "B";
  return null;
}

function looksLikeDifferential(text: string): boolean {
  return /diff[ée]rentiel|inter\.?\s*diff|\bid\b|\binter\s*dif|30\s?mA|300\s?mA/i.test(text);
}

function looksLikeAgcp(text: string): boolean {
  return /agcp|disjoncteur de branchement|disj\.?\s*branchement/i.test(text);
}

function looksLikeParafoudre(text: string): boolean {
  return /parafoudre|spd\b/i.test(text);
}

// Renvoie un module enrichi (copie) — n'écrase aucune valeur déjà présente.
export function enrichBreakerFromLabel(b: Breaker): Breaker {
  const text = `${b.label ?? ""} ${b.sublabel ?? ""}`.trim();
  if (!text) return b;

  const next: Breaker = { ...b };

  // type
  if (next.type == null) {
    if (looksLikeDifferential(text)) next.type = "interrupteur_differentiel";
    else if (looksLikeAgcp(text)) next.type = "agcp";
    else if (looksLikeParafoudre(text)) next.type = "parafoudre";
    // sinon : laissé null (on ne devine pas "disjoncteur" par défaut)
  }

  // ddr_type / sensibilité — pertinents pour un différentiel
  if (next.type === "interrupteur_differentiel" || looksLikeDifferential(text)) {
    if (next.ddr_type == null) {
      const d = extractDdrType(text);
      if (d) next.ddr_type = d;
    }
    if (next.sensibilite_mA == null) {
      const s = extractSensibilite(text);
      if (s) next.sensibilite_mA = s;
    }
  }

  // calibre
  if (next.calibre_A == null) {
    const c = extractCalibre(text);
    if (c) next.calibre_A = c;
  }

  return next;
}

// Pré-remplit la relation de protection (protege_par) par heuristique de départ.
// NON DESTRUCTIF : ne touche qu'aux modules dont protege_par est undefined
// (une valeur déjà saisie, y compris null = "Aucun", est conservée).
// Règle : dans CHAQUE rangée, gauche → droite, on mémorise le dernier
// interrupteur_differentiel vu ; chaque module suivant est protégé par lui.
// Aucun report d'une rangée à l'autre : tant qu'aucun différentiel n'a été vu
// dans la rangée, protege_par = null.
export function assignProtection(panel: Panel): Panel {
  return {
    ...panel,
    rows: panel.rows.map((row) => {
      let currentDiffId: string | null = null;
      return {
        ...row,
        breakers: row.breakers.map((b) => {
          const isDiff = b.type === "interrupteur_differentiel";
          // Le différentiel lui-même n'est pas protégé par un autre DDR ici.
          const proposed = isDiff ? null : currentDiffId;
          if (isDiff) currentDiffId = b.id;
          if (b.protege_par !== undefined) return b; // déjà saisi → on garde
          return { ...b, protege_par: proposed };
        }),
      };
    }),
  };
}

// Migre un panel entier vers le modèle courant (idempotent, non destructif).
// Sûr à appeler à chaque entrée dans le store : ne touche pas aux panels déjà à jour.
export function migratePanel(panel: Panel): Panel {
  if (panel.version === MODEL_VERSION) return panel;
  // 1. Enrichit les champs techniques (dont type) à partir des libellés.
  const enriched: Panel = {
    ...panel,
    rows: panel.rows.map((row) => ({
      ...row,
      breakers: row.breakers.map(enrichBreakerFromLabel),
    })),
  };
  // 2. Déduit la relation de protection une fois les types connus.
  const withProtection = assignProtection(enriched);
  return { ...withProtection, version: MODEL_VERSION };
}
