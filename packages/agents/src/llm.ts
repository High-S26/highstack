import Anthropic from "@anthropic-ai/sdk";

export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export interface Nachricht { role: "user" | "assistant"; content: string | Block[] }
export interface Werkzeugdefinition { name: string; description: string; input_schema: object }
export interface LlmAnfrage {
  model: string; max_tokens: number; system: string; messages: Nachricht[];
  tools?: Werkzeugdefinition[]; tool_choice?: { type: "auto" } | { type: "any" } | { type: "tool"; name: string };
}
export interface LlmAntwort { content: Block[]; stop_reason: string | null; usage?: { input_tokens: number; output_tokens: number } }
/** Verbrauch eines Laufs; wird von der Laufzeit hochgezählt. */
export interface Verbrauch { aufrufe: number; inputTokens: number; outputTokens: number; ms: number }
export const neuerVerbrauch = (): Verbrauch => ({ aufrufe: 0, inputTokens: 0, outputTokens: 0, ms: 0 });
/** Schmale Schnittstelle zum Modell, damit Laufzeit und Tests ohne echte API auskommen. */
export interface LlmClient { erstelle(a: LlmAnfrage, signal?: AbortSignal): Promise<LlmAntwort> }

export function anthropicClient(apiKey: string): LlmClient {
  const client = new Anthropic({ apiKey });
  return {
    async erstelle(a, signal) {
      const res = await client.messages.create(a as unknown as Anthropic.MessageCreateParamsNonStreaming, { signal });
      return { content: res.content.filter(b => b.type === "text" || b.type === "tool_use") as Block[], stop_reason: res.stop_reason, usage: { input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens } };
    },
  };
}

export interface Modelle { expert: string; fast: string }
export const STANDARD_MODELLE: Modelle = { expert: "claude-opus-5-5", fast: "claude-sonnet-5-5" };
