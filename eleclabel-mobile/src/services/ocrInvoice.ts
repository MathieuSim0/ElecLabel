// OCR gratuit pour factures via Tesseract.js — fonctionne en navigateur et WebView.
// 100 % local, aucun appel API, fonctionne hors-ligne une fois les traineddata en cache.
//
// Chaîne de traitement pour maximiser la précision sur photo :
//   1. preprocessForOcr() : niveaux de gris + étirement de contraste + agrandissement
//   2. Tesseract (fra+eng) avec paramètres adaptés aux documents
//   3. extractInvoiceMetadata() : heuristiques regex robustes (date, montant, fournisseur, n°)
import { createWorker, PSM, type Worker } from "tesseract.js";
import type { InvoiceMetadata } from "../types/invoice";

// Worker partagé entre appels — évite de réinitialiser Tesseract à chaque scan
let cachedWorker: Worker | null = null;

async function getWorker(): Promise<Worker> {
  if (cachedWorker) return cachedWorker;
  const worker = await createWorker(["fra", "eng"], 1);
  // Paramètres adaptés à une facture (bloc de texte multi-colonnes, chiffres importants)
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.AUTO,
    preserve_interword_spaces: "1",
    user_defined_dpi: "300", // évite les avertissements + stabilise la reconnaissance
  });
  cachedWorker = worker;
  return worker;
}

/** Annule le worker (libère mémoire). À appeler au démontage de la page si on veut. */
export async function terminateOcrWorker(): Promise<void> {
  if (cachedWorker) {
    try {
      await cachedWorker.terminate();
    } catch {
      // ignore
    }
    cachedWorker = null;
  }
}

/**
 * Prétraitement image dédié OCR (différent du traitement "visuel" pour le PDF).
 *
 * Niveaux de gris + **normalisation d'illumination par division du fond** : on estime
 * l'éclairage local (reflets de soleil = zones claires, ombres = zones sombres) avec un
 * gros flou, puis on divise l'image par ce fond. Résultat : le papier redevient blanc
 * PARTOUT, reflets et ombres aplatis, et le texte reste sombre. C'est la technique
 * classique de "flat-field correction" des scanners de documents.
 *
 * Retourne un data URL PNG (sans perte, meilleur que JPEG pour l'OCR).
 */
async function preprocessForOcr(base64: string, mimeType: string): Promise<string> {
  const img = await loadImage(base64, mimeType);

  // Cible : plus grand côté entre 1500 et 2200 px. Compromis vitesse/lisibilité :
  // le temps Tesseract croît avec le nombre de pixels, et l'image scannée est déjà
  // recadrée sur la facture, donc pas besoin de très grand.
  const longest = Math.max(img.width, img.height);
  const target = Math.min(2200, Math.max(1500, longest));
  const scale = target / longest;
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return `data:${mimeType};base64,${base64}`;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;

  // 1) Niveaux de gris (luminance perçue)
  const gray = new Float32Array(px.length / 4);
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    gray[j] = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  }

  // 2) Estimation du fond d'illumination : gros flou (rayon ~ 1/18 du petit côté).
  //    Capture les variations lentes de lumière → reflets de soleil et ombres.
  const radius = Math.max(12, Math.round(Math.min(w, h) / 18));
  const bg = boxBlur(gray, w, h, radius);

  // 3) Division par le fond + courbe gamma → papier au blanc, texte sombre.
  //    ratio ≈ 1 sur le papier (même sous un reflet), < 1 sur l'encre.
  for (let i = 0, j = 0; i < px.length; i += 4, j++) {
    let ratio = gray[j] / (bg[j] + 1);
    if (ratio > 1) ratio = 1;          // tout ce qui est plus clair que son fond → blanc
    // gamma 1.5 → creuse les gris (le texte devient plus net/contrasté)
    const c = (Math.pow(ratio, 1.5) * 255) | 0;
    px[i] = c;
    px[i + 1] = c;
    px[i + 2] = c;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Flou de boîte séparable O(n) via sommes glissantes (rapide quel que soit le rayon).
 * Sert à estimer le fond d'illumination pour la correction des reflets/ombres.
 */
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);

  // Passe horizontale
  for (let y = 0; y < h; y++) {
    const off = y * w;
    let sum = 0;
    let count = 0;
    for (let x = 0; x <= r && x < w; x++) {
      sum += src[off + x];
      count++;
    }
    for (let x = 0; x < w; x++) {
      tmp[off + x] = sum / count;
      const addIdx = x + r + 1;
      const remIdx = x - r;
      if (addIdx < w) {
        sum += src[off + addIdx];
        count++;
      }
      if (remIdx >= 0) {
        sum -= src[off + remIdx];
        count--;
      }
    }
  }

  // Passe verticale
  for (let x = 0; x < w; x++) {
    let sum = 0;
    let count = 0;
    for (let y = 0; y <= r && y < h; y++) {
      sum += tmp[y * w + x];
      count++;
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / count;
      const addIdx = y + r + 1;
      const remIdx = y - r;
      if (addIdx < h) {
        sum += tmp[addIdx * w + x];
        count++;
      }
      if (remIdx >= 0) {
        sum -= tmp[remIdx * w + x];
        count--;
      }
    }
  }

  return out;
}

function loadImage(base64: string, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image OCR illisible"));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

/**
 * Lance l'OCR sur une image base64 et retourne le texte brut.
 * Applique d'abord le prétraitement dédié OCR.
 * Premier appel ~10-20 s (téléchargement traineddata), suivants ~2-5 s.
 */
export async function runOcr(base64: string, mimeType: string): Promise<string> {
  let input: string;
  try {
    input = await preprocessForOcr(base64, mimeType);
  } catch {
    // Si le prétraitement échoue, on tente quand même l'OCR sur l'image d'origine
    input = `data:${mimeType};base64,${base64}`;
  }
  const worker = await getWorker();
  const result = await worker.recognize(input);
  return result.data.text ?? "";
}

/** Extrait des champs facture à partir du texte brut — best effort */
export function extractInvoiceMetadata(rawText: string): InvoiceMetadata {
  return {
    invoiceDate: extractDate(rawText),
    supplier: extractSupplier(rawText),
    reference: extractReference(rawText),
    amountCents: extractAmount(rawText),
  };
}

// ─────────────────────── Extraction DATE ───────────────────────

interface DateHit {
  iso: string;
  index: number;
  score: number;
}

const MONTHS: Record<string, number> = {
  janvier: 1, janv: 1,
  février: 2, fevrier: 2, fev: 2, "févr": 2, fevr: 2,
  mars: 3,
  avril: 4, avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7, juil: 7,
  août: 8, aout: 8,
  septembre: 9, sept: 9, sep: 9,
  octobre: 10, oct: 10,
  novembre: 11, nov: 11,
  décembre: 12, decembre: 12, dec: 12, "déc": 12,
};

/**
 * Cherche toutes les dates et choisit la plus probable comme date de facture :
 *  - bonus si proche de "date", "facture", "émission"
 *  - malus si proche de "échéance", "paiement", "règlement" (= date d'échéance)
 */
function extractDate(text: string): string | undefined {
  const lower = text.toLowerCase();
  const hits: DateHit[] = [];

  // Format numérique : 15/05/2026, 15-05-2026, 15.05.2026, 15/05/26
  const numRe = /\b(0?[1-9]|[12]\d|3[01])\s*[\/.\-]\s*(0?[1-9]|1[0-2])\s*[\/.\-]\s*(20\d{2}|\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = numRe.exec(text)) !== null) {
    const day = parseInt(m[1], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    const month = parseInt(m[2], 10);
    const iso = toIso(year, month, day);
    if (iso) hits.push({ iso, index: m.index, score: contextScore(lower, m.index) });
  }

  // Format ISO : 2026-05-15
  const isoRe = /\b(20\d{2})\s*[\/.\-]\s*(0?[1-9]|1[0-2])\s*[\/.\-]\s*(0?[1-9]|[12]\d|3[01])\b/g;
  while ((m = isoRe.exec(text)) !== null) {
    const iso = toIso(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));
    if (iso) hits.push({ iso, index: m.index, score: contextScore(lower, m.index) });
  }

  // Format textuel : 15 mai 2026, 5 janv. 2026, 1er février 2026
  const txtRe = /\b(0?[1-9]|[12]\d|3[01])\s*(?:er)?\s+([a-zéûôà]+)\.?\s+(20\d{2})\b/gi;
  while ((m = txtRe.exec(text)) !== null) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) continue;
    const iso = toIso(parseInt(m[3], 10), month, parseInt(m[1], 10));
    if (iso) hits.push({ iso, index: m.index, score: contextScore(lower, m.index) });
  }

  if (hits.length === 0) return undefined;
  // Meilleur score ; à score égal, la date qui apparaît le plus tôt (en-tête)
  hits.sort((a, b) => b.score - a.score || a.index - b.index);
  return hits[0].iso;
}

function contextScore(lower: string, index: number): number {
  const ctx = lower.slice(Math.max(0, index - 40), index + 20);
  let score = 0;
  if (/date\s*(de\s*)?(facture|d['’]émission|émission|emission)/.test(ctx)) score += 10;
  else if (/\bfacture\b/.test(ctx)) score += 6;
  else if (/\bdate\b/.test(ctx)) score += 5;
  if (/échéance|echeance|paiement|règlement|reglement|payer\s+avant/.test(ctx)) score -= 8;
  return score;
}

function toIso(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2099) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

// ─────────────────────── Extraction MONTANT ───────────────────────

interface AmountHit {
  cents: number;
  value: number;
  score: number;
}

/**
 * Cherche le montant total TTC. Analyse LIGNE PAR LIGNE (label + montant sur la meme ligne)
 * + bonus "le total est presque toujours le plus GROS montant de la facture".
 */
function extractAmount(text: string): number | undefined {
  const lines = text.split(/\r?\n/);
  const moneyRe = /(\d{1,3}(?:[ .\u00a0]\d{3})+[,.]\d{2}|\d+[,.]\d{2})/g;
  const hits: AmountHit[] = [];
  let maxValue = 0;

  lines.forEach((line, i) => {
    const lower = line.toLowerCase();
    let m: RegExpExecArray | null;
    moneyRe.lastIndex = 0;
    while ((m = moneyRe.exec(line)) !== null) {
      const value = parseFrenchNumber(m[1]);
      if (value === null || value <= 0 || value >= 1_000_000) continue;

      let score = 0;
      // Mots-cles du total sur la meme ligne (du plus fort au plus faible)
      if (/total\s*t\.?\s*t\.?\s*c|net\s*[\u00e0a]\s*payer|total\s*g[\u00e9e]n[\u00e9e]ral|montant\s*(total|ttc|d[\u00fbu])/.test(lower))
        score += 14;
      else if (/\b[\u00e0a]\s*payer\b/.test(lower)) score += 11;
      else if (/\bttc\b/.test(lower)) score += 7;
      else if (/\btotal\b/.test(lower)) score += 6;
      else if (/\bmontant\b/.test(lower)) score += 3;
      // Malus : lignes qui ne sont PAS le total a payer
      if (/\bt\.?\s*v\.?\s*a\.?\b|hors\s*taxe|\bh\.?\s*t\.?\b|sous[\s-]*total|acompte|remise|quantit/.test(lower))
        score -= 7;
      if (/\u20ac|eur/.test(lower)) score += 1;
      // Bas du document legerement favorise
      score += (i / Math.max(1, lines.length)) * 2;

      hits.push({ cents: Math.round(value * 100), value, score });
      if (value > maxValue) maxValue = value;
    }
  });

  if (hits.length === 0) return undefined;

  // Bonus de "grosseur" : le total TTC est generalement le plus gros montant.
  // Decisif quand aucun mot-cle n'a ete reconnu (OCR rate sur le label).
  for (const h of hits) {
    if (maxValue > 0) h.score += (h.value / maxValue) * 4;
  }

  hits.sort((a, b) => b.score - a.score || b.value - a.value);
  return hits[0].cents;
}

function parseFrenchNumber(s: string): number | null {
  let t = s.replace(/[  ]/g, "");
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  // Le séparateur décimal est le dernier des deux ; l'autre est un séparateur de milliers
  if (lastComma > lastDot) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else {
    t = t.replace(/,/g, "");
  }
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

// ─────────────────────── Extraction N° FACTURE ───────────────────────

function extractReference(text: string): string | undefined {
  const patterns = [
    /(?:facture|invoice)\s*(?:n[°ºo]?|num[ée]ro)?\s*[:#]?\s*([A-Z0-9][\w\-./]{2,20})/i,
    /n[°ºo]\s*(?:de\s*)?(?:facture|invoice)?\s*[:#]?\s*([A-Z0-9][\w\-./]{2,20})/i,
    /r[ée]f(?:[ée]rence)?\.?\s*[:#]?\s*([A-Z0-9][\w\-./]{2,20})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const ref = m[1].replace(/[^\w\-./]/g, "").slice(0, 20);
      if (ref.length >= 3 && /\d/.test(ref)) return ref; // doit contenir au moins un chiffre
    }
  }
  return undefined;
}

// ─────────────────────── Extraction TITRE / FOURNISSEUR ───────────────────────

const KNOWN_SUPPLIERS = [
  "schneider", "legrand", "hager", "rexel", "sonepar", "yesss", "cged", "sonelec",
  "leroy merlin", "castorama", "bricomarché", "brico", "point p", "cedeo", "prolians",
  "edf", "engie", "totalenergies", "enedis", "amazon", "manomano",
];

/**
 * Récupère le "titre numéro 1" de la facture = l'en-tête en haut (nom de l'entreprise),
 * utilisé directement comme nom de la facture pour le pré-remplissage.
 *
 * Stratégie :
 *  1. Si un fournisseur connu apparaît dans les premières lignes → on le prend (nom propre).
 *  2. Sinon, on score les premières lignes pour trouver le vrai titre (en-tête société) :
 *     bonus aux lignes du tout en haut, en MAJUSCULES ou Capitalisées, surtout des lettres ;
 *     malus aux dates, numéros, adresses, et mots techniques (facture, tva, siret…).
 */
function extractSupplier(text: string): string | undefined {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3 && l.length <= 60);

  // 1) Fournisseur connu en haut → priorité absolue
  for (const line of rawLines.slice(0, 8)) {
    const low = line.toLowerCase();
    for (const k of KNOWN_SUPPLIERS) {
      if (low.includes(k)) return capitalize(k);
    }
  }

  // 2) Score des premières lignes pour isoler le titre / en-tête
  const scored = rawLines.slice(0, 6).map((line, i) => ({
    line: cleanTitle(line),
    score: scoreTitleLine(cleanTitle(line), i),
  }));

  let bestLine = "";
  let bestScore = 0;
  for (const c of scored) {
    if (c.line.length >= 3 && c.score > bestScore) {
      bestScore = c.score;
      bestLine = c.line;
    }
  }

  return bestLine ? bestLine.slice(0, 40) : undefined;
}

/** Note une ligne candidate comme titre/en-tête de société (plus c'est haut, mieux c'est). */
function scoreTitleLine(cleaned: string, indexFromTop: number): number {
  if (cleaned.length < 3) return -100;

  const letters = (cleaned.match(/[A-Za-zÀ-ÿ]/g) ?? []).length;
  const digits = (cleaned.match(/\d/g) ?? []).length;
  const letterRatio = letters / cleaned.length;

  let score = 0;
  // Le titre est presque toujours tout en haut
  score += (6 - indexFromTop) * 2;
  // Doit être majoritairement composé de lettres
  if (letterRatio >= 0.6) score += 5;
  if (letterRatio < 0.4) score -= 6;
  // Les noms d'entreprise sont souvent en MAJUSCULES ou en Title Case
  if (cleaned === cleaned.toUpperCase() && letters >= 3) score += 4;
  else if (/^[A-ZÀ-Ý]/.test(cleaned)) score += 2;
  // Forme juridique = très bon signe de raison sociale
  if (/\b(sarl|sas|sasu|eurl|sa|sàrl|ets|établissements|entreprise|société|electricit[ée]|élec)\b/i.test(cleaned))
    score += 6;

  // Malus : ce qui n'est PAS un titre
  if (/^[\d./\-\s]+$/.test(cleaned)) score -= 12;                        // que des chiffres/séparateurs
  if (digits > letters) score -= 8;                                      // surtout des chiffres
  if (/facture|invoice|devis|\bdate\b|tva|siret|siren|\bn[°ºo]\b/i.test(cleaned)) score -= 10;
  if (/\b(t[ée]l|tel|email|e-mail|www|http|@|adresse|code\s*postal|cedex)\b/i.test(cleaned)) score -= 7;
  if (/^\d{1,4}\s+(rue|avenue|av|bd|boulevard|chemin|impasse|all[ée]e|place)/i.test(cleaned)) score -= 9;

  return score;
}

/** Nettoie une ligne de titre : retire les caractères parasites en bord, espaces multiples. */
function cleanTitle(line: string): string {
  return line
    .replace(/^[^A-Za-zÀ-ÿ0-9]+/, "")
    .replace(/[^A-Za-zÀ-ÿ0-9.&'’\- ]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function capitalize(s: string): string {
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
