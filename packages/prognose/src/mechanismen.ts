import { bis, gleitend, lies, plusTage, rsi, tageZwischen } from "./indikatoren";
import type { Lagebild, Mechanismus, Punkt, Wirkung, Ziel } from "./types";

/**
 * Wirkungsketten: „Wenn diese Daten so stehen, dann neigt dieses Ziel in diese Richtung.“
 * Jede Kette hat eine theoretische Grundlage und ein Ausgangsgewicht. Ob sie trägt,
 * entscheidet die Bilanz der Prognosen (pruefung.ts), nicht die Theorie.
 */
const fmt = (v: number, n = 1) => v.toLocaleString("de-DE", { maximumFractionDigits: n, minimumFractionDigits: n });
const w = (mechanismus: string, ziel: Ziel, richtung: 1 | -1, staerke: number, horizontTage: number, grund: string, symbol?: string): Wirkung =>
  ({ mechanismus, ziel, richtung, staerke: Math.max(0, Math.min(1, staerke)), horizontTage, grund, ...(symbol ? { symbol } : {}) });
const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const fenster = (l: Lagebild, id: string, tage: number): Punkt[] => bis(l.reihen[id], l.stichtag).filter(p => p.d >= plusTage(l.stichtag, -tage));

export const MECHANISMEN: Mechanismus[] = [
  {
    id: "zinskurve", name: "Inverse Zinskurve", gewicht: 0.8, braucht: ["kurve"],
    theorie: "Liegen kurze Zinsen über langen, erwartet der Markt Zinssenkungen wegen Abschwung; die Inversion ging den meisten US-Rezessionen 6–18 Monate voraus (Estrella/Mishkin). Das eigentliche Warnsignal ist oft die Wiederversteilung.",
    wirkung(l) {
      const k = lies(l.reihen, "kurve", l.stichtag); if (k == null) return [];
      const tief = Math.min(...fenster(l, "kurve", 540).map(p => p.w), k);
      if (k < 0) return [w(this.id, "aktien-us", -1, 0.35 + Math.min(0.4, -k), 365, `Zinskurve invertiert (${fmt(k, 2)} %-Pkt.)`)];
      if (tief < -0.25 && k < 0.75) return [w(this.id, "aktien-us", -1, 0.7, 270, `Zinskurve nach Inversion (Tief ${fmt(tief, 2)}) wieder positiv: Phase vor früheren Rezessionen`)];
      return [];
    },
  },
  {
    id: "geldpolitik", name: "Zinswende der Notenbank", gewicht: 0.6, braucht: ["leitzins-us"],
    theorie: "„Don't fight the Fed“: Senkungen verbilligen Kapital und heben Bewertungen, Erhöhungen dämpfen sie, jeweils mit Verzögerung.",
    wirkung(l) {
      const j = lies(l.reihen, "leitzins-us", l.stichtag), v = lies(l.reihen, "leitzins-us", l.stichtag, 180); if (j == null || v == null) return [];
      const d = j - v;
      if (d <= -0.5) return [w(this.id, "aktien-us", 1, Math.min(1, -d / 1.5), 180, `Fed hat in 6 Monaten um ${fmt(-d, 2)} %-Pkt. gesenkt`)];
      if (d >= 0.75) return [w(this.id, "aktien-us", -1, Math.min(1, d / 2), 180, `Fed hat in 6 Monaten um ${fmt(d, 2)} %-Pkt. erhöht`)];
      return [];
    },
  },
  {
    id: "zins-immobilie", name: "Kapitalmarktzins und Immobilienwert", gewicht: 0.9, braucht: ["bund10j"],
    theorie: "Ertragswert = Reinertrag / Liegenschaftszins. Steigt der Kapitalmarktzins, folgen Ankaufsrenditen mit Verzögerung und Werte sinken; fällt er, steigen sie (2022/23 bis zu −20 %).",
    wirkung(l) {
      const id = l.reihen["bund10j"]?.length ? "bund10j" : "bauzins";
      const j = lies(l.reihen, id, l.stichtag), v = lies(l.reihen, id, l.stichtag, 365); if (j == null || v == null) return [];
      const d = j - v; if (Math.abs(d) < 0.4) return [];
      return [w(this.id, "immo-wert", d > 0 ? -1 : 1, Math.min(1, Math.abs(d) / 1.5), 365, `${id === "bund10j" ? "Bundrendite" : "Bauzins"} in 12 Monaten ${d > 0 ? "+" : "−"}${fmt(Math.abs(d), 2)} %-Pkt.`)];
    },
  },
  {
    id: "einkaufsmanager", name: "Konjunkturzyklus (Einkaufsmanager)", gewicht: 0.6, braucht: ["pmi-us", "pmi-ez"],
    theorie: "Einkaufsmanagerindizes laufen der Produktion voraus. Aktien drehen meist, wenn der Index unter 50 wieder steigt (Frühzyklus), und schwächeln, wenn er über 50 kippt.",
    wirkung(l) {
      const out: Wirkung[] = [];
      for (const [id, ziel, land] of [["pmi-us", "aktien-us", "USA"], ["pmi-ez", "aktien-eu", "Eurozone"]] as const) {
        const j = lies(l.reihen, id, l.stichtag), v = lies(l.reihen, id, l.stichtag, 90); if (j == null || v == null) continue;
        const d = j - v;
        if (j < 50 && d > 1) out.push(w(this.id, ziel, 1, 0.5 + Math.min(0.3, d / 10), 180, `Einkaufsmanager ${land} unter 50, aber steigend (${fmt(j)}; ${fmt(d)} in 3 Monaten): Frühzyklus`));
        else if (j < 50 && d < -1) out.push(w(this.id, ziel, -1, 0.5, 180, `Einkaufsmanager ${land} unter 50 und fallend (${fmt(j)})`));
        else if (j >= 50 && d < -1.5) out.push(w(this.id, ziel, -1, 0.35, 180, `Einkaufsmanager ${land} über 50, aber fallend (${fmt(j)}): Spätzyklus`));
        else if (j >= 50 && d > 1) out.push(w(this.id, ziel, 1, 0.3, 180, `Einkaufsmanager ${land} über 50 und steigend (${fmt(j)})`));
      }
      return out;
    },
  },
  {
    id: "inflationsdruck", name: "Inflationstrend", gewicht: 0.6, braucht: ["inflation-us", "inflation-ez"],
    theorie: "Steigende Inflation über dem Ziel zwingt Notenbanken zu höheren Zinsen: lange Renditen steigen, Bewertungen sinken. Sinkende Inflation öffnet Raum für Senkungen.",
    wirkung(l) {
      const out: Wirkung[] = [];
      const j = lies(l.reihen, "inflation-us", l.stichtag), v = lies(l.reihen, "inflation-us", l.stichtag, 90);
      if (j != null && v != null) {
        const d = j - v;
        if (j > 3 && d > 0.3) out.push(w(this.id, "zins-lang", 1, 0.5, 180, `US-Inflation ${fmt(j)} % und steigend`), w(this.id, "aktien-us", -1, 0.3, 180, `US-Inflation ${fmt(j)} % und steigend`));
        else if (j > 2 && d < -0.4) out.push(w(this.id, "zins-lang", -1, 0.35, 180, `US-Inflation fällt (${fmt(j)} %, ${fmt(d)} in 3 Monaten)`), w(this.id, "aktien-us", 1, 0.2, 180, `US-Inflation fällt`));
      }
      const e = lies(l.reihen, "inflation-ez", l.stichtag), ev = lies(l.reihen, "inflation-ez", l.stichtag, 90);
      if (e != null && ev != null) {
        if (e > 3 && e - ev > 0.3) out.push(w(this.id, "immo-wert", -1, 0.3, 365, `Inflation Eurozone ${fmt(e)} % und steigend: EZB muss straffen`));
        else if (e < 2.5 && e - ev < -0.3) out.push(w(this.id, "immo-wert", 1, 0.25, 365, `Inflation Eurozone fällt (${fmt(e)} %): Raum für niedrigere Zinsen`));
      }
      return out;
    },
  },
  {
    id: "sahm", name: "Sahm-Regel (Arbeitsmarkt)", gewicht: 0.8, braucht: ["arbeitslos-us"],
    theorie: "Steigt der 3-Monats-Schnitt der Arbeitslosenquote um 0,5 Punkte über sein Tief der letzten 12 Monate, hat die Rezession historisch begonnen (Claudia Sahm).",
    wirkung(l) {
      const p = bis(l.reihen["arbeitslos-us"], l.stichtag, 7); if (p.length < 15 || lies(l.reihen, "arbeitslos-us", l.stichtag) == null) return [];
      const schnitt = (i: number) => (p[i]!.w + p[i - 1]!.w + p[i - 2]!.w) / 3;
      const n = p.length - 1; const jetzt = schnitt(n); let tief = Infinity;
      for (let i = n - 12; i < n; i++) if (i >= 2) tief = Math.min(tief, schnitt(i));
      const d = jetzt - tief;
      if (d >= 0.5) return [w(this.id, "aktien-us", -1, 0.7, 270, `Sahm-Regel ausgelöst (+${fmt(d, 2)} Punkte)`)];
      if (d >= 0.3) return [w(this.id, "aktien-us", -1, 0.3, 270, `Arbeitslosigkeit zieht an (+${fmt(d, 2)} Punkte, Warnstufe)`)];
      return [];
    },
  },
  {
    id: "kreditstress", name: "Kreditaufschläge", gewicht: 0.7, braucht: ["hy-spread"],
    theorie: "Steigende Risikoaufschläge zeigen, dass Kapitalgeber Ausfälle fürchten; Aktien folgen meist. Nach Stressspitzen läuft die Entspannung oft voraus.",
    wirkung(l) {
      const j = lies(l.reihen, "hy-spread", l.stichtag), v = lies(l.reihen, "hy-spread", l.stichtag, 90); if (j == null || v == null) return [];
      const d = j - v;
      if (d >= 1) return [w(this.id, "aktien-us", -1, Math.min(1, 0.4 + d / 4), 90, `Hochzins-Aufschlag +${fmt(d, 2)} %-Pkt. in 3 Monaten`), w(this.id, "volatilitaet", 1, 0.6, 30, "Kreditstress")];
      if (j > 6 && d <= -0.75) return [w(this.id, "aktien-us", 1, 0.45, 90, `Kreditstress lässt nach (${fmt(j, 2)}, ${fmt(d, 2)} in 3 Monaten)`)];
      return [];
    },
  },
  {
    id: "trend", name: "Trend (200-Tage-Linie)", gewicht: 0.5, braucht: ["sp500", "dax"],
    theorie: "Zeitreihen-Momentum: Märkte über ihrem 200-Tage-Schnitt steigen häufiger weiter, darunter sind Verluste größer (Faber; Moskowitz/Ooi/Pedersen).",
    wirkung(l) {
      const out: Wirkung[] = [];
      for (const [id, ziel, name] of [["sp500", "aktien-us", "S&P 500"], ["dax", "aktien-eu", "DAX"]] as const) {
        const p = bis(l.reihen[id], l.stichtag); const s = gleitend(p, 200); const k = p.at(-1)?.w; if (s == null || k == null) continue;
        if (tageZwischen(p.at(-1)!.d, l.stichtag) > 7) continue;
        const a = k / s - 1;
        if (a > 0.02) out.push(w(this.id, ziel, 1, Math.min(0.6, 0.25 + a * 2), 90, `${name} ${fmt(a * 100)} % über der 200-Tage-Linie`));
        else if (a < -0.02) out.push(w(this.id, ziel, -1, Math.min(0.7, 0.3 - a * 3), 90, `${name} ${fmt(-a * 100)} % unter der 200-Tage-Linie`));
      }
      return out;
    },
  },
  {
    id: "angst", name: "Angst und Sorglosigkeit (VIX)", gewicht: 0.5, braucht: ["vix"],
    theorie: "Volatilität kehrt zum Mittel zurück. Panikspitzen (VIX über 30) waren oft gute Einstiegszeitpunkte; sehr niedrige Werte gehen Schwankungsanstiegen voraus.",
    wirkung(l) {
      const v = lies(l.reihen, "vix", l.stichtag); if (v == null) return [];
      if (v > 30) return [w(this.id, "aktien-us", 1, Math.min(0.7, 0.3 + (v - 30) / 30), 90, `VIX ${fmt(v)}: Panikniveau`), w(this.id, "volatilitaet", -1, 0.6, 30, `VIX ${fmt(v)} weit über dem Mittel`)];
      if (v < 13) return [w(this.id, "volatilitaet", 1, 0.45, 60, `VIX ${fmt(v)}: Sorglosigkeit`)];
      return [];
    },
  },
  {
    id: "ueberkauft", name: "Überkauft und überverkauft", gewicht: 0.35, braucht: ["sp500", "dax"],
    theorie: "Kurzfristige Übertreibungen (RSI über 70 bzw. unter 30, Kurs außerhalb der Bollinger-Bänder) bilden sich häufig zurück; schwach und nur über Tage bis wenige Wochen.",
    wirkung(l) {
      const out: Wirkung[] = [];
      for (const [id, ziel, name] of [["sp500", "aktien-us", "S&P 500"], ["dax", "aktien-eu", "DAX"]] as const) {
        const r = rsi(bis(l.reihen[id], l.stichtag)); if (r == null) continue;
        if (r > 75) out.push(w(this.id, ziel, -1, Math.min(0.6, (r - 70) / 20), 14, `${name} RSI ${fmt(r, 0)}: überkauft`));
        else if (r < 25) out.push(w(this.id, ziel, 1, Math.min(0.6, (30 - r) / 20), 14, `${name} RSI ${fmt(r, 0)}: überverkauft`));
      }
      return out;
    },
  },
  {
    id: "ereignisse", name: "Ereignisse und erzwungene Flüsse", gewicht: 0.4, braucht: [],
    theorie: "„Buy the rumor, sell the news“ vor Zahlen und Konferenzen; Indexaufnahmen erzwingen Käufe vor dem Stichtag; Lockup-Enden bringen Angebot; Termine wie Zinsentscheide erhöhen die Schwankung.",
    wirkung(l) {
      const out: Wirkung[] = [];
      for (const e of l.ereignisse) {
        const t = tageZwischen(l.stichtag, e.datum);
        if (e.symbol) {
          if (e.art === "index-aufnahme" && t >= 0 && t <= 10) out.push(w(this.id, "einzelwert", 1, 0.45, Math.max(1, t), `${e.symbol}: Indexaufnahme am ${tagDe(e.datum)}, Indexfonds müssen kaufen`, e.symbol));
          if (e.art === "index-aufnahme" && t < 0 && t >= -3) out.push(w(this.id, "einzelwert", -1, 0.3, 10, `${e.symbol}: nach Indexaufnahme lassen erzwungene Käufe nach`, e.symbol));
          if (e.art === "lockup-ende" && t >= -2 && t <= 20) out.push(w(this.id, "einzelwert", -1, 0.45, Math.max(5, t + 5), `${e.symbol}: Haltefrist endet am ${tagDe(e.datum)}, zusätzliches Angebot`, e.symbol));
          if ((e.art === "zahlen" || e.art === "sonstiges") && t > 0 && t <= 10) out.push(w(this.id, "einzelwert", 1, 0.2, t, `${e.symbol}: Vorlauf vor „${e.titel}“`, e.symbol));
          if ((e.art === "zahlen" || e.art === "sonstiges") && t <= 0 && t >= -2) out.push(w(this.id, "einzelwert", -1, 0.2, 5, `${e.symbol}: nach „${e.titel}“ oft Gewinnmitnahmen`, e.symbol));
          if (e.art === "ipo" && t <= 0 && t >= -5) out.push(w(this.id, "einzelwert", 1, 0.25, 10, `${e.symbol}: frisch gelistet, Nachkäufe nicht zugeteilter Anleger`, e.symbol));
        } else if (e.wichtig && t >= 0 && t <= 2) out.push(w(this.id, "volatilitaet", 1, 0.4, 3, `${e.titel} am ${tagDe(e.datum)}`));
      }
      return out;
    },
  },
];

export const mechanismus = (id: string) => MECHANISMEN.find(m => m.id === id);
/** Welche Ketten mangels Daten nicht rechnen können */
export const fehlendeDaten = (l: Lagebild) => MECHANISMEN.filter(m => m.braucht.length && m.braucht.every(id => lies(l.reihen, id, l.stichtag) == null)).map(m => ({ mechanismus: m.id, name: m.name, braucht: m.braucht }));
