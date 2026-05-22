// Bandeau de mise à jour automatique (desktop Tauri uniquement).
// Au démarrage, vérifie s'il existe une version plus récente publiée sur GitHub Releases.
// Si oui → propose de l'installer, télécharge, applique et redémarre l'app.
// En navigateur (npm run dev) ou sur mobile, le composant ne fait rien.
import { useEffect, useState } from "react";

type Status = "idle" | "available" | "downloading" | "error";

// Détecte si on tourne dans l'app native Tauri (vs navigateur)
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Type minimal de l'objet Update retourné par le plugin (on n'utilise que ces champs)
interface TauriUpdate {
  version: string;
  downloadAndInstall: (onEvent: (e: DownloadEvent) => void) => Promise<void>;
}
interface DownloadEvent {
  event: "Started" | "Progress" | "Finished";
  data?: { contentLength?: number; chunkLength?: number };
}

export default function UpdateBanner() {
  const [status, setStatus] = useState<Status>("idle");
  const [version, setVersion] = useState("");
  const [progress, setProgress] = useState(0);
  const [update, setUpdate] = useState<TauriUpdate | null>(null);

  // Vérification au démarrage
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const found = (await check()) as TauriUpdate | null;
        if (!cancelled && found) {
          setUpdate(found);
          setVersion(found.version);
          setStatus("available");
        }
      } catch (err) {
        // Pas de réseau / pas de release / endpoint vide → on n'affiche rien
        console.warn("Vérification de mise à jour échouée :", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const install = async () => {
    if (!update) return;
    setStatus("downloading");
    setProgress(0);
    try {
      let downloaded = 0;
      let total = 0;
      await update.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data?.contentLength ?? 0;
        else if (e.event === "Progress") {
          downloaded += e.data?.chunkLength ?? 0;
          if (total > 0) setProgress(Math.round((downloaded / total) * 100));
        } else if (e.event === "Finished") {
          setProgress(100);
        }
      });
      // Mise à jour appliquée → redémarrage de l'app
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (err) {
      console.error("Échec de la mise à jour :", err);
      setStatus("error");
    }
  };

  if (status === "idle") return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "linear-gradient(135deg, #111827, #1F2937)",
        color: "#FFFFFF",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        fontSize: 13,
        fontFamily: "var(--font-sans)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ fontSize: 16 }}>⚡</span>

      {status === "available" && (
        <>
          <span>
            Nouvelle version <b>{version}</b> disponible.
          </span>
          <button
            type="button"
            onClick={install}
            style={{
              padding: "6px 16px",
              fontSize: 12,
              fontWeight: 700,
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #E63946, #C0303C)",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Installer et redémarrer
          </button>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "rgba(255,255,255,0.85)",
              cursor: "pointer",
            }}
          >
            Plus tard
          </button>
        </>
      )}

      {status === "downloading" && (
        <>
          <span>Téléchargement de la mise à jour… {progress}%</span>
          <div
            style={{
              width: 160,
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.2)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "#E63946",
                transition: "width 0.2s ease",
              }}
            />
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <span>Échec de la mise à jour. Réessaie plus tard ou télécharge manuellement.</span>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            style={{
              padding: "6px 12px",
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "transparent",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            Fermer
          </button>
        </>
      )}
    </div>
  );
}
