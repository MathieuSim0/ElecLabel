// Configuration manuelle d'un tableau : choix nombre de rangées + slots par rangée + aperçu visuel.
// UI responsive : modal centrée sur desktop, plein écran sur mobile.
import { useState } from "react";
import type { Panel, PoleWidth } from "../types/panel";

interface ManualPanelSetupProps {
  onConfirm: (panel: Panel) => void;
  onCancel: () => void;
}

const SLOT_OPTIONS = [8, 10, 12, 13, 14, 18, 24];
const ROW_OPTIONS = [1, 2, 3, 4, 5, 6];

export default function ManualPanelSetup({ onConfirm, onCancel }: ManualPanelSetupProps) {
  const [rowCount, setRowCount] = useState(2);
  const [slotsPerRow, setSlotsPerRow] = useState(13);

  const handleConfirm = () => {
    const rows = Array.from({ length: rowCount }, (_, rowIndex) => ({
      index: rowIndex,
      totalSlots: slotsPerRow,
      breakers: Array.from({ length: slotsPerRow }, (_, i) => ({
        id: `r${rowIndex}-${i}`,
        row: rowIndex,
        position: i,
        poles: 1 as PoleWidth,
        label: "",
        sublabel: "",
      })),
    }));
    onConfirm({ rows });
  };

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(6px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "manualFadeIn 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "92vh",
          background: "#FFFFFF",
          borderRadius: 18,
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "manualSlideUp 0.22s cubic-bezier(.21,.94,.49,1.05)",
        }}
      >
        {/* En-tête */}
        <div
          style={{
            padding: "18px 22px 16px",
            borderBottom: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 11,
                background: "linear-gradient(135deg, #E63946, #C0303C)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 6px 14px rgba(230,57,70,0.32)",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="6" width="18" height="12" rx="2" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="8" y1="6" x2="8" y2="18" />
                <line x1="13" y1="6" x2="13" y2="18" />
                <line x1="18" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.3px" }}>
                Créer un tableau manuellement
              </h2>
              <p style={{ fontSize: 12, color: "#6B7280", marginTop: 3, lineHeight: 1.4 }}>
                Choisis la structure, tu rempliras les étiquettes après.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#6B7280",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 16,
              flexShrink: 0,
              transition: "all 0.15s ease",
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Contenu scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px 12px" }}>
          {/* ── Section rangées ── */}
          <SectionTitle index={1} title="Nombre de rangées" subtitle="Combien de rails DIN dans ton tableau ?" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, 1fr)",
              gap: 8,
              marginBottom: 22,
            }}
          >
            {ROW_OPTIONS.map((n) => {
              const active = rowCount === n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRowCount(n)}
                  style={{
                    minHeight: 52,
                    padding: "8px 4px",
                    borderRadius: 11,
                    border: active ? "2px solid #111827" : "2px solid #E5E7EB",
                    background: active ? "#111827" : "#FFFFFF",
                    color: active ? "#FFFFFF" : "#4B5563",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    fontWeight: 700,
                    transition: "all 0.12s ease",
                    boxShadow: active ? "0 4px 12px rgba(17,24,39,0.25)" : "none",
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{n}</span>
                  <span style={{ fontSize: 9, opacity: 0.7, fontWeight: 500 }}>
                    rang.
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Section slots ── */}
          <SectionTitle index={2} title="Slots par rangée" subtitle="13 est le standard résidentiel français" />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: 6,
              marginBottom: 22,
            }}
          >
            {SLOT_OPTIONS.map((n) => {
              const active = slotsPerRow === n;
              const isStandard = n === 13;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSlotsPerRow(n)}
                  style={{
                    minHeight: 44,
                    borderRadius: 10,
                    border: active
                      ? "2px solid #E63946"
                      : isStandard
                      ? "2px solid #FCA5A5"
                      : "2px solid #E5E7EB",
                    background: active ? "#E63946" : "#FFFFFF",
                    color: active ? "#FFFFFF" : "#4B5563",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 14,
                    transition: "all 0.12s ease",
                    boxShadow: active ? "0 4px 12px rgba(230,57,70,0.3)" : "none",
                    position: "relative",
                  }}
                >
                  {n}
                  {isStandard && !active && (
                    <span
                      style={{
                        position: "absolute",
                        top: -7,
                        right: -7,
                        fontSize: 8,
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: 4,
                        background: "#FCA5A5",
                        color: "#7F1D1D",
                        letterSpacing: 0.3,
                      }}
                    >
                      DIN
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Aperçu visuel ── */}
          <SectionTitle index={3} title="Aperçu" subtitle="À quoi ressemble ton tableau" />
          <PanelPreview rowCount={rowCount} slotsPerRow={slotsPerRow} />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 10,
              padding: "10px 14px",
              background: "#F9FAFB",
              borderRadius: 10,
              border: "1px solid #F1F5F9",
              fontSize: 12,
              color: "#374151",
            }}
          >
            <span>
              {rowCount} rangée{rowCount > 1 ? "s" : ""} × {slotsPerRow} slots
            </span>
            <span style={{ fontWeight: 700, color: "#111827" }}>
              = {rowCount * slotsPerRow} emplacements
            </span>
          </div>
        </div>

        {/* Actions */}
        <div
          style={{
            padding: "14px 22px 18px",
            borderTop: "1px solid #F1F5F9",
            display: "flex",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              flex: 1,
              minHeight: 46,
              padding: "0 18px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 11,
              border: "1.5px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#4B5563",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#111827";
              e.currentTarget.style.color = "#111827";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#E5E7EB";
              e.currentTarget.style.color = "#4B5563";
            }}
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              flex: 2,
              minHeight: 46,
              padding: "0 18px",
              fontSize: 13,
              fontWeight: 700,
              borderRadius: 11,
              border: "none",
              background: "linear-gradient(135deg, #E63946, #C0303C)",
              color: "#FFFFFF",
              cursor: "pointer",
              boxShadow: "0 6px 16px rgba(230,57,70,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "transform 0.12s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            Créer le tableau
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes manualFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes manualSlideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function SectionTitle({ index, title, subtitle }: { index: number; title: string; subtitle: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          background: "#111827",
          color: "#FFFFFF",
          fontSize: 11,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {index}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", letterSpacing: "-0.1px" }}>
          {title}
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{subtitle}</div>
      </div>
    </div>
  );
}

// Aperçu visuel : mime un tableau électrique avec rails DIN gris-clairs et slots vides.
// Les slots utilisent flex: 1 pour s'adapter à la largeur disponible (responsive desktop/mobile).
function PanelPreview({ rowCount, slotsPerRow }: { rowCount: number; slotsPerRow: number }) {
  // Hauteur des slots scale légèrement selon densité (plus on en met, plus c'est fin)
  const slotHeight = slotsPerRow >= 18 ? 22 : 26;

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #1E293B, #0F172A)",
        borderRadius: 12,
        padding: "14px 12px",
        boxShadow: "inset 0 3px 10px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: rowCount }).map((_, r) => (
          <div key={r} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 20,
                fontSize: 10,
                fontWeight: 700,
                color: "#64748B",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              R{r + 1}
            </span>
            <div
              style={{
                display: "flex",
                gap: 2,
                flex: 1,
                padding: "3px 4px",
                background: "rgba(255,255,255,0.04)",
                borderRadius: 4,
                border: "1px solid rgba(255,255,255,0.06)",
                minWidth: 0,
              }}
            >
              {Array.from({ length: slotsPerRow }).map((_, s) => (
                <div
                  key={s}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: slotHeight,
                    background: "rgba(248, 250, 252, 0.92)",
                    borderRadius: 2,
                    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.08)",
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
