// Rendu d'emojis sur canvas → data URL PNG, pour l'intégration dans react-pdf
// react-pdf ne supporte pas les glyphes emoji natifs — on les pré-rend côté navigateur

const cache = new Map<string, string>();

// Rend un emoji sur un canvas et retourne un data URL PNG
export function emojiToDataUrl(emoji: string, size = 22): string {
  if (cache.has(emoji)) return cache.get(emoji)!;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    ctx.clearRect(0, 0, size, size);
    ctx.font = `${Math.floor(size * 0.78)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(emoji, size / 2, size / 2 + 1);

    const dataUrl = canvas.toDataURL("image/png");
    cache.set(emoji, dataUrl);
    return dataUrl;
  } catch {
    return "";
  }
}

// Construit une map emoji → data URL pour un ensemble d'icônes (dédupliqué)
export function buildIconMap(icons: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const icon of new Set(icons)) {
    const dataUrl = emojiToDataUrl(icon);
    if (dataUrl) map[icon] = dataUrl;
  }
  return map;
}
