import { anthropicClient, ausUmgebung, ollamaClient, routerClient, STANDARD_MODELLE, type LlmClient } from "@highstack/agents";
import { speicher, type Speicher } from "./speicher";

/**
 * Modellwahl je Experte: Claude oder ein lokales Modell über Ollama (z. B. „ollama:qwen3.5:9b“).
 * Gespeichert global (Admin), gilt für alle Läufe dieses Servers. Ollama läuft auf dem Rechner des Servers;
 * im gehosteten Betrieb ist es meist nicht erreichbar, dann greift der Rückfall auf Claude.
 */
export interface Modellwahl {
  ollamaUrl: string;
  /** Kontextlänge für Ollama in Tokens */
  kontext: number;
  denken: boolean;
  /** „claude“ oder „ollama:<modell>“ je Modellklasse */
  standardFast: string; standardExpert: string;
  /** je Experte; leer = Standard der Klasse */
  jeExperte: Record<string, string>;
  /** Fällt das lokale Modell aus oder liefert Unbrauchbares, mit Claude weiter (nur mit API-Schlüssel) */
  rueckfallClaude: boolean;
}
export const STANDARD_WAHL: Modellwahl = { ollamaUrl: process.env.OLLAMA_URL || "http://127.0.0.1:11434", kontext: 16384, denken: false, standardFast: "claude", standardExpert: "claude", jeExperte: {}, rueckfallClaude: true };
const ART = "einstellungen"; const ID = "modelle";

let cache: { w: Modellwahl; am: number } | null = null;
export async function modellwahl(s?: Speicher): Promise<Modellwahl> {
  if (cache && Date.now() - cache.am < 30_000) return cache.w;
  const sp = s ?? await speicher();
  const w = { ...STANDARD_WAHL, ...((await sp.globalEins<Modellwahl>(ART, ID)) ?? {}) };
  cache = { w, am: Date.now() }; return w;
}
export async function speichereModellwahl(s: Speicher, w: Modellwahl) { await s.speichereGlobal(ART, ID, w); cache = { w, am: Date.now() }; }
export const nutztLokal = (w: Modellwahl) => [w.standardFast, w.standardExpert, ...Object.values(w.jeExperte)].some(x => x?.startsWith("ollama:"));

/** Was ein Experte gerade nutzt */
export function zielFuer(w: Modellwahl, experte: string | undefined, klasse: "expert" | "fast" | undefined) {
  return (experte && w.jeExperte[experte]) || (klasse === "fast" ? w.standardFast : w.standardExpert) || "claude";
}

/** Rückfälle auf Claude (für die Anzeige im Admin) */
export const rueckfaelle: { am: number; experte: string; grund: string }[] = [];

let lokalCache: { schluessel: string; c: LlmClient } | null = null;
const lokal = (w: Modellwahl) => { const k = `${w.ollamaUrl}|${w.kontext}|${w.denken}`; if (lokalCache?.schluessel !== k) lokalCache = { schluessel: k, c: ollamaClient({ url: w.ollamaUrl, kontext: w.kontext, denken: w.denken }) }; return lokalCache.c; };

/** Ersetzt ausUmgebung(): gleicher Rückgabewert, aber mit Modellwahl je Experte */
export function modellUmgebung() {
  const basis = ausUmgebung();
  const client = routerClient(async a => {
    const w = await modellwahl(); const ziel = zielFuer(w, a.experte, a.klasse);
    if (!ziel.startsWith("ollama:")) return { client: basis.client, model: a.model };
    const l = lokal(w);
    const mitRueckfall: LlmClient = {
      async erstelle(anfrage, signal) {
        try { return await l.erstelle(anfrage, signal); }
        catch (e) {
          if (!w.rueckfallClaude || basis.testmodus || signal?.aborted) throw e;
          rueckfaelle.unshift({ am: Date.now(), experte: a.experte ?? "?", grund: (e as Error).message.slice(0, 200) }); rueckfaelle.length = Math.min(rueckfaelle.length, 20);
          return basis.client.erstelle({ ...anfrage, model: a.klasse === "fast" ? basis.modelle.fast : basis.modelle.expert }, signal);
        }
      },
    };
    return { client: mitRueckfall, model: ziel.slice("ollama:".length) };
  });
  // Testmodus nur, wenn weder Schlüssel noch ein lokales Modell eingestellt ist
  return { client, modelle: basis.modelle, testmodus: basis.testmodus && !(cache && nutztLokal(cache.w)) };
}

/** Für den Vergleichslauf: genau ein Anbieter, ohne Rückfall */
export function festerClient(ziel: string, w: Modellwahl): { client: LlmClient; model: string } {
  if (ziel.startsWith("ollama:")) return { client: ollamaClient({ url: w.ollamaUrl, kontext: w.kontext, denken: w.denken }), model: ziel.slice(7) };
  const key = process.env.ANTHROPIC_API_KEY; if (!key) throw new Error("Für Claude fehlt ANTHROPIC_API_KEY in .env.");
  return { client: anthropicClient(key), model: ziel === "claude-fast" ? (process.env.HIGHSTACK_MODEL_FAST || STANDARD_MODELLE.fast) : (process.env.HIGHSTACK_MODEL_EXPERT || STANDARD_MODELLE.expert) };
}
