import type { Block, LlmAnfrage, LlmAntwort, LlmClient, Nachricht } from "./llm";

/**
 * Lokales Modell über Ollama (native Schnittstelle /api/chat), z. B. Qwen auf dem eigenen Mac.
 * - Werkzeuge: Ollama-Tools; Antwort `tool_calls` wird in tool_use-Blöcke übersetzt.
 * - Erzwungene Abgabe (tool_choice auf ein Werkzeug): strukturierte Ausgabe mit `format` = JSON-Schema,
 *   das Ergebnis kommt als Aufruf dieses Werkzeugs zurück. Kleine Modelle halten Schemas so deutlich zuverlässiger ein.
 * Daten verlassen den Rechner nicht.
 */
export interface OllamaOptionen {
  /** z. B. http://127.0.0.1:11434 */
  url: string;
  /** Kontextlänge in Tokens; Ollama nimmt sonst einen kleinen Standard und schneidet lange Kontexte ab */
  kontext?: number;
  /** Denkmodus der Qwen-Modelle (langsamer, teils besser) */
  denken?: boolean;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

interface OMsg { role: "system" | "user" | "assistant" | "tool"; content: string; images?: string[]; tool_calls?: { function: { name: string; arguments: unknown } }[]; tool_name?: string }

/** Nachrichten im Anthropic-Format in Ollama-Nachrichten übersetzen */
export function zuOllama(system: string, messages: Nachricht[]): OMsg[] {
  const out: OMsg[] = [{ role: "system", content: system }];
  const namen = new Map<string, string>();
  for (const m of messages) {
    if (typeof m.content === "string") { out.push({ role: m.role, content: m.content }); continue; }
    if (m.role === "assistant") {
      const text = m.content.filter((b): b is Extract<Block, { type: "text" }> => b.type === "text").map(b => b.text).join("\n");
      const calls = m.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
      calls.forEach(c => namen.set(c.id, c.name));
      out.push({ role: "assistant", content: text, ...(calls.length ? { tool_calls: calls.map(c => ({ function: { name: c.name, arguments: c.input ?? {} } })) } : {}) });
      continue;
    }
    const texte: string[] = []; const bilder: string[] = [];
    for (const b of m.content) {
      if (b.type === "tool_result") out.push({ role: "tool", content: b.is_error ? `Fehler: ${b.content}` : b.content, ...(namen.get(b.tool_use_id) ? { tool_name: namen.get(b.tool_use_id) } : {}) });
      else if (b.type === "text") texte.push(b.text);
      else if (b.type === "image") bilder.push(b.source.data);
    }
    if (texte.length || bilder.length) out.push({ role: "user", content: texte.join("\n\n"), ...(bilder.length ? { images: bilder } : {}) });
  }
  return out;
}

/** Denkblöcke der Qwen-Modelle entfernen und JSON aus Text holen (auch in Code-Zäunen) */
export const ohneDenken = (t: string) => t.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
export function jsonAus(t: string): unknown {
  const s = ohneDenken(t).replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  try { return JSON.parse(s); } catch { /* weiter */ }
  const a = s.indexOf("{"), e = s.lastIndexOf("}");
  if (a >= 0 && e > a) return JSON.parse(s.slice(a, e + 1));
  throw new Error("Das lokale Modell hat kein gültiges JSON geliefert.");
}

export function ollamaClient(o: OllamaOptionen): LlmClient {
  const f = o.fetch ?? fetch; const basis = o.url.replace(/\/+$/, "");
  let zaehler = 0;
  return {
    async erstelle(a: LlmAnfrage, signal?: AbortSignal): Promise<LlmAntwort> {
      const erzwungen = a.tool_choice?.type === "tool" ? a.tools?.find(t => t.name === (a.tool_choice as { name: string }).name) : undefined;
      const msgs = zuOllama(a.system, a.messages);
      if (erzwungen) msgs.push({ role: "user", content: `Antworte jetzt ausschließlich mit einem JSON-Objekt für „${erzwungen.name}“ (${erzwungen.description}), das genau dem vorgegebenen Schema entspricht. Kein Text davor oder danach.` });
      const body = {
        model: a.model, stream: false, messages: msgs, think: o.denken ?? false,
        options: { num_ctx: o.kontext ?? 16384, num_predict: a.max_tokens },
        ...(erzwungen ? { format: erzwungen.input_schema } : a.tools?.length ? { tools: a.tools.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } })) } : {}),
      };
      const zeit = AbortSignal.timeout(o.timeoutMs ?? 600_000);
      const res = await f(`${basis}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: signal ? AbortSignal.any([signal, zeit]) : zeit })
        .catch(e => { throw new Error(`Ollama nicht erreichbar unter ${basis} (${(e as Error).message}). Läuft die Ollama-App?`); });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(res.status === 404 && /model/i.test(t) ? `Modell „${a.model}“ ist in Ollama nicht geladen. Im Terminal: ollama pull ${a.model}` : `Ollama: HTTP ${res.status} ${t.slice(0, 200)}`);
      }
      const j = await res.json() as { message?: { content?: string; tool_calls?: { function?: { name?: string; arguments?: unknown } }[] }; done_reason?: string; prompt_eval_count?: number; eval_count?: number };
      const usage = { input_tokens: j.prompt_eval_count ?? 0, output_tokens: j.eval_count ?? 0 };
      const text = ohneDenken(j.message?.content ?? "");
      if (erzwungen) return { stop_reason: "tool_use", usage, content: [{ type: "tool_use", id: `ollama_${++zaehler}`, name: erzwungen.name, input: jsonAus(text) }] };
      const calls = (j.message?.tool_calls ?? []).filter(c => c.function?.name);
      const content: Block[] = [];
      if (text) content.push({ type: "text", text });
      for (const c of calls) {
        let input = c.function!.arguments ?? {};
        if (typeof input === "string") { try { input = JSON.parse(input); } catch { input = {}; } }
        content.push({ type: "tool_use", id: `ollama_${++zaehler}`, name: c.function!.name!, input });
      }
      return { stop_reason: calls.length ? "tool_use" : j.done_reason === "length" ? "max_tokens" : "end_turn", usage, content };
    },
  };
}

/** Was in Ollama installiert ist (für die Auswahl im Admin) */
export async function ollamaModelle(url: string, f: typeof fetch = fetch): Promise<{ name: string; groesseGb: number; parameter: string | null; quantisierung: string | null }[]> {
  const r = await f(`${url.replace(/\/+$/, "")}/api/tags`, { signal: AbortSignal.timeout(4000) });
  if (!r.ok) throw new Error(`Ollama: HTTP ${r.status}`);
  const j = await r.json() as { models?: { name: string; size?: number; details?: { parameter_size?: string; quantization_level?: string } }[] };
  return (j.models ?? []).map(m => ({ name: m.name, groesseGb: Math.round((m.size ?? 0) / 1e8) / 10, parameter: m.details?.parameter_size ?? null, quantisierung: m.details?.quantization_level ?? null }));
}

/**
 * Leitet jede Anfrage an den passenden Anbieter. `waehle` entscheidet je Experte und Modellklasse,
 * z. B. „ollama:qwen3.5:9b“ für einfache Aufgaben und Claude für das Komitee.
 */
export function routerClient(waehle: (a: LlmAnfrage) => Promise<{ client: LlmClient; model: string }>): LlmClient {
  return { async erstelle(a, signal) { const z = await waehle(a); return z.client.erstelle({ ...a, model: z.model }, signal); } };
}

/** Prüft ein Ergebnis gegen ein JSON-Schema (Teilmenge: type, required, properties, items, enum). Liefert Abweichungen. */
export function pruefeSchema(wert: unknown, schema: unknown, pfad = "$"): string[] {
  const s = schema as { type?: string | string[]; required?: string[]; properties?: Record<string, unknown>; items?: unknown; enum?: unknown[]; minItems?: number };
  if (!s || typeof s !== "object") return [];
  const fehler: string[] = [];
  const typen = s.type == null ? null : Array.isArray(s.type) ? s.type : [s.type];
  const ist = wert === null ? "null" : Array.isArray(wert) ? "array" : typeof wert === "number" && Number.isInteger(wert) ? "integer" : typeof wert;
  if (typen && !typen.some(t => t === ist || (t === "number" && ist === "integer"))) return [`${pfad}: erwartet ${typen.join("|")}, ist ${ist}`];
  if (s.enum && !s.enum.includes(wert)) fehler.push(`${pfad}: Wert ${JSON.stringify(wert)} nicht erlaubt`);
  if (ist === "object" && wert) {
    for (const r of s.required ?? []) if (!(r in (wert as object)) || (wert as Record<string, unknown>)[r] === undefined) fehler.push(`${pfad}.${r}: fehlt`);
    for (const [k, v] of Object.entries(s.properties ?? {})) if (k in (wert as object)) fehler.push(...pruefeSchema((wert as Record<string, unknown>)[k], v, `${pfad}.${k}`));
  }
  if (ist === "array") {
    if (s.minItems && (wert as unknown[]).length < s.minItems) fehler.push(`${pfad}: mindestens ${s.minItems} Einträge`);
    if (s.items) (wert as unknown[]).forEach((x, i) => fehler.push(...pruefeSchema(x, s.items, `${pfad}[${i}]`)));
  }
  return fehler;
}
