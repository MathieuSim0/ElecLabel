// Suggestions de labels intelligentes basées sur (pôles + ampérage)
// Applique les conventions françaises NF C 15-100
import type { Breaker, Panel, PoleWidth } from "../types/panel";

interface SuggestionRule {
  poles: PoleWidth;
  amp: number;
  primary: string;        // suggestion principale (unique)
  pool?: string[];        // alternatives si plusieurs disjoncteurs même (poles, amp)
}

// Pool large pour 1P : tous les circuits typiques d'un logement
// Mixe prises / éclairage / appareils pour éviter la monotonie visuelle
const POOL_1P_GENERIC = [
  "Éclairage séjour", "Prises séjour",
  "Éclairage cuisine", "Prises cuisine",
  "Éclairage chambre 1", "Prises chambre 1",
  "Éclairage chambre 2", "Prises chambre 2",
  "Éclairage chambre 3", "Prises chambre 3",
  "Éclairage SdB", "Prises SdB",
  "Éclairage WC", "Éclairage couloir",
  "Éclairage entrée", "Éclairage escalier",
  "Éclairage garage", "Prises garage",
  "Éclairage extérieur", "Prises extérieur",
  "Éclairage cave", "Prises bureau",
  "Réfrigérateur", "Lave-vaisselle",
  "Lave-linge", "Sèche-linge",
  "Four", "Micro-ondes",
  "Hotte", "Congélateur",
  "TV / Multimédia", "Box internet",
  "Chaudière", "VMC",
  "Sonnette", "Alarme",
  "Interphone", "Portail",
  "Volets roulants",
];

// Table des suggestions par convention. Pools élargis pour limiter les doublons.
const RULES: SuggestionRule[] = [
  // Tétrapolaire (3P + N)
  { poles: 4, amp: 63, primary: "Général 4P",       pool: ["Général 4P", "Arrivée 3P+N", "Disjoncteur principal 4P", "Inter général 4P"] },
  { poles: 4, amp: 40, primary: "Différentiel 4P",  pool: ["Différentiel 4P", "Diff. type A 4P 40A", "Diff. type AC 4P 40A", "Inter différentiel 4P"] },
  { poles: 4, amp: 32, primary: "Borne IRVE",       pool: ["Borne IRVE 4P", "Recharge VE 4P", "Plaque triphasée + N", "Moteur 4P"] },
  { poles: 4, amp: 25, primary: "Pompe à chaleur",  pool: ["Pompe à chaleur 4P", "Climatisation 4P", "Four triphasé"] },
  { poles: 4, amp: 20, primary: "Moteur 4P",        pool: ["Moteur 4P", "Atelier 4P", "Compresseur 4P", "Pompe 4P"] },

  // Triphasé
  { poles: 3, amp: 63, primary: "Général 3P",       pool: ["Général 3P", "Arrivée triphasée"] },
  { poles: 3, amp: 32, primary: "Plaque triphasée", pool: ["Plaque triphasée", "Four triphasé", "Moteur 3P"] },
  { poles: 3, amp: 20, primary: "Moteur",           pool: ["Moteur", "Pompe", "Atelier", "Compresseur"] },

  // 2P — protections et gros appareils
  { poles: 2, amp: 63, primary: "Général",      pool: ["Général", "Interrupteur général", "Arrivée"] },
  { poles: 2, amp: 40, primary: "Différentiel", pool: ["Différentiel 40A", "Diff. type A 40A", "Diff. type AC 40A", "Diff. type Hpi 40A"] },
  { poles: 2, amp: 30, primary: "Différentiel", pool: ["Différentiel 30mA", "Diff. type A 30mA", "Diff. type AC 30mA", "Diff. type Hpi"] },
  { poles: 2, amp: 32, primary: "Cuisinière",   pool: ["Cuisinière", "Plaque induction", "Four + plaque"] },
  { poles: 2, amp: 25, primary: "Chauffe-eau",  pool: ["Chauffe-eau", "Ballon eau chaude", "Cumulus"] },
  { poles: 2, amp: 20, primary: "Chauffe-eau",  pool: ["Chauffe-eau", "Lave-linge", "Sèche-linge", "Climatisation", "Pompe à chaleur", "Four", "Lave-vaisselle"] },
  { poles: 2, amp: 16, primary: "Chauffage",    pool: ["Chauffage principal", "Radiateur", "Convecteur", "Plancher chauffant"] },
  { poles: 2, amp: 10, primary: "Chauffage",    pool: ["Radiateur SdB", "Sèche-serviettes", "Chauffage d'appoint"] },

  // 1P — circuits classiques
  { poles: 1, amp: 32, primary: "Plaque cuisson", pool: ["Plaque cuisson", "Cuisson", "Plaque induction"] },
  { poles: 1, amp: 20, primary: "Four",          pool: ["Four", "Lave-vaisselle", "Lave-linge", "Sèche-linge", "Prises cuisine", "Micro-ondes", "Hotte", "Congélateur", "Réfrigérateur"] },
  { poles: 1, amp: 16, primary: "Prises",        pool: [
    "Prises séjour", "Prises cuisine", "Prises chambre 1", "Prises chambre 2", "Prises chambre 3",
    "Prises bureau", "Prises couloir", "Prises SdB", "Prises entrée", "Prises garage",
    "Prises extérieur", "Prises cave", "Réfrigérateur", "Lave-vaisselle", "Lave-linge",
    "TV / Multimédia", "Box internet", "Chaudière", "Micro-ondes", "Hotte",
  ] },
  { poles: 1, amp: 10, primary: "Éclairage",     pool: [
    "Éclairage séjour", "Éclairage cuisine", "Éclairage chambre 1", "Éclairage chambre 2", "Éclairage chambre 3",
    "Éclairage bureau", "Éclairage couloir", "Éclairage SdB", "Éclairage WC", "Éclairage entrée",
    "Éclairage escalier", "Éclairage garage", "Éclairage extérieur", "Éclairage cave", "Portail",
    "Volets roulants",
  ] },
  { poles: 1, amp: 6,  primary: "Éclairage",     pool: ["Éclairage basse tension", "Spots LED", "Rail lumineux", "Éclairage escalier"] },
  { poles: 1, amp: 2,  primary: "VMC",           pool: ["VMC", "Sonnette", "Alarme", "Interphone", "Box internet", "Visiophone", "Thermostat"] },
];

/** Extrait un ampérage numérique depuis "16A", "16 A", "16", etc. */
function parseAmp(sublabel: string | undefined): number | null {
  if (!sublabel) return null;
  const m = sublabel.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Trouve la règle qui correspond le mieux à (poles, amp). Tolère ±2A. */
function findRule(poles: PoleWidth, amp: number | null): SuggestionRule | null {
  if (amp === null) {
    // Sans ampérage, pool très large pour éviter les doublons numérotés
    if (poles === 1) return { poles: 1, amp: 16, primary: "Circuit", pool: POOL_1P_GENERIC };
    if (poles === 2) return {
      poles: 2, amp: 20, primary: "Circuit 2P",
      pool: [
        "Différentiel 30mA", "Chauffe-eau", "Plaque cuisson", "Four", "Cuisinière",
        "Pompe à chaleur", "Climatisation", "Lave-linge", "Sèche-linge", "Lave-vaisselle",
        "Chauffage principal", "Plancher chauffant", "Ballon eau chaude", "Radiateur SdB",
        "Sèche-serviettes", "Chauffage d'appoint",
      ],
    };
    if (poles === 3) return { poles: 3, amp: 32, primary: "Triphasé", pool: ["Plaque triphasée", "Four triphasé", "Moteur 3P", "Pompe"] };
    return {
      poles: 4, amp: 40, primary: "Tétrapolaire",
      pool: ["Général 4P", "Inter différentiel 4P", "Borne IRVE 4P", "Pompe à chaleur 4P", "Climatisation 4P", "Moteur 4P"],
    };
  }
  // Match exact
  const exact = RULES.find((r) => r.poles === poles && r.amp === amp);
  if (exact) return exact;
  // Match proche (±2A)
  const near = RULES
    .filter((r) => r.poles === poles && Math.abs(r.amp - amp) <= 2)
    .sort((a, b) => Math.abs(a.amp - amp) - Math.abs(b.amp - amp))[0];
  return near ?? null;
}

/**
 * Remplit les labels vides ou "?" avec des suggestions intelligentes.
 * Les breakers obtiennent `suggested: true` pour que l'UI puisse les distinguer.
 * Chaque pool rotatif évite de dupliquer le même label.
 * Quand le pool est épuisé, on retombe sur "À préciser" (pas de numérotation moche).
 */
export function applySuggestions(panel: Panel): Panel {
  const poolCursor: Record<string, number> = {}; // clé = "poles-amp"

  return {
    ...panel,
    rows: panel.rows.map((row) => ({
      ...row,
      breakers: row.breakers.map((b) => {
        const label = b.label.trim();
        const needsSuggestion = label === "" || label === "?";
        if (!needsSuggestion) return b;

        const amp = parseAmp(b.sublabel);
        const rule = findRule(b.poles, amp);
        // Sublabel vidé systématiquement : l'ampérage ne figure pas sur l'étiquette imprimée
        if (!rule) return { ...b, label: "À préciser", sublabel: "", suggested: true };

        const pool = rule.pool && rule.pool.length > 0 ? rule.pool : [rule.primary];
        const key = `${b.poles}-${amp ?? "x"}`;
        const idx = poolCursor[key] ?? 0;
        poolCursor[key] = idx + 1;
        // Premier passage : entrée variée du pool.
        // Cycle suivant : "À préciser" (plus honnête que "Prises 17")
        const suggestion = idx < pool.length ? pool[idx] : "À préciser";

        return { ...b, label: suggestion, sublabel: "", suggested: true };
      }),
    })),
  };
}

/** Utilitaire pour le mode manuel : suggère un label à partir des pôles */
export function suggestFromPoles(poles: PoleWidth): string {
  const rule = findRule(poles, null);
  return rule?.primary ?? "Circuit";
}

/** Pour LabelCell : donne la liste des suggestions alternatives pour un breaker */
export function getAlternatives(b: Breaker): string[] {
  const amp = parseAmp(b.sublabel);
  const rule = findRule(b.poles, amp);
  return rule?.pool ?? [];
}
