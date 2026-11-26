// Implementación del adaptador sobre la API de Anthropic (Messages API, bucle de herramientas propio).
import Anthropic from "@anthropic-ai/sdk";
import type { LlmAdapter, LlmBlock, LlmRequest, LlmResponse } from "./adapter";

export class AnthropicAdapter implements LlmAdapter {
  provider = "anthropic";
  private client: Anthropic;
  constructor(public model = "claude-opus-5-5", private effort: "low" | "medium" | "high" = "medium", apiKey?: string) {
    this.client = new Anthropic(apiKey ? { apiKey } : {});
  }

  async complete(req: LlmRequest): Promise<LlmResponse> {
    const messages = req.messages.map((m) => ({
      role: m.role,
      // Las respuestas del modelo se devuelven tal cual (incluidos sus bloques de razonamiento).
      content: (m.raw as any) ?? m.content.map((b) =>
        b.type === "tool_result" ? { type: "tool_result" as const, tool_use_id: b.tool_use_id, content: b.content, is_error: b.is_error ?? false }
        : b.type === "tool_use" ? { type: "tool_use" as const, id: b.id, name: b.name, input: b.input }
        : { type: "text" as const, text: b.text }),
    }));
    const params: any = {
      model: this.model,
      max_tokens: req.maxTokens ?? 16000,
      output_config: { effort: this.effort },
      // El prompt de sistema y las herramientas son estables: se cachean (docs/31 §2).
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
      messages,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    };
    const res: any = await this.client.beta.messages.create(params);
    const blocks: LlmBlock[] = [];
    for (const b of res.content ?? []) {
      if (b.type === "text") blocks.push({ type: "text", text: b.text });
      else if (b.type === "tool_use") blocks.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
    }
    const stop = res.stop_reason === "end_turn" || res.stop_reason === "tool_use" || res.stop_reason === "max_tokens" || res.stop_reason === "refusal" ? res.stop_reason : "other";
    return { blocks, stop, usage: { input_tokens: res.usage?.input_tokens ?? 0, output_tokens: res.usage?.output_tokens ?? 0 }, raw: res.content };
  }
}
