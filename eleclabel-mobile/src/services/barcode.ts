// Décodage de code-barres à partir d'une image capturée (réutilise le scanner
// caméra des factures). S'appuie sur l'API navigateur BarcodeDetector, disponible
// dans le WebView Android (Chrome). Si indisponible ou aucun code lisible → null
// (l'UI bascule alors sur la saisie manuelle).

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image illisible"));
    img.src = src;
  });
}

export function barcodeSupported(): boolean {
  return typeof (globalThis as { BarcodeDetector?: unknown }).BarcodeDetector === "function";
}

// Renvoie le 1ᵉʳ code-barres lisible dans l'image, ou null.
export async function decodeBarcode(base64: string, mime = "image/jpeg"): Promise<string | null> {
  try {
    const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) return null;
    const detector = new Ctor();
    const img = await loadImage(`data:${mime};base64,${base64}`);
    const codes = await detector.detect(img);
    const value = codes?.[0]?.rawValue?.trim();
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
