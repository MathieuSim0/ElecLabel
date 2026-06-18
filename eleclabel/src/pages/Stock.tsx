// Page Stock desktop (gestion) : vue tableau, création/édition, mouvements,
// écran « à racheter », export PDF (réappro + inventaire complet).
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStockStore } from "../store/stockStore";
import {
  type Article,
  type ArticleCategory,
  type ArticleUnit,
  type Emplacement,
  CATEGORY_LABELS,
  UNIT_LABELS,
  EMPLACEMENT_LABELS,
  isLowStock,
} from "../types/stock";
import { generateReorderPdfBlob, defaultReorderFilename } from "../services/pdfReorder";

const ACCENT = "#E63946";

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Stock() {
  const navigate = useNavigate();
  const { articles, load, addMovement, seedDemo } = useStockStore();
  const lowStock = useStockStore((s) => s.lowStockArticles);

  const [view, setView] = useState<"all" | "reappro">("all");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<ArticleCategory | "all">("all");
  const [editing, setEditing] = useState<Article | "new" | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const lowCount = useMemo(() => lowStock().length, [lowStock, articles]);

  const list = useMemo(() => {
    const base = view === "reappro" ? lowStock() : articles.filter((a) => !a.archived);
    const q = query.trim().toLowerCase();
    return base
      .filter((a) => (cat === "all" ? true : a.categorie === cat))
      .filter((a) => (!q ? true : a.nom.toLowerCase().includes(q) || a.reference?.toLowerCase().includes(q) || a.code_barres?.toLowerCase().includes(q)))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [view, articles, lowStock, query, cat]);

  const exportPdf = async (mode: "reappro" | "full") => {
    const data = mode === "reappro" ? lowStock() : articles.filter((a) => !a.archived);
    const blob = await generateReorderPdfBlob(data, { mode });
    downloadBlob(blob, defaultReorderFilename(mode));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F7F8FC", fontFamily: "var(--font-sans)" }}>
      {/* Header */}
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", padding: "16px 32px", display: "flex", alignItems: "center", gap: 16 }}>
        <button type="button" onClick={() => navigate("/")} style={{ background: "transparent", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontSize: 13, color: "#4B5563" }}>← Accueil</button>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#111827", flex: 1 }}>Stock matériel</h1>
        <button type="button" onClick={() => void exportPdf("reappro")} style={btn("#111827", "#FFF")}>Exporter réappro</button>
        <button type="button" onClick={() => void exportPdf("full")} style={btn("#FFF", "#4B5563", true)}>Exporter inventaire</button>
        <button type="button" onClick={() => setEditing("new")} style={btn(ACCENT, "#FFF")}>+ Nouvel article</button>
      </header>

      <main style={{ padding: "20px 32px", maxWidth: 1100, margin: "0 auto" }}>
        {/* Onglets + recherche + filtre */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <Tab label="Inventaire" active={view === "all"} onClick={() => setView("all")} />
            <Tab label={`À racheter${lowCount ? ` (${lowCount})` : ""}`} active={view === "reappro"} onClick={() => setView("reappro")} danger={lowCount > 0} />
          </div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher…" style={{ flex: 1, minWidth: 200, padding: "9px 12px", fontSize: 13.5, border: "1.5px solid #E5E7EB", borderRadius: 9, outline: "none" }} />
          <select value={cat} onChange={(e) => setCat(e.target.value as ArticleCategory | "all")} style={{ padding: "9px 12px", fontSize: 13.5, border: "1.5px solid #E5E7EB", borderRadius: 9, background: "#FFF", cursor: "pointer" }}>
            <option value="all">Toutes catégories</option>
            {(Object.keys(CATEGORY_LABELS) as ArticleCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>

        {/* Tableau */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2.4fr 1.2fr 1fr 1fr 1.4fr 0.8fr", padding: "10px 14px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", fontSize: 11.5, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4 }}>
            <span>Article</span><span>Catégorie</span><span>Emplacement</span><span>Seuil</span><span style={{ textAlign: "center" }}>Stock</span><span></span>
          </div>
          {list.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 14 }}>
              {view === "reappro" ? "Rien à racheter 👍" : "Aucun article."}
              {view === "all" && articles.length === 0 && (
                <div style={{ marginTop: 14 }}>
                  <button type="button" onClick={() => void seedDemo()} style={btn("#FFF", "#4B5563", true)}>Charger des exemples</button>
                </div>
              )}
            </div>
          ) : (
            list.map((a) => {
              const low = isLowStock(a);
              return (
                <div key={a.id} style={{ display: "grid", gridTemplateColumns: "2.4fr 1.2fr 1fr 1fr 1.4fr 0.8fr", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #F1F5F9", fontSize: 13.5 }}>
                  <button type="button" onClick={() => setEditing(a)} style={{ textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, color: "#111827" }}>{a.nom}</span>
                    {low && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "#B91C1C", background: "#FEE2E2", borderRadius: 999, padding: "2px 7px" }}>BAS</span>}
                    {a.reference ? <div style={{ fontSize: 11, color: "#9CA3AF" }}>{a.reference}</div> : null}
                  </button>
                  <span style={{ color: "#4B5563" }}>{CATEGORY_LABELS[a.categorie]}</span>
                  <span style={{ color: "#4B5563" }}>{a.emplacement ? EMPLACEMENT_LABELS[a.emplacement] : "—"}</span>
                  <span style={{ color: "#4B5563" }}>{a.seuil_alerte ?? "—"}</span>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <button type="button" onClick={() => void addMovement(a.id, "sortie", 1, { source: "manuel" })} style={qtyBtn("#FEE2E2", "#B91C1C")}>−</button>
                    <span style={{ minWidth: 54, textAlign: "center", fontWeight: 800, color: low ? "#B91C1C" : "#111827" }}>{a.quantite_stock} <span style={{ fontSize: 11, fontWeight: 500, color: "#9CA3AF" }}>{UNIT_LABELS[a.unite]}</span></span>
                    <button type="button" onClick={() => void addMovement(a.id, "entree", 1, { source: "manuel" })} style={qtyBtn("#DCFCE7", "#15803D")}>+</button>
                  </div>
                  <button type="button" onClick={() => setEditing(a)} style={{ justifySelf: "end", background: "transparent", border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "#4B5563", cursor: "pointer" }}>Éditer</button>
                </div>
              );
            })
          )}
        </div>
      </main>

      {editing && <ArticleModal article={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─────────────────────────── Modale d'édition ───────────────────────────

function ArticleModal({ article, onClose }: { article: Article | null; onClose: () => void }) {
  const { addArticle, updateArticle, archiveArticle, removeArticle, addMovement, setStockByCount, movementsForArticle } = useStockStore();
  const isEdit = article != null;
  const [f, setF] = useState({
    nom: article?.nom ?? "",
    categorie: (article?.categorie ?? "autre") as ArticleCategory,
    unite: (article?.unite ?? "piece") as ArticleUnit,
    code_barres: article?.code_barres ?? "",
    reference: article?.reference ?? "",
    emplacement: (article?.emplacement ?? "") as Emplacement | "",
    seuil: article?.seuil_alerte != null ? String(article.seuil_alerte) : "",
    fournisseur: article?.fournisseur ?? "",
    prix: article?.prix_unitaire_ht != null ? String(article.prix_unitaire_ht) : "",
  });
  const [qty, setQty] = useState("1");
  const movements = isEdit && article ? movementsForArticle(article.id) : [];

  const payload = () => ({
    nom: f.nom.trim() || "Article",
    categorie: f.categorie,
    unite: f.unite,
    code_barres: f.code_barres.trim() || null,
    reference: f.reference.trim() || null,
    emplacement: f.emplacement || null,
    seuil_alerte: f.seuil.trim() ? Number(f.seuil.replace(",", ".")) : null,
    fournisseur: f.fournisseur.trim() || null,
    prix_unitaire_ht: f.prix.trim() ? Number(f.prix.replace(",", ".")) : null,
  });

  const save = async () => {
    if (isEdit && article) await updateArticle(article.id, payload());
    else await addArticle(payload());
    onClose();
  };

  const q = () => { const n = Number(qty.replace(",", ".")); return Number.isFinite(n) ? n : 0; };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.55)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", background: "#FFFFFF", borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{isEdit ? "Article" : "Nouvel article"}</h2>
          <button type="button" onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {isEdit && article && (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 13, color: "#6B7280" }}>Stock : <b style={{ fontSize: 18, color: "#111827" }}>{article.quantite_stock}</b> {UNIT_LABELS[f.unite]}</span>
            <button type="button" onClick={() => void addMovement(article.id, "sortie", q(), { source: "manuel" })} style={qtyBtn("#FEE2E2", "#B91C1C")}>−</button>
            <input value={qty} onChange={(e) => setQty(e.target.value)} style={{ width: 60, textAlign: "center", padding: "8px", border: "1.5px solid #E5E7EB", borderRadius: 8, fontWeight: 700 }} />
            <button type="button" onClick={() => void addMovement(article.id, "entree", q(), { source: "manuel" })} style={qtyBtn("#DCFCE7", "#15803D")}>+</button>
            <button type="button" onClick={() => void setStockByCount(article.id, q(), { source: "manuel", note: "Correction" })} style={{ border: "1.5px solid #E5E7EB", borderRadius: 8, padding: "8px 10px", fontSize: 12, cursor: "pointer", background: "#FFF" }}>Ajuster</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Nom" wide><input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} style={inp} placeholder="Disjoncteur 16 A courbe C" /></Field>
          <Field label="Catégorie"><select value={f.categorie} onChange={(e) => setF({ ...f, categorie: e.target.value as ArticleCategory })} style={inp}>{(Object.keys(CATEGORY_LABELS) as ArticleCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</select></Field>
          <Field label="Unité"><select value={f.unite} onChange={(e) => setF({ ...f, unite: e.target.value as ArticleUnit })} style={inp}>{(Object.keys(UNIT_LABELS) as ArticleUnit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}</select></Field>
          <Field label="Seuil d'alerte"><input value={f.seuil} onChange={(e) => setF({ ...f, seuil: e.target.value })} style={inp} placeholder="—" /></Field>
          <Field label="Emplacement"><select value={f.emplacement} onChange={(e) => setF({ ...f, emplacement: e.target.value as Emplacement | "" })} style={inp}><option value="">—</option>{(Object.keys(EMPLACEMENT_LABELS) as Emplacement[]).map((e) => <option key={e} value={e}>{EMPLACEMENT_LABELS[e]}</option>)}</select></Field>
          <Field label="Code-barres"><input value={f.code_barres} onChange={(e) => setF({ ...f, code_barres: e.target.value })} style={inp} /></Field>
          <Field label="Référence"><input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} style={inp} /></Field>
          <Field label="Fournisseur"><input value={f.fournisseur} onChange={(e) => setF({ ...f, fournisseur: e.target.value })} style={inp} /></Field>
          <Field label="Prix HT (€)"><input value={f.prix} onChange={(e) => setF({ ...f, prix: e.target.value })} style={inp} placeholder="—" /></Field>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
          <button type="button" onClick={() => void save()} style={{ flex: 1, ...btn(ACCENT, "#FFF"), padding: 12, fontSize: 15 }}>{isEdit ? "Enregistrer" : "Créer"}</button>
          {isEdit && article && (
            <>
              <button type="button" onClick={() => void archiveArticle(article.id, !article.archived)} style={btn("#FFF", "#4B5563", true)}>{article.archived ? "Désarchiver" : "Archiver"}</button>
              <button type="button" onClick={() => { if (window.confirm("Supprimer cet article et son historique ?")) { void removeArticle(article.id); onClose(); } }} style={{ ...btn("#FFF", "#B91C1C", true), borderColor: "#FECACA" }}>Supprimer</button>
            </>
          )}
        </div>

        {isEdit && movements.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>Mouvements</div>
            {movements.slice(0, 40).map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                <span style={{ fontWeight: 600, color: m.type === "sortie" ? "#B91C1C" : m.type === "entree" ? "#15803D" : "#6B7280" }}>{m.type === "entree" ? "Entrée" : m.type === "sortie" ? "Sortie" : "Ajustement"} {m.type === "ajustement" && m.quantite > 0 ? "+" : ""}{m.quantite}</span>
                <span style={{ color: "#9CA3AF" }}>{new Date(m.date).toLocaleString("fr-FR")}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "9px 11px", fontSize: 13.5, border: "1.5px solid #E5E7EB", borderRadius: 9, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#FFF" };

function btn(bg: string, color: string, outline = false): React.CSSProperties {
  return { background: bg, color, border: outline ? "1.5px solid #E5E7EB" : "none", borderRadius: 9, padding: "9px 14px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" };
}
function qtyBtn(bg: string, color: string): React.CSSProperties {
  return { width: 36, height: 36, fontSize: 22, fontWeight: 800, border: "none", borderRadius: 9, background: bg, color, cursor: "pointer", lineHeight: 1 };
}
function Tab({ label, active, onClick, danger }: { label: string; active: boolean; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} style={{ padding: "8px 14px", fontSize: 13.5, fontWeight: 700, border: "none", borderRadius: 9, cursor: "pointer", background: active ? (danger ? "#B91C1C" : "#111827") : "#FFFFFF", color: active ? "#FFFFFF" : danger ? "#B91C1C" : "#6B7280", boxShadow: active ? "none" : "inset 0 0 0 1px #E5E7EB" }}>{label}</button>;
}
