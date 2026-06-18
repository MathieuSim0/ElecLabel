// Abonnements Realtime Supabase : reçoit les changements distants en live.
// Quand un autre device modifie une facture/un tableau, le store local est mis à jour
// instantanément (pas besoin de rafraîchir manuellement).
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { useInvoiceStore } from "../store/invoiceStore";
import { useHistoryStore, type HistoryEntry, type HistorySource } from "../store/historyStore";
import { useStockStore } from "../store/stockStore";
import type { Invoice } from "../types/invoice";
import type { Panel } from "../types/panel";
import {
  computeStock,
  type Article,
  type ArticleCategory,
  type ArticleUnit,
  type Emplacement,
  type StockMovement,
  type MovementType,
  type MovementSource,
} from "../types/stock";

let invoicesChannel: RealtimeChannel | null = null;
let panelsChannel: RealtimeChannel | null = null;
let stockArticlesChannel: RealtimeChannel | null = null;
let stockMovementsChannel: RealtimeChannel | null = null;

// ── Type narrowing pour les payloads Supabase ──

interface InvoiceRow {
  id: string;
  user_id: string;
  supplier: string | null;
  invoice_date: string | null;
  reference: string | null;
  amount_cents: number | null;
  notes: string | null;
  ocr_raw_text: string | null;
  reviewed: boolean;
  thumbnail: string | null;
  image_storage_path: string | null;
  image_mime_type: string;
  created_at: string;
  updated_at: string;
}

interface PanelRow {
  id: string;
  user_id: string;
  name: string;
  source: string;
  panel_data: Panel;
  thumbnail: string | null;
  breaker_count: number;
  row_count: number;
  created_at: string;
  updated_at: string;
}

function rowToInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    createdAt: new Date(row.created_at).getTime(),
    imageBase64: "",
    imageMimeType: row.image_mime_type,
    thumbnail: row.thumbnail ?? undefined,
    invoiceDate: row.invoice_date ?? undefined,
    supplier: row.supplier ?? undefined,
    reference: row.reference ?? undefined,
    amountCents: row.amount_cents ?? undefined,
    notes: row.notes ?? undefined,
    ocrRawText: row.ocr_raw_text ?? undefined,
    reviewed: row.reviewed,
  };
}

function rowToHistoryEntry(row: PanelRow): HistoryEntry {
  return {
    id: row.id,
    name: row.name,
    timestamp: new Date(row.created_at).getTime(),
    // panel_data peut manquer si le payload realtime est tronqué (gros JSON image) → fallback sûr
    panel: panelHasRows(row.panel_data) ? row.panel_data : { rows: [] },
    thumbnail: row.thumbnail ?? undefined,
    source: row.source as HistorySource,
    breakerCount: row.breaker_count,
    rowCount: row.row_count,
  };
}

// Vrai seulement si l'objet panel reçu contient bien des rangées exploitables
function panelHasRows(panel: unknown): panel is Panel {
  return Boolean(panel && typeof panel === "object" && Array.isArray((panel as Panel).rows));
}

// ── Handlers ──
// Applique le changement reçu sur le store local. Idempotent : si l'event est notre
// propre modif qui revient, l'effet est nul (on a déjà la même donnée).

function handleInvoiceChange(payload: RealtimePostgresChangesPayload<InvoiceRow>): void {
  if (payload.eventType === "INSERT") {
    const inv = rowToInvoice(payload.new);
    useInvoiceStore.setState((state) => {
      if (state.invoices.some((i) => i.id === inv.id)) return state;
      return { invoices: [inv, ...state.invoices] };
    });
  } else if (payload.eventType === "UPDATE") {
    const updated = rowToInvoice(payload.new);
    useInvoiceStore.setState((state) => ({
      invoices: state.invoices.map((i) =>
        // On préserve imageBase64 local si déjà chargée (la photo HD n'est pas dans le payload)
        i.id === updated.id ? { ...updated, imageBase64: i.imageBase64 } : i,
      ),
    }));
  } else if (payload.eventType === "DELETE") {
    const deletedId = (payload.old as InvoiceRow | undefined)?.id;
    if (!deletedId) return;
    useInvoiceStore.setState((state) => ({
      invoices: state.invoices.filter((i) => i.id !== deletedId),
    }));
  }
}

function handlePanelChange(payload: RealtimePostgresChangesPayload<PanelRow>): void {
  if (payload.eventType === "INSERT") {
    const entry = rowToHistoryEntry(payload.new);
    useHistoryStore.setState((state) => {
      if (state.entries.some((e) => e.id === entry.id)) return state;
      return { entries: [entry, ...state.entries] };
    });
  } else if (payload.eventType === "UPDATE") {
    const updated = rowToHistoryEntry(payload.new);
    const incomingHasPanel = panelHasRows(payload.new.panel_data);
    useHistoryStore.setState((state) => ({
      entries: state.entries.map((e) => {
        if (e.id !== updated.id) return e;
        // Si le payload realtime n'a pas de panel exploitable (tronqué), on garde
        // le panel local existant au lieu de l'écraser avec du vide.
        // Idem pour la vignette : un payload tronqué la renvoie null → on conserve
        // la vignette locale au lieu de la perdre.
        return {
          ...updated,
          panel: incomingHasPanel ? updated.panel : e.panel,
          thumbnail: updated.thumbnail ?? e.thumbnail,
        };
      }),
    }));
  } else if (payload.eventType === "DELETE") {
    const deletedId = (payload.old as PanelRow | undefined)?.id;
    if (!deletedId) return;
    useHistoryStore.setState((state) => ({
      entries: state.entries.filter((e) => e.id !== deletedId),
    }));
  }
}

// ── Stock : articles + mouvements ──

interface StockArticleRow {
  id: string;
  user_id: string;
  nom: string;
  categorie: string;
  reference: string | null;
  code_barres: string | null;
  unite: string;
  quantite_stock: number;
  seuil_alerte: number | null;
  emplacement: string | null;
  prix_unitaire_ht: number | null;
  fournisseur: string | null;
  photo: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface StockMovementRow {
  id: string;
  user_id: string;
  article_id: string;
  type: string;
  quantite: number;
  moved_at: string;
  note: string | null;
  source: string;
  created_at: string;
}

function rowToArticle(row: StockArticleRow): Article {
  return {
    id: row.id,
    nom: row.nom,
    categorie: row.categorie as ArticleCategory,
    reference: row.reference ?? undefined,
    code_barres: row.code_barres ?? undefined,
    unite: row.unite as ArticleUnit,
    quantite_stock: Number(row.quantite_stock),
    seuil_alerte: row.seuil_alerte ?? undefined,
    emplacement: (row.emplacement as Emplacement | null) ?? undefined,
    prix_unitaire_ht: row.prix_unitaire_ht ?? undefined,
    fournisseur: row.fournisseur ?? undefined,
    photo: row.photo ?? undefined,
    archived: row.archived,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function rowToMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    article_id: row.article_id,
    type: row.type as MovementType,
    quantite: Number(row.quantite),
    date: new Date(row.moved_at).getTime(),
    note: row.note ?? undefined,
    source: row.source as MovementSource,
  };
}

// Recalcule quantite_stock d'un article depuis ses mouvements (source de vérité).
function recomputeOne(articleId: string, articles: Article[], movements: StockMovement[]): Article[] {
  const stock = computeStock(movements.filter((m) => m.article_id === articleId));
  return articles.map((a) => (a.id === articleId ? { ...a, quantite_stock: stock } : a));
}

function handleStockArticleChange(payload: RealtimePostgresChangesPayload<StockArticleRow>): void {
  if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
    const incoming = rowToArticle(payload.new);
    useStockStore.setState((state) => {
      const exists = state.articles.some((a) => a.id === incoming.id);
      // On préserve quantite_stock recalculé depuis les mouvements locaux.
      const localStock = computeStock(state.movements.filter((m) => m.article_id === incoming.id));
      const merged = { ...incoming, quantite_stock: localStock };
      const articles = exists
        ? state.articles.map((a) => (a.id === incoming.id ? merged : a))
        : [...state.articles, merged].sort((a, b) => a.nom.localeCompare(b.nom));
      return { articles };
    });
  } else if (payload.eventType === "DELETE") {
    const deletedId = (payload.old as StockArticleRow | undefined)?.id;
    if (!deletedId) return;
    useStockStore.setState((state) => ({
      articles: state.articles.filter((a) => a.id !== deletedId),
      movements: state.movements.filter((m) => m.article_id !== deletedId),
    }));
  }
}

function handleStockMovementChange(payload: RealtimePostgresChangesPayload<StockMovementRow>): void {
  if (payload.eventType === "INSERT") {
    const m = rowToMovement(payload.new);
    useStockStore.setState((state) => {
      if (state.movements.some((x) => x.id === m.id)) return state;
      const movements = [...state.movements, m];
      return { movements, articles: recomputeOne(m.article_id, state.articles, movements) };
    });
  } else if (payload.eventType === "DELETE") {
    const old = payload.old as StockMovementRow | undefined;
    if (!old?.id) return;
    useStockStore.setState((state) => {
      const movements = state.movements.filter((x) => x.id !== old.id);
      return { movements, articles: recomputeOne(old.article_id, state.articles, movements) };
    });
  }
}

// ── API publique ──

export function subscribeRealtime(userId: string): void {
  unsubscribeRealtime();

  invoicesChannel = supabase
    .channel(`invoices:${userId}`)
    .on<InvoiceRow>(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "invoices",
        filter: `user_id=eq.${userId}`,
      },
      handleInvoiceChange,
    )
    .subscribe();

  panelsChannel = supabase
    .channel(`panels:${userId}`)
    .on<PanelRow>(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "panels",
        filter: `user_id=eq.${userId}`,
      },
      handlePanelChange,
    )
    .subscribe();

  stockArticlesChannel = supabase
    .channel(`stock_articles:${userId}`)
    .on<StockArticleRow>(
      "postgres_changes",
      { event: "*", schema: "public", table: "stock_articles", filter: `user_id=eq.${userId}` },
      handleStockArticleChange,
    )
    .subscribe();

  stockMovementsChannel = supabase
    .channel(`stock_movements:${userId}`)
    .on<StockMovementRow>(
      "postgres_changes",
      { event: "*", schema: "public", table: "stock_movements", filter: `user_id=eq.${userId}` },
      handleStockMovementChange,
    )
    .subscribe();
}

export function unsubscribeRealtime(): void {
  if (invoicesChannel) {
    supabase.removeChannel(invoicesChannel);
    invoicesChannel = null;
  }
  if (panelsChannel) {
    supabase.removeChannel(panelsChannel);
    panelsChannel = null;
  }
  if (stockArticlesChannel) {
    supabase.removeChannel(stockArticlesChannel);
    stockArticlesChannel = null;
  }
  if (stockMovementsChannel) {
    supabase.removeChannel(stockMovementsChannel);
    stockMovementsChannel = null;
  }
}
