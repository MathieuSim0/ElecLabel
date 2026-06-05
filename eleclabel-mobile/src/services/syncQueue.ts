// File d'attente de synchronisation cloud — permet le mode offline.
// Chaque mutation locale enfile une opération ; le moteur flush dès que le réseau est dispo.
// Stockage persistant dans IndexedDB → survit aux fermetures d'app.
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import type { Invoice } from "../types/invoice";
import type { HistoryEntry } from "../store/historyStore";
import type { Panel } from "../types/panel";
import {
  pushInvoice,
  pushInvoiceMetadata,
  pushDeleteInvoice,
  pushPanel,
  pushPanelData,
  pushPanelName,
  pushDeletePanel,
} from "./cloudSync";

const QUEUE_KEY = "eleclabel-sync-queue";
const MAX_ATTEMPTS = 5;

// ── Types d'opérations ──

export type QueueOp =
  | { kind: "invoice-upsert"; userId: string; recordId: string; record: Invoice; ts: number; attempts: number }
  | { kind: "invoice-meta"; userId: string; recordId: string; record: Invoice; ts: number; attempts: number }
  | { kind: "invoice-delete"; userId: string; recordId: string; ts: number; attempts: number }
  | { kind: "panel-upsert"; userId: string; recordId: string; record: HistoryEntry; ts: number; attempts: number }
  | {
      kind: "panel-data";
      userId: string;
      recordId: string;
      panel: Panel;
      breakerCount: number;
      rowCount: number;
      ts: number;
      attempts: number;
    }
  | { kind: "panel-name"; userId: string; recordId: string; name: string; ts: number; attempts: number }
  | { kind: "panel-delete"; userId: string; recordId: string; ts: number; attempts: number };

// DistributiveOmit : applique Omit à chaque variante de l'union (pas à l'union elle-même).
// Sans ça, TypeScript ne sait pas que { kind: "panel-data", panel, breakerCount, ... } est valide.
type DistributiveOmit<T, K extends keyof T | keyof unknown> = T extends unknown ? Omit<T, K & keyof T> : never;
type EnqueueInput = DistributiveOmit<QueueOp, "ts" | "attempts">;

// ── État interne ──

let flushing = false;
const listeners = new Set<() => void>();

// ── IO IndexedDB ──

async function readQueue(): Promise<QueueOp[]> {
  try {
    const raw = await idbGet(QUEUE_KEY);
    if (!Array.isArray(raw)) return [];
    return raw as QueueOp[];
  } catch {
    return [];
  }
}

async function writeQueue(ops: QueueOp[]): Promise<void> {
  await idbSet(QUEUE_KEY, ops);
  listeners.forEach((l) => l());
}

// ── Dedup logic ──
// Si l'utilisateur édite 50× la même facture en 5 sec, on garde que la dernière op.
// Si on enfile un delete sur un record, toutes les ops antérieures pour ce record deviennent inutiles.
function dedupe(queue: QueueOp[], newOp: QueueOp): QueueOp[] {
  const isDelete = newOp.kind.endsWith("-delete");

  if (isDelete) {
    // Supprime toutes les ops antérieures pour ce record
    return [...queue.filter((q) => q.recordId !== newOp.recordId), newOp];
  }
  // Remplace toute ancienne op de même type sur le même record
  return [
    ...queue.filter((q) => !(q.kind === newOp.kind && q.recordId === newOp.recordId)),
    newOp,
  ];
}

// ── API publique ──

/** Ajoute une opération à la queue + tente un flush immédiat */
export async function enqueue(input: EnqueueInput): Promise<void> {
  const newOp: QueueOp = { ...input, ts: Date.now(), attempts: 0 } as QueueOp;
  const queue = await readQueue();
  await writeQueue(dedupe(queue, newOp));
  // Best-effort flush — n'attend pas (UI reste fluide)
  void flush();
}

/** Exécute autant d'opérations que possible. Stoppe à la 1ʳᵉ erreur réseau. */
export async function flush(): Promise<{ remaining: number; flushed: number }> {
  if (flushing) return { remaining: (await readQueue()).length, flushed: 0 };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { remaining: (await readQueue()).length, flushed: 0 };
  }

  flushing = true;
  let flushed = 0;
  try {
    let queue = await readQueue();
    while (queue.length > 0) {
      const op = queue[0];
      try {
        await executeOp(op);
        queue = queue.slice(1);
        await writeQueue(queue);
        flushed++;
      } catch (err) {
        // Erreur réseau ou autre : retry plus tard, on garde l'op
        const opUpdated = { ...op, attempts: op.attempts + 1 };
        if (opUpdated.attempts >= MAX_ATTEMPTS) {
          // eslint-disable-next-line no-console
          console.error(
            `[syncQueue] op ${opUpdated.kind} (record ${opUpdated.recordId}) abandonnée après ${MAX_ATTEMPTS} tentatives:`,
            err,
          );
          queue = queue.slice(1);
        } else {
          // eslint-disable-next-line no-console
          console.warn(`[syncQueue] op ${opUpdated.kind} échec (essai ${opUpdated.attempts}):`, err);
          queue = [opUpdated, ...queue.slice(1)];
        }
        await writeQueue(queue);
        break; // stoppe le flush, retentera plus tard
      }
    }
    return { remaining: queue.length, flushed };
  } finally {
    flushing = false;
  }
}

async function executeOp(op: QueueOp): Promise<void> {
  switch (op.kind) {
    case "invoice-upsert":
      await pushInvoice(op.record, op.userId);
      break;
    case "invoice-meta":
      await pushInvoiceMetadata(op.record, op.userId);
      break;
    case "invoice-delete":
      await pushDeleteInvoice(op.recordId, op.userId);
      break;
    case "panel-upsert":
      await pushPanel(op.record, op.userId);
      break;
    case "panel-data":
      await pushPanelData(op.recordId, op.userId, op.panel, op.breakerCount, op.rowCount);
      break;
    case "panel-name":
      await pushPanelName(op.recordId, op.userId, op.name);
      break;
    case "panel-delete":
      await pushDeletePanel(op.recordId, op.userId);
      break;
  }
}

// ── Observables pour l'UI ──

export async function getQueueLength(): Promise<number> {
  return (await readQueue()).length;
}

export function subscribeQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Vide totalement la queue (logout, ou bouton "abandonner les modifs en attente") */
export async function clearQueue(): Promise<void> {
  await idbDel(QUEUE_KEY);
  listeners.forEach((l) => l());
}

// ── Auto-flush sur reconnexion + tick périodique ──

let intervalId: ReturnType<typeof setInterval> | null = null;

if (typeof window !== "undefined") {
  // Flush dès qu'on retrouve le réseau
  window.addEventListener("online", () => {
    void flush();
  });

  // Tick toutes les 30 sec — au cas où un flush s'est arrêté en erreur
  if (intervalId === null) {
    intervalId = setInterval(() => {
      if (navigator.onLine) {
        readQueue().then((q) => {
          if (q.length > 0) void flush();
        });
      }
    }, 30_000);
  }
}
