// Page d'accueil — import de photo et lancement de l'analyse IA
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PhotoDropzone from "../components/PhotoDropzone";
import ManualPanelSetup from "../components/ManualPanelSetup";
import AccountMenu from "../components/AccountMenu";
import SyncStatus from "../components/SyncStatus";
import LogoMark from "../components/LogoMark";
import { analyzePanel } from "../services/openai";
import { usePanelStore } from "../store/panelStore";
import { useHistoryStore, createThumbnail, type HistorySource } from "../store/historyStore";
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
    {
      index: 1, totalSlots: 13,
      breakers: [
        { id: "r1-0",  row: 1, position: 0,  poles: 2, label: "Chauffe-eau",    sublabel: "20A" },
        { id: "r1-1",  row: 1, position: 2,  poles: 2, label: "Lave-linge",     sublabel: "20A" },
        { id: "r1-2",  row: 1, position: 4,  poles: 1, label: "Sèche-linge",    sublabel: "16A" },
        { id: "r1-3",  row: 1, position: 5,  poles: 1, label: "Chambre 1",      sublabel: "16A" },
        { id: "r1-4",  row: 1, position: 6,  poles: 1, label: "Chambre 2",      sublabel: "16A" },
        { id: "r1-5",  row: 1, position: 7,  poles: 1, label: "Salle de bain",  sublabel: "16A" },
        { id: "r1-6",  row: 1, position: 8,  poles: 1, label: "WC",             sublabel: "10A" },
        { id: "r1-7",  row: 1, position: 9,  poles: 1, label: "Couloir",        sublabel: "10A" },
        { id: "r1-8",  row: 1, position: 10, poles: 1, label: "Garage",         sublabel: "16A" },
        { id: "r1-9",  row: 1, position: 11, poles: 1, label: "Alarme",         sublabel: "2A"  },
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
  const { add: addHistory } = useHistoryStore();
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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#F7F8FC",
        fontFamily: "var(--font-sans)",
      }}
    >
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

      {/* ── Barre du haut ── */}
      <header
        style={{
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 32px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LogoMark size={34} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.3px" }}>
                ElecLabel
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                Étiquettes de tableau électrique
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SyncStatus />
            <AccountMenu />
          </div>
        </div>

        {/* Onglets */}
        <div style={{ display: "flex", padding: "0 32px", gap: 4 }}>
          <TabButton active label="Analyse photo" icon="📷" onClick={() => {}} />
          <TabButton active={false} label="Modèles prêts" icon="📋" onClick={() => navigate("/templates")} />
          <TabButton active={false} label="Historique" icon="🕐" onClick={() => navigate("/history")} />
          <TabButton active={false} label="Factures" icon="🧾" onClick={() => navigate("/invoices")} />
          <TabButton active={false} label="Stock" icon="📦" onClick={() => navigate("/stock")} />
        </div>
      </header>

      {/* ── Contenu principal ── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 560 }}>
          {isAnalyzing ? (
            <LoadingState stepIndex={stepIndex} />
          ) : (
            <>
              {/* Titre */}
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <h1
                  style={{
                    fontSize: 30,
                    fontWeight: 700,
                    color: "#111827",
                    letterSpacing: "-0.6px",
                    lineHeight: 1.15,
                    marginBottom: 10,
                  }}
                >
                  Étiquetez votre tableau<br />
                  en <span style={{ color: "#E63946" }}>quelques secondes</span>
                </h1>
                <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.5 }}>
                  Prenez une photo, l'IA identifie les disjoncteurs, vous éditez, puis exportez en PDF A4.
                </p>
              </div>

              {/* Erreur */}
              {errorMsg && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    fontSize: 13,
                    marginBottom: 16,
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1, marginTop: 1 }}>⚠</span>
                  <span style={{ lineHeight: 1.5 }}>{errorMsg}</span>
                </div>
              )}

              {/* Dropzone */}
              <div style={{ height: 280, marginBottom: 16 }}>
                <PhotoDropzone onFile={handleFile} disabled={isAnalyzing} />
              </div>

              {/* Conseils photo */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  marginBottom: 24,
                  fontSize: 11,
                  color: "#9CA3AF",
                }}
              >
                <span>📸 Bonne lumière</span>
                <span>•</span>
                <span>📐 De face</span>
                <span>•</span>
                <span>🔍 Labels lisibles</span>
              </div>

              {/* Divider avec "ou" */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  margin: "24px 0 20px",
                }}
              >
                <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
                <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500 }}>OU</span>
                <div style={{ flex: 1, height: 1, background: "#E5E7EB" }} />
              </div>

              {/* Actions alternatives */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <ActionCard
                  icon="📋"
                  title="Modèles prêts"
                  subtitle="25 tableaux types"
                  onClick={() => navigate("/templates")}
                />
                <ActionCard
                  icon="✏️"
                  title="Saisie manuelle"
                  subtitle="Créer depuis zéro"
                  onClick={() => setShowManual(true)}
                />
              </div>

              {/* Exemple rapide */}
              <button
                type="button"
                onClick={() => {
                  setPanel(DEMO_PANEL);
                  const id = addHistory({ name: defaultName("template"), panel: DEMO_PANEL, source: "template" });
                  setHistoryId(id);
                  navigate("/editor");
                }}
                style={{
                  marginTop: 10,
                  padding: "8px",
                  background: "transparent",
                  border: "none",
                  color: "#9CA3AF",
                  fontSize: 12,
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "center",
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#9CA3AF")}
              >
                Ou charger un exemple de démonstration →
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function TabButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 16px",
        background: "transparent",
        border: "none",
        borderBottom: `2px solid ${active ? "#E63946" : "transparent"}`,
        color: active ? "#111827" : "#6B7280",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        transition: "all 0.15s ease",
        marginBottom: -1,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "#111827"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "#6B7280"; }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}

function ActionCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        background: "#FFFFFF",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#111827";
        e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E5E7EB";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: "#F3F4F6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{title}</div>
        <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>{subtitle}</div>
      </div>
    </button>
  );
}

function LoadingState({ stepIndex }: { stepIndex: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        padding: "16px 0",
      }}
    >
      <div style={{ position: "relative", width: 72, height: 72 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid #E5E7EB",
          }}
        />
        <div
          className="animate-spin"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "#111827",
            animation: "spin 1s linear infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 512 512" fill="none">
            <path d="M288 138 L168 298 L246 298 L222 374 L344 244 L266 244 Z" fill="#E63946" />
          </svg>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
          {STEPS[stepIndex]}…
        </p>
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
          Étape {stepIndex + 1} sur {STEPS.length}
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 18,
          borderRadius: 12,
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {STEPS.map((step, i) => (
          <div key={step} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                flexShrink: 0,
                background: i < stepIndex ? "#111827" : i === stepIndex ? "#E63946" : "#F3F4F6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: i <= stepIndex ? "#FFFFFF" : "transparent",
                fontSize: 10,
                fontWeight: 700,
                transition: "all 0.3s ease",
              }}
            >
              {i < stepIndex ? "✓" : i + 1}
            </div>
            <span
              style={{
                fontSize: 13,
                color: i === stepIndex ? "#111827" : i < stepIndex ? "#9CA3AF" : "#D1D5DB",
                fontWeight: i === stepIndex ? 600 : 500,
              }}
            >
              {step}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
