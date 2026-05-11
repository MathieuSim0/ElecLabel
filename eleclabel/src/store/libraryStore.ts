// Bibliothèque de schémas importés — fichiers .smg, .pdf, images, DWG, etc.
// Stocke n'importe quel fichier dans localStorage avec métadonnées cherchables.
import { create } from "zustand";

export interface ImportedFile {
  id: string;
  name: string;             // nom éditable affiché (différent du filename brut)
  filename: string;         // nom d'origine du fichier
  extension: string;        // ex: "smg", "pdf", "png"
  size: number;             // octets
  mimeType: string;
  data: string;             // contenu base64
  preview?: string;         // base64 JPEG (miniature pour images)
  notes?: string;           // description libre
  tags?: string[];          // mots-clés
  timestamp: number;
}

interface LibraryStore {
  files: ImportedFile[];
  add: (file: Omit<ImportedFile, "id" | "timestamp">) => boolean;  // false si quota
  remove: (id: string) => void;
  clear: () => void;
  rename: (id: string, name: string) => void;
  updateNotes: (id: string, notes: string) => void;
  updateTags: (id: string, tags: string[]) => void;
}

const STORAGE_KEY = "eleclabel-library";
const MAX_FILES = 40;
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 Mo par fichier

function loadLibrary(): ImportedFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ImportedFile[];
  } catch {
    return [];
  }
}

function saveLibrary(files: ImportedFile[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
    return true;
  } catch {
    if (files.length > 1) return saveLibrary(files.slice(0, files.length - 1));
    return false;
  }
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  files: loadLibrary(),

  add: (file) => {
    const newFile: ImportedFile = {
      ...file,
      id: `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    const next = [newFile, ...get().files].slice(0, MAX_FILES);
    const ok = saveLibrary(next);
    if (ok) set({ files: next });
    return ok;
  },

  remove: (id) => set((state) => {
    const next = state.files.filter((f) => f.id !== id);
    saveLibrary(next);
    return { files: next };
  }),

  clear: () => {
    saveLibrary([]);
    set({ files: [] });
  },

  rename: (id, name) => set((state) => {
    const next = state.files.map((f) => (f.id === id ? { ...f, name } : f));
    saveLibrary(next);
    return { files: next };
  }),

  updateNotes: (id, notes) => set((state) => {
    const next = state.files.map((f) => (f.id === id ? { ...f, notes } : f));
    saveLibrary(next);
    return { files: next };
  }),

  updateTags: (id, tags) => set((state) => {
    const next = state.files.map((f) => (f.id === id ? { ...f, tags } : f));
    saveLibrary(next);
    return { files: next };
  }),
}));

// Lit un File/Blob en base64 (sans le préfixe data URL)
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.replace(/^data:.+;base64,/, ""));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

// Déclenche le téléchargement d'un fichier de la bibliothèque
export function downloadImportedFile(file: ImportedFile): void {
  const bytes = atob(file.data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob = new Blob([arr], { type: file.mimeType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Formate une taille en octets lisible
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

// Icône par extension de fichier
export function iconForExtension(ext: string): string {
  const e = ext.toLowerCase();
  if (["smg", "semolog"].includes(e)) return "⚡";
  if (["pdf"].includes(e)) return "📄";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) return "🖼";
  if (["dwg", "dxf"].includes(e)) return "📐";
  if (["splc", "xsc", "xl3", "see", "qet"].includes(e)) return "🔌";
  if (["zip", "rar", "7z"].includes(e)) return "📦";
  return "📁";
}
