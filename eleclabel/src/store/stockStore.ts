// Store stock matériel — local-first avec sync Supabase en arrière-plan.
// Lectures depuis IndexedDB (instantané, offline-friendly).
// Mutations : écriture locale immédiate + enqueue vers Supabase (offline OK).
// Cohérence : quantite_stock est TOUJOURS recalculé = somme des mouvements.
import { create } from "zustand";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { Article, StockMovement, MovementType, MovementSource } from "../types/stock";
import { computeStock, isLowStock } from "../types/stock";
import {
  fetchAllStockArticles,
  fetchAllStockMovements,
  getCurrentUserId,
} from "../services/cloudSync";
import { enqueue } from "../services/syncQueue";

const ARTICLES_KEY = "eleclabel-stock-articles";
const MOVEMENTS_KEY = "eleclabel-stock-movements";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Recalcule quantite_stock de chaque article = somme de ses mouvements (source de vérité).
function recompute(articles: Article[], movements: StockMovement[]): Article[] {
  const byArticle = new Map<string, StockMovement[]>();
  for (const m of movements) {
    const arr = byArticle.get(m.article_id);
    if (arr) arr.push(m);
    else byArticle.set(m.article_id, [m]);
  }
  return articles.map((a) => ({ ...a, quantite_stock: computeStock(byArticle.get(a.id) ?? []) }));
}

interface StockStore {
  articles: Article[];
  movements: StockMovement[];
  loading: boolean;

  load: () => Promise<void>;
  refreshFromCloud: () => Promise<void>;
  addArticle: (input: Omit<Article, "id" | "createdAt" | "updatedAt" | "quantite_stock">) => Promise<string>;
  updateArticle: (id: string, patch: Partial<Article>) => Promise<void>;
  archiveArticle: (id: string, archived: boolean) => Promise<void>;
  removeArticle: (id: string) => Promise<void>;
  /** Enregistre un mouvement. Pour "ajustement", quantite est un delta signé. */
  addMovement: (
    articleId: string,
    type: MovementType,
    quantite: number,
    opts?: { note?: string; source?: MovementSource },
  ) => Promise<void>;
  /** Correction d'inventaire : pose le stock à la valeur recomptée (delta via ajustement). */
  setStockByCount: (articleId: string, counted: number, opts?: { note?: string; source?: MovementSource }) => Promise<void>;

  // Sélecteurs
  movementsForArticle: (articleId: string) => StockMovement[];
  lowStockArticles: () => Article[];
  findByBarcode: (code: string) => Article | undefined;

  clearLocal: () => Promise<void>;
}

async function loadCache<T>(key: string): Promise<T[]> {
  try {
    const raw = await idbGet(key);
    return Array.isArray(raw) ? (raw as T[]) : [];
  } catch {
    return [];
  }
}

async function saveCache<T>(key: string, value: T[]): Promise<void> {
  try {
    await idbSet(key, value);
  } catch (err) {
    console.error(`[stockStore] cache write failed (${key}):`, err);
  }
}

export const useStockStore = create<StockStore>((set, get) => ({
  articles: [],
  movements: [],
  loading: true,

  load: async () => {
    set({ loading: true });
    const userId = await getCurrentUserId();
    if (userId) {
      try {
        const [articles, movements] = await Promise.all([
          fetchAllStockArticles(userId),
          fetchAllStockMovements(userId),
        ]);
        const recomputed = recompute(articles, movements);
        set({ articles: recomputed, movements, loading: false });
        await Promise.all([saveCache(ARTICLES_KEY, recomputed), saveCache(MOVEMENTS_KEY, movements)]);
        return;
      } catch (err) {
        console.warn("[stockStore] cloud fetch failed, using cache:", err);
      }
    }
    const [articles, movements] = await Promise.all([
      loadCache<Article>(ARTICLES_KEY),
      loadCache<StockMovement>(MOVEMENTS_KEY),
    ]);
    set({ articles: recompute(articles, movements), movements, loading: false });
  },

  refreshFromCloud: async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    try {
      const [articles, movements] = await Promise.all([
        fetchAllStockArticles(userId),
        fetchAllStockMovements(userId),
      ]);
      const recomputed = recompute(articles, movements);
      set({ articles: recomputed, movements });
      await Promise.all([saveCache(ARTICLES_KEY, recomputed), saveCache(MOVEMENTS_KEY, movements)]);
    } catch (err) {
      console.warn("[stockStore] refresh failed:", err);
    }
  },

  addArticle: async (input) => {
    const id = newId();
    const now = Date.now();
    const article: Article = { ...input, id, quantite_stock: 0, createdAt: now, updatedAt: now };
    const next = [...get().articles, article].sort((a, b) => a.nom.localeCompare(b.nom));
    set({ articles: next });
    await saveCache(ARTICLES_KEY, next);

    const userId = await getCurrentUserId();
    if (userId) await enqueue({ kind: "stock-article-upsert", userId, recordId: id, record: article });
    return id;
  },

  updateArticle: async (id, patch) => {
    let updated: Article | undefined;
    const next = get().articles.map((a) => {
      if (a.id !== id) return a;
      updated = { ...a, ...patch, id: a.id, updatedAt: Date.now() };
      return updated;
    });
    set({ articles: next });
    await saveCache(ARTICLES_KEY, next);

    const userId = await getCurrentUserId();
    if (userId && updated) await enqueue({ kind: "stock-article-upsert", userId, recordId: id, record: updated });
  },

  archiveArticle: async (id, archived) => {
    await get().updateArticle(id, { archived });
  },

  removeArticle: async (id) => {
    const articles = get().articles.filter((a) => a.id !== id);
    const movements = get().movements.filter((m) => m.article_id !== id);
    set({ articles, movements });
    await Promise.all([saveCache(ARTICLES_KEY, articles), saveCache(MOVEMENTS_KEY, movements)]);

    const userId = await getCurrentUserId();
    if (userId) await enqueue({ kind: "stock-article-delete", userId, recordId: id });
  },

  addMovement: async (articleId, type, quantite, opts) => {
    const movement: StockMovement = {
      id: newId(),
      article_id: articleId,
      type,
      quantite,
      date: Date.now(),
      note: opts?.note,
      source: opts?.source ?? "manuel",
    };
    const movements = [...get().movements, movement];
    // Recalcule le stock de l'article concerné depuis l'ensemble de ses mouvements.
    const articleMovements = movements.filter((m) => m.article_id === articleId);
    const newStock = computeStock(articleMovements);
    let updatedArticle: Article | undefined;
    const articles = get().articles.map((a) => {
      if (a.id !== articleId) return a;
      updatedArticle = { ...a, quantite_stock: newStock, updatedAt: Date.now() };
      return updatedArticle;
    });
    set({ movements, articles });
    await Promise.all([saveCache(MOVEMENTS_KEY, movements), saveCache(ARTICLES_KEY, articles)]);

    const userId = await getCurrentUserId();
    if (userId) {
      await enqueue({ kind: "stock-movement-insert", userId, recordId: movement.id, record: movement });
      // Synchronise aussi le cache quantite_stock côté serveur.
      if (updatedArticle) await enqueue({ kind: "stock-article-upsert", userId, recordId: articleId, record: updatedArticle });
    }
  },

  setStockByCount: async (articleId, counted, opts) => {
    const article = get().articles.find((a) => a.id === articleId);
    if (!article) return;
    const delta = counted - article.quantite_stock;
    if (delta === 0) return;
    await get().addMovement(articleId, "ajustement", delta, opts);
  },

  movementsForArticle: (articleId) =>
    get().movements.filter((m) => m.article_id === articleId).sort((a, b) => b.date - a.date),

  lowStockArticles: () => get().articles.filter(isLowStock),

  findByBarcode: (code) => {
    const c = code.trim();
    if (!c) return undefined;
    return get().articles.find((a) => a.code_barres?.trim() === c);
  },

  clearLocal: async () => {
    set({ articles: [], movements: [] });
    await Promise.all([idbDel(ARTICLES_KEY), idbDel(MOVEMENTS_KEY)]);
  },
}));
