// Page éditeur — modification des étiquettes du tableau détecté
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../store/panelStore";
import { useHistoryStore } from "../store/historyStore";
import LabelGrid from "../components/LabelGrid";
import LabelPicker from "../components/LabelPicker";
import LogoMark from "../components/LogoMark";
import type { PoleWidth, ProjectMeta } from "../types/panel";

export default function Editor() {
  const navigate = useNavigate();
  const {
    panel,
    currentHistoryId,
    updateLabel,
    applyPreset,
    updatePoles,
    deleteBreaker,
    addBreaker,
    deleteRow,
    addRow,
    updateProject,
    undo,
    redo,
    past,
    future,
    reset,
  } = usePanelStore();
  const updateHistoryEntry = useHistoryStore((s) => s.update);
  // ID du disjoncteur dont l'icône a été cliquée → ouvre le LabelPicker pour cette cellule
  const [pickerBreakerId, setPickerBreakerId] = useState<string | null>(null);
  const [showPhoto, setShowPhoto] = useState(false);
  const [showProject, setShowProject] = useState(false);
  // Mode correction sur la photo : clic = ajoute un disjoncteur à la rangée choisie.
  // Les repères sont stockés en coordonnées normalisées 0–1 pour rester alignés au redimensionnement.
  const [correctMode, setCorrectMode] = useState(false);
  const [correctRow, setCorrectRow] = useState(0);
  const [correctPoles, setCorrectPoles] = useState<PoleWidth>(1);
  const [markers, setMarkers] = useState<
    Array<{ id: string; x: number; y: number; row: number; poles: PoleWidth }>
  >([]);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  // Raccourcis clavier Ctrl+Z (undo) / Ctrl+Shift+Z ou Ctrl+Y (redo)
  // Ne se déclenche pas quand l'utilisateur édite un champ (input/textarea/contenteditable)
  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return el.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (isEditable(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  useEffect(() => {
    if (!panel) navigate("/", { replace: true });
  }, [panel, navigate]);

  // Auto-save debounced 500ms : chaque modif (label, pôles, ajout/suppression, projet)
  // est répercutée sur l'entrée historyStore associée. Pas d'entrée → pas d'écriture.
  useEffect(() => {
    if (!panel || !currentHistoryId) return;
    const t = window.setTimeout(() => updateHistoryEntry(currentHistoryId, panel), 500);
    return () => window.clearTimeout(t);
  }, [panel, currentHistoryId, updateHistoryEntry]);

  const stats = useMemo(() => {
    if (!panel) return { total: 0, empty: 0, auto: 0 };
    let total = 0;
    let empty = 0;  // vraiment à remplir (vide ou "?")
    let auto = 0;   // auto-généré (suggested), OK par défaut
    for (const row of panel.rows) {
      for (const b of row.breakers) {
        total++;
        const l = b.label.trim();
        if (l === "?" || l === "" || l === "À préciser") empty++;
        else if (b.suggested) auto++;
      }
    }
    return { total, empty, auto };
  }, [panel]);

  if (!panel) return null;

  // "Prêt" = aucun label vide/à préciser. Les labels auto-générés sont OK par défaut.
  const readyPct = stats.total > 0 ? Math.round(((stats.total - stats.empty) / stats.total) * 100) : 100;

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
      {/* ── Header ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "#FFFFFF",
          borderBottom: "1px solid #E5E7EB",
        }}
      >
        <div
          style={{
            padding: "0 24px",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
            {/* Bouton retour à l'accueil — sobre, ne domine pas le header */}
            <button
              type="button"
              onClick={() => {
                reset();
                navigate("/");
              }}
              title="Retour à l'accueil — modifications déjà enregistrées dans l'historique"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "#6B7280",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#F3F4F6"; e.currentTarget.style.color = "#111827"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#6B7280"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Retour
            </button>

            <div style={{ width: 1, height: 22, background: "#E5E7EB" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <LogoMark size={32} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                ElecLabel
              </span>
            </div>

            <div style={{ width: 1, height: 22, background: "#E5E7EB" }} />

            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span style={{ color: "#111827", fontWeight: 600 }}>
                {panel.rows.length} rangée{panel.rows.length > 1 ? "s" : ""}
              </span>
              <span style={{ color: "#D1D5DB" }}>·</span>
              <span style={{ color: "#111827", fontWeight: 600 }}>
                {stats.total} disjoncteur{stats.total > 1 ? "s" : ""}
              </span>
            </div>

            {stats.empty > 0 && (
              <>
                <div style={{ width: 1, height: 22, background: "#E5E7EB" }} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "#FEF3C7",
                    border: "1px solid #FDE68A",
                  }}
                >
                  <span style={{ fontSize: 12 }}>⚠</span>
                  <span style={{ fontSize: 12, color: "#92400E", fontWeight: 600 }}>
                    {stats.empty} à remplir
                  </span>
                </div>
              </>
            )}
            {stats.empty === 0 && stats.auto > 0 && (
              <>
                <div style={{ width: 1, height: 22, background: "#E5E7EB" }} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    borderRadius: 8,
                    background: "#EEF2FF",
                    border: "1px solid #C7D2FE",
                  }}
                >
                  <span style={{ fontSize: 12 }}>✨</span>
                  <span style={{ fontSize: 12, color: "#3730A3", fontWeight: 600 }}>
                    {stats.auto} auto-générés
                  </span>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Undo / Redo */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                title="Annuler (Ctrl+Z)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1.5px solid #E5E7EB",
                  background: "#FFFFFF",
                  color: canUndo ? "#4B5563" : "#D1D5DB",
                  cursor: canUndo ? "pointer" : "not-allowed",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7v6h6" />
                  <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6.7 3L3 13" />
                </svg>
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                title="Rétablir (Ctrl+Maj+Z)"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1.5px solid #E5E7EB",
                  background: "#FFFFFF",
                  color: canRedo ? "#4B5563" : "#D1D5DB",
                  cursor: canRedo ? "pointer" : "not-allowed",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 7v6h-6" />
                  <path d="M3 17a9 9 0 019-9 9 9 0 016.7 3L21 13" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowProject((v) => !v)}
              title="Informations chantier imprimées sur le PDF"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 8,
                border: "1.5px solid #E5E7EB",
                background: showProject ? "#F3F4F6" : "#FFFFFF",
                color: "#4B5563",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18" />
                <path d="M5 21V7l7-4 7 4v14" />
                <path d="M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1" />
              </svg>
              Chantier
              {panel.project && (
                (panel.project.clientName?.trim() ||
                  panel.project.address?.trim() ||
                  panel.project.quoteNumber?.trim() ||
                  panel.project.date?.trim() ||
                  panel.project.notes?.trim())
              ) ? (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "#10B981",
                    display: "inline-block",
                  }}
                />
              ) : null}
            </button>

            {panel.imageBase64 && (
              <button
                type="button"
                onClick={() => setShowPhoto((v) => !v)}
                title="Voir la photo originale"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: "1.5px solid #E5E7EB",
                  background: showPhoto ? "#F3F4F6" : "#FFFFFF",
                  color: "#4B5563",
                  cursor: "pointer",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                {showPhoto ? "Masquer photo" : "Voir photo"}
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate("/preview")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #111827, #1F2937)",
                color: "#FFFFFF",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, #E63946, #C0303C)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, #111827, #1F2937)";
              }}
            >
              Aperçu PDF
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Bandeau chantier/client dépliable */}
        {showProject && (
          <ProjectForm
            value={panel.project ?? {}}
            onChange={updateProject}
            onClose={() => setShowProject(false)}
          />
        )}

        {/* Bandeau photo dépliable + outil correction */}
        {showPhoto && panel.imageBase64 && (
          <PhotoPanel
            imageBase64={panel.imageBase64}
            rowCount={panel.rows.length}
            correctMode={correctMode}
            setCorrectMode={setCorrectMode}
            correctRow={correctRow}
            setCorrectRow={setCorrectRow}
            correctPoles={correctPoles}
            setCorrectPoles={setCorrectPoles}
            markers={markers}
            onAddMarker={(x, y) => {
              const rowIdx = Math.min(correctRow, panel.rows.length - 1);
              if (rowIdx < 0) return;
              setMarkers((prev) => [
                ...prev,
                {
                  id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  x,
                  y,
                  row: rowIdx,
                  poles: correctPoles,
                },
              ]);
              addBreaker(rowIdx, correctPoles);
            }}
            onClearMarkers={() => setMarkers([])}
          />
        )}

        {/* Barre de progression */}
        {stats.total > 0 && (
          <div
            style={{
              height: 3,
              background: "#F3F4F6",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: `${readyPct}%`,
                background: readyPct === 100
                  ? "linear-gradient(90deg, #10B981, #059669)"
                  : "linear-gradient(90deg, #E63946, #DC2626)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}
      </header>

      {/* ── Contenu principal ── */}
      <main style={{ flex: 1, overflowY: "auto", padding: "0 24px 40px" }}>
        <div
          style={{
            padding: "20px 0 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
              Vos étiquettes
            </h2>
            <p style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>
              Cliquez sur l'icône pour ouvrir la <b>bibliothèque</b> · texte modifiable directement · <b>1P/2P/3P/4P</b> en haut · <b>+</b> pour ajouter
            </p>
          </div>

          {readyPct === 100 ? (
            <div
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                fontSize: 12,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>✓</span>
              Prêt pour le PDF
            </div>
          ) : (
            <div
              style={{
                padding: "5px 10px",
                borderRadius: 8,
                background: "#FEF3C7",
                border: "1px solid #FDE68A",
                color: "#92400E",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {readyPct}% complété
            </div>
          )}
        </div>

        <LabelGrid
          panel={panel}
          onLabelChange={(id, label, sublabel) => updateLabel(id, label, sublabel)}
          onPolesChange={(id, poles: PoleWidth) => updatePoles(id, poles)}
          onDeleteBreaker={deleteBreaker}
          onAddBreaker={addBreaker}
          onDeleteRow={deleteRow}
          onAddRow={addRow}
          onIconClick={(id) => setPickerBreakerId(id)}
        />
      </main>

      {/* Modale de presets — ouverte quand pickerBreakerId !== null */}
      <LabelPicker
        breakerId={pickerBreakerId}
        onPick={(id, preset) => {
          applyPreset(id, preset);
          setPickerBreakerId(null);
        }}
        onClose={() => setPickerBreakerId(null)}
      />
    </div>
  );
}

// Formulaire des métadonnées chantier — écrit dans le PDF en en-tête
interface ProjectFormProps {
  value: ProjectMeta;
  onChange: (project: ProjectMeta) => void;
  onClose: () => void;
}

function ProjectForm({ value, onChange, onClose }: ProjectFormProps) {
  const update = (patch: Partial<ProjectMeta>) => onChange({ ...value, ...patch });
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    fontSize: 12,
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    background: "#FFFFFF",
    color: "#111827",
    fontFamily: "inherit",
    outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#4B5563",
    marginBottom: 4,
  };
  return (
    <div
      style={{
        borderTop: "1px solid #E5E7EB",
        background: "#F7F8FC",
        padding: "14px 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
            Chantier / client
          </h3>
          <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
            Ces informations sont imprimées en en-tête du PDF exporté.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 500,
            borderRadius: 6,
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            color: "#6B7280",
            cursor: "pointer",
          }}
        >
          Fermer
        </button>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        <div>
          <label style={labelStyle}>Client</label>
          <input
            type="text"
            value={value.clientName ?? ""}
            onChange={(e) => update({ clientName: e.target.value })}
            placeholder="Nom du client"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Adresse du chantier</label>
          <input
            type="text"
            value={value.address ?? ""}
            onChange={(e) => update({ address: e.target.value })}
            placeholder="12 rue de l'exemple, 75000 Paris"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Numéro de devis / affaire</label>
          <input
            type="text"
            value={value.quoteNumber ?? ""}
            onChange={(e) => update({ quoteNumber: e.target.value })}
            placeholder="DEV-2026-042"
            style={fieldStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Date</label>
          <input
            type="text"
            value={value.date ?? ""}
            onChange={(e) => update({ date: e.target.value })}
            placeholder="21/04/2026"
            style={fieldStyle}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Mention libre</label>
          <input
            type="text"
            value={value.notes ?? ""}
            onChange={(e) => update({ notes: e.target.value })}
            placeholder="Tableau garage, T3, etc."
            style={fieldStyle}
          />
        </div>
      </div>
    </div>
  );
}

// ─────────── Panneau photo + outil correction clic-à-clic ───────────
// Chaque clic sur la photo ajoute un disjoncteur à la rangée sélectionnée.
// Les repères visuels sont stockés en coordonnées normalisées (0–1) pour survivre au redimensionnement.
interface PhotoPanelProps {
  imageBase64: string;
  rowCount: number;
  correctMode: boolean;
  setCorrectMode: (v: boolean) => void;
  correctRow: number;
  setCorrectRow: (v: number) => void;
  correctPoles: PoleWidth;
  setCorrectPoles: (v: PoleWidth) => void;
  markers: Array<{ id: string; x: number; y: number; row: number; poles: PoleWidth }>;
  onAddMarker: (x: number, y: number) => void;
  onClearMarkers: () => void;
}

function PhotoPanel({
  imageBase64,
  rowCount,
  correctMode,
  setCorrectMode,
  correctRow,
  setCorrectRow,
  correctPoles,
  setCorrectPoles,
  markers,
  onAddMarker,
  onClearMarkers,
}: PhotoPanelProps) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!correctMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    onAddMarker(x, y);
  };

  // Couleur par largeur de pôle pour différencier les repères
  const poleColor = (p: PoleWidth) =>
    p === 1 ? "#10B981" : p === 2 ? "#F59E0B" : p === 3 ? "#E63946" : "#7C3AED";

  const pillBtn = (active: boolean): React.CSSProperties => ({
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 999,
    border: `1.5px solid ${active ? "#111827" : "#E5E7EB"}`,
    background: active ? "#111827" : "#FFFFFF",
    color: active ? "#FFFFFF" : "#4B5563",
    cursor: "pointer",
  });

  return (
    <div
      style={{
        borderTop: "1px solid #E5E7EB",
        background: "#F7F8FC",
        padding: "12px 24px 14px",
      }}
    >
      {/* Barre d'outils correction */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <button
          type="button"
          onClick={() => setCorrectMode(!correctMode)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: `1.5px solid ${correctMode ? "#E63946" : "#E5E7EB"}`,
            background: correctMode ? "#E63946" : "#FFFFFF",
            color: correctMode ? "#FFFFFF" : "#4B5563",
            cursor: "pointer",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
          </svg>
          {correctMode ? "Mode correction actif" : "Corriger la détection"}
        </button>

        {correctMode && (
          <>
            <div style={{ width: 1, height: 20, background: "#E5E7EB" }} />

            <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
              Ajouter à la rangée
            </span>
            <select
              value={correctRow}
              onChange={(e) => setCorrectRow(Number(e.target.value))}
              style={{
                padding: "5px 8px",
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                border: "1.5px solid #E5E7EB",
                background: "#FFFFFF",
                color: "#111827",
                cursor: "pointer",
              }}
            >
              {Array.from({ length: Math.max(rowCount, 1) }, (_, i) => (
                <option key={i} value={i}>
                  R{i + 1}
                </option>
              ))}
            </select>

            <div style={{ width: 1, height: 20, background: "#E5E7EB" }} />

            <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>
              Largeur
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              {([1, 2, 3, 4] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCorrectPoles(p)}
                  style={pillBtn(correctPoles === p)}
                >
                  {p}P
                </button>
              ))}
            </div>

            {markers.length > 0 && (
              <button
                type="button"
                onClick={onClearMarkers}
                title="Effacer les repères visuels (ne supprime pas les disjoncteurs déjà ajoutés)"
                style={{
                  marginLeft: "auto",
                  padding: "5px 10px",
                  fontSize: 11,
                  fontWeight: 500,
                  borderRadius: 8,
                  border: "1.5px solid #E5E7EB",
                  background: "#FFFFFF",
                  color: "#6B7280",
                  cursor: "pointer",
                }}
              >
                Effacer les repères ({markers.length})
              </button>
            )}
          </>
        )}
      </div>

      {correctMode && (
        <div
          style={{
            fontSize: 11,
            color: "#3730A3",
            background: "#EEF2FF",
            border: "1px solid #C7D2FE",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 10,
          }}
        >
          Clique sur chaque disjoncteur <b>oublié</b> par l'IA — il sera ajouté en fin de rangée <b>R{correctRow + 1}</b> en <b>{correctPoles}P</b>.
        </div>
      )}

      {/* Image + overlay des repères */}
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div
          onClick={handleClick}
          style={{
            position: "relative",
            display: "inline-block",
            cursor: correctMode ? "crosshair" : "default",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          }}
        >
          <img
            src={`data:image/jpeg;base64,${imageBase64}`}
            alt="Tableau électrique original"
            draggable={false}
            style={{
              display: "block",
              maxHeight: 260,
              maxWidth: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              userSelect: "none",
            }}
          />
          {markers.map((m) => (
            <div
              key={m.id}
              style={{
                position: "absolute",
                left: `${m.x * 100}%`,
                top: `${m.y * 100}%`,
                transform: "translate(-50%, -50%)",
                width: 20,
                height: 20,
                borderRadius: 999,
                background: poleColor(m.poles),
                border: "2px solid #FFFFFF",
                boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
                color: "#FFFFFF",
                fontSize: 9,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
              title={`R${m.row + 1} — ${m.poles}P`}
            >
              {m.poles}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
