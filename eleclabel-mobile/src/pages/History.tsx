// Page historique mobile — liste single-column de tableaux récents avec recherche
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../store/panelStore";
import { useHistoryStore, loadPanelImage, type HistoryEntry, type HistorySource } from "../store/historyStore";
import { TEMPLATES, type PanelTemplate } from "../data/templates";
import MobileHeader from "../components/MobileHeader";
import BottomNav from "../components/BottomNav";

const SOURCE_LABELS: Record<HistorySource, { icon: string; label: string }> = {
  photo: { icon: "📷", label: "Photo" },
  template: { icon: "📋", label: "Modèle" },
  manual: { icon: "✏️", label: "Manuel" },
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "À l'instant";
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)} j`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export default function History() {
  const navigate = useNavigate();
  const { setPanel, setHistoryId } = usePanelStore();
  const { entries, remove, clear, rename, add: addHistory } = useHistoryStore();
  const [query, setQuery] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const filteredHistory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => {
      if (e.name.toLowerCase().includes(q)) return true;
      for (const r of e.panel.rows) {
        for (const b of r.breakers) {
          if (b.label.toLowerCase().includes(q)) return true;
          if ((b.sublabel ?? "").toLowerCase().includes(q)) return true;
        }
      }
      return false;
    });
  }, [entries, query]);

  const filteredTemplates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return TEMPLATES.filter((t) => {
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
  }, [query]);

  const handleOpen = async (entry: HistoryEntry) => {
    if (!entry.panel || !Array.isArray(entry.panel.rows)) {
      window.alert("Ce tableau n'a pas pu être chargé (données incomplètes). Réessaie dans un instant.");
      return;
    }
    const img = (await loadPanelImage(entry.id)) ?? entry.panel.imageBase64;
    setPanel(structuredClone({ ...entry.panel, imageBase64: img }));
    setHistoryId(entry.id);
    navigate("/editor");
  };

  const handleOpenTemplate = (t: PanelTemplate) => {
    const panel = JSON.parse(JSON.stringify(t.panel));
    setPanel(panel);
    const id = addHistory({ name: t.name, panel, source: "template" });
    setHistoryId(id);
    navigate("/editor");
  };

  return (
    <div style={{ height: "100vh", maxHeight: "100vh", display: "flex", flexDirection: "column", background: "#F7F8FC" }}>
      <MobileHeader
        title="Historique"
        subtitle={`${entries.length} tableau${entries.length > 1 ? "x" : ""}`}
        rightAction={entries.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Effacer tout l'historique ?")) clear();
            }}
            style={{
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "#FFFFFF",
              color: "#6B7280",
            }}
          >
            Vider
          </button>
        ) : undefined}
      />

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
            marginBottom: 14,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Chercher un label, un nom…"
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

        {/* Modèles correspondants (si recherche) */}
        {query && filteredTemplates.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <SectionTitle icon="📋" label="Modèles" count={filteredTemplates.length} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleOpenTemplate(t)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 10,
                    border: "1px solid #E5E7EB", background: "#FFFFFF",
                    cursor: "pointer", textAlign: "left", width: "100%",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: "#F3F4F6",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0,
                  }}>
                    {t.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Historique */}
        <section>
          <SectionTitle icon="🕐" label={query ? "Vos tableaux" : "Tableaux récents"} count={filteredHistory.length} />

          {entries.length === 0 ? (
            <EmptyState onStart={() => navigate("/")} onTemplate={() => navigate("/templates")} />
          ) : filteredHistory.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 20px", color: "#9CA3AF", fontSize: 13 }}>
              Aucun résultat pour « {query} ».
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filteredHistory.map((entry) => (
                <HistoryCard
                  key={entry.id}
                  entry={entry}
                  onOpen={() => handleOpen(entry)}
                  onDelete={() => {
                    if (window.confirm(`Supprimer "${entry.name}" ?`)) remove(entry.id);
                  }}
                  onRename={() => {
                    setRenameTarget(entry.id);
                    setRenameValue(entry.name);
                  }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <BottomNav />

      {/* Modale renommer */}
      {renameTarget && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            zIndex: 100,
            paddingBottom: "var(--safe-bottom)",
          }}
          onClick={() => setRenameTarget(null)}
        >
          <div
            style={{
              background: "#FFF", borderRadius: "16px 16px 0 0",
              padding: 20, width: "100%", maxWidth: 460,
              animation: "slideUp 0.2s ease",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 12 }}>
              Renommer
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "12px", fontSize: 14,
                border: "1.5px solid #E5E7EB", borderRadius: 10, outline: "none",
                marginBottom: 14, boxSizing: "border-box",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  rename(renameTarget, renameValue.trim() || "Sans nom");
                  setRenameTarget(null);
                }
                if (e.key === "Escape") setRenameTarget(null);
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{
                  flex: 1, padding: "12px", fontSize: 13, fontWeight: 600,
                  borderRadius: 10, border: "1.5px solid #E5E7EB",
                  background: "#FFFFFF", color: "#6B7280",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  rename(renameTarget, renameValue.trim() || "Sans nom");
                  setRenameTarget(null);
                }}
                style={{
                  flex: 1, padding: "12px", fontSize: 13, fontWeight: 700,
                  borderRadius: 10, border: "none",
                  background: "#111827", color: "#FFF",
                }}
              >
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, label, count }: { icon: string; label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{label}</h2>
      <span
        style={{
          fontSize: 10, padding: "2px 6px", borderRadius: 5,
          background: "#F3F4F6", color: "#6B7280", fontWeight: 700,
        }}
      >
        {count}
      </span>
    </div>
  );
}

function HistoryCard({
  entry,
  onOpen,
  onDelete,
  onRename,
}: {
  entry: HistoryEntry;
  onOpen: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  const info = SOURCE_LABELS[entry.source];
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 12,
        border: "1px solid #E5E7EB",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        style={{
          display: "flex",
          width: "100%",
          padding: 0,
          border: "none",
          background: "transparent",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 88, height: 88, background: "#F3F4F6",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, position: "relative",
          }}
        >
          {entry.thumbnail ? (
            <img
              src={`data:image/jpeg;base64,${entry.thumbnail}`}
              alt={entry.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: 32, opacity: 0.5 }}>{info.icon}</span>
          )}
          <span
            style={{
              position: "absolute", top: 4, left: 4,
              padding: "2px 5px", borderRadius: 4,
              background: "rgba(17,24,39,0.85)", color: "#FFF",
              fontSize: 9, fontWeight: 600,
            }}
          >
            {info.label}
          </span>
        </div>
        <div style={{ flex: 1, padding: "10px 12px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontSize: 14, fontWeight: 700, color: "#111827",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {entry.name}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
            {formatDate(entry.timestamp)}
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>
            {entry.rowCount} rangée{entry.rowCount > 1 ? "s" : ""} · {entry.breakerCount} disj.
          </div>
        </div>
      </button>
      <div style={{ display: "flex", borderTop: "1px solid #E5E7EB" }}>
        <button
          type="button"
          onClick={onOpen}
          style={{
            flex: 2, padding: "10px",
            fontSize: 12, fontWeight: 700,
            border: "none", background: "transparent",
            color: "#E63946", cursor: "pointer",
          }}
        >
          Ouvrir
        </button>
        <button
          type="button"
          onClick={onRename}
          style={{
            flex: 1, padding: "10px",
            fontSize: 14, border: "none",
            background: "transparent", color: "#6B7280", cursor: "pointer",
            borderLeft: "1px solid #E5E7EB",
          }}
          aria-label="Renommer"
        >
          ✏️
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{
            flex: 1, padding: "10px",
            fontSize: 14, border: "none",
            background: "transparent", color: "#6B7280", cursor: "pointer",
            borderLeft: "1px solid #E5E7EB",
          }}
          aria-label="Supprimer"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onStart, onTemplate }: { onStart: () => void; onTemplate: () => void }) {
  return (
    <div
      style={{
        textAlign: "center", padding: "40px 20px",
        background: "#FFF", borderRadius: 14, border: "1px dashed #E5E7EB",
      }}
    >
      <div style={{ fontSize: 38, opacity: 0.4, marginBottom: 12 }}>🕐</div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
        Pas encore de tableaux
      </h3>
      <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>
        Chaque tableau analysé y est sauvegardé automatiquement.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button
          type="button"
          onClick={onStart}
          style={{
            padding: "10px 14px", fontSize: 12, fontWeight: 700,
            borderRadius: 10, border: "none",
            background: "#111827", color: "#FFF",
          }}
        >
          Analyser
        </button>
        <button
          type="button"
          onClick={onTemplate}
          style={{
            padding: "10px 14px", fontSize: 12, fontWeight: 700,
            borderRadius: 10, border: "1.5px solid #E5E7EB",
            background: "#FFF", color: "#4B5563",
          }}
        >
          Modèles
        </button>
      </div>
    </div>
  );
}
