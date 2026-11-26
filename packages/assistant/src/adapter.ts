// Pieza intercambiable del asistente (docs/31, ADR-017). El bucle y las herramientas son nuestros; el
// proveedor del modelo (API de Anthropic o un modelo propio) solo tiene que implementar `complete`.

export type LlmBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

export interface LlmMessage {
  role: "user" | "assistant";
  content: LlmBlock[];
  /** Contenido original del proveedor (p. ej. bloques de razonamiento) que debe devolverse sin cambios. */
  raw?: unknown;
}

export interface LlmToolDef { name: string; description: string; input_schema: Record<string, unknown> }

export interface LlmRequest { system: string; messages: LlmMessage[]; tools: LlmToolDef[]; maxTokens?: number }

export interface LlmResponse {
  blocks: LlmBlock[];
  stop: "end_turn" | "tool_use" | "max_tokens" | "refusal" | "other";
  usage: { input_tokens: number; output_tokens: number };
  raw?: unknown;
}

export interface LlmAdapter {
  provider: string;
  model: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}

/** Adaptador de pruebas: devuelve respuestas guionizadas en orden y registra las peticiones. */
export class ScriptedAdapter implements LlmAdapter {
  provider = "scripted";
  model = "scripted";
  requests: LlmRequest[] = [];
  constructor(private script: ((req: LlmRequest) => LlmResponse)[]) {}
  async complete(req: LlmRequest): Promise<LlmResponse> {
    this.requests.push(JSON.parse(JSON.stringify(req)));
    const next = this.script.shift();
    if (!next) throw new Error("ScriptedAdapter: sin más respuestas");
    return next(req);
  }
}
