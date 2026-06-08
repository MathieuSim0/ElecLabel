// Page aperçu PDF mobile — sélecteur de hauteur + génération + partage natif (Capacitor Share).
// Pas de PDFViewer iframe (mauvais sur mobile) : on génère le blob, on l'enregistre dans
// Documents/, puis on ouvre la feuille de partage Android (mail, Drive, imprimante…).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../store/panelStore";
import { generatePdfBlob } from "../components/PdfExport";
import { savePdfAndShare } from "../services/pdfMobile";
import { LABEL_HEIGHT_PRESETS_MM, DEFAULT_LABEL_HEIGHT_MM } from "../utils/pdfLayout";
import MobileHeader from "../components/MobileHeader";

export default function Preview() {
  const navigate = useNavigate();
  const { panel, reset } = usePanelStore();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const defaultIndex = Math.max(0, LABEL_HEIGHT_PRESETS_MM.indexOf(DEFAULT_LABEL_HEIGHT_MM));
  const [heightIndex, setHeightIndex] = useState(defaultIndex);
  const labelHeightMm = LABEL_HEIGHT_PRESETS_MM[heightIndex];

  useEffect(() => {
    if (!panel) navigate("/", { replace: true });
  }, [panel, navigate]);

  if (!panel) return null;
  const totalBreakers = panel.rows.reduce((s, r) => s + r.breakers.length, 0);

  const handleExport = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const blob = await generatePdfBlob(panel, labelHeightMm);
      const filename = `eleclabel-etiquettes-${labelHeightMm}mm-${Date.now()}.pdf`;
      await savePdfAndShare(blob, filename);
      setFeedback("PDF prêt — partage ouvert.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Erreur de génération PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC" }}>
      <MobileHeader
        title="Aperçu PDF"
        subtitle={`${panel.rows.length} rangée${panel.rows.length > 1 ? "s" : ""} · ${totalBreakers} disjoncteurs`}
        showBack
        hideAccount
        onBack={() => {
          reset();
          navigate("/");
        }}
      />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "16px 16px 24px",
        }}
      >
        {/* Sélecteur hauteur */}
        <section
          style={{
            background: "#FFFFFF",
            borderRadius: 14,
            border: "1px solid #E5E7EB",
            padding: "16px 16px 20px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                Hauteur d'étiquette
              </h3>
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                Largeur 1P fixe : 18 mm
              </p>
            </div>
            <div
              style={{
                display: "flex", alignItems: "baseline", gap: 4,
                padding: "4px 12px", background: "#F3F4F6", borderRadius: 8,
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 700, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
                {labelHeightMm}
              </span>
              <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 500 }}>mm</span>
            </div>
          </div>

          <div style={{ position: "relative", padding: "8px 0 24px" }}>
            <input
              type="range"
              min={0}
              max={LABEL_HEIGHT_PRESETS_MM.length - 1}
              step={1}
              value={heightIndex}
              onChange={(e) => setHeightIndex(Number(e.target.value))}
              style={{ width: "100%", margin: 0, accentColor: "#E63946" }}
            />
            <div
              style={{
                position: "absolute",
                left: 0, right: 0, bottom: 0,
                display: "flex",
                justifyContent: "space-between",
                pointerEvents: "none",
              }}
            >
              {LABEL_HEIGHT_PRESETS_MM.map((mm, i) => (
                <button
                  key={mm}
                  type="button"
                  onClick={() => setHeightIndex(i)}
                  style={{
                    fontSize: 10,
                    fontWeight: i === heightIndex ? 700 : 500,
                    color: i === heightIndex ? "#E63946" : "#9CA3AF",
                    background: "transparent",
                    border: "none",
                    padding: "2px 4px",
                    pointerEvents: "auto",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {mm}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Aperçu visuel rapide (pas un vrai PDF render — juste rappel structure) */}
        <section
          style={{
            background: "#FFFFFF",
            borderRadius: 14,
            border: "1px solid #E5E7EB",
            padding: 16,
            marginBottom: 16,
          }}
        >
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
            Récapitulatif
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {panel.rows.map((row) => (
              <div
                key={row.index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  background: "#F9FAFB",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 700, color: "#111827", minWidth: 28 }}>R{row.index + 1}</span>
                <span style={{ color: "#6B7280", flex: 1 }}>
                  {row.breakers.length} disj. · {row.totalSlots} slots
                </span>
              </div>
            ))}
          </div>
          {panel.project && (panel.project.clientName?.trim() || panel.project.address?.trim()) ? (
            <div
              style={{
                marginTop: 10,
                padding: "8px 10px",
                background: "#EEF2FF",
                borderRadius: 8,
                fontSize: 11,
                color: "#3730A3",
              }}
            >
              📌 En-tête PDF : {panel.project.clientName?.trim() || panel.project.address?.trim()}
            </div>
          ) : null}
        </section>

        {/* Feedback */}
        {feedback && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: feedback.startsWith("PDF prêt") ? "#ECFDF5" : "#FEF2F2",
              border: `1px solid ${feedback.startsWith("PDF prêt") ? "#A7F3D0" : "#FECACA"}`,
              color: feedback.startsWith("PDF prêt") ? "#065F46" : "#991B1B",
              fontSize: 12,
              marginBottom: 16,
              display: "flex",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>{feedback.startsWith("PDF prêt") ? "✓" : "⚠"}</span>
            <span style={{ lineHeight: 1.4 }}>{feedback}</span>
          </div>
        )}

        {/* Boutons d'action */}
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          style={{
            width: "100%",
            padding: "16px",
            fontSize: 15,
            fontWeight: 700,
            borderRadius: 12,
            border: "none",
            background: busy
              ? "#9CA3AF"
              : "linear-gradient(135deg, #E63946, #C0303C)",
            color: "#FFFFFF",
            cursor: busy ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            boxShadow: busy ? "none" : "0 4px 14px rgba(230,57,70,0.4)",
            marginBottom: 10,
          }}
        >
          {busy ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#FFFFFF",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Génération…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Générer & partager le PDF
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => navigate("/editor")}
          style={{
            width: "100%",
            padding: "12px",
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 10,
            border: "1.5px solid #E5E7EB",
            background: "#FFFFFF",
            color: "#4B5563",
            cursor: "pointer",
          }}
        >
          ← Retour à l'éditeur
        </button>
      </main>
    </div>
  );
}
