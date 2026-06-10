// Scanner de facture : aperçu caméra plein écran (derrière la WebView) + cadre overlay.
// L'utilisateur place la facture dans le cadre, capture → on recadre sur le cadre →
// image ciblée et propre = OCR plus rapide et plus précis.
//
// Marche uniquement en natif (Capacitor). En navigateur, l'appelant utilise un fallback.
import { useEffect, useRef, useState } from "react";
import { CameraPreview } from "@capacitor-community/camera-preview";

interface DocumentScannerProps {
  onCapture: (base64: string, mimeType: string) => void;
  onCancel: () => void;
}

// Marges du cadre (fraction de l'écran ET de l'image capturée → recadrage cohérent)
const MARGIN_X = 0.05; // 5 % gauche + droite
const MARGIN_Y = 0.11; // 11 % haut + bas

export default function DocumentScanner({ onCapture, onCancel }: DocumentScannerProps) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    // Rend le fond transparent pour voir la caméra (rendue derrière la WebView)
    const prevHtml = document.documentElement.style.backgroundColor;
    const prevBody = document.body.style.backgroundColor;
    const root = document.getElementById("root");
    const prevRoot = root?.style.backgroundColor ?? "";
    document.documentElement.style.backgroundColor = "transparent";
    document.body.style.backgroundColor = "transparent";
    if (root) root.style.backgroundColor = "transparent";

    (async () => {
      try {
        await CameraPreview.start({
          position: "rear",
          toBack: true, // caméra DERRIÈRE la WebView → overlay HTML visible dessus
          disableAudio: true,
          width: window.screen.width,
          height: window.screen.height,
          x: 0,
          y: 0,
        });
        if (!cancelled) {
          startedRef.current = true;
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) setError("Caméra indisponible : " + String(err));
      }
    })();

    return () => {
      cancelled = true;
      // Restaure les fonds
      document.documentElement.style.backgroundColor = prevHtml;
      document.body.style.backgroundColor = prevBody;
      if (root) root.style.backgroundColor = prevRoot;
      if (startedRef.current) {
        CameraPreview.stop().catch(() => {});
        startedRef.current = false;
      }
    };
  }, []);

  const handleCapture = async () => {
    if (busy || !ready) return;
    setBusy(true);
    setError(null);
    try {
      const result = await CameraPreview.capture({ quality: 92 });
      const fullBase64 = result.value;
      const cropped = await cropToFrame(fullBase64);
      onCapture(cropped, "image/jpeg");
    } catch (err) {
      setError("Échec de la capture : " + String(err));
      setBusy(false);
    }
  };

  // Masque sombre = 4 rectangles autour du cadre central
  const maskColor = "rgba(0,0,0,0.55)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "transparent" }}>
      {/* ── Masques sombres autour du cadre ── */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${MARGIN_Y * 100}%`, background: maskColor }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${MARGIN_Y * 100}%`, background: maskColor }} />
      <div style={{ position: "absolute", left: 0, top: `${MARGIN_Y * 100}%`, bottom: `${MARGIN_Y * 100}%`, width: `${MARGIN_X * 100}%`, background: maskColor }} />
      <div style={{ position: "absolute", right: 0, top: `${MARGIN_Y * 100}%`, bottom: `${MARGIN_Y * 100}%`, width: `${MARGIN_X * 100}%`, background: maskColor }} />

      {/* ── Cadre (bordure + coins) ── */}
      <div
        style={{
          position: "absolute",
          left: `${MARGIN_X * 100}%`,
          right: `${MARGIN_X * 100}%`,
          top: `${MARGIN_Y * 100}%`,
          bottom: `${MARGIN_Y * 100}%`,
          border: "2px solid rgba(255,255,255,0.85)",
          borderRadius: 8,
          boxSizing: "border-box",
          pointerEvents: "none",
        }}
      >
        <Corner pos="tl" /><Corner pos="tr" /><Corner pos="bl" /><Corner pos="br" />
      </div>

      {/* ── Instruction ── */}
      <div
        style={{
          position: "absolute",
          top: "calc(var(--safe-top) + 16px)",
          left: 0,
          right: 0,
          textAlign: "center",
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 600,
          textShadow: "0 1px 3px rgba(0,0,0,0.6)",
          padding: "0 24px",
        }}
      >
        {ready ? "Place la facture dans le cadre, bien à plat" : "Démarrage de la caméra…"}
      </div>

      {error && (
        <div style={{ position: "absolute", top: "45%", left: 16, right: 16, color: "#FFF", background: "rgba(220,38,38,0.9)", padding: 12, borderRadius: 10, fontSize: 13, textAlign: "center" }}>
          {error}
        </div>
      )}

      {/* ── Barre du bas : annuler + capturer ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${MARGIN_Y * 100}%`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-around",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{ background: "transparent", border: "none", color: "#FFFFFF", fontSize: 15, fontWeight: 600, padding: 12, cursor: "pointer" }}
        >
          Annuler
        </button>

        <button
          type="button"
          onClick={handleCapture}
          disabled={!ready || busy}
          aria-label="Capturer"
          style={{
            width: 70,
            height: 70,
            borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.9)",
            background: busy ? "#9CA3AF" : "#E63946",
            cursor: ready && !busy ? "pointer" : "default",
            boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
          }}
        />

        <div style={{ width: 70 }} />
      </div>
    </div>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const s: React.CSSProperties = {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#E63946",
    borderStyle: "solid",
    borderWidth: 0,
  };
  if (pos === "tl") Object.assign(s, { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 });
  if (pos === "tr") Object.assign(s, { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 });
  if (pos === "bl") Object.assign(s, { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 });
  if (pos === "br") Object.assign(s, { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 });
  return <div style={s} />;
}

// Recadre l'image capturée sur la zone du cadre (mêmes marges qu'à l'écran)
function cropToFrame(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const W = img.width;
      const H = img.height;
      const sx = Math.round(W * MARGIN_X);
      const sy = Math.round(H * MARGIN_Y);
      const sw = Math.round(W * (1 - 2 * MARGIN_X));
      const sh = Math.round(H * (1 - 2 * MARGIN_Y));
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas indisponible"));
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/jpeg", 0.92).replace(/^data:image\/jpeg;base64,/, ""));
    };
    img.onerror = () => reject(new Error("image illisible"));
    img.src = base64.startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
  });
}
