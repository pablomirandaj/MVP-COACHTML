// Une el estado del editor con el anfitrión: guardar (con detección de conflicto), exportar y turnos del asistente.
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { boardWorkspace, sceneWorkspace, setPieceWorkspace, type Workspace } from "@fcs/assistant";
import type { BoardDoc, PlayDoc, SceneSpec } from "@fcs/engine";
import { StoreError, type ChatTurn, type StudioItem, type StudioKind } from "../ports";
import { useStudio } from "./context";
import { editorReducer, initEditor, tracksOf, type AnyDoc } from "./editor";

const newId = (k: StudioKind) => `${k.toLowerCase()}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function useStudioEditor(kind: StudioKind, initial: { item?: StudioItem; doc: AnyDoc | null; title: string; opponent?: string; match?: number }) {
  const { host, roster, bumpLibrary } = useStudio();
  const [s, dispatch] = useReducer(editorReducer, undefined, () => initEditor(kind, initial.item?.doc ?? initial.doc, roster));
  const [title, setTitle] = useState(initial.item?.title ?? initial.title);
  const [meta, setMeta] = useState({ id: initial.item?.id ?? newId(kind), revision: initial.item?.revision ?? 0, opponent: initial.item?.opponent ?? initial.opponent, match: initial.item?.match ?? initial.match });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "conflict" | "error">("idle");
  const [savedHash, setSavedHash] = useState<string | null>(initial.item ? JSON.stringify(initial.item.doc) : null);
  useEffect(() => { dispatch({ type: "roster", roster }); }, [roster]);
  const tracks = useMemo(() => { try { return tracksOf(kind, s.doc, roster, title); } catch { return null; } }, [kind, s.doc, roster, title]);
  const dirty = s.doc !== null && JSON.stringify(s.doc) !== savedHash;

  const save = async (asCopy = false) => {
    if (!s.doc) return;
    setSaveState("saving");
    const id = asCopy ? newId(kind) : meta.id;
    const item: StudioItem = { id, kind, title: asCopy ? `${title} (copia)` : title, doc: s.doc, revision: asCopy ? 0 : meta.revision, updated_at: "", history: s.commands,
      ...(meta.match ? { match: meta.match } : {}), ...(meta.opponent ? { opponent: meta.opponent } : {}) };
    try {
      const r = await host.store.save(item, asCopy || meta.revision === 0 ? undefined : meta.revision);
      setMeta((m) => ({ ...m, id: r.id, revision: r.revision })); if (asCopy) setTitle(item.title);
      setSavedHash(JSON.stringify(s.doc)); setSaveState("saved"); bumpLibrary();
    } catch (e) { setSaveState(e instanceof StoreError && e.code === "conflict" ? "conflict" : "error"); }
  };
  const reloadTheirs = async () => {
    const theirs = await host.store.load(meta.id);
    if (theirs) { dispatch({ type: "load", kind, doc: theirs.doc }); setTitle(theirs.title); setMeta((m) => ({ ...m, revision: theirs.revision })); setSavedHash(JSON.stringify(theirs.doc)); }
    setSaveState("idle");
  };
  const exportHtml = async () => {
    if (!tracks) return;
    await host.exporter.exportHtml(tracks, { title, opponent: meta.opponent, match: meta.match ? `Jornada ${meta.match}` : undefined });
  };

  // Asistente: el espacio de trabajo trabaja sobre una copia; al terminar el turno se registra UN cambio.
  const current = useRef<AnyDoc | null>(s.doc);
  current.current = s.doc;
  const ask = async (message: string, history: ChatTurn[], onText?: (t: string) => void) => {
    let draft: AnyDoc | null = s.doc;
    let ws: Workspace;
    if (kind === "BOARD") ws = boardWorkspace({ doc: draft as BoardDoc, roster, opponent: meta.opponent }, (d) => { draft = d; });
    else if (kind === "SETPIECE") ws = setPieceWorkspace({ doc: draft as PlayDoc | null, type: (draft as PlayDoc | null)?.type ?? "CORNER_ATT", roster, opponent: meta.opponent }, (d) => { draft = d; });
    else ws = sceneWorkspace({ spec: draft as SceneSpec, roster, opponent: meta.opponent }, (d) => { draft = d; });
    const r = await host.ai.turn({ ws, history, message, onText, subject: { kind, state: () => draft, apply: (n) => { draft = n as AnyDoc; } } });
    if (draft && draft !== s.doc) dispatch({ type: "replace", doc: draft, origin: "ASSISTANT", cmds: [{ op: "assistant.turn", message }] });
    return r;
  };
  return { s, dispatch, tracks, title, setTitle, meta, setMeta, save, reloadTheirs, saveState, dirty, exportHtml, ask };
}
