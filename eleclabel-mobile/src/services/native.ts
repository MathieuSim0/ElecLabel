// Initialisation des plugins natifs Capacitor.
// Tous les appels sont protégés : si on tourne en navigateur (npm run dev), ils sont no-op.
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard, KeyboardResize } from "@capacitor/keyboard";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function initNative(): Promise<void> {
  if (!isNative()) return;

  // Barre de statut Android : noir sur fond blanc, ne recouvre pas l'app
  try {
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: "#FFFFFF" });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (err) {
    console.warn("StatusBar init failed:", err);
  }

  // Le clavier ne pousse pas la WebView : c'est l'app qui scrolle vers l'input
  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch (err) {
    console.warn("Keyboard init failed:", err);
  }
}
