// Grille d'étiquettes représentant toutes les rangées du tableau électrique
import type { Panel, PoleWidth } from "../types/panel";
import { computeRowLayout } from "../utils/labelLayout";
import LabelCell from "./LabelCell";

interface LabelGridProps {
  panel: Panel;
  onLabelChange: (id: string, label: string, sublabel: string) => void;
  onPolesChange: (id: string, poles: PoleWidth) => void;
  onDeleteBreaker: (id: string) => void;
  onAddBreaker: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
  onAddRow: () => void;
  onIconClick: (id: string) => void;
}

function RowCard({
  row,
  onLabelChange,
  onPolesChange,
  onDeleteBreaker,
  onAddBreaker,
  onDeleteRow,
  onIconClick,
}: {
  row: Panel["rows"][0];
  onLabelChange: LabelGridProps["onLabelChange"];
  onPolesChange: LabelGridProps["onPolesChange"];
  onDeleteBreaker: LabelGridProps["onDeleteBreaker"];
  onAddBreaker: LabelGridProps["onAddBreaker"];
  onDeleteRow: LabelGridProps["onDeleteRow"];
  onIconClick: LabelGridProps["onIconClick"];
}) {
  const breakers = computeRowLayout(row);
  const unknownCount = breakers.filter(
    (b) => b.label.trim() === "?" || !b.label.trim() || b.suggested,
  ).length;

  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
      {/* Numéro de rangée */}
      <div
        style={{
          width: 36,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 22,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "#111827",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 700,
            color: "#FFFFFF",
          }}
        >
          R{row.index + 1}
        </div>
      </div>

      {/* Contenu principal */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Rail de cellules */}
        <div
          style={{
            display: "flex",
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid #E5E7EB",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            background: "#FFFFFF",
          }}
        >
          {breakers.map((breaker) => (
            <LabelCell
              key={breaker.id}
              breaker={breaker}
              totalSlots={row.totalSlots}
              onChange={onLabelChange}
              onPolesChange={onPolesChange}
              onDelete={onDeleteBreaker}
              onIconClick={onIconClick}
            />
          ))}

          {/* Bouton + ajouter un disjoncteur */}
          <button
            type="button"
            onClick={() => onAddBreaker(row.index)}
            title="Ajouter un disjoncteur"
            style={{
              width: 34,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 300,
              background: "#F9FAFB",
              borderLeft: "1px solid #E5E7EB",
              color: "#9CA3AF",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#F3F4F6";
              e.currentTarget.style.color = "#111827";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "#F9FAFB";
              e.currentTarget.style.color = "#9CA3AF";
            }}
          >
            +
          </button>
        </div>

        {/* Méta-infos */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 4, fontSize: 11 }}>
          <span style={{ color: "#6B7280", fontWeight: 500 }}>
            {breakers.length} disj. · {row.totalSlots} slots
          </span>
          {unknownCount > 0 && (
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                background: "#FEF3C7",
                color: "#92400E",
                fontWeight: 600,
              }}
            >
              {unknownCount} à vérifier
            </span>
          )}
        </div>
      </div>

      {/* Bouton supprimer la rangée */}
      <div style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "flex-start", paddingTop: 22, justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => onDeleteRow(row.index)}
          title="Supprimer cette rangée"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1.5px solid #E5E7EB",
            background: "#FFFFFF",
            color: "#9CA3AF",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#DC2626";
            e.currentTarget.style.color = "#DC2626";
            e.currentTarget.style.background = "#FEF2F2";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#E5E7EB";
            e.currentTarget.style.color = "#9CA3AF";
            e.currentTarget.style.background = "#FFFFFF";
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function LabelGrid({
  panel,
  onLabelChange,
  onPolesChange,
  onDeleteBreaker,
  onAddBreaker,
  onDeleteRow,
  onAddRow,
  onIconClick,
}: LabelGridProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingTop: 12, paddingBottom: 24 }}>
      {panel.rows.map((row) => (
        <RowCard
          key={row.index}
          row={row}
          onLabelChange={onLabelChange}
          onPolesChange={onPolesChange}
          onDeleteBreaker={onDeleteBreaker}
          onAddBreaker={onAddBreaker}
          onDeleteRow={onDeleteRow}
          onIconClick={onIconClick}
        />
      ))}

      {/* Bouton ajouter une rangée */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 12 }}>
        <div style={{ width: 36, flexShrink: 0 }} />
        <button
          type="button"
          onClick={onAddRow}
          style={{
            flex: 1,
            padding: "14px 0",
            borderRadius: 10,
            border: "2px dashed #D1D5DB",
            background: "transparent",
            color: "#6B7280",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#111827";
            e.currentTarget.style.background = "#F9FAFB";
            e.currentTarget.style.color = "#111827";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#D1D5DB";
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#6B7280";
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          Ajouter une rangée
        </button>
        <div style={{ width: 32, flexShrink: 0 }} />
      </div>
    </div>
  );
}
