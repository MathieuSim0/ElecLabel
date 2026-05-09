// Page "Modèles prêts" — parcourir et charger un tableau pré-rempli
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../store/panelStore";
import { useHistoryStore } from "../store/historyStore";
import { TEMPLATES, CATEGORIES, type PanelTemplate } from "../data/templates";
import AccountMenu from "../components/AccountMenu";
import SyncStatus from "../components/SyncStatus";
import LogoMark from "../components/LogoMark";

const POLE_COLOR: Record<number, string> = { 1: "#2563EB", 2: "#D97706", 3: "#DC2626" };

function MiniPanel({ template }: { template: PanelTemplate }) {
  const maxSlots = Math.max(...template.panel.rows.map((r) => r.totalSlots));

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0D1526, #111827)",
        borderRadius: 10,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 4,
        boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      {template.panel.rows.map((row) => (
        <div key={row.index} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: "#6B7280",
              width: 14,
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
                    height: 14,
                    width: `${(pct * rowWidthPct) / 100}%`,
                    background: POLE_COLOR[b.poles],
                    borderRadius: 2,
                    opacity: 0.85,
                  }}
                  title={`${b.label} (${b.poles}P ${b.sublabel ?? ""})`}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateCard({
  template,
  onUse,
}: {
  template: PanelTemplate;
  onUse: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const totalBreakers = template.panel.rows.reduce((s, r) => s + r.breakers.length, 0);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        border: `1px solid ${hovered ? "#111827" : "#E5E7EB"}`,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: hovered
          ? "0 8px 24px rgba(0,0,0,0.08)"
          : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.15s ease",
        cursor: "pointer",
      }}
      onClick={onUse}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {template.icon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
              {template.name}
            </div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>
              {template.description}
            </div>
          </div>
        </div>
      </div>

      <MiniPanel template={template} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: "#9CA3AF",
        }}
      >
        <span>
          {template.panel.rows.length} rangée{template.panel.rows.length > 1 ? "s" : ""} ·{" "}
          {totalBreakers} disjoncteurs
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: hovered ? "#E63946" : "#111827",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Utiliser
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </div>
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
    // Clone profond pour éviter toute mutation partagée entre pages
    const panel = JSON.parse(JSON.stringify(template.panel));
    setPanel(panel);
    const id = addHistory({ name: template.name, panel, source: "template" });
    setHistoryId(id);
    navigate("/editor");
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
      {/* ── Header ── */}
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
          <TabButton active={false} label="Analyse photo" icon="📷" onClick={() => navigate("/")} />
          <TabButton active label="Modèles prêts" icon="📋" onClick={() => {}} />
          <TabButton active={false} label="Historique" icon="🕐" onClick={() => navigate("/history")} />
          <TabButton active={false} label="Factures" icon="🧾" onClick={() => navigate("/invoices")} />
        </div>
      </header>

      {/* ── Contenu ── */}
      <main style={{ flex: 1, padding: "32px 24px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Titre */}
          <div style={{ marginBottom: 24, textAlign: "center" }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: "#111827",
                letterSpacing: "-0.5px",
                marginBottom: 8,
              }}
            >
              Modèles prêts à imprimer
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280" }}>
              Choisissez un tableau type, ajustez si besoin, puis exportez en PDF. Aucune photo nécessaire.
            </p>
          </div>

          {/* Barre de recherche */}
          <div
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 10,
              background: "#FFFFFF", border: "1.5px solid #E5E7EB",
              maxWidth: 520, margin: "0 auto 16px",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Chercher un modèle, un label, un ampérage…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                flex: 1, border: "none", outline: "none",
                fontSize: 13, color: "#111827", background: "transparent",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#9CA3AF", fontSize: 14 }}
              >
                ×
              </button>
            )}
          </div>

          {/* Filtres */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 24,
              flexWrap: "wrap",
              justifyContent: "center",
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

          {/* Grille */}
          {visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", fontSize: 13 }}>
              Aucun modèle ne correspond à « {query} ».
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 16,
              }}
            >
              {visible.map((t) => (
                <TemplateCard key={t.id} template={t} onUse={() => handleUse(t)} />
              ))}
            </div>
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

function CategoryPill({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 10,
        border: `1.5px solid ${active ? "#111827" : "#E5E7EB"}`,
        background: active ? "#111827" : "#FFFFFF",
        color: active ? "#FFFFFF" : "#4B5563",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      <span>{icon}</span>
      <span>{label}</span>
      <span
        style={{
          fontSize: 11,
          padding: "1px 6px",
          borderRadius: 5,
          background: active ? "rgba(255,255,255,0.15)" : "#F3F4F6",
          color: active ? "#FFFFFF" : "#9CA3AF",
          fontWeight: 700,
        }}
      >
        {count}
      </span>
    </button>
  );
}
