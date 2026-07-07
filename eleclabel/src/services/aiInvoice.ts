// Extraction des champs d'une facture par GPT-4o Vision (sortie JSON structurée).
// Bien plus robuste que l'OCR Tesseract sur photo floue / de travers / de taille
// variable : le modèle "comprend" la facture au lieu de lire caractère par caractère.
//
// Stratégie (smartExtractInvoice) :
//   1. Tente GPT-4o Vision → renvoie directement {date, fournisseur, n°, montant}
//   2. Repli sur Tesseract (ocrInvoice) si l'IA échoue (hors-ligne, non connecté, quota…)
// Ainsi la saisie reste automatique même sans réseau, mais devient bien plus fiable
// quand l'IA est disponible.
import type { InvoiceMetadata } from "../types/invoice";
import { postChatCompletion, USE_PROXY } from "./openai";
import { runOcr, extractInvoiceMetadata } from "./ocrInvoice";

const MODEL = "gpt-4o";

const SYSTEM =
  "Tu es un assistant comptable spécialisé dans la lecture de factures de fournisseurs " +
  "de matériel électrique, magasins de bricolage et fournisseurs d'énergie. " +
  "Tu analyses la PHOTO d'une facture et tu en extrais les champs clés avec précision. " +
  "Ne devine jamais : si un champ est illisible ou absent, laisse-le à null.";

const USER =
  "Extrais de cette facture : la DATE de la facture (celle d'émission, PAS l'échéance), " +
  "le NOM du fournisseur/enseigne (en-tête de la facture), le NUMÉRO de facture, et le " +
  "MONTANT TOTAL TTC à payer (le net à payer, pas le HT ni la TVA seule).";

// Structured Outputs : strict → tous les champs requis + nullable explicite.
const SCHEMA = {
  name: "invoice_fields",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      invoice_date: {
        type: ["string", "null"],
        description: "Date de la facture au format ISO AAAA-MM-JJ, ou null si illisible/absente",
      },
      supplier: {
        type: ["string", "null"],
        description: "Nom du fournisseur ou de l'enseigne (en-tête), ou null",
      },
      reference: {
        type: ["string", "null"],
        description: "Numéro de la facture, ou null",
      },
      amount_eur: {
        type: ["number", "null"],
        description: "Montant total TTC à payer, en euros (nombre décimal), ou null",
      },
    },
    required: ["invoice_date", "supplier", "reference", "amount_eur"],
  },
};

interface InvoiceAiResponse {
  invoice_date: string | null;
  supplier: string | null;
  reference: string | null;
  amount_eur: number | null;
}

/**
 * Extraction IA d'une facture. Retourne null en cas d'échec (le caller peut alors
 * basculer sur Tesseract). Ne lève pas : toute erreur → null.
 */
export async function extractInvoiceWithAI(
  base64: string,
  mimeType: string,
): Promise<InvoiceMetadata | null> {
  const apiKey = USE_PROXY ? "proxy" : import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await postChatCompletion(
      "openai",
      {
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: USER },
              {
                type: "image_url",
                // detail: "high" → lecture fine des petits caractères (montants, dates)
                image_url: { url: `data:${mimeType};base64,${base64}`, detail: "high" },
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 500,
        response_format: { type: "json_schema", json_schema: SCHEMA },
      },
      apiKey,
    );

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as InvoiceAiResponse;
    return normalizeAiResponse(parsed);
  } catch {
    return null;
  }
}

function normalizeAiResponse(r: InvoiceAiResponse): InvoiceMetadata {
  const meta: InvoiceMetadata = {};
  if (r.invoice_date && /^\d{4}-\d{2}-\d{2}$/.test(r.invoice_date)) meta.invoiceDate = r.invoice_date;
  if (r.supplier && r.supplier.trim()) meta.supplier = r.supplier.trim().slice(0, 60);
  if (r.reference && r.reference.trim()) meta.reference = r.reference.trim().slice(0, 30);
  if (typeof r.amount_eur === "number" && r.amount_eur > 0 && r.amount_eur < 1_000_000) {
    meta.amountCents = Math.round(r.amount_eur * 100);
  }
  return meta;
}

/** Vrai si l'extraction a trouvé au moins un champ exploitable. */
function hasAnyField(m: InvoiceMetadata): boolean {
  return Boolean(m.invoiceDate || m.supplier || m.reference || m.amountCents);
}

export interface InvoiceExtractionResult {
  metadata: InvoiceMetadata;
  rawText?: string;
  engine: "ai" | "ocr" | "none";
}

/**
 * Extraction "intelligente" : GPT-4o Vision d'abord, repli Tesseract sinon.
 * Ne lève jamais — renvoie au pire un résultat vide (engine "none").
 */
export async function smartExtractInvoice(
  base64: string,
  mimeType: string,
): Promise<InvoiceExtractionResult> {
  // 1) Tentative IA (précise, robuste au flou / à la perspective)
  const aiMeta = await extractInvoiceWithAI(base64, mimeType);
  if (aiMeta && hasAnyField(aiMeta)) {
    return { metadata: aiMeta, engine: "ai" };
  }

  // 2) Repli OCR local (hors-ligne, non connecté, ou IA sans résultat)
  try {
    const rawText = await runOcr(base64, mimeType);
    return { metadata: extractInvoiceMetadata(rawText), rawText, engine: "ocr" };
  } catch {
    return { metadata: {}, engine: "none" };
  }
}
