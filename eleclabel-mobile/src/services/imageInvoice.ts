// Traitement image facture : auto-rotation EXIF + boost contraste/luminosité.
// Tout est fait via canvas natif (zero dépendance), fonctionne en navigateur et WebView.

interface ProcessedImage {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

/**
 * Charge une image base64 et la retourne :
 *   - Redressée selon l'orientation EXIF (si JPEG avec tag d'orientation)
 *   - Contraste/luminosité augmentés pour faciliter la lecture (et l'OCR)
 *   - Limitée à maxSize px sur le plus grand côté (3000px par défaut)
 *
 * Retourne le résultat en JPEG qualité 90 (bon compromis taille/qualité pour facture).
 */
export async function processInvoiceImage(
  base64: string,
  mimeType: string,
  maxSize = 3000,
): Promise<ProcessedImage> {
  const img = await loadImageFromBase64(base64, mimeType);

  // 1. Calcul dimensions cibles
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  // 2. Dessin sur canvas + filter CSS pour contraste/luminosité
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D unavailable");

  // Boost contraste 15% + luminosité 8% + saturation 0.95 (légèrement désaturée = plus propre)
  // Compatible Chrome / Safari / Android WebView
  ctx.filter = "contrast(1.15) brightness(1.08) saturate(0.95)";
  ctx.drawImage(img, 0, 0, w, h);

  // 3. Optionnel : netteté légère via convolution (uniquement si performant)
  // Skipped pour rester rapide sur mobile bas de gamme.

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const cleanBase64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

  return {
    base64: cleanBase64,
    mimeType: "image/jpeg",
    width: w,
    height: h,
  };
}

/** Charge une image base64 dans un HTMLImageElement (avec correction d'orientation EXIF auto par navigateur moderne) */
function loadImageFromBase64(base64: string, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Demande explicite au navigateur d'appliquer l'orientation EXIF (Chrome 81+, Safari 13+)
    img.decoding = "sync";
    (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "high";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image."));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

/** Crée une miniature (300px max) à partir d'une image base64 — pour les listes */
export async function createInvoiceThumbnail(
  base64: string,
  mimeType: string,
  maxSize = 300,
): Promise<string | undefined> {
  try {
    return await new Promise<string>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.65).replace(/^data:image\/jpeg;base64,/, ""));
      };
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = `data:${mimeType};base64,${base64}`;
    });
  } catch {
    return undefined;
  }
}
