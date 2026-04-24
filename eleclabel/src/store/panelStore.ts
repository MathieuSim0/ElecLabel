// Store Zustand — état global du tableau électrique et des étiquettes
import { create } from "zustand";
import type { Panel, PanelRow, PoleWidth, ProjectMeta } from "../types/panel";

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

// Réindexe toutes les rangées et leurs disjoncteurs après suppression/ajout
function reindexRows(rows: PanelRow[]): PanelRow[] {
  return rows.map((row, i) => ({
    ...row,
    index: i,
    breakers: row.breakers.map((b, bi) => ({ ...b, row: i, id: `r${i}-${bi}` })),
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
  setPanel: (panel) => set({ panel, past: [], future: [], currentHistoryId: null }),

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

  // Supprime un disjoncteur et renumérote les ids de la rangée
  deleteBreaker: (breakerId) =>
    set((state) => {
      if (!state.panel) return state;
      const nextPanel: Panel = {
        ...state.panel,
        rows: state.panel.rows.map((row) => {
          const filtered = row.breakers.filter((b) => b.id !== breakerId);
          if (filtered.length === row.breakers.length) return row;
          return {
            ...row,
            breakers: filtered.map((b, i) => ({ ...b, id: `r${row.index}-${i}` })),
          };
        }),
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
            id: `r${rowIndex}-${row.breakers.length}`,
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

  // Supprime une rangée entière et réindexe
  deleteRow: (rowIndex) =>
    set((state) => {
      if (!state.panel) return state;
      const filtered = state.panel.rows.filter((r) => r.index !== rowIndex);
      const nextPanel: Panel = { ...state.panel, rows: reindexRows(filtered) };
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
        id: `r${rowIndex}-${i}`,
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
