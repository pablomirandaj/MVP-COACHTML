// Bucle del asistente (docs/31 §2): el modelo propone comandos con herramientas; el motor los valida y aplica
// sobre un borrador; el resultado vuelve al modelo hasta que responde o pregunta al entrenador.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import type { Command } from "@fcs/engine";
import type { LlmAdapter, LlmBlock, LlmMessage, LlmToolDef } from "./adapter";
import { SYSTEM_PROMPT } from "./prompt";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const irSchema = JSON.parse(readFileSync(`${root}docs/engine/command-ir.schema.json`, "utf8"));
const ajv = new Ajv2020({ strict: false, allErrors: false });
ajv.addSchema(irSchema);
const validateCommand = ajv.compile({ $ref: `${irSchema.$id}#/$defs/command` });

export function commandErrors(commands: unknown): string | null {
  if (!Array.isArray(commands) || commands.length === 0) return "commands debe ser una lista con al menos un comando.";
  for (const [i, c] of commands.entries()) {
    if (!validateCommand(c)) return `Comando ${i + 1} (${(c as any)?.op ?? "?"}) no cumple el esquema IR: ${ajv.errorsText(validateCommand.errors?.slice(0, 3))}`;
  }
  return null;
}

export interface ToolOutcome { content: string; is_error?: boolean; stop?: { question: string; options: string[] } }

/** Lo que el asistente puede tocar en este turno (jugada, escena o alineación). */
export interface Workspace {
  kind: "PLAY" | "NEW_PLAY" | "SCENE" | "LINEUP";
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

const ASK_COACH: LlmToolDef = {
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
      let out: ToolOutcome;
      if (call.name === "ask_coach") {
        const q = call.input as { question: string; options: string[] };
        out = { content: "Pregunta enviada al entrenador.", stop: { question: String(q.question), options: (q.options ?? []).map(String).slice(0, 4) } };
      } else {
        try { out = await ws.exec(call.name, call.input); }
        catch (e) { out = { content: `Error: ${(e as Error).message}`, is_error: true }; }
      }
      if (out.stop && !stop) stop = out.stop;
      results.push({ type: "tool_result", tool_use_id: call.id, content: out.content, is_error: out.is_error });
    }
    messages.push({ role: "user", content: results });
    if (stop) return { reply: text, clarification: stop, messages, usage, iterations: i };
  }
  return { reply: "No he podido completar la petición; prueba a dividirla en pasos más pequeños.", clarification: null, messages, usage, iterations: maxIterations };
}

export type { Command };
