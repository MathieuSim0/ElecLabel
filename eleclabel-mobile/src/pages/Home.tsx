// Page d'accueil mobile — bouton caméra dominant + actions secondaires + démo + historique récent
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PhotoCapture from "../components/PhotoCapture";
import ManualPanelSetup from "../components/ManualPanelSetup";
import MobileHeader from "../components/MobileHeader";
import BottomNav from "../components/BottomNav";
import { analyzePanel } from "../services/openai";
import { usePanelStore } from "../store/panelStore";
import { useHistoryStore, createThumbnail, loadPanelImage, type HistorySource } from "../store/historyStore";
import type { Panel } from "../types/panel";

function defaultName(source: HistorySource): string {
  const now = new Date();
  const date = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const prefix = source === "photo" ? "Scan" : source === "template" ? "Démo" : "Manuel";
  return `${prefix} ${date} ${time}`;
}

const DEMO_PANEL: Panel = {
  rows: [
    {
      index: 0, totalSlots: 13,
      breakers: [
        { id: "r0-0",  row: 0, position: 0,  poles: 2, label: "Général",        sublabel: "63A" },
        { id: "r0-1",  row: 0, position: 2,  poles: 2, label: "Cuisinière",     sublabel: "32A" },
        { id: "r0-2",  row: 0, position: 4,  poles: 1, label: "Four",           sublabel: "20A" },
        { id: "r0-3",  row: 0, position: 5,  poles: 1, label: "Lave-vaisselle", sublabel: "20A" },
        { id: "r0-4",  row: 0, position: 6,  poles: 1, label: "Réfrigérateur",  sublabel: "16A" },
        { id: "r0-5",  row: 0, position: 7,  poles: 1, label: "Prises cuisine", sublabel: "16A" },
        { id: "r0-6",  row: 0, position: 8,  poles: 1, label: "VMC",            sublabel: "2A"  },
        { id: "r0-7",  row: 0, position: 9,  poles: 1, label: "Éclairage",      sublabel: "10A" },
        { id: "r0-8",  row: 0, position: 10, poles: 1, label: "Séjour",         sublabel: "16A" },
        { id: "r0-9",  row: 0, position: 11, poles: 1, label: "Bureau",         sublabel: "16A" },
        { id: "r0-10", row: 0, position: 12, poles: 1, label: "Interphone",     sublabel: "2A"  },
      ],
    },
  ],
};

const STEPS = [
  "Chargement de l'image",
  "Amélioration du contraste",
  "Analyse globale (passes 1 & 2)…",
  "Vérification zoom par rangée…",
  "Reconstitution du tableau",
];

export default function Home() {
  const navigate = useNavigate();
  const { setPanel, setHistoryId, setAnalyzing, isAnalyzing } = usePanelStore();
  const { add: addHistory, entries } = useHistoryStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [showManual, setShowManual] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFile = async (base64: string, mimeType: string) => {
    setErrorMsg(null);
    setAnalyzing(true);
    setStepIndex(0);
    const interval = setInterval(
      () => setStepIndex((s) => Math.min(s + 1, STEPS.length - 1)),
      5000,
    );
    try {
      await new Promise((r) => setTimeout(r, 50));
      const panel = await analyzePanel(base64, mimeType);
      clearInterval(interval);
      if (panel.rows.length === 0) {
        setAnalyzing(false);
        setErrorMsg("L'IA n'a pas pu identifier les disjoncteurs sur cette photo. Essaie une photo plus nette ou passe en saisie manuelle.");
        return;
      }
      const finalPanel = { ...panel, imageBase64: base64 };
      setPanel(finalPanel);
      const thumbnail = await createThumbnail(base64, mimeType, 300);
      const id = addHistory({ name: defaultName("photo"), panel: finalPanel, thumbnail, source: "photo" });
      setHistoryId(id);
      navigate("/editor");
    } catch (err) {
      clearInterval(interval);
      setAnalyzing(false);
      setErrorMsg(err instanceof Error ? err.message : "Erreur inconnue.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (isAnalyzing) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC" }}>
        <MobileHeader title="Analyse en cours" />
        <main style={{ flex: 1, padding: "24px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LoadingState stepIndex={stepIndex} />
        </main>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC" }}>
      {showManual && (
        <ManualPanelSetup
          onConfirm={(p) => {
            setShowManual(false);
            setPanel(p);
            const id = addHistory({ name: defaultName("manual"), panel: p, source: "manual" });
            setHistoryId(id);
            navigate("/editor");
          }}
          onCancel={() => setShowManual(false)}
        />
      )}

      <MobileHeader title="ElecLabel" subtitle="Étiquettes de tableau électrique" />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "20px 16px 100px",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.4px", lineHeight: 1.2, marginBottom: 6 }}>
            Photographiez<br />
            votre <span style={{ color: "#E63946" }}>tableau</span>
          </h1>
          <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
            L'IA détecte les disjoncteurs, vous éditez les étiquettes, puis exportez en PDF A4.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: 12,
              marginBottom: 14,
              display: "flex",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>⚠</span>
            <span style={{ lineHeight: 1.4 }}>{errorMsg}</span>
          </div>
        )}

        <PhotoCapture onFile={handleFile} disabled={isAnalyzing} />

        {/* Conseils photo */}
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            margin: "16px 0 20px",
            fontSize: 11,
            color: "#9CA3AF",
            flexWrap: "wrap",
          }}
        >
          <span>📸 Bonne lumière</span>
          <span>•</span>
          <span>📐 De face</span>
          <span>•</span>
          <span>🔍 Net</span>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0 16px" }}>
          <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
          <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>OU</span>
          <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
        </div>

        {/* Actions alternatives */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <ActionCard icon="📋" title="Modèles" subtitle="Tableaux types" onClick={() => navigate("/templates")} />
          <ActionCard icon="✏️" title="Manuel" subtitle="Depuis zéro" onClick={() => setShowManual(true)} />
        </div>

        {/* Démo */}
        <button
          type="button"
          onClick={() => {
            setPanel(DEMO_PANEL);
            const id = addHistory({ name: defaultName("template"), panel: DEMO_PANEL, source: "template" });
            setHistoryId(id);
            navigate("/editor");
          }}
          style={{
            width: "100%",
            marginTop: 12,
            padding: "10px",
            background: "transparent",
            border: "none",
            color: "#9CA3AF",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Charger un exemple de démonstration →
        </button>

        {/* Historique récent (3 derniers) */}
        {entries.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                Récents
              </h3>
              <button
                type="button"
                onClick={() => navigate("/history")}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#E63946",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Tout voir →
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {entries.slice(0, 3).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={async () => {
                    if (!e.panel || !Array.isArray(e.panel.rows)) return;
                    const img = (await loadPanelImage(e.id)) ?? e.panel.imageBase64;
                    setPanel(JSON.parse(JSON.stringify({ ...e.panel, imageBase64: img })));
                    setHistoryId(e.id);
                    navigate("/editor");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #E5E7EB",
                    background: "#FFFFFF",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {e.thumbnail ? (
                    <img
                      src={`data:image/jpeg;base64,${e.thumbnail}`}
                      alt=""
                      style={{ width: 38, height: 38, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 38, height: 38, borderRadius: 6, background: "#F3F4F6",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                        flexShrink: 0,
                      }}
                    >
                      {e.source === "photo" ? "📷" : e.source === "manual" ? "✏️" : "📋"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13, fontWeight: 600, color: "#111827",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}
                    >
                      {e.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>
                      {e.rowCount} rangée{e.rowCount > 1 ? "s" : ""} · {e.breakerCount} disj.
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function ActionCard({ icon, title, subtitle, onClick }: { icon: string; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        padding: "12px 14px",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        background: "#FFFFFF",
        cursor: "pointer",
        textAlign: "left",
        minHeight: 76,
      }}
    >
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>{subtitle}</div>
      </div>
    </button>
  );
}

function LoadingState({ stepIndex }: { stepIndex: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: "100%", maxWidth: 380 }}>
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid #E5E7EB" }} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#111827",
            animation: "spin 1s linear infinite",
          }}
        />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="20" height="20" viewBox="0 0 512 512" fill="none">
            <path d="M288 138 L168 298 L246 298 L222 374 L344 244 L266 244 Z" fill="#E63946" />
          </svg>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{STEPS[stepIndex]}</p>
        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
          Étape {stepIndex + 1} sur {STEPS.length}
        </p>
      </div>
      <div
        style={{
          width: "100%",
          padding: 16,
          borderRadius: 12,
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {STEPS.map((step, i) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: "50%",
                flexShrink: 0,
                background: i < stepIndex ? "#111827" : i === stepIndex ? "#E63946" : "#F3F4F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: i <= stepIndex ? "#FFFFFF" : "transparent",
                fontSize: 9,
                fontWeight: 700,
              }}
            >
              {i < stepIndex ? "✓" : i + 1}
            </div>
            <span
              style={{
                fontSize: 12,
                color: i === stepIndex ? "#111827" : i < stepIndex ? "#9CA3AF" : "#D1D5DB",
                fontWeight: i === stepIndex ? 600 : 500,
              }}
            >
              {step}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
