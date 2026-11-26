// Panel del asistente (docs/31): el entrenador escribe; el modelo propone comandos; el motor los valida;
// lo aplicado se guarda como versión nueva y se puede deshacer.
import { useState } from "react";
import { post } from "../lib/api";

interface Msg { who: "coach" | "assistant"; text: string; options?: string[] }

export function Chat(props: {
  targetType: "PLAY" | "NEW_PLAY" | "SCENE" | "LINEUP"; targetId: string; matchId?: string;
  placeholder: string; onChanged: (target: { type: string; id: string }) => void; examples?: string[];
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async (message: string) => {
    if (!message.trim() || busy) return;
    setMsgs((m) => [...m, { who: "coach", text: message }]);
    setText(""); setBusy(true);
    try {
      const r = await post<{ reply: string; clarification: { question: string; options: string[] } | null; changed: boolean; target: { type: string; id: string } }>(
        "/assistant/turns", { target_type: props.targetType, target_id: props.targetId, match_id: props.matchId, message });
      const reply = [r.reply, r.clarification?.question].filter(Boolean).join("\n");
      setMsgs((m) => [...m, { who: "assistant", text: reply || "Hecho.", options: r.clarification?.options }]);
      if (r.changed) props.onChanged(r.target);
    } catch (e) {
      setMsgs((m) => [...m, { who: "assistant", text: (e as Error).message }]);
    } finally { setBusy(false); }
  };
  return (
    <div className="chat">
      <div className="msgs" aria-live="polite">
        {msgs.length === 0 && (
          <div className="muted small">
            <p>Pídele cambios como se los pedirías a tu segundo. El asistente solo usa las acciones del motor: todo lo que cambie podrás deshacerlo.</p>
            {props.examples?.map((e) => <button key={e} className="chip" onClick={() => send(e)}>{e}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.who}`}>
            <p>{m.text}</p>
            {m.options && <div className="row wrap">{m.options.map((o) => <button key={o} className="chip" onClick={() => send(o)}>{o}</button>)}</div>}
          </div>
        ))}
        {busy && <div className="msg assistant"><p className="muted">Pensando…</p></div>}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={props.placeholder} aria-label="Mensaje al asistente" disabled={busy} />
        <button className="primary" disabled={busy || !text.trim()}>Enviar</button>
      </form>
    </div>
  );
}
