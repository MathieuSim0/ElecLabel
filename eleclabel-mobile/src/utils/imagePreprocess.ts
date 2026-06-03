// Prétraitement d'image — redimensionnement et amélioration pour la détection IA

export interface ImageInfo {
  base64: string;
  mimeType: string;
  width: number;
  height: number;
}

function loadImage(base64: string, mimeType: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Impossible de charger l'image"));
    img.src = `data:${mimeType};base64,${base64}`;
  });
}

// Redimensionne + augmente contraste et netteté pour faciliter la lecture des labels
function exportEnhanced(img: HTMLImageElement, maxWidth: number): string {
  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const ratio = Math.min(1, maxWidth / sw);
  const dw = Math.max(1, Math.round(sw * ratio));
  const dh = Math.max(1, Math.round(sh * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");

  // Fond blanc (évite la transparence des PNG)
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, dw, dh);

  // Premier rendu : redimensionnement propre
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, sw, sh, 0, 0, dw, dh);

  // Deuxième passe : contraste + luminosité pour les photos sombres
  ctx.filter = "contrast(1.30) brightness(1.08) saturate(0.85)";
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = "none";

  return canvas.toDataURL("image/jpeg", 0.92).split(",")[1];
}

export async function loadAndResize(
  base64: string,
  mimeType: string,
  maxWidth = 3072,
): Promise<ImageInfo> {
  const img = await loadImage(base64, mimeType);
  const enhanced = exportEnhanced(img, maxWidth);
  return {
    base64: enhanced,
    mimeType: "image/jpeg",
    width: img.naturalWidth,
    height: img.naturalHeight,
  };
}

// Coupe une bande horizontale de l'image entre top et bottom (coords normalisées 0–1).
// Utilisé pour analyser chaque rail DIN indépendamment — chaque disjoncteur passe
// de ~50 px à plusieurs centaines de pixels, ce qui restaure la précision de détection.
export async function cropImageY(
  base64: string,
  mimeType: string,
  top: number,
  bottom: number,
): Promise<{ base64: string; mimeType: string }> {
  const img = await loadImage(base64, mimeType);
  const h = img.naturalHeight;
  const w = img.naturalWidth;
  const sy = Math.max(0, Math.floor(h * top));
  const sh = Math.max(1, Math.min(h - sy, Math.floor(h * (bottom - top))));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponible");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, w, sh);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, sy, w, sh, 0, 0, w, sh);

  // Contraste renforcé aussi sur le crop
  ctx.filter = "contrast(1.25) brightness(1.06) saturate(0.9)";
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = "none";

  return {
    base64: canvas.toDataURL("image/jpeg", 0.92).split(",")[1],
    mimeType: "image/jpeg",
  };
}
