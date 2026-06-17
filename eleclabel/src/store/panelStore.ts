// Store Zustand — état global du tableau électrique et des étiquettes
import { create } from "zustand";
import type { Breaker, Panel, PanelRow, PoleWidth, ProjectMeta } from "../types/panel";
import { migratePanel } from "../utils/breakerEnrich";

// Champs techniques modifiables d'un module (sous-ensemble de Breaker)
export type ModulePatch = Partial<
  Pick<Breaker, "type" | "calibre_A" | "ddr_type" | "sensibilite_mA" | "circuit_type" | "protege_par">
>;

// Génère un id de module unique et STABLE — jamais réattribué après création.
// Indispensable pour que les références protege_par survivent aux ajouts/suppressions.
function newBreakerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `m-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `m-${Math.random().toString(36).slice(2, 10)}`;
}

interface PanelStore {
  panel: Panel | null;
  isAnalyzing: boolean;
  // Piles historiques pour undo/redo (snapshots successifs du panel)
  past: Panel[];
  future: Panel[];
  // Id de l'entrée historyStore associée au projet courant (auto-save)
  currentHistoryId: string | null;

  setPanel: (panel: Panel) => void;
  setHistoryId: (id: string | null) => void;
  setAnalyzing: (value: boolean) => void;
  updateLabel: (breakerId: string, label: string, sublabel?: string) => void;
  // Applique un preset complet (label + sublabel + icône) en une seule action undo-able.
  applyPreset: (
    breakerId: string,
    preset: { label: string; sublabel: string; icon: string },
  ) => void;
  updatePoles: (breakerId: string, poles: PoleWidth) => void;
  // Met à jour les champs techniques structurés (type, calibre, différentiel…)
  updateModule: (breakerId: string, patch: ModulePatch) => void;
  deleteBreaker: (breakerId: string) => void;
  addBreaker: (rowIndex: number, poles?: PoleWidth) => void;
  deleteRow: (rowIndex: number) => void;
  addRow: () => void;
  updateProject: (project: ProjectMeta) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
}

// Limite de l'historique undo pour éviter la consommation mémoire excessive
const MAX_HISTORY = 60;

// Réindexe les rangées après suppression/ajout. Met à jour index/row mais
// CONSERVE les id de modules (stabilité des références protege_par).
function reindexRows(rows: PanelRow[]): PanelRow[] {
  return rows.map((row, i) => ({
    ...row,
    index: i,
    breakers: row.breakers.map((b) => ({ ...b, row: i })),
  }));
}

// Annule les références protege_par pointant vers un module supprimé.
function clearDanglingProtection(rows: PanelRow[], removedIds: Set<string>): PanelRow[] {
  if (removedIds.size === 0) return rows;
  return rows.map((row) => ({
    ...row,
    breakers: row.breakers.map((b) =>
      b.protege_par && removedIds.has(b.protege_par) ? { ...b, protege_par: null } : b,
    ),
  }));
}

// Pousse l'état courant dans la pile past et vide la pile future
function pushHistory(past: Panel[], current: Panel | null): Panel[] {
  if (!current) return past;
  const next = [...past, current];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  panel: null,
  isAnalyzing: false,
  past: [],
  future: [],
  currentHistoryId: null,

  // setPanel remplace le panel et purge l'historique (nouveau projet)
  // L'id history est volontairement remis à null : c'est l'appelant (Home/Templates/History)
  // qui appelle setHistoryId juste après pour brancher l'auto-save.
  setPanel: (panel) =>
    set({ panel: migratePanel(panel), past: [], future: [], currentHistoryId: null }),

  setHistoryId: (id) => set({ currentHistoryId: id }),

  setAnalyzing: (value) => set({ isAnalyzing: value }),

  // Met à jour le label et le sublabel d'un disjoncteur identifié par son id.
  // L'édition manuelle efface automatiquement le flag "suggested" mais conserve l'icône explicite.
  updateLabel: (breakerId, label, sublabel) =>
    set((state) => {
      if (!state.panel) return state;
      const nextPanel: Panel = {
        ...state.panel,
        rows: state.panel.rows.map((row) => ({
          ...row,
          breakers: row.breakers.map((b) =>
            b.id === breakerId ? { ...b, label, sublabel, suggested: false } : b,
          ),
        })),
      };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Applique un preset (label + sublabel + icône) en une seule transaction.
  applyPreset: (breakerId, preset) =>
    set((state) => {
      if (!state.panel) return state;
      const nextPanel: Panel = {
        ...state.panel,
        rows: state.panel.rows.map((row) => ({
          ...row,
          breakers: row.breakers.map((b) =>
            b.id === breakerId
              ? {
                  ...b,
                  label: preset.label,
                  sublabel: preset.sublabel,
                  icon: preset.icon,
                  suggested: false,
                }
              : b,
          ),
        })),
      };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Met à jour le nombre de pôles et recalcule les positions dans la rangée
  updatePoles: (breakerId, poles) =>
    set((state) => {
      if (!state.panel) return state;
      const nextPanel: Panel = {
        ...state.panel,
        rows: state.panel.rows.map((row) => {
          const targetBreaker = row.breakers.find((b) => b.id === breakerId);
          if (!targetBreaker) return row;

          const updated = row.breakers.map((b) =>
            b.id === breakerId ? { ...b, poles } : b,
          );

          const sorted = [...updated].sort((a, b) => a.position - b.position);
          let currentSlot = 0;
          const repositioned = sorted.map((b) => {
            const positioned = { ...b, position: currentSlot };
            currentSlot += b.poles;
            return positioned;
          });

          const totalSlots = Math.max(row.totalSlots, currentSlot);
          return { ...row, totalSlots, breakers: repositioned };
        }),
      };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Met à jour les champs techniques structurés d'un module.
  // Si le type devient non-différentiel, on purge ddr_type/sensibilité (cohérence).
  updateModule: (breakerId, patch) =>
    set((state) => {
      if (!state.panel) return state;
      const nextPanel: Panel = {
        ...state.panel,
        rows: state.panel.rows.map((row) => ({
          ...row,
          breakers: row.breakers.map((b) => {
            if (b.id !== breakerId) return b;
            const merged = { ...b, ...patch };
            if ("type" in patch && patch.type !== "interrupteur_differentiel") {
              merged.ddr_type = null;
              merged.sensibilite_mA = null;
            }
            return merged;
          }),
        })),
      };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Supprime un disjoncteur. Les id restent stables ; on annule les éventuelles
  // références protege_par qui pointaient vers le module supprimé.
  deleteBreaker: (breakerId) =>
    set((state) => {
      if (!state.panel) return state;
      const rowsFiltered = state.panel.rows.map((row) => ({
        ...row,
        breakers: row.breakers.filter((b) => b.id !== breakerId),
      }));
      const nextPanel: Panel = {
        ...state.panel,
        rows: clearDanglingProtection(rowsFiltered, new Set([breakerId])),
      };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Ajoute un disjoncteur (1P par défaut, ou largeur choisie) à la fin d'une rangée
  addBreaker: (rowIndex, poles = 1) =>
    set((state) => {
      if (!state.panel) return state;
      const nextPanel: Panel = {
        ...state.panel,
        rows: state.panel.rows.map((row) => {
          if (row.index !== rowIndex) return row;
          const nextPos = row.breakers.reduce(
            (max, b) => Math.max(max, b.position + b.poles),
            0,
          );
          const newBreaker = {
            id: newBreakerId(),
            row: rowIndex,
            position: nextPos,
            poles,
            label: "",
            sublabel: "",
          };
          const totalSlots = Math.max(row.totalSlots, nextPos + poles);
          return { ...row, totalSlots, breakers: [...row.breakers, newBreaker] };
        }),
      };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Supprime une rangée entière et réindexe (id de modules conservés ailleurs)
  deleteRow: (rowIndex) =>
    set((state) => {
      if (!state.panel) return state;
      const removed = new Set(
        state.panel.rows.find((r) => r.index === rowIndex)?.breakers.map((b) => b.id) ?? [],
      );
      const filtered = state.panel.rows.filter((r) => r.index !== rowIndex);
      const nextPanel: Panel = {
        ...state.panel,
        rows: clearDanglingProtection(reindexRows(filtered), removed),
      };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Ajoute une rangée vide de 13 slots à la fin
  addRow: () =>
    set((state) => {
      if (!state.panel) return state;
      const rowIndex = state.panel.rows.length;
      const totalSlots = 13;
      const breakers = Array.from({ length: totalSlots }, (_, i) => ({
        id: newBreakerId(),
        row: rowIndex,
        position: i,
        poles: 1 as PoleWidth,
        label: "",
        sublabel: "",
      }));
      const newRow: PanelRow = { index: rowIndex, totalSlots, breakers };
      const nextPanel: Panel = { ...state.panel, rows: [...state.panel.rows, newRow] };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Met à jour les métadonnées chantier/client (imprimées en en-tête du PDF)
  updateProject: (project) =>
    set((state) => {
      if (!state.panel) return state;
      const nextPanel: Panel = { ...state.panel, project: { ...project } };
      return {
        panel: nextPanel,
        past: pushHistory(state.past, state.panel),
        future: [],
      };
    }),

  // Annule la dernière action en repoussant le panel courant vers la pile future
  undo: () =>
    set((state) => {
      if (state.past.length === 0 || !state.panel) return state;
      const previous = state.past[state.past.length - 1];
      return {
        panel: previous,
        past: state.past.slice(0, -1),
        future: [state.panel, ...state.future],
      };
    }),

  // Rejoue la dernière action annulée
  redo: () =>
    set((state) => {
      if (state.future.length === 0 || !state.panel) return state;
      const next = state.future[0];
      return {
        panel: next,
        past: [...state.past, state.panel],
        future: state.future.slice(1),
      };
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  reset: () => set({ panel: null, past: [], future: [], currentHistoryId: null }),
}));
