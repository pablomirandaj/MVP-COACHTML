// Chat con el asistente. Las respuestas llegan en vivo; las preguntas del asistente se contestan con botones.
import { useEffect, useRef, useState } from "react";
import type { AiTurnResult, ChatTurn } from "../ports";
import { useStudio } from "../lib/context";

interface Msg { role: "coach" | "assistant"; text: string }

export function ChatPanel({ ask, examples, onUndo, canUndo }: {
  ask: (message: string, history: ChatTurn[], onText?: (t: string) => void) => Promise<AiTurnResult>;
  examples: string[]; onUndo?: () => void; canUndo?: boolean;
}) {
  const { host } = useStudio();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [usedAssistant, setUsed] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => { host.ai.available().then(setAvailable).catch(() => setAvailable(false)); }, [host]);
  useEffect(() => { list.current?.scrollTo?.({ top: list.current.scrollHeight }); }, [msgs]);
  if (available === false) return <p className="st-small st-muted">El asistente no está disponible en esta vista. Puedes editar todo a mano.</p>;

  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    const history: ChatTurn[] = msgs.map((m) => ({ role: m.role === "coach" ? "user" : "assistant", content: m.text }));
    setMsgs((m) => [...m, { role: "coach", text: message }, { role: "assistant", text: "Pensando…" }]);
    setText(""); setOptions([]); setBusy(true);
    const put = (t: string) => setMsgs((m) => [...m.slice(0, -1), { role: "assistant", text: t }]);
    try {
      const r = await ask(message, history, (t) => t && put(t));
      put(r.clarification ? `${r.reply ? r.reply + "\n" : ""}${r.clarification.question}` : r.reply);
      setOptions(r.clarification?.options ?? []);
      setUsed(true);
    } catch (e: any) {
      put(e?.code === "rate_limited" ? "Has hecho muchas peticiones seguidas. Espera un momento y vuelve a intentarlo." : e?.code === "not_granted" ? "Para usar el asistente tienes que permitirlo en esta página." : `No he podido responder: ${e?.message ?? "error desconocido"}.`);
    } finally { setBusy(false); }
  };
  return (
    <div className="st-chat">
      <div className="st-msgs" ref={list} aria-live="polite">
        {!msgs.length && <p className="st-small st-muted">Pídeme cambios en lenguaje normal. El motor comprueba cada cambio y puedes deshacerlo.</p>}
        {msgs.map((m, i) => <div key={i} className={`st-msg ${m.role}`}>{m.text}</div>)}
      </div>
      {options.length > 0 && <div className="st-row">{options.map((o) => <button key={o} className="st-chip" onClick={() => send(o)}>{o}</button>)}</div>}
      {!msgs.length && <div className="st-row">{examples.map((e) => <button key={e} className="st-chip" onClick={() => send(e)}>{e}</button>)}</div>}
      <form className="st-compose" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input id="chat-input" aria-label="Mensaje para el asistente" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ej.: que el 9 baje a recibir" disabled={busy} />
        <button className="st-btn primary" disabled={busy || !text.trim()}>{busy ? "…" : "Enviar"}</button>
      </form>
      {usedAssistant && onUndo && <button className="st-btn sm" onClick={onUndo} disabled={!canUndo}>Deshacer lo último</button>}
    </div>
  );
}
