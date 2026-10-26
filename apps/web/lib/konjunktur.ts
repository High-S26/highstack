import { terminlage } from "@highstack/trading";
import { abrufen, bewerte, bilanz, gewichteAus, INDIKATOREN, lage, ordne, prognosen, punktAktuell, risikolage, wahrscheinlichkeit, type Bilanz, type Ereignis, type Prognose, type Punkt, type Reihen } from "@highstack/prognose";
import type { Speicher } from "./speicher";

/**
 * Konjunktur- und Marktdaten, Prognosen und deren Überprüfung. Alles liegt in der globalen Ablage
 * (Arten „konjunktur“, „ereignis“, „prognose“, „konjunktur-stand“) und wird vom Admin gepflegt;
 * Nutzer sehen nur die Wirkung (Marktszenarien, Positionsgröße im Trading).
 */
export interface Reihendatensatz { id: string; punkte: Punkt[]; quelle: string; aktualisiert: number }
export interface Stand { id: "stand"; letzterLauf: string | null; gewichte: Record<string, number>; letzterAbruf?: number; abrufFehler?: Record<string, string> }

export const heute = () => new Date().toISOString().slice(0, 10);

/** Gespeicherter Rückblick: Ergebnis, Gewichte und Beispiele, damit die Überprüfung auch ohne fällige Live-Prognosen sichtbar ist */
export interface Rueckblick { id: "letzter"; am: number; von: string; bis: string; schrittTage: number; anzahl: number; bilanz: Bilanz; gewichte: Record<string, number>; beispiele: Prognose[] }
export const rueckblickGespeichert = (s: Speicher) => s.globalEins<Rueckblick>("konjunktur-rueckblick", "letzter");

export async function reihen(s: Speicher): Promise<Reihen> {
  const r: Reihen = {}; for (const x of await s.global<Reihendatensatz>("konjunktur")) r[x.id] = x.punkte; return r;
}
export const ereignisse = (s: Speicher) => s.global<Ereignis>("ereignis");
/** Wirtschaftskalender für einen Handelstag (Datum New York) und die beobachteten Werte des Agenten */
export async function terminlageFuer(s: Speicher, datum: string, symbole: string[]) { return terminlage(await ereignisse(s), datum, symbole); }
export const stand = async (s: Speicher): Promise<Stand> => (await s.globalEins<Stand>("konjunktur-stand", "stand")) ?? { id: "stand", letzterLauf: null, gewichte: {} };

/** Neue Punkte in eine Reihe übernehmen (gleicher Tag: neuer Wert gewinnt) */
export async function uebernimm(s: Speicher, id: string, punkte: Punkt[], quelle: string) {
  const alt = await s.globalEins<Reihendatensatz>("konjunktur", id);
  const neu: Reihendatensatz = { id, punkte: ordne([...(alt?.punkte ?? []), ...punkte]), quelle, aktualisiert: Date.now() };
  await s.speichereGlobal("konjunktur", id, neu); umfeldVergessen(); return neu;
}

/** Alle frei abrufbaren Reihen holen (FRED mit Schlüssel, EZB ohne) */
export async function abrufAlle(s: Speicher) {
  const ergebnis: Record<string, string> = {};
  for (const i of INDIKATOREN.filter(x => x.quelle.art !== "manuell")) {
    try { const p = await abrufen(i.id, { fredKey: process.env.FRED_API_KEY, seit: "2005-01-01" }); await uebernimm(s, i.id, p, i.quelle.text); ergebnis[i.id] = `${p.length} Werte`; }
    catch (e) { const m = (e as Error).message; ergebnis[i.id] = `Fehler: ${/fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|abort|network/i.test(m) ? `Quelle nicht erreichbar (${i.quelle.text}). Die vorhandenen Werte bleiben; später erneut abrufen.` : m}`; }
  }
  const st = await stand(s); await s.speichereGlobal("konjunktur-stand", "stand", { ...st, letzterAbruf: Date.now(), abrufFehler: Object.fromEntries(Object.entries(ergebnis).filter(([, v]) => v.startsWith("Fehler"))) });
  return ergebnis;
}

/**
 * Täglicher Lauf: fällige Prognosen bewerten, Gewichte aus der Bilanz nachschärfen,
 * neue Prognosen für heute ablegen. Läuft je Tag höchstens einmal (außer erzwungen).
 */
export async function taeglich(s: Speicher, erzwingen = false, tag = heute()) {
  const st = await stand(s); if (!erzwingen && st.letzterLauf === tag) return null;
  const r = await reihen(s); const ev = await ereignisse(s);
  const alle = await s.global<Prognose>("prognose"); let bewertet = 0;
  for (const p of alle) { const b = bewerte(p, r, tag); if (b !== p) { await s.speichereGlobal("prognose", p.id, b); bewertet++; } }
  const nach = (await s.global<Prognose>("prognose"));
  // Gewichte nur aus Live-Fällen nachschärfen, wenn es genug davon gibt; sonst bleiben übernommene Gewichte (z. B. aus dem Rückblick)
  const live = bilanz(nach); const gewichte = live.n >= 20 ? gewichteAus(live) : st.gewichte;
  // Je Ziel und Horizont höchstens eine Prognose pro Tag; ein erneuter Lauf ergänzt nur, was fehlt (z. B. nach neuen Daten)
  const schluessel = (p: Prognose) => `${p.ziel}|${p.symbol ?? ""}|${p.horizontTage}`;
  const heuteDa = new Set(nach.filter(p => p.erstellt === tag).map(schluessel));
  let neu = 0;
  for (const p of prognosen({ stichtag: tag, reihen: r, ereignisse: ev }, gewichte, i => `p${tag}-${Date.now().toString(36)}-${i}`)) {
    if (heuteDa.has(schluessel(p))) continue;
    await s.speichereGlobal("prognose", p.id, p); heuteDa.add(schluessel(p)); neu++;
  }
  await s.speichereGlobal("konjunktur-stand", "stand", { ...st, letzterLauf: tag, gewichte });
  umfeldVergessen();
  return { bewertet, neu, vorhanden: heuteDa.size - neu };
}

export async function lagebild(s: Speicher, tag = heute()) {
  const st = await stand(s); return lage({ stichtag: tag, reihen: await reihen(s), ereignisse: await ereignisse(s) }, st.gewichte);
}

// Für den Trading-Takt zwischengespeichert, damit nicht jede Minute alle Reihen gelesen werden
const bevorzugt = ((globalThis as { hsUmfeld?: { zeit: number; wert: { faktor: number; text: string; lage: string; gruende: string[] } | null } }).hsUmfeld ??= { zeit: 0, wert: null });
/** Nach neuen Daten oder Terminen sofort neu rechnen statt bis zu 10 Minuten zu warten */
export function umfeldVergessen() { bevorzugt.zeit = 0; bevorzugt.wert = null; umfeldJeTag.clear(); }
const umfeldJeTag = new Map<string, { zeit: number; wert: Umfeldwert }>();
type Umfeldwert = { faktor: number; lage: "risk-on" | "neutral" | "risk-off"; gruende: string[]; text: string };
/** Marktumfeld zum Stichtag; die Simulation fragt mit ihrem simulierten Tag (TRD-035) */
export async function umfeld(s: Speicher, stichtag?: string): Promise<Umfeldwert> {
  const tag = stichtag ?? heute();
  if (tag === heute() && Date.now() - bevorzugt.zeit < 10 * 60_000 && bevorzugt.wert) return bevorzugt.wert as Umfeldwert;
  const c = umfeldJeTag.get(tag); if (tag !== heute() && c && Date.now() - c.zeit < 10 * 60_000) return c.wert;
  const r = risikolage({ stichtag: tag, reihen: await reihen(s), ereignisse: await ereignisse(s) });
  const name = { "risk-on": "Risikobereitschaft", neutral: "neutral", "risk-off": "Vorsicht" }[r.lage];
  const wert: Umfeldwert = { faktor: r.faktor, lage: r.lage, gruende: r.gruende, text: `${name}, Positionsgröße ${Math.round(r.faktor * 100)} % (${r.gruende.join("; ")})` };
  if (tag === heute()) { bevorzugt.wert = wert; bevorzugt.zeit = Date.now(); } else { umfeldJeTag.set(tag, { zeit: Date.now(), wert }); if (umfeldJeTag.size > 400) umfeldJeTag.clear(); }
  return wert;
}

/** Ausblick für die Marktszenarien der Investments: Wohnimmobilienpreise und Zinsniveau */
export async function ausblickImmobilien(s: Speicher) {
  const st = await stand(s); const l = await lagebild(s);
  const w = l.wirkungen.filter(x => x.ziel === "immo-wert"); const p = w.length ? wahrscheinlichkeit("immo-wert", 365, w, st.gewichte) : null;
  // Nur aktuelle, plausible Bundrendite (Höchstalter je Frequenz, Bereich −1 bis 10 %); veraltete Werte werden nicht verwendet
  const b = punktAktuell(await reihen(s), "bund10j", heute()); const bund = b && b.w >= -1 && b.w <= 10 ? b : null;
  const letzterBund = (await reihen(s)).bund10j?.at(-1); const bundVeraltet = !bund && letzterBund ? { stand: letzterBund.d } : null;
  if (!w.length && !bund && !bundVeraltet) return null;
  return { pHoch: p?.pHoch ?? null, gruende: w.map(x => x.grund), bund10j: bund ? { wert: bund.w, stand: bund.d } : null, bundVeraltet };
}
