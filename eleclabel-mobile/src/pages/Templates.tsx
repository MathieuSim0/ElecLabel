// Page modèles prêts — version mobile single-column avec recherche + filtres horizontaux scrollables
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../store/panelStore";
import { useHistoryStore } from "../store/historyStore";
import { TEMPLATES, CATEGORIES, type PanelTemplate } from "../data/templates";
import MobileHeader from "../components/MobileHeader";
import BottomNav from "../components/BottomNav";

const POLE_COLOR: Record<number, string> = { 1: "#2563EB", 2: "#D97706", 3: "#DC2626", 4: "#7C3AED" };

function MiniPanel({ template }: { template: PanelTemplate }) {
  const maxSlots = Math.max(...template.panel.rows.map((r) => r.totalSlots));
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0D1526, #111827)",
        borderRadius: 8,
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 3,
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      {template.panel.rows.map((row) => (
        <div key={row.index} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            style={{
              fontSize: 7,
              fontWeight: 700,
              color: "#6B7280",
              width: 12,
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            R{row.index + 1}
          </span>
          <div style={{ flex: 1, display: "flex", gap: 1 }}>
            {row.breakers.map((b) => {
              const pct = (b.poles / row.totalSlots) * 100;
              const rowWidthPct = (row.totalSlots / maxSlots) * 100;
              return (
                <div
                  key={b.id}
                  style={{
                    height: 11,
                    width: `${(pct * rowWidthPct) / 100}%`,
                    background: POLE_COLOR[b.poles] ?? "#6B7280",
                    borderRadius: 2,
                    opacity: 0.85,
                  }}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateCard({ template, onUse }: { template: PanelTemplate; onUse: () => void }) {
  const totalBreakers = template.panel.rows.reduce((s, r) => s + r.breakers.length, 0);
  return (
    <button
      type="button"
      onClick={onUse}
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 36, height: 36, borderRadius: 9, background: "#F3F4F6",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}
        >
          {template.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{template.name}</div>
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>{template.description}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <MiniPanel template={template} />
      <div style={{ fontSize: 11, color: "#9CA3AF" }}>
        {template.panel.rows.length} rangée{template.panel.rows.length > 1 ? "s" : ""} · {totalBreakers} disjoncteurs
      </div>
    </button>
  );
}

export default function Templates() {
  const navigate = useNavigate();
  const { setPanel, setHistoryId } = usePanelStore();
  const { add: addHistory } = useHistoryStore();
  const [activeCat, setActiveCat] = useState<"all" | (typeof CATEGORIES)[number]["id"]>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = activeCat === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.category === activeCat);
    if (q) {
      list = list.filter((t) => {
        if (t.name.toLowerCase().includes(q)) return true;
        if (t.description.toLowerCase().includes(q)) return true;
        for (const r of t.panel.rows) {
          for (const b of r.breakers) {
            if (b.label.toLowerCase().includes(q)) return true;
            if ((b.sublabel ?? "").toLowerCase().includes(q)) return true;
          }
        }
        return false;
      });
    }
    return list;
  }, [activeCat, query]);

  const handleUse = (template: PanelTemplate) => {
    const panel = JSON.parse(JSON.stringify(template.panel));
    setPanel(panel);
    const id = addHistory({ name: template.name, panel, source: "template" });
    setHistoryId(id);
    navigate("/editor");
  };

  return (
    <div style={{ height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC" }}>
      <MobileHeader title="Modèles" subtitle={`${TEMPLATES.length} tableaux types`} />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "16px 16px 100px",
        }}
      >
        {/* Recherche */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 12px", borderRadius: 10,
            background: "#FFFFFF", border: "1px solid #E5E7EB",
            marginBottom: 12,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Chercher un modèle…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1, border: "none", outline: "none",
              fontSize: 14, color: "#111827", background: "transparent",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{ border: "none", background: "transparent", color: "#9CA3AF", fontSize: 16, padding: 0, width: 24, height: 24 }}
            >
              ×
            </button>
          )}
        </div>

        {/* Filtres horizontaux scroll */}
        <div
          style={{
            display: "flex", gap: 8, overflowX: "auto",
            marginBottom: 14, paddingBottom: 4,
            scrollbarWidth: "none", WebkitOverflowScrolling: "touch",
          }}
        >
          <CategoryPill
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
            icon="📋"
            label="Tous"
            count={TEMPLATES.length}
          />
          {CATEGORIES.map((cat) => {
            const count = TEMPLATES.filter((t) => t.category === cat.id).length;
            return (
              <CategoryPill
                key={cat.id}
                active={activeCat === cat.id}
                onClick={() => setActiveCat(cat.id)}
                icon={cat.icon}
                label={cat.label}
                count={count}
              />
            );
          })}
        </div>

        {/* Liste cartes */}
        {visible.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#9CA3AF", fontSize: 13 }}>
            Aucun modèle ne correspond à « {query} ».
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {visible.map((t) => (
              <TemplateCard key={t.id} template={t} onUse={() => handleUse(t)} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function CategoryPill({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: string; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderRadius: 999,
        border: `1.5px solid ${active ? "#111827" : "#E5E7EB"}`,
        background: active ? "#111827" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#4B5563",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        flexShrink: 0,
        whiteSpace: "nowrap",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span
        style={{
          fontSize: 10,
          padding: "1px 5px",
          borderRadius: 4,
          background: active ? "rgba(255,255,255,0.2)" : "#F3F4F6",
          color: active ? "#FFFFFF" : "#9CA3AF",
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );
}
