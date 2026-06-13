# Pipeline d'analyse IA des tableaux électriques

Comment ElecLabel transforme une photo de tableau en structure de données exacte.
Code source : `src/services/openai.ts`.

---

## 1. Objectif

À partir d'une photo, reconstituer **sans erreur** :
- le nombre de rangées (rails DIN),
- le nombre de modules par rangée,
- le nombre de pôles de chaque module (1P / 2P / 3P / 4P),
- la position exacte de chaque module sur le rail.

La moindre erreur de comptage rend les étiquettes inexploitables → le pipeline est conçu
pour la fiabilité maximale, pas pour la vitesse.

---

## 2. Vue d'ensemble du pipeline

```
   Photo
     │
     ▼
┌─────────────────────────┐
│ 0. Prétraitement image  │  loadAndResize() — 3072px max, contraste/luminosité
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 1. Consensus global     │  2-3 passes GPT-4o à températures différentes
│    (self-consistency)   │  + agreementScore + arbitrage
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 2. Vérification zoom     │  cropImageY() découpe par rangée → ré-analyse focalisée
│    par rangée            │  applyZoomCorrection si divergence
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 3. Post-traitement      │  parse · normalise · dédup hallucinations · split rangées
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ 4. Suggestions labels   │  applySuggestions() — règles NF C 15-100 (pôles + ampérage)
└───────────┬─────────────┘
            ▼
        Panel structuré

   (Fallback : si OpenAI échoue → Groq Llama 4 Scout/Maverick)
```

---

## 3. Étape 0 — Prétraitement (`utils/imagePreprocess.ts`)

- **Redimensionnement** à 3072 px sur le plus grand côté (taille max exploitable par GPT-4o en `detail: high`).
- **Renforcement** du contraste et de la luminosité via Canvas → améliore la distinction manettes / cache-bornes.
- Sortie JPEG qualité élevée pour limiter la taille transmise.

---

## 4. Étape 1 — Consensus global (self-consistency)

Le cœur de la fiabilité. Au lieu d'un seul appel, on lance plusieurs analyses et on les fait converger.

```
MAIN_TEMPS = [0.0, 0.4]      // 2 passes parallèles
TIEBREAKER_TEMP = 0.7        // 3ᵉ passe si désaccord
```

1. **Passes 1 et 2** envoyées en parallèle (températures 0.0 et 0.4).
2. `agreementScore(p1, p2)` mesure l'accord rangée par rangée :
   - somme des différences absolues du nombre de modules par rangée,
   - transformée en score `exp(-diff × 0.35)` ∈ [0, 1].
3. **Si score ≥ 0.85** → on garde la passe déterministe (température 0).
4. **Sinon** → 3ᵉ passe arbitre (température 0.7) puis `pickBestAmongCandidates()` :
   choisit la sortie qui minimise la distance moyenne aux autres (médiane robuste),
   conservatrice en cas d'égalité (préfère le moins de modules).

### Garde-fous du prompt global (`SYSTEM_GLOBAL`)

Prompt système d'environ 1500 mots structuré comme un mode opératoire industriel :

- **Checklist positive** : ce qui caractérise un module (corps plastique, manette basculante, rail).
- **Checklist négative** : ce qui n'est PAS un module (cache-borne lisse, peigne d'alimentation, câblage).
- **Test de solidarité** pour les pôles : barre transversale / corps unique → 2P+ ; joint vertical → 1P indépendants.
- **Calcul croisé** par largeur : >1.6× un 1P = 2P, >2.5× = 3P, >3.5× = 4P.
- **Procédure A→F** : inventaire des rails → capacité → double comptage gauche/droite → analyse module par module → découpage en rangées → validation finale.
- **10 erreurs à ne jamais commettre** (oubli de bord, fusion induite, différentiel mal classé…).
- **3 exemples calibrés** sur des cas réels.

### JSON Schema strict + reasoning

La sortie est imposée par `response_format: { type: "json_schema", strict: true }`.
Le schéma inclut un champ **`reasoning` obligatoire** (raisonnement par rail avec
double-comptage `count_LR` / `count_RL`) → c'est une variante imposée de **Chain-of-Thought** :
le modèle doit expliciter sa logique avant de produire la liste finale.

> Le paramètre **`detail: "high"`** est indispensable : sans lui GPT-4o analyse l'image en
> basse résolution et rate les barres transversales / joints qui déterminent le nombre de pôles.

---

## 5. Étape 2 — Vérification zoom par rangée

Redondance qui rattrape les erreurs du modèle sur les grandes images.

1. `cropImageY(top, bottom)` découpe l'image en tranches horizontales — une par rangée — avec un **padding de 40 %** pour ne couper aucun module.
2. Chaque tranche est ré-analysée par GPT-4o avec un prompt court (`SYSTEM_ROW`) focalisé sur **une seule rangée**, retournant `{ count, poles[] }`.
3. Si le zoom diverge du global, `applyZoomCorrection()` reconstruit la rangée à partir des pôles vérifiés **en préservant les labels par index**.

Toutes les rangées sont vérifiées **en parallèle** (`Promise.all`).

---

## 6. Étape 3 — Post-traitement

| Fonction | Rôle |
|---|---|
| `extractJson()` | Extrait le JSON même entouré de texte parasite |
| `parseAndNormalize()` | Valide la structure, normalise les positions (pas de chevauchement) |
| `clampPoles()` | Borne les pôles à [1, 4] |
| `dedupeHallucinations()` | Efface les labels apparus ≥ 3 fois (boucles du modèle) |
| `splitAllRows()` | Sépare une rangée en 2 si trou ≥ 3 slots consécutifs |
| `fillInnerGaps()` | (fallback Groq) comble les slots vides internes |

---

## 7. Étape 4 — Suggestions de labels (`utils/smartSuggest.ts`)

L'IA ne lit **aucun** texte d'étiquette (seule la géométrie est demandée). Les labels affichés
sont générés par règles métier basées sur le couple **(nombre de pôles, ampérage)** selon la
norme **NF C 15-100** :

| Pôles | Ampérage | Suggestion principale |
|---|---|---|
| 1P | 16A | Prises (séjour, cuisine, chambre…) |
| 1P | 10A | Éclairage (par pièce) |
| 2P | 20A | Chauffe-eau / Lave-linge / Climatisation |
| 2P | 32A | Cuisinière / Plaque induction |
| 2P | 30mA | Différentiel |
| 3P | 63A | Général 3P |
| 4P | 63A | Général 4P / Arrivée 3P+N |

Chaque suggestion est marquée `suggested: true` pour que l'UI la distingue visuellement
(italique + étoile ✨). Des pools rotatifs évitent les doublons.

---

## 8. Fallback Groq

Si OpenAI échoue (rate-limit 429, erreur réseau), bascule automatique sur **Groq** :
1. `meta-llama/llama-4-scout-17b-16e-instruct`
2. puis `meta-llama/llama-4-maverick-17b-128e-instruct`

Prompt simplifié, `response_format: json_object`. Sortie passée par le même post-traitement.

---

## 9. Coûts & performance

| Élément | Ordre de grandeur |
|---|---|
| Coût par analyse (OpenAI, `detail: high`, 2-3 passes + zoom) | ~0,01–0,02 € |
| Durée typique | 10–25 s (plusieurs appels parallèles) |
| Entraînement de modèle | **aucun** (pure orchestration / prompt engineering) |

**Avantages de l'approche sans fine-tuning** : pas de dataset annoté à constituer, pas de coût
d'entraînement, évolutivité immédiate (changer de modèle = changer une constante), robustesse
via le fallback multi-fournisseurs.

---

## 10. Variables d'environnement

```env
VITE_OPENAI_API_KEY=sk-...     # principal — GPT-4o Vision
VITE_GROQ_API_KEY=gsk_...      # optionnel — active le fallback
```
