// Page Stock mobile (usage camion) : inventaire, recherche, +/− rapides,
// écran « à racheter », création par scan de code-barres.
import { useEffect, useMemo, useState } from "react";
import { useStockStore } from "../store/stockStore";
import { isNative } from "../services/native";
import { decodeBarcode } from "../services/barcode";
import { generateReorderPdfBlob, defaultReorderFilename } from "../services/pdfReorder";
import { savePdfAndShare } from "../services/pdfMobile";
import {
  type Article,
  type ArticleCategory,
  CATEGORY_LABELS,
  UNIT_LABELS,
  isLowStock,
} from "../types/stock";
import MobileHeader from "../components/MobileHeader";
import BottomNav from "../components/BottomNav";
import DocumentScanner from "../components/DocumentScanner";
import StockArticleSheet from "../components/StockArticleSheet";

const ACCENT = "#E63946";

export default function Stock() {
  const { articles, loading, load, addMovement } = useStockStore();
  const lowStock = useStockStore((s) => s.lowStockArticles);
  const findByBarcode = useStockStore((s) => s.findByBarcode);

  const [view, setView] = useState<"all" | "reappro">("all");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<ArticleCategory | "all">("all");
  const [scanning, setScanning] = useState(false);
  const [sheet, setSheet] = useState<{ article: Article | null; barcode?: string | null } | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  const lowCount = useMemo(() => lowStock().length, [lowStock, articles]);

  const list = useMemo(() => {
    const base = view === "reappro" ? lowStock() : articles.filter((a) => !a.archived);
    const q = query.trim().toLowerCase();
    return base
      .filter((a) => (cat === "all" ? true : a.categorie === cat))
      .filter((a) =>
        !q
          ? true
          : a.nom.toLowerCase().includes(q) ||
            a.reference?.toLowerCase().includes(q) ||
            a.code_barres?.toLowerCase().includes(q),
      )
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [view, articles, lowStock, query, cat]);

  const onScanCapture = async (base64: string, mime: string) => {
    setScanning(false);
    const code = await decodeBarcode(base64, mime);
    if (code) {
      const existing = findByBarcode(code);
      if (existing) setSheet({ article: existing });
      else setSheet({ article: null, barcode: code });
    } else {
      // Aucun code lisible → création manuelle (repli)
      setSheet({ article: null });
    }
  };

  const startAdd = () => {
    if (isNative()) setScanning(true);
    else setSheet({ article: null });
  };

  const exportReappro = async () => {
    const blob = await generateReorderPdfBlob(lowStock(), { mode: "reappro" });
    await savePdfAndShare(blob, defaultReorderFilename("reappro"));
  };

  if (scanning) {
    return <DocumentScanner onCapture={(b, m) => void onScanCapture(b, m)} onCancel={() => setScanning(false)} />;
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", paddingBottom: "calc(60px + var(--safe-bottom) + 80px)" }}>
      <MobileHeader title="Stock" subtitle={`${articles.filter((a) => !a.archived).length} articles`} />

      {/* Onglets Inventaire / À racheter */}
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 0" }}>
        <Tab label="Inventaire" active={view === "all"} onClick={() => setView("all")} />
        <Tab label={`À racheter${lowCount ? ` (${lowCount})` : ""}`} active={view === "reappro"} onClick={() => setView("reappro")} danger={lowCount > 0} />
      </div>

      {view === "reappro" && lowCount > 0 && (
        <div style={{ padding: "12px 16px 0" }}>
          <button type="button" onClick={() => void exportReappro()} style={{ width: "100%", padding: 12, fontSize: 14, fontWeight: 700, border: "none", borderRadius: 12, background: "#111827", color: "#FFFFFF", cursor: "pointer" }}>
            Exporter la liste de réappro (PDF)
          </button>
        </div>
      )}

      {/* Recherche */}
      <div style={{ padding: "12px 16px 6px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (nom, réf, code-barres)…"
          style={{ width: "100%", padding: "11px 13px", fontSize: 15, border: "1.5px solid #E5E7EB", borderRadius: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
        />
      </div>

      {/* Filtre catégorie */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "4px 16px 10px" }}>
        <Chip label="Toutes" active={cat === "all"} onClick={() => setCat("all")} />
        {(Object.keys(CATEGORY_LABELS) as ArticleCategory[]).map((c) => (
          <Chip key={c} label={CATEGORY_LABELS[c]} active={cat === c} onClick={() => setCat(c)} />
        ))}
      </div>

      {/* Liste */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {loading && articles.length === 0 ? (
          <Empty text="Chargement…" />
        ) : list.length === 0 ? (
          <Empty text={view === "reappro" ? "Rien à racheter 👍" : query || cat !== "all" ? "Aucun article ne correspond." : "Aucun article. Touche + pour en ajouter."} />
        ) : (
          list.map((a) => (
            <ArticleCard
              key={a.id}
              article={a}
              onOpen={() => setSheet({ article: a })}
              onMinus={() => void addMovement(a.id, "sortie", 1, { source: "manuel" })}
              onPlus={() => void addMovement(a.id, "entree", 1, { source: "manuel" })}
            />
          ))
        )}
      </div>

      {/* FAB ajouter */}
      <button
        type="button"
        onClick={startAdd}
        aria-label="Ajouter un article"
        style={{ position: "fixed", right: 18, bottom: "calc(72px + var(--safe-bottom))", zIndex: 40, width: 58, height: 58, borderRadius: "50%", border: "none", background: ACCENT, color: "#FFFFFF", fontSize: 30, lineHeight: 1, cursor: "pointer", boxShadow: "0 8px 22px rgba(230,57,70,0.4)" }}
      >
        +
      </button>

      {sheet && <StockArticleSheet article={sheet.article} prefillBarcode={sheet.barcode} onClose={() => setSheet(null)} />}

      <BottomNav />
    </div>
  );
}

function ArticleCard({ article, onOpen, onMinus, onPlus }: { article: Article; onOpen: () => void; onMinus: () => void; onPlus: () => void }) {
  const low = isLowStock(article);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFFFFF", border: `1px solid ${low ? "#FECACA" : "#E5E7EB"}`, borderRadius: 14, padding: 12 }}>
      <button type="button" onClick={onOpen} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.nom}</span>
          {low && <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: "#B91C1C", background: "#FEE2E2", borderRadius: 999, padding: "2px 7px" }}>STOCK BAS</span>}
        </div>
        <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
          {CATEGORY_LABELS[article.categorie]}
          {article.emplacement ? ` · ${article.emplacement === "camion" ? "Camion" : "Dépôt"}` : ""}
          {article.seuil_alerte != null ? ` · seuil ${article.seuil_alerte}` : ""}
        </div>
      </button>
      <button type="button" onClick={onMinus} style={qtyBtn("#FEE2E2", "#B91C1C")}>−</button>
      <div style={{ minWidth: 46, textAlign: "center" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: low ? "#B91C1C" : "#111827", lineHeight: 1 }}>{article.quantite_stock}</div>
        <div style={{ fontSize: 10, color: "#9CA3AF" }}>{UNIT_LABELS[article.unite]}</div>
      </div>
      <button type="button" onClick={onPlus} style={qtyBtn("#DCFCE7", "#15803D")}>+</button>
    </div>
  );
}

function qtyBtn(bg: string, color: string): React.CSSProperties {
  return { width: 44, height: 44, flexShrink: 0, fontSize: 24, fontWeight: 800, border: "none", borderRadius: 11, background: bg, color, cursor: "pointer", lineHeight: 1 };
}

function Tab({ label, active, onClick, danger }: { label: string; active: boolean; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} style={{ flex: 1, padding: "9px", fontSize: 13.5, fontWeight: 700, border: "none", borderRadius: 10, cursor: "pointer", background: active ? (danger ? "#B91C1C" : "#111827") : "#FFFFFF", color: active ? "#FFFFFF" : danger ? "#B91C1C" : "#6B7280", borderBottom: active ? "none" : "1px solid #E5E7EB" }}>
      {label}
    </button>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ flexShrink: 0, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, borderRadius: 999, border: `1.5px solid ${active ? "#111827" : "#E5E7EB"}`, background: active ? "#111827" : "#FFFFFF", color: active ? "#FFFFFF" : "#4B5563", cursor: "pointer", whiteSpace: "nowrap" }}>
      {label}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: "center", color: "#9CA3AF", fontSize: 14, padding: "48px 16px" }}>{text}</div>;
}
