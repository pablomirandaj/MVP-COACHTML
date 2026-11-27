// Estado del editor (función pura): documento, historial con deshacer/rehacer y pistas para dibujar.
// Cada acción del entrenador o cada turno del asistente es UNA entrada del historial.
import {
  applyBoardCommand, applyPlayCommand, boardTracks, computeScene, createSetPiece, DEFAULT_PITCH, playTracks, record, redo, sceneTracks,
  startHistory, undo, type BoardDoc, type Clarification, type Command, type History, type Player, type PlayDoc, type SceneSpec, type Tracks,
} from "@fcs/engine";
import { commandErrors } from "@fcs/assistant";
import type { StudioKind } from "../ports";

export type AnyDoc = BoardDoc | PlayDoc | SceneSpec;
export interface EditorState {
  kind: StudioKind;
  doc: AnyDoc | null;
  history: History<AnyDoc | null>;
  roster: Player[];
  commands: Command[][];
  canUndo: boolean; canRedo: boolean;
  error: string | null;
  clarification: Clarification | null;
  lastOrigin: string | null;
}
export type EditorAction =
  | { type: "apply"; cmds: Command[]; origin: "MANUAL" | "ASSISTANT" }
  | { type: "replace"; doc: AnyDoc; origin: "MANUAL" | "ASSISTANT"; cmds?: Command[] }
  | { type: "undo" } | { type: "redo" }
  | { type: "roster"; roster: Player[] }
  | { type: "load"; kind: StudioKind; doc: AnyDoc | null }
  | { type: "dismiss" };

export function initEditor(kind: StudioKind, doc: AnyDoc | null, roster: Player[]): EditorState {
  return { kind, doc, history: startHistory(doc), roster, commands: [], canUndo: false, canRedo: false, error: null, clarification: null, lastOrigin: null };
}

const flags = (h: History<AnyDoc | null>) => ({ canUndo: h.past.length > 0, canRedo: h.future.length > 0 });
const ctx = (roster: Player[]) => ({ pitch: DEFAULT_PITCH, roster });

/** Aplica comandos al documento según su tipo; devuelve el nuevo documento o un error/aclaración. */
export function applyCommands(kind: StudioKind, doc: AnyDoc | null, cmds: Command[], roster: Player[], origin: string):
  { doc: AnyDoc | null; error?: string; clarification?: Clarification } {
  if (kind === "SCENE") return { doc, error: "Las escenas se editan cambiando sus parámetros." };
  const err = commandErrors(cmds);
  if (err) return { doc, error: err };
  try {
    if (kind === "BOARD") {
      let d = doc as BoardDoc;
      for (const c of cmds) d = applyBoardCommand(d, c, origin === "MANUAL" ? "EXPLICIT" : origin).doc;
      return { doc: d };
    }
    if (cmds.some((c) => c.op === "play.create")) {
      const r = createSetPiece(cmds, ctx(roster));
      if (r.clarifications.length) return { doc, clarification: r.clarifications[0] };
      if (!r.doc) return { doc, error: r.diagnostics.map((d) => d.message).join(" ") };
      return { doc: r.doc };
    }
    if (!doc) return { doc, error: "Crea primero la jugada." };
    let d = doc as PlayDoc;
    for (const c of cmds) {
      const r = applyPlayCommand(d, c, ctx(roster));
      if (r.clarifications.length) return { doc, clarification: r.clarifications[0] };
      d = r.doc;
    }
    return { doc: d };
  } catch (e) { return { doc, error: (e as Error).message }; }
}

export function editorReducer(s: EditorState, a: EditorAction): EditorState {
  switch (a.type) {
    case "apply": {
      const r = applyCommands(s.kind, s.doc, a.cmds, s.roster, a.origin);
      if (r.error || r.clarification) return { ...s, error: r.error ?? null, clarification: r.clarification ?? null };
      if (r.doc === s.doc) return { ...s, error: null, clarification: null };
      const history = record(s.history, a.cmds, r.doc);
      return { ...s, doc: r.doc, history, commands: [...s.commands, a.cmds], ...flags(history), error: null, clarification: null, lastOrigin: a.origin };
    }
    case "replace": {
      if (s.kind === "SCENE") { try { computeScene(a.doc as SceneSpec, DEFAULT_PITCH); } catch (e) { return { ...s, error: (e as Error).message }; } }
      const history = record(s.history, a.cmds ?? [{ op: "replace" }], a.doc);
      return { ...s, doc: a.doc, history, commands: [...s.commands, a.cmds ?? []], ...flags(history), error: null, clarification: null, lastOrigin: a.origin };
    }
    case "undo": { const h = undo(s.history); return { ...s, doc: h.doc, history: h, ...flags(h), error: null }; }
    case "redo": { const h = redo(s.history); return { ...s, doc: h.doc, history: h, ...flags(h), error: null }; }
    case "roster": return { ...s, roster: a.roster };
    case "load": return initEditor(a.kind, a.doc, s.roster);
    case "dismiss": return { ...s, error: null, clarification: null };
  }
}

/** Pistas para dibujar y exportar cualquier tipo de pieza. */
export function tracksOf(kind: StudioKind, doc: AnyDoc | null, roster: Player[], title: string): Tracks | null {
  if (!doc) return null;
  if (kind === "BOARD") return { ...boardTracks(doc as BoardDoc, roster), title };
  if (kind === "SETPIECE") return playTracks(doc as PlayDoc, roster, title);
  return sceneTracks(computeScene(doc as SceneSpec, DEFAULT_PITCH), title);
}
