// Page éditeur mobile — header compact, scroll vertical, FAB pour Aperçu PDF
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../store/panelStore";
import { useHistoryStore } from "../store/historyStore";
import LabelGrid from "../components/LabelGrid";
import LabelPicker from "../components/LabelPicker";
import MobileHeader from "../components/MobileHeader";
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
  const [pickerBreakerId, setPickerBreakerId] = useState<string | null>(null);
  const [showProject, setShowProject] = useState(false);
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  useEffect(() => {
    if (!panel) navigate("/", { replace: true });
  }, [panel, navigate]);

  // Auto-save debounced 500ms
  useEffect(() => {
    if (!panel || !currentHistoryId) return;
    const t = window.setTimeout(() => updateHistoryEntry(currentHistoryId, panel), 500);
    return () => window.clearTimeout(t);
  }, [panel, currentHistoryId, updateHistoryEntry]);

  const stats = useMemo(() => {
    if (!panel) return { total: 0, empty: 0, auto: 0 };
    let total = 0, empty = 0, auto = 0;
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

  const readyPct = stats.total > 0
    ? Math.round(((stats.total - stats.empty) / stats.total) * 100)
    : 100;

  const projectFilled = Boolean(
    panel.project &&
      (panel.project.clientName?.trim() ||
        panel.project.address?.trim() ||
        panel.project.quoteNumber?.trim() ||
        panel.project.date?.trim() ||
        panel.project.notes?.trim()),
  );

  return (
    <div style={{ height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC" }}>
      <MobileHeader
        title={`${stats.total} disj. · ${panel.rows.length} rangée${panel.rows.length > 1 ? "s" : ""}`}
        subtitle={readyPct === 100 ? "Prêt à exporter" : `${readyPct}% complété`}
        showBack
        hideAccount
        onBack={() => {
          reset();
          navigate("/");
        }}
        rightAction={
          <>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Annuler"
              style={{
                width: 36, height: 36, borderRadius: 9,
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                color: canUndo ? "#4B5563" : "#D1D5DB",
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
              aria-label="Rétablir"
              style={{
                width: 36, height: 36, borderRadius: 9,
                border: "1px solid #E5E7EB",
                background: "#FFFFFF",
                color: canRedo ? "#4B5563" : "#D1D5DB",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 019-9 9 9 0 016.7 3L21 13" />
              </svg>
            </button>
          </>
        }
      />

      {/* Barre de progression */}
      {stats.total > 0 && (
        <div style={{ height: 3, background: "#F3F4F6", position: "relative" }}>
          <div
            style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: `${readyPct}%`,
              background: readyPct === 100
                ? "linear-gradient(90deg, #10B981, #059669)"
                : "linear-gradient(90deg, #E63946, #DC2626)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}

      {/* Bouton chantier dépliant */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", padding: "8px 12px" }}>
        <button
          type="button"
          onClick={() => setShowProject((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 600,
            borderRadius: 8,
            border: "1px solid #E5E7EB",
            background: showProject ? "#F3F4F6" : "#FFFFFF",
            color: "#4B5563",
            cursor: "pointer",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" />
            <path d="M5 21V7l7-4 7 4v14" />
          </svg>
          <span>Chantier / client</span>
          {projectFilled && (
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "#10B981", display: "inline-block" }} />
          )}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF" }}>
            {showProject ? "▲" : "▼"}
          </span>
        </button>
      </div>

      {showProject && (
        <ProjectForm
          value={panel.project ?? {}}
          onChange={updateProject}
          onClose={() => setShowProject(false)}
        />
      )}

      {/* Hint */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", padding: "8px 14px" }}>
        <p style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.4 }}>
          Touche l'icône pour la bibliothèque · texte modifiable · <b>1P/2P/3P/4P</b> en haut · <b>+</b> pour ajouter · glisse horizontalement
        </p>
      </div>

      {/* Rangées en lignes horizontales — scroll horizontal pour les rails larges (13 / 18 slots).
          min-width calculé pour que chaque slot fasse ~52px : confortable au pouce, pôles lisibles. */}
      <main style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div
          style={{
            padding: "8px 10px 110px",
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            style={{
              minWidth: Math.max(...panel.rows.map((r) => r.totalSlots), 13) * 52,
            }}
          >
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
          </div>
        </div>
      </main>

      {/* FAB Aperçu PDF */}
      <button
        type="button"
        onClick={() => navigate("/preview")}
        style={{
          position: "fixed",
          bottom: "calc(var(--safe-bottom) + 16px)",
          right: "calc(var(--safe-right) + 16px)",
          padding: "14px 22px",
          borderRadius: 999,
          border: "none",
          background: readyPct === 100
            ? "linear-gradient(135deg, #10B981, #059669)"
            : "linear-gradient(135deg, #111827, #1F2937)",
          color: "#FFFFFF",
          fontSize: 14,
          fontWeight: 700,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          zIndex: 40,
          cursor: "pointer",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        Aperçu PDF
      </button>

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

function ProjectForm({
  value,
  onChange,
  onClose,
}: {
  value: ProjectMeta;
  onChange: (project: ProjectMeta) => void;
  onClose: () => void;
}) {
  const update = (patch: Partial<ProjectMeta>) => onChange({ ...value, ...patch });
  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    background: "#FFFFFF",
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "#4B5563",
    marginBottom: 4,
  };
  return (
    <div style={{ background: "#F7F8FC", padding: "12px 14px 16px", borderBottom: "1px solid #E5E7EB" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <p style={{ fontSize: 11, color: "#6B7280" }}>Imprimé en en-tête du PDF.</p>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "4px 10px", fontSize: 11, fontWeight: 500,
            borderRadius: 6, border: "1px solid #E5E7EB",
            background: "#FFFFFF", color: "#6B7280",
          }}
        >
          Fermer
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Devis n°</label>
            <input
              type="text"
              value={value.quoteNumber ?? ""}
              onChange={(e) => update({ quoteNumber: e.target.value })}
              placeholder="DEV-2026-042"
              style={fieldStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Date</label>
            <input
              type="text"
              value={value.date ?? ""}
              onChange={(e) => update({ date: e.target.value })}
              placeholder="21/04/2026"
              style={fieldStyle}
            />
          </div>
        </div>
        <div>
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
