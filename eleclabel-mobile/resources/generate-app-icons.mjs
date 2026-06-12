// Génère tous les PNG sources d'icônes depuis le logo "Badge" (concept C).
// Utilise sharp pour rendre le SVG en PNG haute résolution.
//
// Sorties :
//   eleclabel-mobile/assets/icon-only.png        1024  (icône iOS / legacy Android)
//   eleclabel-mobile/assets/icon-foreground.png  1024  (Android adaptatif — 1er plan)
//   eleclabel-mobile/assets/icon-background.png  1024  (Android adaptatif — fond)
//   eleclabel-mobile/assets/splash.png           2732  (écran de démarrage)
//   eleclabel-mobile/assets/splash-dark.png      2732  (idem, mode sombre)
//   eleclabel/src-tauri/app-icon.png             1024  (source pour `tauri icon`)
//
// Lancer depuis eleclabel-mobile/ :  node resources/generate-app-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = resolve(HERE, "..");
const DESKTOP_SRC_TAURI = resolve(MOBILE_ROOT, "../eleclabel/src-tauri");

// ── Briques SVG du logo Badge ──
const DEFS = `
  <linearGradient id="bg" x1="70" y1="40" x2="450" y2="490" gradientUnits="userSpaceOnUse">
    <stop stop-color="#1F2C44"/><stop offset="1" stop-color="#0C1426"/>
  </linearGradient>
  <linearGradient id="ring" x1="120" y1="120" x2="392" y2="392" gradientUnits="userSpaceOnUse">
    <stop stop-color="#F2495A"/><stop offset="1" stop-color="#C0303C"/>
  </linearGradient>
  <linearGradient id="bolt" x1="256" y1="150" x2="256" y2="362" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FF5663"/><stop offset="1" stop-color="#E63946"/>
  </linearGradient>`;

// Anneau + 2 points + éclair (coords dans un canvas 512)
const DESIGN = `
  <circle cx="256" cy="256" r="150" stroke="url(#ring)" stroke-width="26" fill="none"/>
  <circle cx="256" cy="92" r="13" fill="#E63946"/>
  <circle cx="256" cy="420" r="13" fill="#E63946"/>
  <path d="M288 138 L168 298 L246 298 L222 374 L344 244 L266 244 Z"
        fill="url(#bolt)" stroke="#FFFFFF" stroke-width="3" stroke-linejoin="round"/>`;

// Met le design à l'échelle autour du centre (256,256)
function scaled(s) {
  return `<g transform="translate(256 256) scale(${s}) translate(-256 -256)">${DESIGN}</g>`;
}

// ── 5 variantes ──

// Icône pleine (fond + design) — iOS / Android legacy
const svgIconOnly = `<svg width="1024" height="1024" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}</defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <path d="M0 0 L280 0 L0 280 Z" fill="#FFFFFF" opacity="0.045"/>
  ${scaled(0.90)}
</svg>`;

// 1er plan adaptatif Android — fond transparent, design dans la zone sûre (66%)
const svgIconForeground = `<svg width="1024" height="1024" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}</defs>
  ${scaled(0.82)}
</svg>`;

// Fond adaptatif Android — uni
const svgIconBackground = `<svg width="1024" height="1024" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>${DEFS}</defs>
  <rect width="512" height="512" fill="url(#bg)"/>
</svg>`;

// Écran de démarrage — fond navy + badge arrondi centré
function svgSplash() {
  const badge = 820;
  const off = (2732 - badge) / 2;
  const s = badge / 512;
  return `<svg width="2732" height="2732" viewBox="0 0 2732 2732" xmlns="http://www.w3.org/2000/svg">
    <defs>${DEFS}</defs>
    <rect width="2732" height="2732" fill="#0E1830"/>
    <g transform="translate(${off} ${off}) scale(${s})">
      <rect width="512" height="512" rx="116" fill="url(#bg)"/>
      <path d="M0 0 L280 0 L0 280 Z" fill="#FFFFFF" opacity="0.045"/>
      ${DESIGN}
    </g>
  </svg>`;
}

// ── Rendu ──
// Les SVG ont déjà width=size. Densité 192 → suréchantillonnage ~2,7× pour un rendu net,
// puis resize à la taille exacte. Reste sous la limite de pixels de sharp même en 2732px.
async function render(svg, outPath, size) {
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg), { density: 192, limitInputPixels: false })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  console.log("  ✓", outPath);
}

async function main() {
  console.log("Génération des icônes ElecLabel (logo Badge)…\n");

  const assets = resolve(MOBILE_ROOT, "assets");
  await render(svgIconOnly, resolve(assets, "icon-only.png"), 1024);
  await render(svgIconForeground, resolve(assets, "icon-foreground.png"), 1024);
  await render(svgIconBackground, resolve(assets, "icon-background.png"), 1024);
  await render(svgSplash(), resolve(assets, "splash.png"), 2732);
  await render(svgSplash(), resolve(assets, "splash-dark.png"), 2732);

  // Source pour Tauri (desktop)
  await render(svgIconOnly, resolve(DESKTOP_SRC_TAURI, "app-icon.png"), 1024);

  console.log("\n✓ Terminé.");
  console.log("  Mobile  → npx @capacitor/assets generate");
  console.log("  Desktop → cd ../eleclabel && npm run tauri icon src-tauri/app-icon.png");
}

main().catch((err) => {
  console.error("Échec :", err);
  process.exit(1);
});
