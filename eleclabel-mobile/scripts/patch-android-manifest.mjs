// Ajoute les permissions natives manquantes dans AndroidManifest.xml.
// Le dossier android/ étant régénéré (cap add android), on ré-injecte les permissions
// à chaque build. À lancer depuis eleclabel-mobile/ après `npx cap sync android`.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MANIFEST = "android/app/src/main/AndroidManifest.xml";

if (!existsSync(MANIFEST)) {
  console.log("AndroidManifest.xml absent — rien à patcher.");
  process.exit(0);
}

let xml = readFileSync(MANIFEST, "utf8");
let changed = false;

// Permissions requises (caméra pour le scanner de factures)
const permissions = ["android.permission.CAMERA"];
for (const perm of permissions) {
  if (!xml.includes(perm)) {
    xml = xml.replace(
      /<application/,
      `<uses-permission android:name="${perm}" />\n    <application`,
    );
    changed = true;
    console.log(`+ permission ${perm}`);
  }
}

// Déclare la caméra comme matériel optionnel (évite le rejet sur appareils sans caméra)
if (!xml.includes('android.hardware.camera')) {
  xml = xml.replace(
    /<application/,
    `<uses-feature android:name="android.hardware.camera" android:required="false" />\n    <application`,
  );
  changed = true;
  console.log("+ uses-feature camera (optionnel)");
}

if (changed) {
  writeFileSync(MANIFEST, xml);
  console.log("AndroidManifest.xml patché.");
} else {
  console.log("AndroidManifest.xml déjà OK.");
}
