import { alpacaBroker, leererZustand, manuellerBroker, simBroker, simWeiter, takt, type AgentEinstellungen, type Agentzustand, type Broker, type BrokerArt } from "@highstack/trading";
import { entschluessele } from "./geheim";
import { umfeld } from "./konjunktur";
import type { Speicher } from "./speicher";

/**
 * Trading-Agenten je Konto. Abgelegt in der globalen Ablage (Art „trading“) mit Konto-Kennung;
 * Zugangsdaten verschlüsselt und nie an die Oberfläche zurückgegeben.
 */
export interface Agentdatensatz { id: string; tenant: string; einstellungen: AgentEinstellungen; zustand: Agentzustand; zugang?: { keyId: string; secret: string } | null; erstellt: number; geaendert: number }
export type Agentansicht = Omit<Agentdatensatz, "zugang"> & { zugangHinterlegt: boolean };
export const ansicht = (d: Agentdatensatz): Agentansicht => { const { zugang, ...rest } = d; return { ...rest, zugangHinterlegt: !!zugang }; };

export const agenten = async (s: Speicher, tenant?: string) => (await s.global<Agentdatensatz>("trading")).filter(a => !tenant || a.tenant === tenant);
export const agent = async (s: Speicher, tenant: string, id: string) => { const a = await s.globalEins<Agentdatensatz>("trading", id); return a && a.tenant === tenant ? a : null; };
export const speichere = (s: Speicher, a: Agentdatensatz) => s.speichereGlobal("trading", a.id, { ...a, geaendert: Date.now() });
export const neuerAgent = (id: string, tenant: string, e: AgentEinstellungen): Agentdatensatz => ({ id, tenant, einstellungen: e, zustand: leererZustand(), zugang: null, erstellt: Date.now(), geaendert: Date.now() });

/** Broker-Baustein zum Agenten. Neue Broker kommen hier dazu, der Agent bleibt gleich. */
export async function brokerFuer(a: Agentdatensatz): Promise<Broker> {
  const e = a.einstellungen; const z = a.zustand;
  const alpaca = async (live = false) => {
    const keyId = a.zugang?.keyId ?? process.env.ALPACA_KEY_ID; const secret = a.zugang ? await entschluessele(a.zugang.secret) : process.env.ALPACA_SECRET;
    if (!keyId || !secret) throw new Error("Bitte Alpaca-Zugang (Key-ID und Secret) beim Agenten hinterlegen.");
    return alpacaBroker({ keyId, secret }, live);
  };
  switch (e.broker) {
    case "simulation": return simBroker(z, e.startkapital);
    case "alpaca-paper": return alpaca(false);
    case "alpaca-live": if (process.env.TRADING_LIVE !== "1") throw new Error("Live-Handel ist auf diesem Server ausgeschaltet (TRADING_LIVE=1)."); return alpaca(true);
    case "manuell": { let daten: Pick<Broker, "bars"> | null = null; try { daten = await alpaca(false); } catch { daten = null; } return manuellerBroker(z, e.startkapital, daten); }
    default: throw new Error(`Broker ${e.broker} ist noch nicht angebunden.`);
  }
}

/** Broker, die auf diesem Server angelegt und gestartet werden dürfen */
export const erlaubteBroker = (): BrokerArt[] => ["simulation", "alpaca-paper", "manuell", ...(process.env.TRADING_LIVE === "1" ? ["alpaca-live" as const] : [])];

/** Fehler ins Protokoll, gleiche Meldungen hintereinander nur einmal (mit Zähler) */
export function fehlerLog(z: Agentzustand, text: string) {
  const l = z.log[0]; const zeit = new Date().toISOString();
  if (l && l.art === "fehler" && l.text.replace(/ \(\d+×\)$/, "") === text) { const n = Number(l.text.match(/\((\d+)×\)$/)?.[1] ?? 1) + 1; l.text = `${text} (${n}×)`; l.zeit = zeit; }
  else z.log.unshift({ zeit, art: "fehler", text });
}

// Ein Agent wird nie gleichzeitig von Dauerlauf und Oberfläche verändert
const sperren = ((globalThis as { hsSperren?: Map<string, Promise<unknown>> }).hsSperren ??= new Map<string, Promise<unknown>>());
export function exklusiv<T>(id: string, f: () => Promise<T>): Promise<T> {
  const vorher = sperren.get(id) ?? Promise.resolve(); const r = vorher.then(f, f); sperren.set(id, r.catch(() => undefined)); return r;
}

/** Ein Takt für einen Agenten: laden, rechnen, speichern. Die Simulation dreht dabei eine Minute weiter. */
export async function taktFuer(s: Speicher, id: string, schritte = 1) {
  return exklusiv(id, async () => {
    const a = await s.globalEins<Agentdatensatz>("trading", id); if (!a) return null;
    a.zustand.letzterTakt = new Date().toISOString();
    let b: Broker;
    try { b = await brokerFuer(a); } catch (err) { fehlerLog(a.zustand, (err as Error).message); await speichere(s, a); throw err; }
    let letzter = null;
    const u = a.einstellungen.marktlage === false ? undefined : await umfeld(s).catch(() => undefined);
    for (let i = 0; i < schritte; i++) {
      try { letzter = await takt(a.einstellungen, a.zustand, b, new Date(), u); }
      catch (err) { fehlerLog(a.zustand, (err as Error).message); break; }
      if (a.einstellungen.broker === "simulation") { simWeiter(a.zustand); if (a.zustand.simUhr!.minute === 0) break; }
    }
    await speichere(s, a); return letzter;
  });
}

/** Dauerlauf: alle aktiven Agenten. Simulation jede Runde, echte Broker höchstens einmal pro Minute. */
export async function dauerlauf(s: Speicher) {
  for (const a of await agenten(s)) {
    if (!a.zustand.aktiv) continue;
    const echt = a.einstellungen.broker !== "simulation";
    if (echt && a.zustand.letzterTakt && Date.now() - Date.parse(a.zustand.letzterTakt) < 55_000) continue;
    try { await taktFuer(s, a.id); } catch { /* im Protokoll des Agenten */ }
  }
}
