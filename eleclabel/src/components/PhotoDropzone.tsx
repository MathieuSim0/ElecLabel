// Zone de drag & drop pour l'import de photo du tableau électrique
import { useRef, useState, useCallback } from "react";

interface PhotoDropzoneProps {
  onFile: (base64: string, mimeType: string) => void;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(new Error("Erreur de lecture"));
    reader.readAsDataURL(file);
  });
}

export default function PhotoDropzone({ onFile, disabled = false }: PhotoDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) return;
    const base64 = await fileToBase64(file);
    setThumbnail(URL.createObjectURL(file));
    onFile(base64, file.type);
  }, [onFile]);

  const handleDragOver  = (e: React.DragEvent) => { e.preventDefault(); if (!disabled) setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); };
  const handleDrop      = async (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (!disabled) { const f = e.dataTransfer.files[0]; if (f) await handleFile(f); } };
  const handleChange    = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) await handleFile(f); };

  const borderColor = isDragging ? "#E63946" : "#D1D5DB";
  const bgColor     = isDragging ? "#FFF5F5" : thumbnail ? "transparent" : "#FFFFFF";

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className="relative flex flex-col items-center justify-center w-full h-full rounded-2xl cursor-pointer select-none overflow-hidden"
      style={{
        border: `2px dashed ${borderColor}`,
        background: bgColor,
        transform: isDragging ? "scale(1.01)" : "scale(1)",
        transition: "all 0.2s ease",
        boxShadow: isDragging
          ? "0 0 0 4px rgba(230,57,70,0.12), inset 0 0 0 1px rgba(230,57,70,0.2)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <input ref={inputRef} type="file" accept={ACCEPTED_TYPES.join(",")} className="hidden" onChange={handleChange} disabled={disabled} />

      {thumbnail ? (
        /* ── Aperçu photo ── */
        <div className="relative w-full h-full group">
          <img src={thumbnail} alt="Tableau électrique" className="w-full h-full object-contain rounded-2xl" />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl opacity-0 group-hover:opacity-100"
            style={{ background: "rgba(0,0,0,0.55)", transition: "opacity 0.2s ease" }}
          >
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className="text-white font-semibold" style={{ fontSize: 14 }}>Changer de photo</span>
          </div>
        </div>
      ) : isDragging ? (
        /* ── Drag actif ── */
        <div className="flex flex-col items-center gap-3 pointer-events-none">
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{ background: "rgba(230,57,70,0.1)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E63946" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            </svg>
          </div>
          <p className="font-bold" style={{ color: "#E63946", fontSize: 16 }}>Déposer ici</p>
        </div>
      ) : (
        /* ── État par défaut ── */
        <div className="flex flex-col items-center gap-5 px-8 text-center">
          {/* Upload icon dans un carré flottant */}
          <div
            className="flex items-center justify-center w-16 h-16 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #F3F4F6, #E5E7EB)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </div>

          <div>
            <p className="font-semibold" style={{ color: "#111827", fontSize: 15 }}>
              Glissez votre photo ici
            </p>
            <p style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
              ou cliquez pour parcourir vos fichiers
            </p>
          </div>

          <button
            type="button"
            className="px-5 py-2 rounded-lg font-semibold text-white"
            style={{
              background: "#111827",
              fontSize: 13,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#E63946")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#111827")}
            onClick={(e) => { e.stopPropagation(); if (!disabled) inputRef.current?.click(); }}
          >
            Choisir une photo
          </button>
        </div>
      )}
    </div>
  );
}
