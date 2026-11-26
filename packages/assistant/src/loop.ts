// Bucle del asistente (docs/31 §2): el modelo propone comandos con herramientas; el motor los valida y aplica
// sobre un borrador; el resultado vuelve al modelo hasta que responde o pregunta al entrenador.
import type { LlmAdapter, LlmBlock, LlmMessage, LlmToolDef } from "./adapter";
import { SYSTEM_PROMPT } from "./prompt";

export interface ToolOutcome { content: string; is_error?: boolean; stop?: { question: string; options: string[] } }

/** Lo que el asistente puede tocar en este turno (jugada, escena, pizarra o alineación). */
export interface Workspace {
  kind: string;
  /** Mensaje de contexto con el estado actual y la plantilla (va en el turno del usuario, no en el sistema). */
  context(): string;
  tools(): LlmToolDef[];
  exec(name: string, input: any): Promise<ToolOutcome>;
}

export interface TurnResult {
  reply: string;
  clarification: { question: string; options: string[] } | null;
  messages: LlmMessage[];
  usage: { input_tokens: number; output_tokens: number };
  iterations: number;
}

export const ASK_COACH: LlmToolDef = {
  name: "ask_coach",
  description: "Pregunta al entrenador cuando su petición es ambigua. Termina el turno; su respuesta llegará en el siguiente mensaje.",
  input_schema: { type: "object", additionalProperties: false, required: ["question", "options"], properties: {
    question: { type: "string" }, options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } } } },
};

export const commandsTool = (name: string, description: string): LlmToolDef => ({
  name, description,
  input_schema: { type: "object", additionalProperties: false, required: ["commands"], properties: {
    commands: { type: "array", minItems: 1, maxItems: 20, items: { type: "object", required: ["op"], properties: { op: { type: "string" } } } } } },
});

export async function runTurn(adapter: LlmAdapter, ws: Workspace, history: LlmMessage[], message: string, maxIterations = 6): Promise<TurnResult> {
  const messages: LlmMessage[] = [...history, { role: "user", content: [{ type: "text", text: `${ws.context()}\n\nEntrenador: ${message}` }] }];
  const tools = [...ws.tools(), ASK_COACH];
  const usage = { input_tokens: 0, output_tokens: 0 };
  for (let i = 1; i <= maxIterations; i++) {
    const res = await adapter.complete({ system: SYSTEM_PROMPT, messages, tools });
    usage.input_tokens += res.usage.input_tokens; usage.output_tokens += res.usage.output_tokens;
    messages.push({ role: "assistant", content: res.blocks, raw: res.raw });
    const text = res.blocks.filter((b): b is Extract<LlmBlock, { type: "text" }> => b.type === "text").map((b) => b.text).join("\n").trim();
    if (res.stop === "refusal") return { reply: "No puedo ayudar con esa petición.", clarification: null, messages, usage, iterations: i };
    const calls = res.blocks.filter((b): b is Extract<LlmBlock, { type: "tool_use" }> => b.type === "tool_use");
    if (!calls.length) return { reply: text || "Hecho.", clarification: null, messages, usage, iterations: i };
    const results: LlmBlock[] = [];
    let stop: ToolOutcome["stop"] | undefined;
    for (const call of calls) {
      const out = await execTool(ws, call.name, call.input);
      if (out.stop && !stop) stop = out.stop;
      results.push({ type: "tool_result", tool_use_id: call.id, content: out.content, is_error: out.is_error });
    }
    messages.push({ role: "user", content: results });
    if (stop) return { reply: text, clarification: stop, messages, usage, iterations: i };
  }
  return { reply: "No he podido completar la petición; prueba a dividirla en pasos más pequeños.", clarification: null, messages, usage, iterations: maxIterations };
}

/** Ejecuta una herramienta del espacio de trabajo (o ask_coach); nunca lanza: los errores vuelven al modelo. */
export async function execTool(ws: Workspace, name: string, input: any): Promise<ToolOutcome> {
  if (name === "ask_coach") {
    const q = input as { question: string; options: string[] };
    return { content: "Pregunta enviada al entrenador.", stop: { question: String(q?.question ?? ""), options: (q?.options ?? []).map(String).slice(0, 4) } };
  }
  try { return await ws.exec(name, input); }
  catch (e) { return { content: `Error: ${(e as Error).message}`, is_error: true }; }
}
