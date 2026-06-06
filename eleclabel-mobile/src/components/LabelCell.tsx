// Cellule d'un disjoncteur — éditable, avec contrôles toujours visibles.
// L'icône résolue (preset explicite ou auto depuis le label) est affichée et cliquable
// pour ouvrir le LabelPicker via onIconClick.
import { useState } from "react";
import type { Breaker, PoleWidth } from "../types/panel";
import { getSlotWidth } from "../utils/labelLayout";
import { getCircuitIcon } from "../utils/circuitIcons";

interface LabelCellProps {
  breaker: Breaker;
  totalSlots: number;
  onChange: (id: string, label: string, sublabel: string) => void;
  onPolesChange: (id: string, poles: PoleWidth) => void;
  onDelete: (id: string) => void;
  onIconClick: (id: string) => void;
}

const POLE_COLOR: Record<number, string> = { 1: "#2563EB", 2: "#D97706", 3: "#DC2626", 4: "#7C3AED" };
const POLE_TINT: Record<number, string> = { 1: "#EFF6FF", 2: "#FFFBEB", 3: "#FEF2F2", 4: "#F5F3FF" };

export default function LabelCell({
  breaker,
  totalSlots,
  onChange,
  onPolesChange,
  onDelete,
  onIconClick,
}: LabelCellProps) {
  const width = getSlotWidth(breaker.poles, totalSlots);
  const icon = breaker.icon ?? getCircuitIcon(breaker.label);
  const color = POLE_COLOR[breaker.poles];
  const tint = POLE_TINT[breaker.poles];
  const isEmpty = breaker.label.trim() === "?" || breaker.label.trim() === "";
  const isSuggested = breaker.suggested === true && !isEmpty;
  const [hover, setHover] = useState(false);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: hover
          ? "#F5F9FF"
          : isEmpty
          ? "#FEF3C7"
          : isSuggested
          ? "#F5F3FF"
          : "#FFFFFF",
        borderRight: "1.5px solid #333333",
        position: "relative",
        boxSizing: "border-box",
        overflow: "hidden",
        transition: "background 0.12s ease",
      }}
    >
      {/* ── Barre de contrôle toujours visible ── */}
      <div
        style={{
          height: 20,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 2px",
          gap: 2,
          background: tint,
          borderBottom: `2px solid ${color}`,
          boxSizing: "border-box",
        }}
      >
        {/* Sélecteur de pôles : <select> natif stylisé. Tient dans n'importe quelle largeur
            de cellule (même 1P étroit), affiche le pôle courant, ouvre les 4 options au tap. */}
        <select
          value={breaker.poles}
          onChange={(e) => onPolesChange(breaker.id, Number(e.target.value) as PoleWidth)}
          title={`${breaker.poles} pôle${breaker.poles > 1 ? "s" : ""} — change pour 1P / 2P / 3P / 4P`}
          style={{
            flex: 1,
            minWidth: 0,
            height: 16,
            fontSize: 10,
            fontWeight: 800,
            padding: "0 3px",
            borderRadius: 3,
            border: `1px solid ${color}`,
            background: color,
            color: "#FFFFFF",
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            MozAppearance: "none",
            textAlign: "center",
            textAlignLast: "center",
            lineHeight: 1,
            fontFamily: "inherit",
          }}
        >
          {([1, 2, 3, 4] as PoleWidth[]).map((p) => (
            <option key={p} value={p} style={{ color: "#111827", background: "#FFFFFF" }}>
              {p}P
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onDelete(breaker.id)}
          title="Supprimer"
          style={{
            width: 14,
            height: 14,
            fontSize: 13,
            fontWeight: 700,
            color: "#9CA3AF",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            lineHeight: 1,
            padding: 0,
            borderRadius: 3,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#DC2626";
            e.currentTarget.style.background = "rgba(220,38,38,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#9CA3AF";
            e.currentTarget.style.background = "transparent";
          }}
        >
          ×
        </button>
      </div>

      {/* ── Contenu de l'étiquette ── */}
      <div
        style={{
          flex: 1,
          minHeight: 56,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "5px 3px",
          gap: 2,
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Icône — cliquable pour ouvrir le picker de presets */}
        <button
          type="button"
          onClick={() => onIconClick(breaker.id)}
          title="Choisir un preset depuis la bibliothèque"
          style={{
            width: 22,
            height: 22,
            flexShrink: 0,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 4,
            position: "relative",
          }}
        >
          <span
            style={{
              fontSize: 16,
              lineHeight: 1,
              userSelect: "none",
              filter: hover ? "saturate(1.15)" : "none",
            }}
          >
            {icon}
          </span>
          {isSuggested && (
            <span
              style={{
                position: "absolute",
                top: -2,
                right: -2,
                fontSize: 8,
                lineHeight: 1,
              }}
              title="Suggestion automatique — modifiez si besoin"
            >
              ✨
            </span>
          )}
        </button>

        <input
          type="text"
          value={breaker.label === "?" ? "" : breaker.label}
          onChange={(e) => onChange(breaker.id, e.target.value, breaker.sublabel ?? "")}
          placeholder="À remplir"
          title={isSuggested ? `Suggestion : ${breaker.label}` : breaker.label || "Cliquez pour nommer"}
          style={{
            width: "100%",
            textAlign: "center",
            fontFamily: "'IBM Plex Sans Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 600,
            fontSize: 13,
            fontStyle: isSuggested ? "italic" : "normal",
            color: isEmpty ? "#D97706" : isSuggested ? "#7C3AED" : "#111827",
            background: "transparent",
            border: "none",
            outline: "none",
            lineHeight: 1.2,
            padding: 0,
            // Anti-débordement : tronque visuellement au-delà de la largeur
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        />

        <div style={{ width: "70%", borderTop: "1px solid #E5E7EB" }} />

        <input
          type="text"
          value={breaker.sublabel ?? ""}
          onChange={(e) => onChange(breaker.id, breaker.label, e.target.value)}
          placeholder="—"
          style={{
            width: "100%",
            textAlign: "center",
            fontFamily: "'IBM Plex Sans Condensed', 'Arial Narrow', Arial, sans-serif",
            fontWeight: 500,
            fontSize: 11,
            color: "#555555",
            background: "transparent",
            border: "none",
            outline: "none",
            lineHeight: 1.1,
            padding: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        />
      </div>
    </div>
  );
}
