import type { CapacitorConfig } from "@capacitor/cli";

// Configuration Capacitor — appId inversé (fr.alainsimon.eleclabel) pour Play Store
// Les plugins listés ici doivent matcher ceux installés dans package.json.
const config: CapacitorConfig = {
  appId: "fr.alainsimon.eleclabel",
  appName: "ElecLabel",
  webDir: "dist",
  bundledWebRuntime: false,
  android: {
    // Permet aux WebViews de charger les images locales (data:image base64)
    allowMixedContent: false,
    // Empêche les utilisateurs de zoomer accidentellement par double-tap
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    Camera: {
      // Demande explicite au démarrage du plugin (Android API 23+)
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: {
      // Évite que la barre de statut Android écrase notre header
      style: "DARK",
      backgroundColor: "#FFFFFF",
      overlaysWebView: false,
    },
    Keyboard: {
      // Le clavier ne pousse pas la WebView : on laisse l'app gérer le scroll
      resize: "body",
      style: "DEFAULT",
    },
  },
};

export default config;
