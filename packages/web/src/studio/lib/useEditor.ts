// Une el estado del editor con el anfitrión: guardar (con detección de conflicto), ficha de la jugada, secuencia
// por pasos para «Ver», exportar como la J5 y turnos del asistente.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { boardWorkspace, sceneWorkspace, setPieceWorkspace, type Workspace } from "@fcs/assistant";
import type { BoardDoc, PlayDoc, SceneSpec, Sheet } from "@fcs/engine";
import { StoreError, type ChatTurn, type StudioItem, type StudioKind } from "../ports";
import { useStudio } from "./context";
import { buildDossier, DEFAULT_RULES } from "./dossier";
import { editorReducer, initEditor, sequenceOf, sheetOf, tracksOf, type AnyDoc } from "./editor";
import { teamShort } from "./format";

const newId = (k: StudioKind) => `${k.toLowerCase()}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

interface Draft { s: ReturnType<typeof initEditor>; title: string; meta: { id: string; revision: number; opponent?: string; match?: number }; savedHash: string | null; sheet?: Sheet; labels: "ROLE" | "DORSAL" }
const hashOf = (doc: AnyDoc | null, sheet?: Sheet) => JSON.stringify({ doc, sheet: sheet ?? null });

export function useStudioEditor(kind: StudioKind, initial: { item?: StudioItem; doc: AnyDoc | null; title: string; opponent?: string; match?: number }, draftKey?: string) {
  const { host, roster, bumpLibrary, drafts, rules } = useStudio();
  const draft = draftKey ? (drafts.get(draftKey) as Draft | undefined) : undefined;
  const [s, dispatch] = useReducer(editorReducer, undefined, () => draft?.s ?? initEditor(kind, initial.item?.doc ?? initial.doc, roster));
  const [title, setTitle] = useState(draft?.title ?? initial.item?.title ?? initial.title);
  const [meta, setMeta] = useState(draft?.meta ?? { id: initial.item?.id ?? newId(kind), revision: initial.item?.revision ?? 0, opponent: initial.item?.opponent ?? initial.opponent, match: initial.item?.match ?? initial.match });
  const [sheet, setSheet] = useState<Sheet | undefined>(draft ? draft.sheet : initial.item?.sheet);
  const [labels, setLabels] = useState<"ROLE" | "DORSAL">(draft?.labels ?? (kind === "SETPIECE" ? "ROLE" : "DORSAL"));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [savedHash, setSavedHash] = useState<string | null>(draft ? draft.savedHash : initial.item ? hashOf(initial.item.doc, initial.item.sheet) : null);
  useEffect(() => { if (draftKey) drafts.set(draftKey, { s, title, meta, savedHash, sheet, labels } satisfies Draft); }, [draftKey, s, title, meta, savedHash, sheet, labels]);
  useEffect(() => { dispatch({ type: "roster", roster }); }, [roster]);
  const tracks = useMemo(() => { try { return tracksOf(kind, s.doc, roster, title); } catch { return null; } }, [kind, s.doc, roster, title]);
  const seq = useMemo(() => sequenceOf(kind, s.doc, roster, labels, title), [kind, s.doc, roster, labels, title]);
  const proposed = useMemo(() => (seq && s.doc ? sheetOf(kind, s.doc, seq) : null), [kind, s.doc, seq]);
  const dirty = s.doc !== null && hashOf(s.doc, sheet) !== savedHash;

  const itemNow = (over: Partial<StudioItem> = {}): StudioItem => ({ id: meta.id, kind, title, doc: s.doc!, revision: meta.revision, updated_at: "", history: s.commands,
    ...(meta.match ? { match: meta.match } : {}), ...(meta.opponent ? { opponent: meta.opponent } : {}), ...(sheet ? { sheet } : {}), ...over });
  const save = async (asCopy = false) => {
    if (!s.doc) return;
    setSaveState("saving");
    const item = itemNow(asCopy ? { id: newId(kind), title: `${title} (copia)`, revision: 0 } : {});
    try {
      const r = await host.store.save(item, asCopy || meta.revision === 0 ? undefined : meta.revision);
      setMeta((m) => ({ ...m, id: r.id, revision: r.revision })); if (asCopy) setTitle(item.title);
      setSavedHash(hashOf(s.doc, sheet)); setSaveState("saved"); bumpLibrary();
    } catch (e) { setSaveState(e instanceof StoreError && e.code === "conflict" ? "conflict" : "error"); }
  };
  const reloadTheirs = async () => {
    const theirs = await host.store.load(meta.id);
    if (theirs) { dispatch({ type: "load", kind, doc: theirs.doc }); setTitle(theirs.title); setSheet(theirs.sheet); setMeta((m) => ({ ...m, revision: theirs.revision })); setSavedHash(hashOf(theirs.doc, theirs.sheet)); }
    setSaveState("idle");
  };
  /** Exporta esta pieza con el formato de la J5 (una jugada, sin pestañas). */
  const exportHtml = async () => {
    if (!s.doc) return;
    const { html } = buildDossier([itemNow()], { team: host.team.team(), roster, rules: rules.length ? rules : DEFAULT_RULES, title, labels,
      match: meta.match ? `Jornada ${meta.match}` : undefined, opponent: meta.opponent ? teamShort(meta.opponent) : undefined });
    await host.exporter.saveHtml(title, html);
  };

  // Asistente: el espacio de trabajo trabaja sobre una copia; al terminar el turno se registra UN cambio.
  const current = useRef<AnyDoc | null>(s.doc);
  current.current = s.doc;
  const ask = async (message: string, history: ChatTurn[], onText?: (t: string) => void) => {
    let work: AnyDoc | null = s.doc;
    const onSheet = (sh: Sheet) => setSheet(sh);
    let ws: Workspace;
    if (kind === "BOARD") ws = boardWorkspace({ doc: work as BoardDoc, roster, opponent: meta.opponent }, (d) => { work = d; }, onSheet);
    else if (kind === "SETPIECE") ws = setPieceWorkspace({ doc: work as PlayDoc | null, type: (work as PlayDoc | null)?.type ?? "CORNER_ATT", roster, opponent: meta.opponent }, (d) => { work = d; }, onSheet);
    else ws = sceneWorkspace({ spec: work as SceneSpec, roster, opponent: meta.opponent }, (d) => { work = d; }, onSheet);
    const r = await host.ai.turn({ ws, history, message, onText, subject: { kind, state: () => work, apply: (n) => { work = n as AnyDoc; } } });
    if (work && work !== s.doc) dispatch({ type: "replace", doc: work, origin: "ASSISTANT", cmds: [{ op: "assistant.turn", message }] });
    return r;
  };
  return { s, dispatch, tracks, seq, sheet, setSheet, proposed, labels, setLabels, title, setTitle, meta, setMeta, save, reloadTheirs, saveState, dirty, exportHtml, ask };
}
