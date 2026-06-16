// Modale de sélection de presets pour étiquettes — affiche la bibliothèque
// LABEL_PRESETS groupée par catégorie, avec champ de recherche.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LABEL_PRESETS,
  PRESET_CATEGORIES,
  filterPresets,
  type LabelPreset,
  type PresetCategory,
} from "../data/labelPresets";
import type { Breaker, ModuleType, DdrType, CircuitType } from "../types/panel";
import type { ModulePatch } from "../store/panelStore";

interface LabelPickerProps {
  /** Présent → modale ouverte ; null → fermée */
  breakerId: string | null;
  /** Module courant (pour éditer ses champs techniques) */
  breaker?: Breaker | null;
  /** Met à jour les champs techniques structurés du module */
  onUpdateModule?: (breakerId: string, patch: ModulePatch) => void;
  onPick: (breakerId: string, preset: LabelPreset) => void;
  onClose: () => void;
}

export default function LabelPicker({ breakerId, breaker, onUpdateModule, onPick, onClose }: LabelPickerProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<PresetCategory | "Tous">("Tous");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset à l'ouverture + autofocus sur la recherche
  useEffect(() => {
    if (breakerId) {
      setQuery("");
      setActiveCategory("Tous");
      // Délai pour laisser la modale apparaître avant focus
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [breakerId]);

  // Fermeture sur Échap
  useEffect(() => {
    if (!breakerId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [breakerId, onClose]);

  const filtered = useMemo(() => {
    const base = query.trim() ? filterPresets(query) : LABEL_PRESETS;
    if (activeCategory === "Tous") return base;
    return base.filter((p) => p.category === activeCategory);
  }, [query, activeCategory]);

  // Regroupement par catégorie pour affichage en sections (mode "Tous")
  const grouped = useMemo(() => {
    if (activeCategory !== "Tous") {
      return [{ category: activeCategory, items: filtered }];
    }
    const map = new Map<PresetCategory, LabelPreset[]>();
    for (const cat of PRESET_CATEGORIES) map.set(cat, []);
    for (const p of filtered) {
      const arr = map.get(p.category as PresetCategory);
      if (arr) arr.push(p);
    }
    return PRESET_CATEGORIES
      .map((cat) => ({ category: cat, items: map.get(cat) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [filtered, activeCategory]);

  if (!breakerId) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 24, 39, 0.55)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          height: "100vh",
          background: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.2)",
          animation: "slideIn 0.2s ease",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: "18px 20px 12px",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                Bibliothèque d'étiquettes
              </h2>
              <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
                Choisis un preset · {LABEL_PRESETS.length} disponibles
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Fermer (Échap)"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: "1.5px solid #E5E7EB",
                background: "#FFFFFF",
                color: "#6B7280",
                cursor: "pointer",
                fontSize: 18,
                fontWeight: 500,
                lineHeight: 1,
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#DC2626";
                e.currentTarget.style.color = "#DC2626";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.color = "#6B7280";
              }}
            >
              ×
            </button>
          </div>

          {/* Recherche */}
          <div style={{ position: "relative" }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9CA3AF"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher (ex: cuisine, lave-linge)…"
              style={{
                width: "100%",
                padding: "9px 32px 9px 32px",
                fontSize: 13,
                border: "1.5px solid #E5E7EB",
                borderRadius: 9,
                background: "#F9FAFB",
                color: "#111827",
                outline: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#E63946")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                title="Effacer"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 18,
                  height: 18,
                  border: "none",
                  background: "#E5E7EB",
                  borderRadius: 999,
                  color: "#6B7280",
                  cursor: "pointer",
                  fontSize: 11,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Onglets catégories */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <CategoryChip
              label="Tous"
              active={activeCategory === "Tous"}
              onClick={() => setActiveCategory("Tous")}
            />
            {PRESET_CATEGORIES.map((cat) => (
              <CategoryChip
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        </div>

        {/* ── Détails techniques du module ── */}
        {breaker && onUpdateModule && (
          <TechnicalDetails breaker={breaker} onUpdate={(patch) => onUpdateModule(breaker.id, patch)} />
        )}

        {/* ── Liste des presets ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 20px" }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "40px 16px",
                textAlign: "center",
                color: "#9CA3AF",
                fontSize: 13,
              }}
            >
              Aucun preset ne correspond à « {query} »
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category} style={{ marginBottom: 18 }}>
                <h3
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#6B7280",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                    paddingTop: 4,
                  }}
                >
                  {group.category} · {group.items.length}
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  {group.items.map((preset, i) => (
                    <PresetCard
                      key={`${preset.label}-${preset.sublabel}-${i}`}
                      preset={preset}
                      onClick={() => onPick(breakerId, preset)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { transform: translateX(20px); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}

// Options des sélecteurs techniques. "" = valeur null (inconnu).
const TYPE_OPTS: { v: ModuleType | ""; t: string }[] = [
  { v: "", t: "— Type —" },
  { v: "disjoncteur", t: "Disjoncteur" },
  { v: "interrupteur_differentiel", t: "Inter. différentiel" },
  { v: "agcp", t: "AGCP (branchement)" },
  { v: "parafoudre", t: "Parafoudre" },
  { v: "autre", t: "Autre" },
];
const CALIBRE_OPTS = ["", "2", "10", "16", "20", "25", "32", "40", "63"];
const DDR_OPTS: { v: DdrType | ""; t: string }[] = [
  { v: "", t: "— Type diff. —" },
  { v: "AC", t: "Type AC" },
  { v: "A", t: "Type A" },
  { v: "F", t: "Type F" },
  { v: "B", t: "Type B" },
];
const SENS_OPTS = ["", "30", "300", "500"];
const CIRCUIT_OPTS: { v: CircuitType | ""; t: string }[] = [
  { v: "", t: "— Usage —" },
  { v: "eclairage", t: "Éclairage" },
  { v: "prises", t: "Prises" },
  { v: "specialise", t: "Spécialisé" },
  { v: "chauffage", t: "Chauffage" },
  { v: "autre", t: "Autre" },
];

const selectStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: "7px 9px",
  fontSize: 12.5,
  border: "1.5px solid #E5E7EB",
  borderRadius: 8,
  background: "#FFFFFF",
  color: "#111827",
  outline: "none",
  fontFamily: "inherit",
  cursor: "pointer",
};

// Bloc d'édition des champs techniques structurés (alimente l'audit de Volt).
function TechnicalDetails({ breaker, onUpdate }: { breaker: Breaker; onUpdate: (patch: ModulePatch) => void }) {
  const isDiff = breaker.type === "interrupteur_differentiel";
  return (
    <div style={{ padding: "12px 20px", borderBottom: "1px solid #E5E7EB", background: "#F9FAFB" }}>
      <h3
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#6B7280",
          textTransform: "uppercase",
          letterSpacing: 0.5,
          marginBottom: 8,
        }}
      >
        Détails techniques
      </h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <select
            value={breaker.type ?? ""}
            onChange={(e) => onUpdate({ type: (e.target.value || null) as ModuleType | null })}
            style={selectStyle}
            title="Nature du module"
          >
            {TYPE_OPTS.map((o) => (
              <option key={o.v} value={o.v}>{o.t}</option>
            ))}
          </select>
          <select
            value={breaker.calibre_A != null ? String(breaker.calibre_A) : ""}
            onChange={(e) => onUpdate({ calibre_A: e.target.value ? Number(e.target.value) : null })}
            style={selectStyle}
            title="Calibre (ampères)"
          >
            {CALIBRE_OPTS.map((c) => (
              <option key={c} value={c}>{c === "" ? "— Calibre —" : `${c} A`}</option>
            ))}
          </select>
        </div>

        <select
          value={breaker.circuit_type ?? ""}
          onChange={(e) => onUpdate({ circuit_type: (e.target.value || null) as CircuitType | null })}
          style={selectStyle}
          title="Usage du circuit"
        >
          {CIRCUIT_OPTS.map((o) => (
            <option key={o.v} value={o.v}>{o.t}</option>
          ))}
        </select>

        {isDiff && (
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={breaker.ddr_type ?? ""}
              onChange={(e) => onUpdate({ ddr_type: (e.target.value || null) as DdrType | null })}
              style={selectStyle}
              title="Type de différentiel"
            >
              {DDR_OPTS.map((o) => (
                <option key={o.v} value={o.v}>{o.t}</option>
              ))}
            </select>
            <select
              value={breaker.sensibilite_mA != null ? String(breaker.sensibilite_mA) : ""}
              onChange={(e) => onUpdate({ sensibilite_mA: e.target.value ? Number(e.target.value) : null })}
              style={selectStyle}
              title="Sensibilité (mA)"
            >
              {SENS_OPTS.map((s) => (
                <option key={s} value={s}>{s === "" ? "— Sensib. —" : `${s} mA`}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 11px",
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 999,
        border: `1.5px solid ${active ? "#111827" : "#E5E7EB"}`,
        background: active ? "#111827" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#4B5563",
        cursor: "pointer",
        transition: "all 0.12s ease",
      }}
    >
      {label}
    </button>
  );
}

function PresetCard({ preset, onClick }: { preset: LabelPreset; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: "1.5px solid #E5E7EB",
        background: "#FFFFFF",
        cursor: "pointer",
        textAlign: "left",
        transition: "all 0.12s ease",
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#E63946";
        e.currentTarget.style.background = "#FFF5F5";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#E5E7EB";
        e.currentTarget.style.background = "#FFFFFF";
      }}
    >
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{preset.icon}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#111827",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {preset.label}
        </div>
        {preset.sublabel ? (
          <div
            style={{
              fontSize: 11,
              color: "#6B7280",
              marginTop: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {preset.sublabel}
          </div>
        ) : null}
      </div>
    </button>
  );
}
