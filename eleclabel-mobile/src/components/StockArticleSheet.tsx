// Bottom sheet de création / édition d'un article + mouvements rapides.
// Pensé pour le camion : gros boutons +/−, saisie minimale.
import { useMemo, useState } from "react";
import { useStockStore } from "../store/stockStore";
import {
  type Article,
  type ArticleCategory,
  type ArticleUnit,
  type Emplacement,
  CATEGORY_LABELS,
  UNIT_LABELS,
  EMPLACEMENT_LABELS,
} from "../types/stock";

const ACCENT = "#E63946";

interface Props {
  article: Article | null; // null = création
  prefillBarcode?: string | null;
  onClose: () => void;
}

const field: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  fontSize: 15,
  border: "1.5px solid #E5E7EB",
  borderRadius: 10,
  background: "#FFFFFF",
  color: "#111827",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 4 };

export default function StockArticleSheet({ article, prefillBarcode, onClose }: Props) {
  const { addArticle, updateArticle, archiveArticle, removeArticle, addMovement, setStockByCount, movementsForArticle } =
    useStockStore();

  const isEdit = article != null;
  const [nom, setNom] = useState(article?.nom ?? "");
  const [categorie, setCategorie] = useState<ArticleCategory>(article?.categorie ?? "autre");
  const [unite, setUnite] = useState<ArticleUnit>(article?.unite ?? "piece");
  const [codeBarres, setCodeBarres] = useState(article?.code_barres ?? prefillBarcode ?? "");
  const [reference, setReference] = useState(article?.reference ?? "");
  const [emplacement, setEmplacement] = useState<Emplacement | "">(article?.emplacement ?? "");
  const [seuil, setSeuil] = useState(article?.seuil_alerte != null ? String(article.seuil_alerte) : "");
  const [fournisseur, setFournisseur] = useState(article?.fournisseur ?? "");
  const [prix, setPrix] = useState(article?.prix_unitaire_ht != null ? String(article.prix_unitaire_ht) : "");
  const [qty, setQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const movements = useMemo(
    () => (article ? movementsForArticle(article.id) : []),
    [article, movementsForArticle],
  );
  const stock = article?.quantite_stock ?? 0;

  const parsedQty = () => {
    const n = Number(qty.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const buildPayload = () => ({
    nom: nom.trim() || "Article",
    categorie,
    unite,
    code_barres: codeBarres.trim() || null,
    reference: reference.trim() || null,
    emplacement: emplacement || null,
    seuil_alerte: seuil.trim() ? Number(seuil.replace(",", ".")) : null,
    fournisseur: fournisseur.trim() || null,
    prix_unitaire_ht: prix.trim() ? Number(prix.replace(",", ".")) : null,
  });

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isEdit && article) await updateArticle(article.id, buildPayload());
      else await addArticle(buildPayload());
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const doMovement = async (type: "entree" | "sortie") => {
    if (!article) return;
    const q = parsedQty();
    if (q <= 0) return;
    await addMovement(article.id, type, q, { source: "manuel" });
  };

  const doAdjust = async () => {
    if (!article) return;
    const n = Number(qty.replace(",", "."));
    if (!Number.isFinite(n)) return;
    await setStockByCount(article.id, n, { source: "manuel", note: "Correction d'inventaire" });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,0.45)" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#F8FAFC",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: "calc(var(--safe-bottom) + 16px)",
        }}
      >
        <div style={{ position: "sticky", top: 0, background: "#FFFFFF", borderBottom: "1px solid #E5E7EB", padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, zIndex: 1 }}>
          <div style={{ flex: 1, fontWeight: 700, fontSize: 16, color: "#111827" }}>
            {isEdit ? "Article" : "Nouvel article"}
          </div>
          <button type="button" onClick={onClose} style={{ background: "#F3F4F6", border: "none", borderRadius: 8, width: 34, height: 34, fontSize: 17, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Mouvements rapides (édition uniquement) */}
          {isEdit && (
            <div style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#6B7280" }}>Stock actuel</span>
                <span style={{ fontSize: 26, fontWeight: 800, color: "#111827" }}>
                  {stock} <span style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF" }}>{UNIT_LABELS[unite]}</span>
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" onClick={() => void doMovement("sortie")} style={{ flex: 1, height: 56, fontSize: 26, fontWeight: 800, border: "none", borderRadius: 12, background: "#FEE2E2", color: "#B91C1C", cursor: "pointer" }}>−</button>
                <input
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  style={{ ...field, width: 72, textAlign: "center", fontSize: 18, fontWeight: 700 }}
                />
                <button type="button" onClick={() => void doMovement("entree")} style={{ flex: 1, height: 56, fontSize: 26, fontWeight: 800, border: "none", borderRadius: 12, background: "#DCFCE7", color: "#15803D", cursor: "pointer" }}>+</button>
              </div>
              <button type="button" onClick={() => void doAdjust()} style={{ marginTop: 8, width: "100%", padding: "9px", fontSize: 13, fontWeight: 600, border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFFFFF", color: "#4B5563", cursor: "pointer" }}>
                Ajuster : poser le stock à {qty || "?"} (correction d'inventaire)
              </button>
            </div>
          )}

          {/* Champs */}
          <div><div style={lbl}>Nom</div><input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. Disjoncteur 16 A courbe C" style={field} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={lbl}>Catégorie</div>
              <select value={categorie} onChange={(e) => setCategorie(e.target.value as ArticleCategory)} style={field}>
                {(Object.keys(CATEGORY_LABELS) as ArticleCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div style={lbl}>Unité</div>
              <select value={unite} onChange={(e) => setUnite(e.target.value as ArticleUnit)} style={field}>
                {(Object.keys(UNIT_LABELS) as ArticleUnit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={lbl}>Seuil d'alerte</div>
              <input inputMode="decimal" value={seuil} onChange={(e) => setSeuil(e.target.value)} placeholder="—" style={field} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={lbl}>Emplacement</div>
              <select value={emplacement} onChange={(e) => setEmplacement(e.target.value as Emplacement | "")} style={field}>
                <option value="">—</option>
                {(Object.keys(EMPLACEMENT_LABELS) as Emplacement[]).map((e) => <option key={e} value={e}>{EMPLACEMENT_LABELS[e]}</option>)}
              </select>
            </div>
          </div>
          <div><div style={lbl}>Code-barres</div><input value={codeBarres} onChange={(e) => setCodeBarres(e.target.value)} placeholder="EAN / QR" style={field} /></div>
          <div><div style={lbl}>Référence</div><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="réf. fabricant / interne" style={field} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><div style={lbl}>Fournisseur</div><input value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} style={field} /></div>
            <div style={{ flex: 1 }}><div style={lbl}>Prix HT (€)</div><input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="—" style={field} /></div>
          </div>

          <button type="button" onClick={() => void save()} disabled={busy} style={{ width: "100%", padding: 14, fontSize: 16, fontWeight: 700, border: "none", borderRadius: 12, background: ACCENT, color: "#FFFFFF", cursor: "pointer", marginTop: 4 }}>
            {isEdit ? "Enregistrer" : "Créer l'article"}
          </button>

          {/* Historique + actions (édition) */}
          {isEdit && article && (
            <>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => void archiveArticle(article.id, !article.archived)} style={{ flex: 1, padding: 11, fontSize: 13, fontWeight: 600, border: "1.5px solid #E5E7EB", borderRadius: 10, background: "#FFFFFF", color: "#4B5563", cursor: "pointer" }}>
                  {article.archived ? "Désarchiver" : "Archiver"}
                </button>
                <button type="button" onClick={() => { if (window.confirm("Supprimer cet article et son historique ?")) { void removeArticle(article.id); onClose(); } }} style={{ flex: 1, padding: 11, fontSize: 13, fontWeight: 600, border: "1.5px solid #FECACA", borderRadius: 10, background: "#FFFFFF", color: "#B91C1C", cursor: "pointer" }}>
                  Supprimer
                </button>
              </div>
              {movements.length > 0 && (
                <div style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 14, padding: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Mouvements</div>
                  {movements.slice(0, 30).map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F1F5F9", fontSize: 13 }}>
                      <span style={{ color: m.type === "sortie" ? "#B91C1C" : m.type === "entree" ? "#15803D" : "#6B7280", fontWeight: 600 }}>
                        {m.type === "entree" ? "Entrée" : m.type === "sortie" ? "Sortie" : "Ajustement"} {m.type === "ajustement" && m.quantite > 0 ? "+" : ""}{m.quantite}
                      </span>
                      <span style={{ color: "#9CA3AF" }}>{new Date(m.date).toLocaleDateString("fr-FR")}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
