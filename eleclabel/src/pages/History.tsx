// Historique des tableaux déjà analysés + bibliothèque de schémas importés + recherche globale
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePanelStore } from "../store/panelStore";
import { useHistoryStore, createThumbnail, loadPanelImage, type HistoryEntry, type HistorySource } from "../store/historyStore";
import {
  useLibraryStore, readFileAsBase64, downloadImportedFile, formatFileSize, iconForExtension,
  MAX_FILE_SIZE, type ImportedFile,
} from "../store/libraryStore";
import { TEMPLATES, type PanelTemplate } from "../data/templates";
import AccountMenu from "../components/AccountMenu";
import SyncStatus from "../components/SyncStatus";
import LogoMark from "../components/LogoMark";

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
  const {
    files: libFiles, add: addLibFile, remove: removeLibFile,
    rename: renameLibFile, updateNotes,
  } = useLibraryStore();
  const [query, setQuery] = useState("");
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [libRenameTarget, setLibRenameTarget] = useState<string | null>(null);
  const [libRenameValue, setLibRenameValue] = useState("");
  const [editingNotesFor, setEditingNotesFor] = useState<ImportedFile | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setImportError(null);
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_FILE_SIZE) {
        setImportError(`"${file.name}" dépasse 2 Mo — trop gros pour être stocké localement.`);
        continue;
      }
      try {
        const data = await readFileAsBase64(file);
        const extension = (file.name.split(".").pop() ?? "").toLowerCase();
        let preview: string | undefined;
        if (file.type.startsWith("image/")) {
          preview = await createThumbnail(data, file.type, 300);
        }
        const ok = addLibFile({
          name: file.name.replace(/\.[^.]+$/, ""),
          filename: file.name,
          extension,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          data,
          preview,
        });
        if (!ok) setImportError("Stockage local saturé. Supprimez des fichiers avant d'importer.");
      } catch {
        setImportError(`Impossible de lire "${file.name}".`);
      }
    }
  };

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

  const filteredLibrary = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return libFiles;
    return libFiles.filter((f) => {
      if (f.name.toLowerCase().includes(q)) return true;
      if (f.filename.toLowerCase().includes(q)) return true;
      if (f.extension.toLowerCase().includes(q)) return true;
      if ((f.notes ?? "").toLowerCase().includes(q)) return true;
      if ((f.tags ?? []).some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [libFiles, query]);

  const handleOpen = async (entry: HistoryEntry) => {
    // Garde : si le panel est absent/corrompu (payload realtime tronqué), on n'ouvre pas
    // au lieu de planter sur JSON.parse(undefined).
    if (!entry.panel || !Array.isArray(entry.panel.rows)) {
      window.alert("Ce tableau n'a pas pu être chargé (données incomplètes). Réessaie dans un instant.");
      return;
    }
    // L'image originale est stockée à part (IndexedDB) → on la recharge ici.
    // Fallback sur entry.panel.imageBase64 pour les anciennes entrées qui l'embarquaient encore.
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
    <div style={{ minHeight: "100vh", background: "#F7F8FC", fontFamily: "var(--font-sans)" }}>
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px" }}>
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

        <div style={{ display: "flex", padding: "0 32px", gap: 4 }}>
          <TabButton active={false} label="Analyse photo" icon="📷" onClick={() => navigate("/")} />
          <TabButton active={false} label="Modèles prêts" icon="📋" onClick={() => navigate("/templates")} />
          <TabButton active label="Historique" icon="🕐" onClick={() => {}} />
          <TabButton active={false} label="Factures" icon="🧾" onClick={() => navigate("/invoices")} />
        </div>
      </header>

      <main style={{ padding: "32px 24px 60px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ marginBottom: 24, textAlign: "center" }}>
            <h1
              style={{
                fontSize: 28, fontWeight: 700, color: "#111827",
                letterSpacing: "-0.5px", marginBottom: 8,
              }}
            >
              Vos tableaux & recherche
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280" }}>
              Tableaux analysés récemment, modèles prêts — tout est cherchable par label ou ampérage.
            </p>
          </div>

          {/* Search bar */}
          <div
            style={{
              display: "flex", gap: 10, alignItems: "center",
              maxWidth: 600, margin: "0 auto 28px",
            }}
          >
            <div
              style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                padding: "10px 14px", borderRadius: 10,
                background: "#FFFFFF", border: "1.5px solid #E5E7EB",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Chercher un label, un ampérage, un nom de tableau…"
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
            {entries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Effacer tout l'historique ? Cette action est irréversible.")) clear();
                }}
                style={{
                  padding: "10px 14px", fontSize: 12, fontWeight: 600,
                  borderRadius: 10, border: "1.5px solid #E5E7EB",
                  background: "#FFFFFF", color: "#6B7280", cursor: "pointer",
                }}
              >
                Vider
              </button>
            )}
          </div>

          {/* Résultats recherche templates */}
          {query && filteredTemplates.length > 0 && (
            <section style={{ marginBottom: 32 }}>
              <SectionTitle icon="📋" label="Modèles correspondants" count={filteredTemplates.length} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {filteredTemplates.map((t) => (
                  <TemplateResultCard key={t.id} template={t} onOpen={() => handleOpenTemplate(t)} />
                ))}
              </div>
            </section>
          )}

          {/* Bibliothèque de schémas importés */}
          <section style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 10, flexWrap: "wrap" }}>
              <SectionTitle
                icon="📁"
                label={query ? "Schémas correspondants" : "Bibliothèque de schémas"}
                count={filteredLibrary.length}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    padding: "8px 14px", fontSize: 12, fontWeight: 700,
                    borderRadius: 8, border: "none",
                    background: "#111827", color: "#FFF", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <span>＋</span> Importer un fichier
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  style={{ display: "none" }}
                />
              </div>
            </div>

            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 14, lineHeight: 1.5 }}>
              Gardez vos anciens schémas Semolog (.smg), PDF, images, DWG… tout format accepté (max 2 Mo / fichier).
              Stockage local uniquement — rien n'est envoyé en ligne.
            </p>

            {importError && (
              <div
                style={{
                  padding: "10px 14px", borderRadius: 10,
                  background: "#FEF2F2", border: "1px solid #FECACA",
                  color: "#991B1B", fontSize: 12, marginBottom: 14,
                }}
              >
                ⚠ {importError}
              </div>
            )}

            {/* Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? "#E63946" : "#D1D5DB"}`,
                background: isDragging ? "#FEF2F2" : "#FFFFFF",
                borderRadius: 14, padding: "22px 16px",
                textAlign: "center", cursor: "pointer",
                marginBottom: 16, transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>📥</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                Glissez vos fichiers ici ou cliquez pour sélectionner
              </div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                .smg · .pdf · .png · .jpg · .dwg · .dxf · etc.
              </div>
            </div>

            {/* Liste fichiers */}
            {filteredLibrary.length === 0 ? (
              libFiles.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#9CA3AF", fontSize: 12 }}>
                  Aucun fichier importé pour l'instant.
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "20px", color: "#9CA3AF", fontSize: 12 }}>
                  Aucun fichier ne correspond à « {query} ».
                </div>
              )
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {filteredLibrary.map((f) => (
                  <LibraryCard
                    key={f.id}
                    file={f}
                    onDownload={() => downloadImportedFile(f)}
                    onDelete={() => {
                      if (window.confirm(`Supprimer "${f.name}" ?`)) removeLibFile(f.id);
                    }}
                    onRename={() => {
                      setLibRenameTarget(f.id);
                      setLibRenameValue(f.name);
                    }}
                    onEditNotes={() => {
                      setEditingNotesFor(f);
                      setNotesDraft(f.notes ?? "");
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Historique */}
          <section>
            <SectionTitle
              icon="🕐"
              label={query ? "Dans votre historique" : "Tableaux récents"}
              count={filteredHistory.length}
            />

            {entries.length === 0 ? (
              <EmptyState onStart={() => navigate("/")} onTemplate={() => navigate("/templates")} />
            ) : filteredHistory.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "#9CA3AF", fontSize: 13 }}>
                Aucun résultat pour « {query} » dans votre historique.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {filteredHistory.map((entry) => (
                  <HistoryCard
                    key={entry.id}
                    entry={entry}
                    onOpen={() => handleOpen(entry)}
                    onDelete={() => {
                      if (window.confirm(`Supprimer "${entry.name}" de l'historique ?`)) remove(entry.id);
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
        </div>
      </main>

      {/* Rename dialog */}
      {renameTarget && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
          onClick={() => setRenameTarget(null)}
        >
          <div
            style={{ background: "#FFF", borderRadius: 12, padding: 24, minWidth: 340, maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 14 }}>
              Renommer le tableau
            </h3>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13,
                border: "1.5px solid #E5E7EB", borderRadius: 8, outline: "none",
                marginBottom: 16, boxSizing: "border-box",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  rename(renameTarget, renameValue.trim() || "Sans nom");
                  setRenameTarget(null);
                }
                if (e.key === "Escape") setRenameTarget(null);
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                style={{
                  padding: "8px 14px", fontSize: 12, fontWeight: 600,
                  borderRadius: 8, border: "1.5px solid #E5E7EB",
                  background: "#FFFFFF", color: "#6B7280", cursor: "pointer",
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
                  padding: "8px 14px", fontSize: 12, fontWeight: 700,
                  borderRadius: 8, border: "none",
                  background: "#111827", color: "#FFF", cursor: "pointer",
                }}
              >
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renommer un fichier bibliothèque */}
      {libRenameTarget && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
          onClick={() => setLibRenameTarget(null)}
        >
          <div
            style={{ background: "#FFF", borderRadius: 12, padding: 24, minWidth: 340, maxWidth: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 14 }}>
              Renommer le fichier
            </h3>
            <input
              type="text"
              value={libRenameValue}
              onChange={(e) => setLibRenameValue(e.target.value)}
              autoFocus
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13,
                border: "1.5px solid #E5E7EB", borderRadius: 8, outline: "none",
                marginBottom: 16, boxSizing: "border-box",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  renameLibFile(libRenameTarget, libRenameValue.trim() || "Sans nom");
                  setLibRenameTarget(null);
                }
                if (e.key === "Escape") setLibRenameTarget(null);
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setLibRenameTarget(null)}
                style={{
                  padding: "8px 14px", fontSize: 12, fontWeight: 600,
                  borderRadius: 8, border: "1.5px solid #E5E7EB",
                  background: "#FFFFFF", color: "#6B7280", cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  renameLibFile(libRenameTarget, libRenameValue.trim() || "Sans nom");
                  setLibRenameTarget(null);
                }}
                style={{
                  padding: "8px 14px", fontSize: 12, fontWeight: 700,
                  borderRadius: 8, border: "none",
                  background: "#111827", color: "#FFF", cursor: "pointer",
                }}
              >
                Renommer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Éditer les notes d'un fichier */}
      {editingNotesFor && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
          }}
          onClick={() => setEditingNotesFor(null)}
        >
          <div
            style={{ background: "#FFF", borderRadius: 12, padding: 24, minWidth: 360, maxWidth: 460, width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              Notes sur ce schéma
            </h3>
            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 14 }}>
              Ajoutez une description, l'adresse du chantier, les mots-clés de recherche…
            </p>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              autoFocus
              rows={5}
              placeholder="ex: Maison Dupont — tableau garage — rénovation 2024"
              style={{
                width: "100%", padding: "10px 12px", fontSize: 13,
                border: "1.5px solid #E5E7EB", borderRadius: 8, outline: "none",
                marginBottom: 16, boxSizing: "border-box", resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setEditingNotesFor(null)}
                style={{
                  padding: "8px 14px", fontSize: 12, fontWeight: 600,
                  borderRadius: 8, border: "1.5px solid #E5E7EB",
                  background: "#FFFFFF", color: "#6B7280", cursor: "pointer",
                }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  updateNotes(editingNotesFor.id, notesDraft);
                  setEditingNotesFor(null);
                }}
                style={{
                  padding: "8px 14px", fontSize: 12, fontWeight: 700,
                  borderRadius: 8, border: "none",
                  background: "#111827", color: "#FFF", cursor: "pointer",
                }}
              >
                Enregistrer
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
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{label}</h2>
      <span
        style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 6,
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
  const [hovered, setHovered] = useState(false);
  const info = SOURCE_LABELS[entry.source];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF", borderRadius: 14,
        border: `1px solid ${hovered ? "#111827" : "#E5E7EB"}`,
        display: "flex", flexDirection: "column",
        boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.08)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.15s ease", overflow: "hidden",
      }}
    >
      <div
        onClick={onOpen}
        style={{
          height: 130, background: "#F3F4F6", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", position: "relative",
        }}
      >
        {entry.thumbnail ? (
          <img
            src={`data:image/jpeg;base64,${entry.thumbnail}`}
            alt={entry.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ fontSize: 38, opacity: 0.4 }}>{info.icon}</div>
        )}
        <div
          style={{
            position: "absolute", top: 8, left: 8,
            padding: "3px 8px", borderRadius: 6,
            background: "rgba(17,24,39,0.85)", color: "#FFF",
            fontSize: 10, fontWeight: 600,
            display: "flex", alignItems: "center", gap: 4,
          }}
        >
          <span>{info.icon}</span>
          <span>{info.label}</span>
        </div>
      </div>

      <div style={{ padding: 13, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div
            style={{
              fontSize: 13, fontWeight: 700, color: "#111827",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
          >
            {entry.name}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>
            {formatDate(entry.timestamp)} · {entry.rowCount} rangée{entry.rowCount > 1 ? "s" : ""} · {entry.breakerCount} disj.
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onOpen}
            style={{
              flex: 1, padding: "7px", fontSize: 12, fontWeight: 700,
              borderRadius: 8, border: "none",
              background: "#111827", color: "#FFF", cursor: "pointer",
            }}
          >
            Ouvrir
          </button>
          <button
            type="button"
            onClick={onRename}
            title="Renommer"
            style={{
              padding: "7px 10px", fontSize: 12, fontWeight: 500,
              borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "#FFF", color: "#4B5563", cursor: "pointer",
            }}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer"
            style={{
              padding: "7px 10px", fontSize: 12, fontWeight: 500,
              borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "#FFF", color: "#4B5563", cursor: "pointer",
            }}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

function LibraryCard({
  file, onDownload, onDelete, onRename, onEditNotes,
}: {
  file: ImportedFile;
  onDownload: () => void;
  onDelete: () => void;
  onRename: () => void;
  onEditNotes: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const icon = iconForExtension(file.extension);
  const date = new Date(file.timestamp).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "2-digit" });

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF", borderRadius: 12,
        border: `1px solid ${hovered ? "#111827" : "#E5E7EB"}`,
        display: "flex", flexDirection: "column",
        boxShadow: hovered ? "0 6px 18px rgba(0,0,0,0.07)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.15s ease", overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 100, background: file.preview ? "#000" : "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", position: "relative",
        }}
      >
        {file.preview ? (
          <img
            src={`data:image/jpeg;base64,${file.preview}`}
            alt={file.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ fontSize: 40, opacity: 0.6 }}>{icon}</div>
        )}
        <div
          style={{
            position: "absolute", top: 6, right: 6,
            padding: "2px 7px", borderRadius: 5,
            background: "rgba(17,24,39,0.85)", color: "#FFF",
            fontSize: 10, fontWeight: 700, textTransform: "uppercase",
          }}
        >
          {file.extension || "file"}
        </div>
      </div>

      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div
            style={{
              fontSize: 13, fontWeight: 700, color: "#111827",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}
            title={file.filename}
          >
            {file.name}
          </div>
          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
            {formatFileSize(file.size)} · {date}
          </div>
          {file.notes && (
            <div
              style={{
                fontSize: 11, color: "#4B5563", marginTop: 6,
                padding: "6px 8px", background: "#F9FAFB", borderRadius: 6,
                lineHeight: 1.4,
                display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {file.notes}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onDownload}
            style={{
              flex: 1, padding: "7px", fontSize: 12, fontWeight: 700,
              borderRadius: 8, border: "none",
              background: "#111827", color: "#FFF", cursor: "pointer",
            }}
          >
            Télécharger
          </button>
          <button
            type="button"
            onClick={onEditNotes}
            title="Notes"
            style={{
              padding: "7px 10px", fontSize: 12,
              borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "#FFF", color: "#4B5563", cursor: "pointer",
            }}
          >
            📝
          </button>
          <button
            type="button"
            onClick={onRename}
            title="Renommer"
            style={{
              padding: "7px 10px", fontSize: 12,
              borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "#FFF", color: "#4B5563", cursor: "pointer",
            }}
          >
            ✏️
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Supprimer"
            style={{
              padding: "7px 10px", fontSize: 12,
              borderRadius: 8, border: "1.5px solid #E5E7EB",
              background: "#FFF", color: "#4B5563", cursor: "pointer",
            }}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}

function TemplateResultCard({ template, onOpen }: { template: PanelTemplate; onOpen: () => void }) {
  const [hovered, setHovered] = useState(false);
  const totalBreakers = template.panel.rows.reduce((s, r) => s + r.breakers.length, 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF", borderRadius: 12,
        border: `1px solid ${hovered ? "#111827" : "#E5E7EB"}`,
        padding: "12px 14px", cursor: "pointer", textAlign: "left",
        display: "flex", alignItems: "center", gap: 12,
        transition: "all 0.15s ease",
      }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 8, background: "#F3F4F6",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}
      >
        {template.icon}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{template.name}</div>
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
          {template.panel.rows.length} rangée{template.panel.rows.length > 1 ? "s" : ""} · {totalBreakers} disj.
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onStart, onTemplate }: { onStart: () => void; onTemplate: () => void }) {
  return (
    <div
      style={{
        textAlign: "center", padding: "60px 20px",
        background: "#FFF", borderRadius: 14, border: "1px dashed #E5E7EB",
      }}
    >
      <div style={{ fontSize: 44, opacity: 0.4, marginBottom: 14 }}>🕐</div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 8 }}>
        Aucun tableau dans l'historique
      </h3>
      <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 18 }}>
        Chaque tableau analysé ou créé y est sauvegardé automatiquement.
      </p>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onStart}
          style={{
            padding: "9px 16px", fontSize: 12, fontWeight: 700,
            borderRadius: 10, border: "none",
            background: "#111827", color: "#FFF", cursor: "pointer",
          }}
        >
          Analyser un tableau
        </button>
        <button
          type="button"
          onClick={onTemplate}
          style={{
            padding: "9px 16px", fontSize: 12, fontWeight: 700,
            borderRadius: 10, border: "1.5px solid #E5E7EB",
            background: "#FFF", color: "#4B5563", cursor: "pointer",
          }}
        >
          Voir les modèles
        </button>
      </div>
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
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 16px",
        background: "transparent", border: "none",
        borderBottom: `2px solid ${active ? "#E63946" : "transparent"}`,
        color: active ? "#111827" : "#6B7280",
        fontSize: 13, fontWeight: active ? 700 : 500,
        cursor: "pointer", transition: "all 0.15s ease",
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
