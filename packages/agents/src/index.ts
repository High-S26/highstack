export * from "./llm";
export * from "./experten";
export * from "./schemas";
export * from "./tools";
export * from "./runtime";
export * from "./orchestrator";
export * from "./mock";
import { anthropicClient, STANDARD_MODELLE, type LlmClient, type Modelle } from "./llm";
import { testClient } from "./mock";

/** Client und Modelle aus der Umgebung. Ohne ANTHROPIC_API_KEY: Testmodus. */
export function ausUmgebung(env: Record<string, string | undefined> = process.env): { client: LlmClient; modelle: Modelle; testmodus: boolean } {
  const key = env.ANTHROPIC_API_KEY;
  const modelle = { expert: env.HIGHSTACK_MODEL_EXPERT || STANDARD_MODELLE.expert, fast: env.HIGHSTACK_MODEL_FAST || STANDARD_MODELLE.fast };
  return key ? { client: anthropicClient(key), modelle, testmodus: false } : { client: testClient(), modelle, testmodus: true };
}
