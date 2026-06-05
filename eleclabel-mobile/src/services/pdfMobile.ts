// Service mobile pour sauvegarde + partage de PDF.
// Sur web (npm run dev) : déclenche un téléchargement classique.
// Sur Android/iOS : écrit dans le dossier Documents puis ouvre la feuille de partage native.
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNative } from "./native";

// Convertit un Blob en chaîne base64 (sans le préfixe data:...)
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("FileReader failed"));
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(blob);
  });
}

// Web : déclenche un téléchargement standard via <a download>
function downloadBlobInBrowser(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Petit délai pour que le navigateur ait commencé à charger le blob
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Sauvegarde un PDF généré et propose à l'utilisateur de le partager.
 * Sur mobile, écrit dans Documents/ et ouvre la feuille de partage Android/iOS.
 * Sur web, déclenche le téléchargement direct.
 */
export async function savePdfAndShare(blob: Blob, filename: string): Promise<void> {
  if (!isNative()) {
    downloadBlobInBrowser(blob, filename);
    return;
  }

  const base64 = await blobToBase64(blob);

  // Écrit dans Documents/ — accessible via le gestionnaire de fichiers Android.
  // Pas de paramètre `encoding` → Capacitor traite `data` comme du base64 (binaire).
  const writeResult = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
  });

  // Ouvre la feuille de partage native (Gmail, WhatsApp, Drive, imprimante…)
  try {
    await Share.share({
      title: "Étiquettes ElecLabel",
      text: "Étiquettes générées avec ElecLabel — prêtes à imprimer en A4.",
      url: writeResult.uri,
      dialogTitle: "Partager le PDF",
    });
  } catch (err) {
    // Annulation utilisateur → pas une vraie erreur
    const msg = err instanceof Error ? err.message : String(err);
    if (!/cancel/i.test(msg)) {
      console.warn("Share failed, fichier reste dans Documents/:", msg);
    }
  }
}

/**
 * Variante : sauvegarde sans ouvrir le partage (utile pour archivage automatique).
 * Retourne l'URI natif du fichier sauvegardé.
 */
export async function savePdfOnly(blob: Blob, filename: string): Promise<string | null> {
  if (!isNative()) {
    downloadBlobInBrowser(blob, filename);
    return null;
  }
  const base64 = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64,
    directory: Directory.Documents,
  });
  return result.uri;
}
