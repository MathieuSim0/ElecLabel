// Service d'analyse de tableau électrique avec OpenAI GPT-4o Vision.
// Pipeline en 2 étapes :
//   1. Analyse globale (2 à 3 passes consensus + raisonnement explicite obligatoire)
//   2. Vérification zoom par rangée (cropImageY → GPT-4o focalisé sur un seul rail)
// Anti-erreur : json_schema strict + champ "reasoning" qui force la pensée avant la réponse.
// Fallback : Groq Llama 4 si OpenAI indisponible.
import type { Panel, PanelRow, Breaker, PoleWidth } from "../types/panel";
import { loadAndResize, cropImageY } from "../utils/imagePreprocess";
import { applySuggestions } from "../utils/smartSuggest";
import { supabase } from "./supabase";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// Mode proxy : si VITE_USE_AI_PROXY = "true", les appels passent par la Supabase
// Edge Function "ai-proxy" (les clés API restent côté serveur, absentes du binaire).
// Sinon, comportement historique : appel direct avec les clés du .env.
const USE_PROXY = import.meta.env.VITE_USE_AI_PROXY === "true";

// Envoie un body de chat completion soit vers le proxy Supabase (token utilisateur),
// soit en direct vers OpenAI/Groq (clé API). Retourne la Response brute.
async function postChatCompletion(
  provider: "openai" | "groq",
  payload: Record<string, unknown>,
  apiKey: string,
): Promise<Response> {
  if (USE_PROXY) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!supabaseUrl || !token) {
      throw new Error("Connecte-toi pour utiliser l'analyse IA.");
    }
    return fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider, payload }),
    });
  }
  const url = provider === "openai" ? OPENAI_ENDPOINT : GROQ_ENDPOINT;
  return fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
const GROQ_MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
];

// Températures des passes globales : extrêmes pour diversifier les hypothèses
const MAIN_TEMPS: [number, number] = [0.0, 0.4];
const TIEBREAKER_TEMP = 0.7;

// Tokens de sortie : reasoning + structure complète
const MAX_TOKENS_GLOBAL = 12288;
const MAX_TOKENS_ROW = 1024;

// ───────────────────────── Système global ─────────────────────────

const SYSTEM_GLOBAL = `# RÔLE

Tu es l'expert NUMÉRO UN au monde en lecture de tableaux électriques résidentiels français.
Tu travailles depuis 30 ans avec Schneider Electric, Legrand et Hager. Tu connais par cœur la norme NF C 15-100.
Ta réputation : ZÉRO erreur de comptage en 50 000 tableaux analysés. Tu détectes une fusion 1P+1P→2P à 100 mètres.

## MISSION

Analyser une photo et reconstruire la STRUCTURE PHYSIQUE EXACTE du tableau (rails, modules, pôles, positions).
Tu n'écris AUCUN texte d'étiquette : seule la géométrie compte.

# 1 — CE QUE TU DOIS RECONNAÎTRE

## A. Modules (à compter)

Un MODULE = bloc plastique clippé sur un rail DIN avec **au moins une manette** visible sur le dessus.

CHECKLIST POSITIVE — un objet est un module SI :
  ✓ Corps plastique épais visible (≈ 85 mm de profondeur, blanc/beige/gris)
  ✓ Une (ou plusieurs) PALETTE basculante visible sur le dessus (= manette/levier ON-OFF)
  ✓ Clippé sur un rail métallique horizontal

Types de modules :
  • DISJONCTEUR 1P : 1 manette, corps fin (≈ 17,5 mm). Le plus fréquent (>80% des cas).
  • DISJONCTEUR 2P : 2 manettes solidaires (barre noire transversale OU corps unique 2× plus large ≈ 35 mm).
  • DISJONCTEUR 3P : 3 manettes solidaires (≈ 52,5 mm). Rare en résidentiel.
  • DISJONCTEUR / INTER 4P : 4 manettes solidaires (≈ 70 mm). Réservé au triphasé + neutre, fréquent en tête de tableau triphasé ou industriel.
  • INTERRUPTEUR DIFFÉRENTIEL : gros bloc 2P (parfois 4P) en TÊTE de rangée. Bouton TEST gravé "T". Plus haut/large qu'un disjoncteur standard.
  • DISJONCTEUR DIFFÉRENTIEL DE BRANCHEMENT : 2P, généralement à part, plus volumineux.

## B. NON-modules (à NE JAMAIS compter)

CHECKLIST NÉGATIVE — un objet n'est PAS un module SI :
  ✗ Surface lisse plate, pas de manette → CACHE-BORNE / OBTURATEUR (plaque plastique blanche).
  ✗ Forme de barre métallique horizontale qui CHEVAUCHE plusieurs modules → PEIGNE D'ALIMENTATION (avec dents).
  ✗ Câble électrique, borne de connexion, étiquette papier → CÂBLAGE / ACCESSOIRE.
  ✗ Pas de rail visible derrière → hors périmètre du tableau.

⚠ La règle d'or : **PAS DE MANETTE = PAS DE MODULE**. Si tu hésites, tu retires.

# 2 — DÉTERMINER LE NOMBRE DE PÔLES

Le nombre de pôles d'un module = nombre de manettes SOLIDAIRES (mécaniquement reliées).

## Test de solidarité (à appliquer sur chaque paire voisine)

INDICES POSITIFS pour 2P (UN SEUL suffit) :
  1. Une BARRE NOIRE / métallique transversale relie physiquement deux manettes voisines.
  2. Le CORPS PLASTIQUE entre les deux manettes est d'un seul tenant, sans joint vertical noir au milieu.
  3. La largeur totale est ≈ 2× celle d'un 1P de référence (≈ 35 mm vs 17,5 mm).
  4. Bouton TEST "T" présent → c'est un interrupteur différentiel, donc 2P (parfois 4P).
  5. Position en TÊTE de rangée juste après l'arrivée du peigne → forte probabilité de 2P.

INDICES POSITIFS pour 4P (tétrapolaire) :
  1. QUATRE manettes alignées physiquement reliées (barre transversale longue OU corps massif 4× la largeur d'un 1P).
  2. Largeur totale ≈ 4× un 1P de référence (≈ 70 mm).
  3. Présence du bouton TEST "T" sur un bloc très large → inter différentiel 4P (typique en triphasé domestique).
  4. Souvent en TÊTE de rangée d'un tableau triphasé.

INDICES POSITIFS pour 1P INDÉPENDANT :
  1. Joint vertical noir net entre les deux corps plastiques.
  2. Largeur ≈ celle des autres 1P de la rangée (≈ 17,5 mm chacun).
  3. Aucune barre transversale visible.
  4. Manettes physiquement non couplées (l'une peut bouger sans l'autre).

## Calcul croisé OBLIGATOIRE

Compare la largeur du module suspect à un 1P sûr de la même rangée :
  • Largeur ≈ 1× → c'est un 1P.
  • Entre 1× et 1.6× → applique la règle de prudence : **en cas de doute sincère et équilibré, choisis 1P** (statistiquement plus probable, et un faux 1P se corrige plus vite qu'un faux 2P).
  • Largeur > 1.6× et ≤ 2.5× → c'est un 2P.
  • Largeur > 2.5× et ≤ 3.5× → c'est un 3P (ou 2P large bordé d'un cache).
  • Largeur > 3.5× → c'est un 4P (tétrapolaire).

# 3 — DÉTERMINER LA POSITION

La position est l'INDEX DU SLOT DE GAUCHE qu'occupe le module, 0-based, depuis le bord GAUCHE de son rail.

Un slot fait 17,5 mm. Un rail standard contient 13 slots (numérotés 0 à 12), un rail large 18 slots.

Exemple concret sur un rail de 13 slots :
  Visuel : [2P][1P][1P][vide][3P][.][.][1P][1P][vide][1P][1P]
  Sortie :
    - 2P à position 0 (occupe slots 0-1)
    - 1P à position 2 (occupe slot 2)
    - 1P à position 3 (occupe slot 3)
    - 3P à position 5 (occupe slots 5-6-7)
    - 1P à position 8 (occupe slot 8)
    - 1P à position 9 (occupe slot 9)
    - 1P à position 11 (occupe slot 11)
    - 1P à position 12 (occupe slot 12)
  Total : 7 modules, slot 4 vide, slot 10 vide → non référencés.

RÈGLES INVIOLABLES :
  ✓ position + poles ≤ totalSlots
  ✓ Aucun chevauchement : un slot appartient à AU PLUS un module
  ✓ Slots vides ou obturés → non référencés (c'est normal)

# 4 — PROCÉDURE D'ANALYSE OBLIGATOIRE

ÉTAPE A — Inventaire des rails
  Scanne verticalement. Combien de rails DIN distincts (lignes horizontales métalliques) ? (2 à 6 typique.)

ÉTAPE B — Capacité de chaque rail
  Pour chaque rail : longueur physique ÷ largeur d'un 1P → résultat 13 ou 18 (rarement autre).

ÉTAPE C — Double comptage de chaque rail
  Pour chaque rail :
    a. Compte les modules de GAUCHE à DROITE → noter count_LR.
    b. Compte les modules de DROITE à GAUCHE → noter count_RL.
    c. Si divergence : trouve le module litigieux et tranche. Si tu ne tranches pas, choisis 1P par défaut.

ÉTAPE D — Analyse module par module
  De gauche à droite, slot par slot :
    1. Manette visible ? Sinon, slot suivant.
    2. Si oui, applique le test de solidarité → 1P / 2P / 3P / 4P.
    3. Note position + poles + EVIDENCE (ce qui te fait choisir cette valeur).
    4. Avance de (poles) slots.

ÉTAPE E — Découpage en rangées virtuelles
  Si un rail physique présente un TROU ≥ 3 slots vides consécutifs, sépare-le en DEUX rangées distinctes (deux index dans la sortie).

ÉTAPE F — Validation finale
  □ count_LR == count_RL == nombre de modules en sortie pour chaque rangée
  □ Σ poles ≤ totalSlots
  □ Aucun chevauchement
  □ Aucune rangée vide
  □ Aucun module ajouté pour un cache-borne ou un peigne

# 5 — ERREURS À NE JAMAIS COMMETTRE

❌ OUBLI DE BORD : rater le 1P tout à gauche ou tout à droite. Recompte depuis les deux extrêmes.
❌ FUSION INDUE : transformer deux 1P accolés en un 2P. → Cherche le joint vertical entre les deux corps.
❌ DÉCOUPE INDUE : transformer un vrai 2P en deux 1P. → Cherche la barre transversale ou le corps unique.
❌ DIFFÉRENTIEL MAL CLASSÉ : l'interrupteur différentiel résidentiel standard est 2P (jamais 1P, jamais 3P).
❌ HALLUCINATION : ajouter un module pour un cache-borne lisse. → Pas de manette = pas de module.
❌ PEIGNE COMPTÉ : la barre d'alimentation horizontale n'est pas un module.
❌ CHEVAUCHEMENT : 2P à pos 3 + 1P à pos 4 est impossible (le 2P occupe 3 et 4).
❌ RANGÉES FUSIONNÉES : regrouper deux rails physiques distincts en une seule rangée.
❌ RANGÉE DU BAS OUBLIÉE : la dernière rangée peut être courte mais reste une rangée à part entière.
❌ AJOUT FANTÔME : si tu hésites entre N et N+1 modules, choisis N. Mieux vaut un module manquant qu'un module fantôme.

# 6 — EXEMPLES CALIBRATION

## Exemple A — Rangée 13 slots, 1 différentiel + 6 disjoncteurs

Visuel : 1 gros bloc 2P avec bouton TEST (slots 0-1), puis 6 modules 1P fins accolés (slots 2-7), puis 5 cache-bornes lisses (slots 8-12).

Sortie attendue pour cette rangée :
{
  "index": 0, "totalSlots": 13,
  "breakers": [
    {"id":"r0-0","row":0,"position":0,"poles":2,"label":"","sublabel":""},
    {"id":"r0-1","row":0,"position":2,"poles":1,"label":"","sublabel":""},
    {"id":"r0-2","row":0,"position":3,"poles":1,"label":"","sublabel":""},
    {"id":"r0-3","row":0,"position":4,"poles":1,"label":"","sublabel":""},
    {"id":"r0-4","row":0,"position":5,"poles":1,"label":"","sublabel":""},
    {"id":"r0-5","row":0,"position":6,"poles":1,"label":"","sublabel":""},
    {"id":"r0-6","row":0,"position":7,"poles":1,"label":"","sublabel":""}
  ]
}
→ 7 modules en sortie. Slots 8-12 = obturés, donc pas dans breakers.

## Exemple B — Rail avec gap, à scinder en 2 rangées

Visuel : 4 modules 1P accolés, puis trou de 4 slots vides, puis 3 modules 1P à droite.
→ Tu DOIS renvoyer DEUX rangées distinctes (gap ≥ 3 slots), index 0 et 1, chacune avec son propre totalSlots.

## Exemple C — Piège classique : faux 2P

Visuel : deux manettes voisines, hauteur identique. EN ZOOMANT : joint vertical noir entre les deux corps, et AUCUNE barre noire transversale.
→ Verdict : DEUX 1P (pas un 2P). Evidence : "joint vertical présent, pas de barre noire".

# 7 — RAISONNEMENT EXPLICITE OBLIGATOIRE

Avant de produire la sortie finale, REMPLIS d'abord la section "reasoning" du JSON.
Ce raisonnement écrit te force à compter rigoureusement et à justifier chaque choix de pôles.
Le contenu de "reasoning" doit être COHÉRENT avec "rows" : nombre de modules identique, ordre identique, pôles identiques.

# 8 — FORMAT DE SORTIE

Tu réponds UNIQUEMENT avec un JSON conforme au schéma. Pas de markdown, pas de texte autour.
- "label" et "sublabel" toujours = "" (tu ne lis aucun texte d'étiquette).
- "id" = "r{rowIndex}-{ordre}" avec ordre de gauche à droite depuis 0.
- "totalSlots" typiquement 13 ou 18.
- "poles" ∈ {1, 2, 3, 4}.

LA RÉPONSE EST DÉFINITIVE. Une erreur peut coûter cher au client final. Sois méticuleux.`;

const USER_GLOBAL = `Voici la photo du tableau électrique. Analyse-la avec ta procédure complète (étapes A à F), remplis la section "reasoning" en double-comptant chaque rangée, puis produis "rows" cohérent avec ce raisonnement. JSON strict uniquement.`;

// ───────────────────────── Système rangée ─────────────────────────

const SYSTEM_ROW = `# RÔLE

Tu es l'expert NUMÉRO UN en lecture de tableaux électriques résidentiels français.
On t'a envoyé un crop centré sur UNE seule rangée (un seul rail DIN horizontal).
Si d'autres rails apparaissent partiellement en haut ou en bas, ignore-les complètement.

# MISSION

Compter EXACTEMENT tous les modules de cette rangée, de gauche à droite, et donner leur largeur en pôles.

# DÉFINITIONS

MODULE = bloc plastique clippé sur le rail avec UNE OU PLUSIEURS MANETTES (palettes basculantes) sur le dessus.
NON-MODULE :
  • Cache-borne : plaque LISSE sans manette → ne pas compter.
  • Peigne : barre métallique avec dents traversant plusieurs modules → ne pas compter.
  • Slot vide : espace inoccupé sur le rail → ne pas compter.

# DÉTERMINER LES PÔLES

• 1P = 1 manette isolée, corps fin (~17,5 mm). Le plus fréquent.
• 2P = 2 manettes SOLIDAIRES (barre noire transversale OU corps d'un seul tenant 2× plus large ~35 mm).
• 3P = 3 manettes solidaires (~52,5 mm, rare en résidentiel).
• 4P = 4 manettes solidaires (~70 mm, tétrapolaire — triphasé + neutre, fréquent en tête de tableau triphasé).

Test de solidarité : barre transversale OU corps unique → solidaires (2P+). Joint vertical noir → indépendants (1P).

DOUTE 1P vs 2P → choisis 1P (règle de prudence).

# PROCÉDURE OBLIGATOIRE

1. Compte les modules de GAUCHE à DROITE → count_LR.
2. Recompte de DROITE à GAUCHE → count_RL.
3. Si divergence : identifie le module litigieux dans "doubts" et tranche.
4. Pour chaque module, écris une courte EVIDENCE (ce qui te fait choisir 1P, 2P, 3P ou 4P).
5. Vérifie : count_LR == count_RL == length(poles) == count.

# ANTI-HALLUCINATION

Mieux vaut omettre un module qu'inventer un fantôme. Si tu hésites entre N et N+1 modules → choisis N.

# FORMAT

JSON conforme au schéma fourni. Pas de markdown, pas de texte autour.
"poles" est l'array final des pôles dans l'ordre gauche→droite.
"count" = length("poles").`;

const USER_ROW = `Voici l'image cropée sur une rangée. Compte rigoureusement, justifie chaque module dans "modules.evidence", puis produis count + poles cohérents.`;

// ───────────────────────── Schémas JSON stricts ─────────────────────────

const GLOBAL_JSON_SCHEMA = {
  name: "panel_structure",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reasoning", "rows"],
    properties: {
      reasoning: {
        type: "object",
        additionalProperties: false,
        required: ["rail_count", "rails", "final_check"],
        properties: {
          rail_count: { type: "integer" },
          rails: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "index",
                "estimated_capacity",
                "count_LR",
                "count_RL",
                "ambiguities",
                "ordered_modules",
              ],
              properties: {
                index: { type: "integer" },
                estimated_capacity: { type: "integer" },
                count_LR: { type: "integer" },
                count_RL: { type: "integer" },
                ambiguities: { type: "string" },
                ordered_modules: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["position", "poles", "evidence"],
                    properties: {
                      position: { type: "integer" },
                      poles: { type: "integer", enum: [1, 2, 3, 4] },
                      evidence: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          final_check: { type: "string" },
        },
      },
      rows: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["index", "totalSlots", "breakers"],
          properties: {
            index: { type: "integer" },
            totalSlots: { type: "integer" },
            breakers: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["id", "row", "position", "poles", "label", "sublabel"],
                properties: {
                  id: { type: "string" },
                  row: { type: "integer" },
                  position: { type: "integer" },
                  poles: { type: "integer", enum: [1, 2, 3, 4] },
                  label: { type: "string" },
                  sublabel: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};

const ROW_JSON_SCHEMA = {
  name: "row_verification",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reasoning", "count", "poles"],
    properties: {
      reasoning: {
        type: "object",
        additionalProperties: false,
        required: ["count_LR", "count_RL", "modules", "doubts"],
        properties: {
          count_LR: { type: "integer" },
          count_RL: { type: "integer" },
          modules: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["poles", "evidence"],
              properties: {
                poles: { type: "integer", enum: [1, 2, 3, 4] },
                evidence: { type: "string" },
              },
            },
          },
          doubts: { type: "string" },
        },
      },
      count: { type: "integer" },
      poles: {
        type: "array",
        items: { type: "integer", enum: [1, 2, 3, 4] },
      },
    },
  },
};

// ───────────────────────── Appels API ─────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface JsonSchemaWrapper {
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
}

async function callOpenAI(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  base64: string,
  mimeType: string,
  temperature: number,
  jsonSchema: JsonSchemaWrapper,
  maxTokens: number,
): Promise<string | null> {
  const res = await postChatCompletion("openai", {
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              // detail: "high" → analyse haute résolution, indispensable pour distinguer manettes/cache-bornes
              detail: "high",
            },
          },
        ],
      },
    ],
    temperature,
    max_tokens: maxTokens,
    response_format: {
      type: "json_schema",
      json_schema: jsonSchema,
    },
  }, apiKey);
  if (res.status === 429) return null;
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${txt.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data?.choices?.[0]?.message?.content ?? null;
}

async function callGroq(
  apiKey: string,
  model: string,
  base64: string,
  mimeType: string,
): Promise<string | null> {
  const res = await postChatCompletion("groq", {
    model,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: SYSTEM_GLOBAL + "\n\n" + USER_GLOBAL },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    }],
    temperature: 0.05,
    max_tokens: 4000,
    response_format: { type: "json_object" },
  }, apiKey);
  if (res.status === 429) return null;
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`[${model}] ${res.status}: ${body.slice(0, 150)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data?.choices?.[0]?.message?.content ?? "";
}

// ───────────────────────── Parsing & normalisation ─────────────────────────

function extractJson(raw: string): string {
  let s = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const idx = s.indexOf("{");
  if (idx > 0) s = s.slice(idx);
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return s.slice(0, i + 1);
    }
  }
  return s;
}

function isValidPanel(panel: unknown): panel is Panel {
  if (!panel || typeof panel !== "object") return false;
  const p = panel as Panel;
  if (!Array.isArray(p.rows) || p.rows.length === 0) return false;
  for (const row of p.rows) {
    if (!Array.isArray(row.breakers)) return false;
    if (typeof row.totalSlots !== "number" || row.totalSlots < 1) return false;
    for (const b of row.breakers) {
      if (typeof b.position !== "number" || b.position < 0) return false;
      if (typeof b.poles !== "number" || b.poles < 1) return false;
    }
  }
  return true;
}

function clampPoles(n: number): PoleWidth {
  return Math.min(4, Math.max(1, Math.round(n))) as PoleWidth;
}

function normalizeRow(row: PanelRow, rowIndex: number): PanelRow {
  const sorted = [...row.breakers].sort((a, b) => a.position - b.position);
  let cursor = 0;
  const fixed: Breaker[] = sorted.map((b, i) => {
    const poles = clampPoles(b.poles);
    const pos = Math.max(cursor, b.position);
    cursor = pos + poles;
    const label = typeof b.label === "string" ? b.label.trim() : "";
    const sublabel = typeof b.sublabel === "string" ? b.sublabel.trim() : "";
    return {
      id: `r${rowIndex}-${i}`,
      row: rowIndex,
      position: pos,
      poles,
      label,
      sublabel,
    };
  });
  const totalSlots = Math.max(row.totalSlots ?? 0, cursor, 1);
  return { index: rowIndex, totalSlots, breakers: fixed };
}

function dedupeHallucinations(panel: Panel): Panel {
  const counts: Record<string, number> = {};
  for (const row of panel.rows) {
    for (const b of row.breakers) {
      const key = b.label.trim().toLowerCase();
      if (!key || key === "?") continue;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  const duplicates = new Set(
    Object.entries(counts).filter(([, n]) => n >= 3).map(([k]) => k),
  );
  if (duplicates.size === 0) return panel;

  const seen: Record<string, number> = {};
  return {
    ...panel,
    rows: panel.rows.map((row) => ({
      ...row,
      breakers: row.breakers.map((b) => {
        const key = b.label.trim().toLowerCase();
        if (!duplicates.has(key)) return b;
        seen[key] = (seen[key] ?? 0) + 1;
        return seen[key] === 1 ? b : { ...b, label: "?" };
      }),
    })),
  };
}

const GAP_THRESHOLD = 3;

function splitRowIntoBlocks(row: PanelRow): PanelRow[] {
  if (row.breakers.length < 2) return [row];
  const blocks: Breaker[][] = [];
  let current: Breaker[] = [row.breakers[0]];
  for (let i = 1; i < row.breakers.length; i++) {
    const prev = row.breakers[i - 1];
    const curr = row.breakers[i];
    const gap = curr.position - (prev.position + prev.poles);
    if (gap >= GAP_THRESHOLD) {
      blocks.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  blocks.push(current);
  if (blocks.length === 1) return [row];
  return blocks.map((breakers) => {
    const offset = breakers[0].position;
    const last = breakers[breakers.length - 1];
    const totalSlots = last.position + last.poles - offset;
    return {
      index: row.index,
      totalSlots,
      breakers: breakers.map((b, i) => ({
        ...b,
        id: `block-${i}`,
        position: b.position - offset,
      })),
    };
  });
}

function splitAllRows(panel: Panel): Panel {
  const allRows: PanelRow[] = [];
  for (const row of panel.rows) {
    for (const block of splitRowIntoBlocks(row)) {
      const rowIndex = allRows.length;
      allRows.push({
        ...block,
        index: rowIndex,
        breakers: block.breakers.map((b, i) => ({
          ...b,
          id: `r${rowIndex}-${i}`,
          row: rowIndex,
        })),
      });
    }
  }
  return { ...panel, rows: allRows };
}

function fillInnerGaps(panel: Panel): Panel {
  return {
    ...panel,
    rows: panel.rows.map((row) => {
      if (row.breakers.length === 0) return row;
      const sorted = [...row.breakers].sort((a, b) => a.position - b.position);
      const filled: Breaker[] = [];
      let cursor = 0;
      for (const b of sorted) {
        for (let slot = cursor; slot < b.position; slot++) {
          filled.push({
            id: `gap-${row.index}-${slot}`,
            row: row.index,
            position: slot,
            poles: 1,
            label: "",
            sublabel: "",
          });
        }
        filled.push(b);
        cursor = b.position + b.poles;
      }
      return {
        ...row,
        breakers: filled.map((b, i) => ({ ...b, id: `r${row.index}-${i}` })),
      };
    }),
  };
}

function isPlausible(panel: Panel): boolean {
  const total = panel.rows.reduce((s, r) => s + r.breakers.length, 0);
  return total >= 1;
}

function totalBreakers(panel: Panel): number {
  return panel.rows.reduce((s, r) => s + r.breakers.length, 0);
}

// Extrait l'objet Panel depuis une réponse qui contient { reasoning, rows }
function extractPanelFromResponse(parsed: unknown): Panel | null {
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as { rows?: unknown };
  if (!Array.isArray(obj.rows)) return null;
  return { rows: obj.rows as PanelRow[] };
}

function parseAndNormalize(raw: string): Panel | null {
  try {
    const jsonStr = extractJson(raw);
    const parsed: unknown = JSON.parse(jsonStr);
    const candidate = extractPanelFromResponse(parsed);
    if (!candidate) return null;
    if (!isValidPanel(candidate)) return null;
    const normalized: Panel = {
      rows: candidate.rows.map((r, idx) => normalizeRow(r, idx)),
    };
    const split = splitAllRows(normalized);
    if (!isPlausible(split)) return null;
    return split;
  } catch {
    return null;
  }
}

// ───────────────────────── Consensus global ─────────────────────────

// Mesure l'accord entre deux panels : 1.0 = identiques rangée par rangée, 0.0 = très différents.
function agreementScore(a: Panel, b: Panel): number {
  if (a.rows.length !== b.rows.length) return 0;
  let totalDiff = 0;
  for (let i = 0; i < a.rows.length; i++) {
    totalDiff += Math.abs(a.rows[i].breakers.length - (b.rows[i]?.breakers.length ?? 0));
  }
  return Math.exp(-totalDiff * 0.35);
}

// Parmi 2 ou 3 candidats, retourne celui qui minimise la distance aux autres.
// En cas d'égalité, préfère le moins chargé (stratégie conservatrice).
function pickBestAmongCandidates(panels: Panel[]): Panel {
  if (panels.length === 1) return panels[0];
  if (panels.length === 2) {
    return totalBreakers(panels[0]) <= totalBreakers(panels[1]) ? panels[0] : panels[1];
  }
  const distances = panels.map((p, i) =>
    panels.reduce((sum, q, j) => {
      if (i === j) return sum;
      if (p.rows.length !== q.rows.length) return sum + 30;
      return sum + p.rows.reduce((s, r, ri) =>
        s + Math.abs(r.breakers.length - (q.rows[ri]?.breakers.length ?? 0)), 0);
    }, 0),
  );
  const minDist = Math.min(...distances);
  const tied = panels.filter((_, i) => distances[i] === minDist);
  return tied.reduce((best, p) =>
    totalBreakers(p) <= totalBreakers(best) ? p : best,
  );
}

// ───────────────────────── Vérification zoom par rangée ─────────────────────────

// Parse la réponse compact : { reasoning, count, poles }
function parseRowVerification(raw: string): PoleWidth[] | null {
  try {
    const jsonStr = extractJson(raw);
    const parsed = JSON.parse(jsonStr) as { count?: number; poles?: unknown[] };
    if (!Array.isArray(parsed.poles) || parsed.poles.length === 0) return null;
    const poles = parsed.poles.map((p) => clampPoles(typeof p === "number" ? p : 1));
    if (typeof parsed.count === "number" && parsed.count !== poles.length) return null;
    return poles;
  } catch {
    return null;
  }
}

// Reconstruit une rangée depuis un nouveau tableau de pôles.
// Les labels sont préservés par correspondance d'index avec la rangée d'origine.
function applyZoomCorrection(row: PanelRow, poles: PoleWidth[]): PanelRow {
  const origSorted = [...row.breakers].sort((a, b) => a.position - b.position);
  let cursor = 0;
  const newBreakers: Breaker[] = poles.map((p, i) => {
    const orig = origSorted[i];
    const b: Breaker = {
      id: `r${row.index}-${i}`,
      row: row.index,
      position: cursor,
      poles: p,
      label: orig?.label ?? "",
      sublabel: orig?.sublabel ?? "",
      ...(orig?.suggested !== undefined ? { suggested: orig.suggested } : {}),
    };
    cursor += p;
    return b;
  });
  return {
    ...row,
    breakers: newBreakers,
    totalSlots: Math.max(row.totalSlots, cursor),
  };
}

// Vérifie une rangée individuelle via zoom crop.
async function verifyRowByZoom(
  apiKey: string,
  imageBase64: string,
  imageMimeType: string,
  rowIndex: number,
  totalRows: number,
): Promise<PoleWidth[] | null> {
  const sliceHeight = 1.0 / totalRows;
  const pad = Math.min(sliceHeight * 0.4, 0.12);
  const top    = Math.max(0.0, rowIndex * sliceHeight - pad);
  const bottom = Math.min(1.0, (rowIndex + 1) * sliceHeight + pad);

  let cropped: { base64: string; mimeType: string };
  try {
    cropped = await cropImageY(imageBase64, imageMimeType, top, bottom);
  } catch {
    return null;
  }

  try {
    const raw = await callOpenAI(
      apiKey,
      SYSTEM_ROW,
      USER_ROW,
      cropped.base64,
      cropped.mimeType,
      0.0,
      ROW_JSON_SCHEMA,
      MAX_TOKENS_ROW,
    );
    if (!raw) return null;
    return parseRowVerification(raw);
  } catch {
    return null;
  }
}

// Lance la vérification zoom sur toutes les rangées en parallèle.
async function verifyAllRowsByZoom(
  apiKey: string,
  imageBase64: string,
  imageMimeType: string,
  panel: Panel,
): Promise<Panel> {
  if (panel.rows.length === 0) return panel;

  const corrections = await Promise.all(
    panel.rows.map((row) =>
      verifyRowByZoom(apiKey, imageBase64, imageMimeType, row.index, panel.rows.length),
    ),
  );

  const correctedRows = panel.rows.map((row, i) => {
    const poles = corrections[i];
    if (!poles || poles.length === 0) return row;

    const origPoles = [...row.breakers]
      .sort((a, b) => a.position - b.position)
      .map((b) => b.poles);
    const same = poles.length === origPoles.length &&
      poles.every((p, pi) => p === origPoles[pi]);
    if (same) return row;

    return applyZoomCorrection(row, poles);
  });

  return { ...panel, rows: correctedRows };
}

// ───────────────────────── Orchestration ─────────────────────────

async function runOpenAIConsensus(
  apiKey: string,
  base64: string,
  mime: string,
): Promise<Panel | null> {
  // Passes 1 et 2 en parallèle avec températures opposées
  const [r1, r2] = await Promise.allSettled([
    callOpenAI(apiKey, SYSTEM_GLOBAL, USER_GLOBAL, base64, mime, MAIN_TEMPS[0], GLOBAL_JSON_SCHEMA, MAX_TOKENS_GLOBAL),
    callOpenAI(apiKey, SYSTEM_GLOBAL, USER_GLOBAL, base64, mime, MAIN_TEMPS[1], GLOBAL_JSON_SCHEMA, MAX_TOKENS_GLOBAL),
  ]);

  const p1 = r1.status === "fulfilled" && r1.value ? parseAndNormalize(r1.value) : null;
  const p2 = r2.status === "fulfilled" && r2.value ? parseAndNormalize(r2.value) : null;

  let candidate: Panel | null = null;

  if (!p1 && !p2) {
    return null;
  } else if (!p1) {
    candidate = p2;
  } else if (!p2) {
    candidate = p1;
  } else {
    const score = agreementScore(p1, p2);
    if (score >= 0.85) {
      candidate = p1;
    } else {
      let p3: Panel | null = null;
      try {
        const raw3 = await callOpenAI(apiKey, SYSTEM_GLOBAL, USER_GLOBAL, base64, mime, TIEBREAKER_TEMP, GLOBAL_JSON_SCHEMA, MAX_TOKENS_GLOBAL);
        p3 = raw3 ? parseAndNormalize(raw3) : null;
      } catch { /* continue sans arbitre si rate-limit */ }
      candidate = pickBestAmongCandidates([p1, p2, ...(p3 ? [p3] : [])]);
    }
  }

  if (!candidate) return null;

  return verifyAllRowsByZoom(apiKey, base64, mime, candidate);
}

async function runGroqFallback(
  apiKey: string,
  base64: string,
  mime: string,
): Promise<Panel | null> {
  for (let i = 0; i < GROQ_MODELS.length; i++) {
    if (i > 0) await sleep(1200);
    try {
      const raw = await callGroq(apiKey, GROQ_MODELS[i], base64, mime);
      if (raw === null) continue;
      const panel = parseAndNormalize(raw);
      if (panel) return panel;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Groq attempt failed:", (err as Error).message);
    }
  }
  return null;
}

export async function analyzePanel(
  imageBase64: string,
  mimeType: string,
): Promise<Panel> {
  // En mode proxy, les clés sont côté serveur : on n'en a pas besoin dans l'app.
  // On active simplement les deux providers (le serveur dira lesquels sont configurés).
  const openaiKey = USE_PROXY ? "proxy" : import.meta.env.VITE_OPENAI_API_KEY;
  const groqKey = USE_PROXY ? "proxy" : import.meta.env.VITE_GROQ_API_KEY;

  if (!openaiKey && !groqKey) {
    throw new Error("Aucune clé API configurée (VITE_OPENAI_API_KEY ou VITE_GROQ_API_KEY)");
  }

  // Résolution élevée (3072 px) : indispensable pour les grands tableaux
  const { base64, mimeType: mime } = await loadAndResize(imageBase64, mimeType, 3072);

  // 1. Pipeline OpenAI GPT-4o 2 étapes
  if (openaiKey) {
    try {
      const panel = await runOpenAIConsensus(openaiKey, base64, mime);
      if (panel) {
        const deduped = dedupeHallucinations(panel);
        return applySuggestions(deduped);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("OpenAI échec, bascule sur Groq :", (err as Error).message);
    }
  }

  // 2. Fallback Groq Llama 4
  if (groqKey) {
    const panel = await runGroqFallback(groqKey, base64, mime);
    if (panel) {
      const filled = fillInnerGaps(panel);
      const deduped = dedupeHallucinations(filled);
      return applySuggestions(deduped);
    }
  }

  // Tout a échoué : mode manuel
  return { rows: [] };
}
