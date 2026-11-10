import { describe, expect, it } from "vitest";
import { BEISPIEL_ANLAGEPROFIL, BEISPIEL_INVESTOR, BEISPIEL_OBJEKT } from "@highstack/engine";
import { fuehreAus, jsonAus, ollamaClient, pruefeSchema, routerClient, SCHEMA_JE_AUSGABE, zuOllama, type LlmClient } from "../src/index";

/** Nachgebautes Ollama: erst ein Werkzeugaufruf, dann (erzwungen) die Abgabe als JSON */
function fakeOllama(log: unknown[]) {
  return (async (_url: string, init: RequestInit) => {
    const b = JSON.parse(String(init.body)); log.push(b);
    if (b.format) return new Response(JSON.stringify({ message: { content: "<think>kurz</think>```json\n" + JSON.stringify({ kernaussage: "Lokal geprüft.", einstufung: "Watch", fragen: [{ an: "Makler", frage: "Hausgeld?" }], verhandlungsansatz: "5 % unter Angebot", naechster_schritt: "Unterlagen anfordern" }) + "\n```" }, prompt_eval_count: 900, eval_count: 120 }));
    if (b.tools && !b.messages.some((m: { role: string }) => m.role === "tool")) return new Response(JSON.stringify({ message: { content: "", tool_calls: [{ function: { name: "zielpreis", arguments: { ziel: "cashflow", wert: 0 } } }] }, prompt_eval_count: 800, eval_count: 30 }));
    return new Response(JSON.stringify({ message: { content: "fertig" } }));
  }) as unknown as typeof fetch;
}

describe("Ollama-Client", () => {
  it("übersetzt Nachrichten mit Werkzeugen, Ergebnissen und Bildern", () => {
    const m = zuOllama("SYS", [
      { role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/png", data: "AAA" } }, { type: "text", text: "Hallo" }] },
      { role: "assistant", content: [{ type: "text", text: "rechne" }, { type: "tool_use", id: "t1", name: "zielpreis", input: { ziel: "cashflow" } }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{\"preis\":1}" }] },
    ]);
    expect(m[0]).toEqual({ role: "system", content: "SYS" });
    expect(m[1]).toEqual({ role: "user", content: "Hallo", images: ["AAA"] });
    expect(m[2]!.tool_calls![0]!.function.name).toBe("zielpreis");
    expect(m[3]).toEqual({ role: "tool", content: "{\"preis\":1}", tool_name: "zielpreis" });
  });
  it("JSON aus Antworten mit Denkblock und Code-Zaun", () => {
    expect(jsonAus("<think>x</think>\n```json\n{\"a\":1}\n```")).toEqual({ a: 1 });
    expect(jsonAus("Hier: {\"a\": 2} danke")).toEqual({ a: 2 });
    expect(() => jsonAus("kein json")).toThrow(/kein gültiges JSON/);
  });
  it("führt einen Experten mit Werkzeug und erzwungener Abgabe lokal aus", async () => {
    const log: Record<string, any>[] = [];
    const client = ollamaClient({ url: "http://x:11434/", fetch: fakeOllama(log) });
    const r = await fuehreAus<{ einstufung: string }>("kurzurteil", { client, modelle: { expert: "qwen3.5:9b", fast: "qwen3.5:9b" }, eingabe: { investor: BEISPIEL_INVESTOR, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: BEISPIEL_OBJEKT } });
    expect(r.ergebnis.einstufung).toBe("Watch");
    const letzte = log.at(-1)!; expect(letzte.format).toBeTruthy(); expect(letzte.think).toBe(false); expect(letzte.options.num_ctx).toBe(16384);
    expect(pruefeSchema(r.ergebnis, SCHEMA_JE_AUSGABE.kurzurteil)).toEqual([]);
  });
  it("Fehlermeldungen: nicht erreichbar, Modell fehlt", async () => {
    const weg = ollamaClient({ url: "http://x", fetch: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch });
    await expect(weg.erstelle({ model: "m", max_tokens: 10, system: "", messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/Läuft die Ollama-App/);
    const fehlt = ollamaClient({ url: "http://x", fetch: (async () => new Response("model 'm' not found", { status: 404 })) as unknown as typeof fetch });
    await expect(fehlt.erstelle({ model: "m", max_tokens: 10, system: "", messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/ollama pull m/);
  });
  it("Router wählt je Experte", async () => {
    const gesehen: string[] = [];
    const mk = (n: string): LlmClient => ({ async erstelle(a) { gesehen.push(`${n}:${a.model}`); return { content: [{ type: "text", text: "ok" }], stop_reason: "end_turn" }; } });
    const lokal = mk("lokal"), claude = mk("claude");
    const r = routerClient(async a => a.experte === "komitee" ? { client: claude, model: "claude-x" } : { client: lokal, model: "qwen" });
    await r.erstelle({ model: "egal", experte: "datenanalyst", max_tokens: 1, system: "", messages: [] });
    await r.erstelle({ model: "egal", experte: "komitee", max_tokens: 1, system: "", messages: [] });
    expect(gesehen).toEqual(["lokal:qwen", "claude:claude-x"]);
  });
  it("Schema-Prüfung findet fehlende Felder und falsche Typen", () => {
    const f = pruefeSchema({ kernaussage: 3, fragen: [{}] }, SCHEMA_JE_AUSGABE.kurzurteil);
    expect(f.join(" ")).toMatch(/kernaussage: erwartet string/); expect(f.join(" ")).toMatch(/einstufung: fehlt/);
  });
});
