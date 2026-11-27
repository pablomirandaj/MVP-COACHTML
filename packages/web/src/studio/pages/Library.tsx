// Biblioteca: todas las jugadas y planes guardados, con miniatura, filtros y exportación.
import { useEffect, useMemo, useState } from "react";
import { DossierDialog, type FolderRequest } from "../components/DossierDialog";
import { Thumb } from "../components/Thumb";
import { useStudio } from "../lib/context";
import { tracksOf } from "../lib/editor";
import { buildDossier, DEFAULT_RULES, exportFolder } from "../lib/dossier";
import { shortDate, teamShort } from "../lib/format";
import type { ItemMeta, StudioItem, StudioKind } from "../ports";

const KIND_ES: Record<StudioKind, string> = { BOARD: "Pizarra", SETPIECE: "Balón parado", SCENE: "Plan de juego" };
const ROUTE = { BOARD: "board", SETPIECE: "setpieces", SCENE: "plans" } as const;

export function Library() {
  const { host, go, roster, libraryVersion, bumpLibrary, rules, setRules, next } = useStudio();
  const [items, setItems] = useState<ItemMeta[] | null>(null);
  const [kind, setKind] = useState<StudioKind | "ALL">("ALL");
  const [match, setMatch] = useState<number | "ALL">("ALL");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [dialog, setDialog] = useState(false);
  const [busy, setBusy] = useState(false);
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const stopSelecting = () => { setSelecting(false); setPicked([]); setDialog(false); };
  const exportPicked = async (r: FolderRequest) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      if (r.rules.join("\n") !== rules.join("\n")) setRules(r.rules);
      const { included, skipped } = await exportFolder(host, r.ids, { roster, rules: r.rules, title: r.title, match: r.match, opponent: r.opponent });
      setNotice(`Carpeta exportada con ${included} ${included === 1 ? "jugada" : "jugadas"}.${skipped ? ` ${skipped === 1 ? "Se ha omitido 1 pieza" : `Se han omitido ${skipped} piezas`} sin pasos o borradas.` : ""}`);
      stopSelecting();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const pickedItems = picked.map((id) => (items ?? []).find((i) => i.id === id)).filter((x): x is ItemMeta => !!x);
  const firstPicked = pickedItems[0];
  useEffect(() => { host.store.list().then(setItems).catch(() => { setItems([]); setError("No se ha podido cargar la biblioteca."); }); }, [host, libraryVersion]);
  const shown = (items ?? []).filter((i) => (kind === "ALL" || i.kind === kind) && (match === "ALL" || i.match === match));
  const matches = useMemo(() => [...new Set((items ?? []).map((i) => i.match).filter((m): m is number => !!m))].sort((a, b) => a - b), [items]);
  const load = async (id: string) => { const it = await host.store.load(id); if (!it) throw new Error("No encontrada"); return it; };
  const openItem = async (id: string) => { const it = await load(id); go(ROUTE[it.kind], { kind: it.kind, item: it }); };
  const duplicate = async (id: string) => {
    const it = await load(id);
    const copy: StudioItem = { ...it, id: `${it.kind.toLowerCase()}_${Date.now().toString(36)}`, title: `${it.title} (copia)`, revision: 0 };
    await host.store.save(copy); bumpLibrary();
  };
  const exportItem = async (id: string) => {
    try {
      const it = await load(id);
      const { html, skipped } = buildDossier([it], { team: host.team.team(), roster, rules: rules.length ? rules : DEFAULT_RULES, title: it.title,
        match: it.match ? `Jornada ${it.match}` : undefined, opponent: it.opponent ? teamShort(it.opponent) : undefined });
      if (skipped) throw new Error("Esta jugada no tiene pasos que exportar.");
      await host.exporter.saveHtml(it.title, html);
    } catch (e) { setError((e as Error).message); }
  };
  return (
    <div className="st-stack" style={{ gap: 14 }}>
      <div><h1>Biblioteca</h1><p className="st-muted" style={{ margin: "4px 0 0" }}>Jugadas y planes guardados. Exporta cualquiera como HTML para mandárselo a los jugadores.</p></div>
      <div className="st-row">
        {(["ALL", "BOARD", "SETPIECE", "SCENE"] as const).map((k) => <button key={k} className="st-chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k === "ALL" ? "Todo" : KIND_ES[k]}</button>)}
        <span style={{ flex: 1 }} />
        {selecting ? <>
          <button className="st-btn primary" disabled={!picked.length} onClick={() => setDialog(true)}>Exportar carpeta del partido ({picked.length})</button>
          <button className="st-btn" onClick={stopSelecting}>Cancelar</button>
        </> : <button className="st-btn" onClick={() => { setSelecting(true); setNotice(null); }}>Seleccionar para la carpeta</button>}
        {matches.length > 0 && <select aria-label="Jornada" value={match} onChange={(e) => setMatch(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}><option value="ALL">Todas las jornadas</option>{matches.map((m) => <option key={m} value={m}>Jornada {m}</option>)}</select>}
      </div>
      {error && <div className="st-error" role="alert">{error}</div>}
      {notice && <div className="st-hint" role="status">{notice}</div>}
      {selecting && !dialog && <p className="st-small st-muted" style={{ margin: 0 }}>Marca las jugadas en el orden en que quieres verlas; luego podrás cambiarlo.</p>}
      {dialog && pickedItems.length > 0 && <DossierDialog items={pickedItems} rules={rules} busy={busy} onExport={exportPicked} onClose={() => setDialog(false)}
        defaults={{ title: firstPicked?.match ? `Jornada ${firstPicked.match}` : next ? `Jornada ${next.jornada}` : "Carpeta del partido",
          match: firstPicked?.match ?? next?.jornada, opponent: firstPicked?.opponent ? teamShort(firstPicked.opponent) : next?.rival ? teamShort(next.rival) : undefined }} />}
      {items === null ? <p className="st-muted">Cargando…</p> : !shown.length ? (
        <div className="st-card st-stack"><b>Todavía no hay nada guardado{kind !== "ALL" ? " de este tipo" : ""}.</b><span className="st-muted st-small">Crea una pizarra, un balón parado o un plan y pulsa «Guardar».</span>
          <div className="st-row"><button className="st-btn primary" onClick={() => go("board", { kind: "BOARD" })}>Nueva pizarra</button><button className="st-btn" onClick={() => go("setpieces", { kind: "SETPIECE" })}>Nuevo balón parado</button></div></div>
      ) : (
        <div className="st-lib">
          {shown.map((it) => (
            <article key={it.id} className={`st-item${picked.includes(it.id) ? " picked" : ""}`}>
              <ItemThumb item={it} />
              <div className="body">
                <span className="st-tag">{KIND_ES[it.kind]}{it.match ? ` · J${it.match}` : ""}{it.opponent ? ` · ${teamShort(it.opponent)}` : ""}</span>
                <b style={{ overflowWrap: "anywhere" }}>{it.title}</b>
                <span className="st-small st-muted">Guardado el {shortDate(String(it.updated_at).slice(0, 10))}</span>
                {selecting ? (
                  <label className="st-pick"><input type="checkbox" checked={picked.includes(it.id)} onChange={() => togglePick(it.id)} />
                    {picked.includes(it.id) ? `En la carpeta (${picked.indexOf(it.id) + 1}º)` : "Incluir en la carpeta"}</label>
                ) : confirm === it.id ? (
                  <div className="st-row"><span className="st-small">¿Borrarla?</span><button className="st-btn sm danger" onClick={async () => { await host.store.remove(it.id); setConfirm(null); bumpLibrary(); }}>Borrar</button><button className="st-btn sm" onClick={() => setConfirm(null)}>Cancelar</button></div>
                ) : (
                  <div className="st-row">
                    <button className="st-btn sm primary" onClick={() => openItem(it.id)}>Abrir</button>
                    <button className="st-btn sm" onClick={() => exportItem(it.id)}>HTML</button>
                    <button className="st-btn sm" onClick={() => duplicate(it.id)}>Duplicar</button>
                    <button className="st-btn sm ghost" aria-label={`Borrar ${it.title}`} onClick={() => setConfirm(it.id)}>✕</button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemThumb({ item }: { item: ItemMeta }) {
  const { roster } = useStudio();
  const tracks = useMemo(() => { try { return item.doc ? tracksOf(item.kind, item.doc, roster, item.title) : null; } catch { return null; } }, [item, roster]);
  return <Thumb tracks={tracks} />;
}
