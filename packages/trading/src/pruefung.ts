import { neueEinstellungen } from "./agent";
import { STRATEGIEN } from "./strategien";
import type { AgentEinstellungen, BrokerArt, StrategieTyp, StrategieWerte } from "./types";

/**
 * Prüfung der Agent-Einstellungen. Gilt für Assistent, Anlegen und Ändern gleichermaßen:
 * nur bekannte Felder, Grenzen je Feld, erlaubte Broker je Umgebung. Unbekannte Felder fallen weg.
 */
export const GRENZEN = {
  startkapital: [100, 10_000_000],
  risikoProTrade: [0.0005, 0.05],
  maxPosition: [0.01, 1],
  maxTradesTag: [1, 100],
  maxPositionen: [1, 20],
  schlussVorEnde: [1, 120],
  spanneMin: [1, 120],
  volumenFaktor: [1, 10],
  z: [0.5, 6],
  fenster: [5, 240],
  zielR: [0.5, 10],
} as const;
const SYMBOL = /^[A-Z][A-Z0-9.]{0,9}$/;
const BROKER: BrokerArt[] = ["simulation", "alpaca-paper", "alpaca-live", "manuell", "ibkr"];

export interface Pruefergebnis { e: AgentEinstellungen; fehler: { feld: string; text: string }[] }

const eur = (v: number) => `${v.toLocaleString("de-DE")} €`;
const pz = (v: number) => `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;

export function pruefeEinstellungen(roh: unknown, opts: { basis?: AgentEinstellungen; erlaubteBroker?: BrokerArt[] } = {}): Pruefergebnis {
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  const basis = opts.basis ?? neueEinstellungen(typeof r.startkapital === "number" ? r.startkapital : 500);
  const fehler: Pruefergebnis["fehler"] = [];
  const f = (feld: string, text: string) => fehler.push({ feld, text });
  const zahl = (k: string, ganz = false): number => {
    const v = k in r ? r[k] : (basis as unknown as Record<string, unknown>)[k];
    if (typeof v !== "number" || !Number.isFinite(v)) { f(k, "Bitte eine Zahl angeben."); return NaN; }
    return ganz ? Math.round(v) : v;
  };
  const im = (k: keyof typeof GRENZEN, v: number, name: string, fmt: (x: number) => string = x => x.toLocaleString("de-DE")) => {
    const [lo, hi] = GRENZEN[k]; if (Number.isFinite(v) && (v < lo || v > hi)) f(k, `${name}: zwischen ${fmt(lo)} und ${fmt(hi)}.`);
  };

  const broker = (typeof r.broker === "string" ? r.broker : basis.broker) as BrokerArt;
  if (!BROKER.includes(broker)) f("broker", "Unbekannter Broker.");
  else if (opts.erlaubteBroker && !opts.erlaubteBroker.includes(broker)) f("broker", broker === "alpaca-live" ? "Handel mit echtem Geld ist auf diesem Server gesperrt." : "Dieser Broker ist noch nicht angebunden.");

  const startkapital = zahl("startkapital"); im("startkapital", startkapital, "Startkapital", eur);
  const tagesziel = zahl("tagesziel"); const tagesverlust = zahl("tagesverlust");
  if (Number.isFinite(tagesziel) && (tagesziel <= 0 || tagesziel > startkapital)) f("tagesziel", "Tagesziel: größer als 0 und höchstens das Startkapital.");
  if (Number.isFinite(tagesverlust) && (tagesverlust <= 0 || tagesverlust > startkapital * 0.5)) f("tagesverlust", `Verlustlimit: größer als 0 und höchstens die Hälfte des Startkapitals (${eur(Math.round(startkapital * 0.5))}).`);
  const risikoProTrade = zahl("risikoProTrade"); im("risikoProTrade", risikoProTrade, "Risiko je Trade", pz);
  const maxPosition = zahl("maxPosition"); im("maxPosition", maxPosition, "Höchstens je Position", pz);
  const maxTradesTag = zahl("maxTradesTag", true); im("maxTradesTag", maxTradesTag, "Trades je Tag");
  const maxPositionen = zahl("maxPositionen", true); im("maxPositionen", maxPositionen, "Positionen gleichzeitig");
  const schlussVorEnde = zahl("schlussVorEnde", true); im("schlussVorEnde", schlussVorEnde, "Schluss vor Handelsende (Minuten)");

  const strategie = (typeof r.strategie === "string" ? r.strategie : basis.strategie) as StrategieTyp;
  if (!(strategie in STRATEGIEN)) f("strategie", "Unbekannte Strategie.");
  const wr = (r.werte && typeof r.werte === "object" ? r.werte : {}) as Record<string, unknown>;
  const werte = { ...basis.werte } as StrategieWerte;
  for (const [k, name] of [["spanneMin", "Eröffnungsspanne"], ["volumenFaktor", "Volumen mindestens"], ["z", "Abweichung mindestens"], ["fenster", "Rückblick"], ["zielR", "Ziel"]] as const) {
    const v = k in wr ? wr[k] : werte[k];
    if (typeof v !== "number" || !Number.isFinite(v)) { f(`werte.${k}`, `${name}: bitte eine Zahl angeben.`); continue; }
    werte[k] = v; im(k, v, name);
  }

  const rohSymbole = Array.isArray(r.symbole) ? r.symbole : basis.symbole;
  const symbole = [...new Set(rohSymbole.filter((x): x is string => typeof x === "string").map(x => x.trim().toUpperCase()).filter(Boolean))];
  const falsch = symbole.filter(x => !SYMBOL.test(x));
  if (!symbole.length) f("symbole", "Mindestens einen Wert angeben.");
  if (symbole.length > 30) f("symbole", "Höchstens 30 Werte.");
  if (falsch.length) f("symbole", `Ungültige Kürzel: ${falsch.join(", ")} (Großbuchstaben, Ziffern, Punkt, höchstens 10 Zeichen).`);

  const name = typeof r.name === "string" ? r.name.trim().slice(0, 60) : basis.name;
  if (!name) f("name", "Bitte einen Namen angeben.");
  const brokerApp = typeof r.brokerApp === "string" ? r.brokerApp.trim().slice(0, 40) : basis.brokerApp;
  let richtung = (r.richtung ?? basis.richtung) as AgentEinstellungen["richtung"]; if (richtung !== "long" && richtung !== "long-short") { f("richtung", "Richtung: long oder long-short."); richtung = "long"; }
  let modus = (r.modus ?? basis.modus) as AgentEinstellungen["modus"]; if (modus !== "vorschlag" && modus !== "auto") { f("modus", "Betriebsart: vorschlag oder auto."); modus = "vorschlag"; }
  if (broker === "manuell") { modus = "vorschlag"; richtung = "long"; }
  const marktlage = typeof r.marktlage === "boolean" ? r.marktlage : basis.marktlage ?? true;

  const e: AgentEinstellungen = { name, broker, ...(brokerApp ? { brokerApp } : {}), startkapital, tagesziel, tagesverlust, risikoProTrade, maxPosition, maxTradesTag, maxPositionen, symbole, strategie, werte, richtung, schlussVorEnde, modus, marktlage };
  return { e, fehler };
}
