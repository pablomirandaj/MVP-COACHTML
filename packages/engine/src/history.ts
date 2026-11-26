// Historial con deshacer/rehacer basado en parches (docs/15 §11). Cada entrada es una transacción
// (todos los comandos de un mismo mensaje o acción) y guarda el parche y su inverso.
import type { Command } from "./types";
import { applyPatch, diff, type PatchOp } from "./util/patch";

export interface HistoryEntry { commands: Command[]; patch: PatchOp[]; inverse: PatchOp[] }
export interface History<T> { doc: T; past: HistoryEntry[]; future: HistoryEntry[] }

export const startHistory = <T>(doc: T): History<T> => ({ doc, past: [], future: [] });

/** Registra el paso de doc → next. Si no hay cambios no se crea entrada (comando idempotente). */
export function record<T>(h: History<T>, commands: Command[], next: T): History<T> {
  const patch = diff(h.doc, next);
  if (patch.length === 0) return h;
  return { doc: next, past: [...h.past, { commands, patch, inverse: diff(next, h.doc) }], future: [] };
}

export function undo<T>(h: History<T>): History<T> {
  const e = h.past[h.past.length - 1];
  if (!e) return h;
  return { doc: applyPatch(h.doc, e.inverse), past: h.past.slice(0, -1), future: [e, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  const e = h.future[0];
  if (!e) return h;
  return { doc: applyPatch(h.doc, e.patch), past: [...h.past, e], future: h.future.slice(1) };
}
