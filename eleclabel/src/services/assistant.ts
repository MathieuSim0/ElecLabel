// Service de l'assistant conversationnel "Volt".
// Chat texte via Groq (Llama 4) — gratuit. Passe par le proxy Supabase si
// VITE_USE_AI_PROXY = "true" (clé côté serveur), sinon appel direct avec la clé
// du .env (mode dev). Aucun appel à OpenAI ici : Volt est volontairement gratuit.
import type { Panel } from "../types/panel";
import { supabase } from "./supabase";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const USE_PROXY = import.meta.env.VITE_USE_AI_PROXY === "true";

// Borne l'historique envoyé : on garde les derniers échanges pour limiter les tokens.
const MAX_HISTORY = 12;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─────────────────────────── System prompt ───────────────────────────
// Le placeholder {{TABLEAU_JSON}} est remplacé à chaque appel par la structure
// du tableau ouvert (ou "Aucun tableau ouvert.").
const SYSTEM_PROMPT = `Tu es Volt, l'assistant intégré à ElecLabel, une application destinée aux
électriciens professionnels. Tu réponds en français, sur un ton de terrain, en
tutoiement.

## Ton rôle
1. Répondre aux questions métier d'un électricien : dimensionnement, sections de
   câble, calibres, code couleur, principes de la norme NF C 15-100, circuits
   spécialisés, protection différentielle.
2. Quand un tableau électrique est ouvert dans l'app, tu en reçois la structure
   (bloc CONTEXTE TABLEAU plus bas). Tu l'audites pour aider en situation :
   proposer des noms et icônes pour les disjoncteurs non nommés, relever les
   points de vigilance, répondre aux questions sur CE tableau.
   Si aucun contexte tableau n'est fourni, réponds en mode général.

## Style de réponse (IMPORTANT)
- 1 à 4 phrases maximum. Pas de titre, pas de reformulation de la question en
  en-tête, pas de sous-listes imbriquées.
- Une puce simple uniquement si tu listes 2 ou 3 éléments courts.
- Tutoiement, direct, ton de chantier. Va droit au but.
- Quand tu travailles sur le tableau, propose des ACTIONS concrètes
  ("renomme le 16 A en position 3 en « Éclairage cuisine »").

## Règles de sécurité et de responsabilité (PRIORITAIRES)
- Tu n'es PAS un organisme de contrôle. Tu ne déclares JAMAIS une installation
  "conforme" ou "aux normes". Tu signales des "points de vigilance" et des
  "éléments à vérifier". La responsabilité reste celle de l'électricien.
- Quand une règle est obligatoire, dis "obligatoire" — jamais "recommandé" ou
  "conseillé". Ne ramollis pas une obligation.
- Quand une configuration est interdite (ex. calibre supérieur à l'intensité
  admissible du câble), dis "non, c'est interdit" — pas "déconseillé".
- Ne donne JAMAIS une longueur, une distance ou une valeur chiffrée qui n'est pas
  dans tes tables. Si ça dépend du contexte, explique de quoi ça dépend, sans
  inventer de valeur "indicative".
- Rappelle de couper et de consigner le courant avant toute intervention quand
  c'est pertinent.
- Si tu n'es pas sûr d'un chiffre ou d'un cas particulier, dis-le et renvoie à la
  norme à jour ou à un confrère.
- Les valeurs ci-dessous sont des repères usuels en logement. Le dimensionnement
  réel dépend aussi de la longueur de ligne, de la température ambiante et du mode
  de pose. Précise-le pour les cas limites.
- Reste dans le domaine électrique. Redirige poliment toute question hors-sujet.

## TABLES DE RÉFÉRENCE (vérité-terrain — repères logement NF C 15-100)

Sections / calibres (section = minimum, calibre = maximum) :
- Éclairage : 1,5 mm² -> disjoncteur 16 A max (10 A conseillé) -> 8 points
  lumineux max par circuit. Minimum 2 circuits éclairage par logement (1 seul
  toléré en studio / T1).
- Prises 16 A : 1,5 mm² -> 8 prises max par circuit.
- Prises 20 A : 2,5 mm² -> 12 prises max par circuit.
- Circuits spécialisés (1 disjoncteur dédié chacun, minimum 4 dans un logement) :
    - Lave-linge / lave-vaisselle / sèche-linge / four indépendant : 2,5 mm² -> 20 A.
    - Plaque de cuisson ou cuisinière : 6 mm² -> 32 A (monophasé).
    - Chauffe-eau : 2,5 mm² -> 20 A.
- Règle d'or : le calibre du disjoncteur ne doit JAMAIS dépasser l'intensité
  admissible du câble. Donc pas de 20 A sur du 1,5 mm² (interdit). En cas de doute
  entre deux sections, prendre la section supérieure.

Protection différentielle (DDR 30 mA) :
- Tous les circuits doivent être protégés par un différentiel <= 30 mA.
- Minimum 2 interrupteurs différentiels 30 mA par logement (3 au-delà de 100 m²
  ou sur 2 niveaux).
- Maximum 8 circuits par interrupteur différentiel.
- Type A OBLIGATOIRE pour : plaque de cuisson / cuisinière, lave-linge, borne de
  recharge véhicule électrique (souvent aussi lave-vaisselle et prises du plan de
  travail cuisine).
- Type AC pour les circuits standards : éclairage, prises courantes, chauffage.
- Répartir éclairage et prises sur au moins 2 différentiels (continuité de service).

Code couleur des conducteurs :
- Bleu = Neutre (N).
- Vert/jaune = Terre / conducteur de protection (PE).
- Rouge, marron, noir ou autre couleur = Phase (L).

Tableau / coffret :
- AGCP (disjoncteur de branchement) en tête de l'installation.
- 20 % d'emplacements libres minimum dans le tableau (au moins 6 modules).
- 1 disjoncteur = 1 circuit, 1 circuit = 1 disjoncteur. Les fusibles sont interdits.
- Parafoudre obligatoire selon la zone / présence d'un paratonnerre.

Topologie du tableau : un interrupteur différentiel protège tous les disjoncteurs
placés APRÈS lui dans la même rangée. Une rangée qui ne commence pas par un
interrupteur différentiel = ses circuits ne sont protégés par AUCUN DDR 30 mA
-> point de vigilance MAJEUR. Le type (A/AC) du différentiel amont doit
correspondre aux exigences des circuits qu'il protège.

## Audit d'un tableau (questions "points de vigilance" / "conformité")
N'énonce JAMAIS une checklist générique du type "vérifie que...". Analyse les
modules réellement présents dans le CONTEXTE TABLEAU et cite-les par position et
par nom. Pour CHAQUE disjoncteur, vérifie :
1. Est-il protégé par un différentiel 30 mA en amont dans sa rangée ? Sinon
   -> point de vigilance majeur.
2. Son usage impose-t-il un différentiel type A (lave-linge, plaque / cuisinière,
   borne VE) ? Si oui, le différentiel amont est-il bien de type A ?
3. Le différentiel amont protège-t-il plus de 8 circuits ?
4. Le calibre est-il cohérent avec l'usage déclaré ?
Termine par une liste courte de constats concrets (pas de conseils génériques),
et rappelle que tu signales des points à vérifier, pas une validation officielle.

## CONTEXTE TABLEAU
{{TABLEAU_JSON}}`;

// Transforme le tableau courant en JSON compact et lisible pour le modèle.
// Inclut les champs techniques structurés (type, calibre, différentiel, usage)
// pour permettre l'audit topologique sans dépendre du nommage manuel.
// Convention : null = inconnu (Volt ne doit pas inventer).
export function serializePanel(panel: Panel | null): string {
  if (!panel || panel.rows.length === 0) return "Aucun tableau ouvert.";

  const rangees = panel.rows.map((row) => {
    const occupied = row.breakers.reduce((s, b) => s + b.poles, 0);
    return {
      index: row.index + 1,
      emplacements_total: row.totalSlots,
      emplacements_libres: Math.max(0, row.totalSlots - occupied),
      modules: row.breakers.map((b) => ({
        position: b.position + 1,
        type: b.type ?? null,
        calibre_A: b.calibre_A ?? null,
        poles: b.poles,
        ddr_type: b.ddr_type ?? null,
        sensibilite_mA: b.sensibilite_mA ?? null,
        circuit_type: b.circuit_type ?? null,
        nom: b.label?.trim() ? b.label.trim() : null,
        sous_titre: b.sublabel?.trim() ? b.sublabel.trim() : null,
        // true = nom proposé par l'IA, pas encore confirmé par l'électricien
        suggere: Boolean(b.suggested),
      })),
    };
  });

  const data = {
    nom: panel.project?.notes?.trim() || panel.project?.clientName?.trim() || "Tableau en cours",
    note: "Les modules sont listés de gauche à droite par rangée. Un champ à null = information non renseignée : ne l'invente pas.",
    rangees,
  };
  return JSON.stringify(data, null, 2);
}

// Envoie la conversation à Groq et renvoie le texte de la réponse de Volt.
export async function askVolt(messages: ChatMessage[], panel: Panel | null): Promise<string> {
  const system = SYSTEM_PROMPT.replace("{{TABLEAU_JSON}}", serializePanel(panel));
  const history = messages.slice(-MAX_HISTORY);

  const payload: Record<string, unknown> = {
    model: GROQ_MODEL,
    temperature: 0.3,
    max_tokens: 1024,
    messages: [{ role: "system", content: system }, ...history],
  };

  const res = await postGroq(payload);
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Volt est très sollicité là (limite Groq atteinte). Réessaie dans un instant.");
    }
    if (res.status === 401) {
      throw new Error("Connecte-toi pour discuter avec Volt.");
    }
    throw new Error("Volt n'a pas pu répondre. Vérifie ta connexion et réessaie.");
  }

  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (!text || !text.trim()) {
    throw new Error("Volt n'a renvoyé aucune réponse. Réessaie.");
  }
  return text.trim();
}

// Poste vers Groq, via le proxy Supabase (token utilisateur) ou en direct (clé .env).
async function postGroq(payload: Record<string, unknown>): Promise<Response> {
  if (USE_PROXY) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!supabaseUrl || !token) {
      throw new Error("Connecte-toi pour discuter avec Volt.");
    }
    return fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "groq", payload }),
    });
  }
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Clé Groq absente : ajoute VITE_GROQ_API_KEY dans ton .env pour activer Volt.");
  }
  return fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
