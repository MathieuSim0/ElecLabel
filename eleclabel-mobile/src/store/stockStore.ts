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
  /** Charge un jeu d'exemples (local uniquement, non synchronisé) pour prévisualiser. */
  seedDemo: () => Promise<void>;
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

  seedDemo: async () => {
    const now = Date.now();
    const day = 86_400_000;
    type Seed = Omit<Article, "id" | "createdAt" | "updatedAt" | "quantite_stock"> & {
      mv: { type: "entree" | "sortie" | "ajustement"; q: number }[];
    };
    // Stock = somme des mouvements → on définit des mouvements cohérents.
    const seeds: Seed[] = [
      { nom: "Disjoncteur 16 A courbe C", categorie: "protection", unite: "piece", reference: "iC60N", fournisseur: "Schneider", seuil_alerte: 10, emplacement: "depot", code_barres: "3606480001016", mv: [{ type: "entree", q: 30 }, { type: "sortie", q: 6 }] },
      { nom: "Disjoncteur 20 A courbe C", categorie: "protection", unite: "piece", reference: "iC60N", fournisseur: "Schneider", seuil_alerte: 10, emplacement: "depot", mv: [{ type: "entree", q: 20 }, { type: "sortie", q: 14 }] },
      { nom: "Inter. différentiel 40 A 30 mA type A", categorie: "protection", unite: "piece", reference: "iID", fournisseur: "Schneider", seuil_alerte: 4, emplacement: "depot", mv: [{ type: "entree", q: 8 }, { type: "sortie", q: 5 }] },
      { nom: "Câble R2V 3G2.5", categorie: "cable", unite: "metre", fournisseur: "Nexans", seuil_alerte: 50, emplacement: "camion", mv: [{ type: "entree", q: 100 }, { type: "sortie", q: 20 }] },
      { nom: "Câble R2V 3G1.5", categorie: "cable", unite: "metre", fournisseur: "Nexans", seuil_alerte: 50, emplacement: "camion", mv: [{ type: "entree", q: 100 }, { type: "sortie", q: 75 }] },
      { nom: "Gaine ICTA Ø20", categorie: "conduit_goulotte", unite: "rouleau", seuil_alerte: 5, emplacement: "depot", mv: [{ type: "entree", q: 12 }] },
      { nom: "Boîte d'encastrement simple", categorie: "boite_coffret", unite: "boite", seuil_alerte: 20, emplacement: "depot", mv: [{ type: "entree", q: 50 }, { type: "sortie", q: 10 }] },
      { nom: "Prise 2P+T 16 A blanche", categorie: "appareillage", unite: "piece", fournisseur: "Legrand", seuil_alerte: 15, emplacement: "camion", mv: [{ type: "entree", q: 24 }, { type: "sortie", q: 6 }] },
      { nom: "Interrupteur va-et-vient", categorie: "appareillage", unite: "piece", fournisseur: "Legrand", seuil_alerte: 10, emplacement: "camion", mv: [{ type: "entree", q: 20 }, { type: "sortie", q: 11 }] },
      { nom: "Bornes Wago 5 entrées", categorie: "accessoire", unite: "sachet", seuil_alerte: 10, emplacement: "depot", mv: [{ type: "entree", q: 30 }] },
      { nom: "Ruban isolant noir", categorie: "consommable", unite: "piece", seuil_alerte: 5, emplacement: "camion", mv: [{ type: "entree", q: 10 }, { type: "sortie", q: 8 }] },
      { nom: "Coffret 13 modules 1 rangée", categorie: "boite_coffret", unite: "piece", fournisseur: "Hager", seuil_alerte: 2, emplacement: "depot", mv: [{ type: "entree", q: 4 }] },
    ];

    const articles: Article[] = [];
    const movements: StockMovement[] = [];
    seeds.forEach((s, i) => {
      const id = newId();
      const { mv, ...rest } = s;
      mv.forEach((m, j) => {
        movements.push({
          id: newId(),
          article_id: id,
          type: m.type,
          quantite: m.q,
          date: now - (seeds.length - i) * day - j * 3600_000,
          source: "manuel",
        });
      });
      articles.push({ ...rest, id, quantite_stock: 0, createdAt: now - (seeds.length - i) * day, updatedAt: now });
    });

    const recomputed = recompute(articles, movements);
    set({ articles: recomputed, movements, loading: false });
    await Promise.all([saveCache(ARTICLES_KEY, recomputed), saveCache(MOVEMENTS_KEY, movements)]);
  },
}));
