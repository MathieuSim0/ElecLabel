// Capture photo mobile — caméra native (Capacitor) ou galerie/fichier.
// Fallback web : input file standard pour pouvoir tester en `npm run dev`.
import { useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { isNative } from "../services/native";

interface PhotoCaptureProps {
  onFile: (base64: string, mimeType: string) => void;
  disabled?: boolean;
}

export default function PhotoCapture({ onFile, disabled }: PhotoCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Caméra native : photo en pleine résolution + base64 direct (pas de roundtrip fichier)
  const handleNativeCamera = async (source: CameraSource) => {
    setError(null);
    try {
      const result = await Camera.getPhoto({
        source,
        resultType: CameraResultType.Base64,
        quality: 92,
        allowEditing: false,
        correctOrientation: true,
        // 4096 max pour préserver la lisibilité des manettes
        width: 4096,
      });
      if (!result.base64String) {
        setError("Aucune image récupérée.");
        return;
      }
      const mime = result.format ? `image/${result.format}` : "image/jpeg";
      onFile(result.base64String, mime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Annulation utilisateur silencieuse
      if (/cancel/i.test(msg) || /denied/i.test(msg)) return;
      setError(`Erreur caméra : ${msg}`);
    }
  };

  // Fallback web (npm run dev) — input file classique
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") return;
        const idx = result.indexOf(",");
        const base64 = idx >= 0 ? result.slice(idx + 1) : result;
        onFile(base64, file.type || "image/jpeg");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    // Reset pour pouvoir reprendre le même fichier après cancel
    e.target.value = "";
  };

  const native = isNative();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Carte principale : prendre une photo */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (native) handleNativeCamera(CameraSource.Camera);
          else fileInputRef.current?.click();
        }}
        style={{
          padding: "20px 16px",
          borderRadius: 16,
          border: "none",
          background: disabled
            ? "#E5E7EB"
            : "linear-gradient(135deg, #E63946, #C0303C)",
          color: disabled ? "#9CA3AF" : "#FFFFFF",
          fontSize: 16,
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          boxShadow: disabled ? "none" : "0 6px 18px rgba(230,57,70,0.35)",
          minHeight: 64,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        Prendre une photo
      </button>

      {/* Carte secondaire : importer depuis la galerie */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (native) handleNativeCamera(CameraSource.Photos);
          else fileInputRef.current?.click();
        }}
        style={{
          padding: "16px",
          borderRadius: 14,
          border: "1.5px solid #E5E7EB",
          background: "#FFFFFF",
          color: "#111827",
          fontSize: 14,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          minHeight: 52,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        Importer depuis la galerie
      </button>

      {/* Input file caché pour fallback web */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      {error && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            fontSize: 12,
          }}
        >
          ⚠ {error}
        </div>
      )}
    </div>
  );
}
