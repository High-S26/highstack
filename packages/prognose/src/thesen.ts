import { bis, lies, plusTage, punktAktuell, tageZwischen } from "./indikatoren";
import type { Ereignis, Lagebild } from "./types";

/**
 * Thesen-Baukasten: verbindet Termine und Marktdaten zu begründeten Trading- und Anlageideen, so wie ein guter
 * Marktbericht mehrere Fakten zu einer Aussage verdichtet (z. B. Notenbankentscheid, Zahlen der Schwergewichte und
 * großer Verfall im selben Fenster, dazu steigende Inflation und niedrige eingepreiste Schwankung).
 * Jede These nennt ihre Fakten mit Stand, das Zeitfenster, die betroffenen Märkte, die Umsetzung für den Agenten,
 * Gegenargumente und woran sie scheitert. Das sind Erfahrungswerte und Denkanstöße, keine Empfehlung.
 */
export interface Fakt { text: string; stand?: string }
export interface These {
  id: string;
  titel: string;
  art: "vorsicht" | "chance" | "einordnung";
  kern: string;
  fakten: Fakt[];
  von: string; bis: string;
  maerkte: string[];
  umsetzung: string[];
  gegen: string[];
  widerlegt: string;
  /** 0 bis 1: wie viele Fakten zusammenkommen */
  staerke: number;
}

const SCHWERGEWICHTE = new Set(["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "BRK.B", "JPM", "LLY", "V", "ORCL", "NFLX"]);
const de = (v: number, n = 1) => v.toLocaleString("de-DE", { minimumFractionDigits: n, maximumFractionDigits: n });
const tagDe = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const werktag = (d: string) => { const w = new Date(d + "T12:00:00Z").getUTCDay(); return w !== 0 && w !== 6; };
/** n Werktage ab dem Stichtag (einschließlich) */
function fensterBis(start: string, n: number) { let d = start, k = werktag(start) ? 1 : 0; while (k < n) { d = plusTage(d, 1); if (werktag(d)) k++; } return d; }
/** Wert vor n Tagen aus der Historie (ohne Altersgrenze: es geht um den Verlauf, nicht um Aktualität) */
const wertVor = (r: Lagebild["reihen"], id: string, stichtag: string, tage: number) => bis(r[id], plusTage(stichtag, -tage)).at(-1)?.w ?? null;
const veraenderung = (r: Lagebild["reihen"], id: string, stichtag: string, tage: number) => { const a = lies(r, id, stichtag); const b = wertVor(r, id, stichtag, tage); return a != null && b != null && b !== 0 ? a / b - 1 : null; };

/** Realisierte Schwankung (annualisiert, Prozent) aus den letzten n Tagesrenditen */
export function realisierteSchwankung(p: { d: string; w: number }[] | undefined, stichtag: string, n = 20): number | null {
  const x = bis(p, stichtag).slice(-(n + 1)); if (x.length < n + 1 || tageZwischen(x.at(-1)!.d, stichtag) > 7) return null;
  const r = x.slice(1).map((q, i) => Math.log(q.w / x[i]!.w)); const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(252) * 100;
}

export function thesen(l: Lagebild): These[] {
  const out: These[] = []; const st = l.stichtag; const r = l.reihen;
  const fenster = fensterBis(st, 5); const im = (e: Ereignis) => e.datum >= st && e.datum <= fenster;
  const bald = l.ereignisse.filter(im).sort((a, b) => `${a.datum}${a.zeit ?? "99"}`.localeCompare(`${b.datum}${b.zeit ?? "99"}`));
  const zeitText = (e: Ereignis) => `${tagDe(e.datum)}${e.zeit ? ` ${e.zeit} Uhr` : e.zeitpunkt === "nachboerslich" ? " nach Börsenschluss" : e.zeitpunkt === "vorboerslich" ? " vor Börsenbeginn" : ""}`;
  const fed = bald.find(e => e.art === "zinsentscheid" && e.land === "US");
  const ezb = bald.find(e => e.art === "zinsentscheid" && e.land === "EU");
  const daten = bald.filter(e => e.wichtig && (e.art === "inflation" || e.art === "arbeitsmarkt" || e.art === "konjunktur") && e.land === "US");
  const schwer = bald.filter(e => e.art === "zahlen" && e.symbol && SCHWERGEWICHTE.has(e.symbol));
  const zahlen = bald.filter(e => e.art === "zahlen" && (e.land === "US" || !!e.symbol));
  const verfall = bald.find(e => e.art === "verfall" && e.land === "US" && /Großer Verfall|US-Optionsverfall/.test(e.titel));
  const grossVerfall = verfall && /Großer Verfall/.test(verfall.titel);
  const vix = punktAktuell(r, "vix", st); const rv = realisierteSchwankung(r.sp500, st);

  // 1. Ereignis-Cluster: mehrere große Termine im selben Fenster
  const bausteine = [fed && `Fed-Zinsentscheid ${zeitText(fed)}`, ezb && `EZB-Zinsentscheid ${zeitText(ezb)}`, ...daten.slice(0, 3).map(e => `${e.titel} ${zeitText(e)}`), schwer.length ? `Zahlen von ${[...new Set(schwer.map(e => e.symbol))].join(", ")} (${[...new Set(schwer.map(e => tagDe(e.datum)))].join(", ")})` : null, verfall && `${grossVerfall ? "Großer Verfall" : "Optionsverfall"} ${tagDe(verfall.datum)}`].filter((x): x is string => !!x);
  const kategorien = [fed || ezb, daten.length, schwer.length, verfall].filter(Boolean).length;
  if (kategorien >= 3 || (kategorien >= 2 && bausteine.length >= 3)) {
    const fakten: Fakt[] = bausteine.map(text => ({ text }));
    if (vix) fakten.push({ text: `VIX bei ${de(vix.w)}`, stand: vix.d });
    out.push({ id: "cluster", titel: `Ereignisfenster ${tagDe(st)} bis ${tagDe(fenster)}`, art: "vorsicht", kern: "Mehrere marktbewegende Termine fallen in wenige Tage. Jeder für sich ist eingeplant, zusammen können sie Bewegungen verstärken; Richtungswetten vor den Terminen sind Münzwürfe.",
      fakten, von: st, bis: fenster, maerkte: ["S&P 500", "Nasdaq 100", ...(schwer.length ? [...new Set(schwer.map(e => e.symbol!))] : [])],
      umsetzung: ["Positionsgrößen im Fenster kleiner halten; der Agent pausiert um die einzelnen Termine.", "Nach einem Termin die Richtung der ersten 15 bis 30 Minuten abwarten (Strategie „Momentum“) statt die erste Zuckung zu handeln.", "Keine Positionen über Zahlen oder Entscheide halten (der Agent schließt vor Handelsschluss)."],
      gegen: ["Ist viel eingepreist, bleiben große Bewegungen oft aus (Ereignis „verpufft“).", ...(vix && vix.w > 25 ? ["Der VIX ist schon hoch: die Vorsicht steckt bereits in den Preisen."] : [])],
      widerlegt: "Die realisierte Schwankung bleibt nach den Terminen unter der eingepreisten und die Kurse driften ohne Lücken.", staerke: Math.min(1, 0.3 + 0.2 * kategorien) });
  }

  // 2. Zins-Überraschungsrisiko vor Notenbankentscheiden
  const nb = fed ?? l.ereignisse.find(e => e.art === "zinsentscheid" && e.land === "US" && e.datum >= st && e.datum <= plusTage(st, 10));
  if (nb) {
    const fz = lies(r, "leitzins-us", st) ?? bis(r["leitzins-us"], st).at(-1)?.w ?? null, fz90 = wertVor(r, "leitzins-us", st, 90);
    const inf = lies(r, "inflation-us", st), inf3 = wertVor(r, "inflation-us", st, 95);
    const oel = veraenderung(r, "oel", st, 60); const al = lies(r, "arbeitslos-us", st), al6 = wertVor(r, "arbeitslos-us", st, 180);
    const falke: Fakt[] = [], taube: Fakt[] = [];
    if (fz != null && fz90 != null && fz > fz90 + 0.05) falke.push({ text: `Leitzins zuletzt erhöht (${de(fz90, 2)} → ${de(fz, 2)} %)` });
    if (fz != null && fz90 != null && fz < fz90 - 0.05) taube.push({ text: `Leitzins zuletzt gesenkt (${de(fz90, 2)} → ${de(fz, 2)} %)` });
    if (inf != null && inf3 != null && inf > inf3 + 0.2) falke.push({ text: `Inflation steigt (${de(inf3)} → ${de(inf)} %)`, stand: punktAktuell(r, "inflation-us", st)?.d });
    if (inf != null && inf3 != null && inf < inf3 - 0.2) taube.push({ text: `Inflation sinkt (${de(inf3)} → ${de(inf)} %)`, stand: punktAktuell(r, "inflation-us", st)?.d });
    if (oel != null && oel > 0.1) falke.push({ text: `Ölpreis +${de(oel * 100, 0)} % in 60 Tagen` });
    if (al != null && al6 != null && al > al6 + 0.3) taube.push({ text: `Arbeitslosenquote steigt (${de(al6)} → ${de(al)} %)` });
    const seite = falke.length >= 2 && falke.length > taube.length ? "falke" : taube.length >= 2 && taube.length > falke.length ? "taube" : null;
    if (seite) {
      const f = seite === "falke" ? falke : taube;
      out.push({ id: "zins", titel: seite === "falke" ? `Falken-Risiko vor der Fed (${zeitText(nb)})` : `Tauben-Chance vor der Fed (${zeitText(nb)})`, art: seite === "falke" ? "vorsicht" : "chance",
        kern: seite === "falke" ? "Die Daten sprechen eher für eine straffere Fed. Erwartet der Markt eine Pause, ist die Überraschung einseitig nach unten verteilt: Ein vorsichtiger Ton reicht für Druck auf teure Wachstumswerte." : "Die Daten sprechen für eine lockerere Fed. Rechnet der Markt noch mit Zurückhaltung, kann ein weicher Ton Zinsen senken und Wachstumswerte stützen.",
        fakten: [...f, { text: `${nb.titel} ${zeitText(nb)}` }, { text: "Markterwartung (z. B. CME FedWatch) vor dem Entscheid prüfen: je klarer eingepreist, desto größer die Wirkung einer Abweichung." }],
        von: st, bis: nb.datum, maerkte: ["Nasdaq 100", "US-Staatsanleihen", "US-Dollar", "Gold"],
        umsetzung: seite === "falke" ? ["Vor dem Entscheid keine großen Long-Positionen in zinssensiblen Wachstumswerten.", "Nach dem Entscheid: fällt der Markt in den ersten 30 Minuten der Pressekonferenz, setzt sich die Bewegung oft fort (Momentum, auch Short)."] : ["Nach dem Entscheid Ausbrüche in zinssensiblen Werten bevorzugen (Momentum).", "Vor dem Entscheid trotzdem klein bleiben: die Richtung ist erst danach klar."],
        gegen: ["Die Fed entscheidet nach ihrer Prognose, nicht nach dem letzten Datenpunkt.", "Ist die Abweichung längst eingepreist, bleibt die Wirkung klein."],
        widerlegt: seite === "falke" ? "Die Fed bestätigt die Pause ohne Hinweis auf weitere Schritte, und die Renditen langer Anleihen fallen." : "Die Fed betont Inflationsrisiken, und die Renditen steigen.",
        staerke: Math.min(1, 0.25 * f.length + 0.2) });
    }
  }

  // 3. Eingepreiste gegen tatsächliche Schwankung
  if (vix && rv != null && tageZwischen(vix.d, st) <= 7) {
    if (vix.w < rv - 2) out.push({ id: "vola-billig", titel: "Schwankung unterschätzt", art: "vorsicht", kern: `Der Markt preist weniger Schwankung ein (VIX ${de(vix.w)}) als zuletzt tatsächlich auftrat (${de(rv)} % auf 20 Tage). Solche Phasen enden oft mit einem Sprung der eingepreisten Schwankung.`,
      fakten: [{ text: `VIX ${de(vix.w)}`, stand: vix.d }, { text: `Realisierte Schwankung S&P 500, 20 Tage: ${de(rv)} %` }], von: st, bis: fensterBis(st, 10), maerkte: ["S&P 500", "VIX"],
      umsetzung: ["Stopps nicht zu eng setzen: die tatsächliche Bewegung ist größer als eingepreist.", "Absicherungen sind gerade vergleichsweise günstig (außerhalb des Agenten).", "Ausbruch-Strategien profitieren von zunehmender Schwankung."],
      gegen: ["Nach einem Schock sinkt die realisierte Schwankung oft schnell wieder."], widerlegt: "Die realisierte Schwankung fällt unter den VIX.", staerke: Math.min(1, (rv - vix.w) / 10 + 0.3) });
    else if (vix.w > rv + 8) out.push({ id: "angst", titel: "Angst über der tatsächlichen Bewegung", art: "chance", kern: `Der VIX (${de(vix.w)}) liegt deutlich über der tatsächlichen Schwankung (${de(rv)} %). Übertriebene Absicherung baut sich oft ab; das stützt Kurse (Rückkehr zum Mittelwert).`,
      fakten: [{ text: `VIX ${de(vix.w)}`, stand: vix.d }, { text: `Realisierte Schwankung S&P 500, 20 Tage: ${de(rv)} %` }], von: st, bis: fensterBis(st, 10), maerkte: ["S&P 500"],
      umsetzung: ["Strategie „Rückkehr zum Mittelwert“ passt besser als Ausbruch.", "Positionsgröße trotzdem nach dem Marktumfeld (der hohe VIX verkleinert sie automatisch)."],
      gegen: ["Ein hoher VIX kann ein kommendes Ereignis vorwegnehmen (siehe Termine)."], widerlegt: "Die realisierte Schwankung steigt auf das Niveau des VIX.", staerke: Math.min(1, (vix.w - rv) / 15 + 0.3) });
  }

  // 4. Verfall
  if (verfall) out.push({ id: "verfall", titel: `${grossVerfall ? "Großer Verfall" : "Optionsverfall"} am ${tagDe(verfall.datum)}`, art: "einordnung",
    kern: grossVerfall ? "Optionen, Futures und Indexanpassungen laufen gleichzeitig aus. Bis zum Verfall kleben Kurse oft an großen Basispreisen; zum Schluss steigt das Volumen stark, danach wird die Bewegung häufig freier." : "Bis zum Verfall kleben Kurse großer Werte oft an viel gehandelten Basispreisen; danach fallen Absicherungen weg und die Bewegung wird freier.",
    fakten: [{ text: `${verfall.titel} (${tagDe(verfall.datum)})` }], von: plusTage(verfall.datum, -2), bis: plusTage(verfall.datum, 3), maerkte: ["S&P 500", "Einzelwerte mit großem Optionsvolumen"],
    umsetzung: ["Am Verfallstag keine Ausbrüche in der letzten Stunde handeln (der Agent schließt vorher).", "In der Woche nach dem Verfall Ausbrüche ernster nehmen."], gegen: ["Der Effekt ist eine Tendenz, kein Gesetz; Nachrichten überlagern ihn."], widerlegt: "Große Bewegungen schon vor dem Verfall ohne Rückkehr.", staerke: grossVerfall ? 0.5 : 0.3 });

  // 5. Zahlensaison
  if (zahlen.length >= 10) out.push({ id: "zahlensaison", titel: `Zahlensaison: ${zahlen.length} US-Quartalszahlen bis ${tagDe(fenster)}`, art: "chance",
    kern: "In der Zahlensaison bewegen sich Einzelwerte stärker als der Index. Deutliche Reaktionen auf Zahlen setzen sich oft über Tage fort (Drift nach Zahlen).",
    fakten: [{ text: `${zahlen.length} US-Unternehmen legen Zahlen vor, davon ${schwer.length} Index-Schwergewichte (${[...new Set(schwer.map(e => e.symbol))].join(", ")})` }], von: st, bis: fenster, maerkte: ["Einzelwerte"],
    umsetzung: ["Am Tag nach Zahlen: Kurslücke mit hohem Volumen und Halten über der ersten halben Stunde spricht für Fortsetzung (Momentum, relative Stärke).", "Werte mit Zahlen am Abend tagsüber nicht neu kaufen (Regel des Agenten)."],
    gegen: ["Bei Schwergewichten dominiert oft der Gesamtmarkt die Reaktion."], widerlegt: "Kurslücken nach Zahlen werden am selben Tag geschlossen.", staerke: 0.4 });

  // 6. Ölpreis- und Dollarbewegungen
  const oel = veraenderung(r, "oel", st, 30); const ol = punktAktuell(r, "oel", st);
  if (oel != null && Math.abs(oel) > 0.12 && ol) out.push({ id: "oel", titel: oel > 0 ? "Ölpreisschub" : "Ölpreisrutsch", art: "einordnung",
    kern: oel > 0 ? "Steigendes Öl stützt Energiewerte, belastet Fluglinien, Chemie und Konsum und erhöht den Inflationsdruck (Zinsen)." : "Fallendes Öl entlastet Konsum, Transport und Inflation; Energiewerte leiden.",
    fakten: [{ text: `Brent ${de(ol.w, 1)} $, ${oel > 0 ? "+" : ""}${de(oel * 100, 0)} % in 30 Tagen`, stand: ol.d }], von: st, bis: fensterBis(st, 10), maerkte: oel > 0 ? ["Energie (XOM, CVX)", "Fluglinien", "Konsum"] : ["Energie", "Transport", "Konsum"],
    umsetzung: [oel > 0 ? "Relative Stärke bei Energiewerten beobachten (Strategie „relative Stärke“ gegen SPY)." : "Konsum- und Transportwerte auf relative Stärke prüfen."], gegen: ["Ölpreise drehen bei politischen Nachrichten abrupt."], widerlegt: "Der Ölpreis fällt unter den Stand vor dem Schub zurück.", staerke: Math.min(1, Math.abs(oel) * 3) });
  const usd = veraenderung(r, "eurusd", st, 30); const fx = punktAktuell(r, "eurusd", st);
  if (usd != null && Math.abs(usd) > 0.03 && fx) out.push({ id: "dollar", titel: usd > 0 ? "Euro stark, Dollar schwach" : "Dollar stark", art: "einordnung",
    kern: usd > 0 ? "Für Anleger in Euro mindert ein schwacher Dollar die Erträge aus US-Aktien; US-Exporteure profitieren." : "Ein starker Dollar erhöht für Euro-Anleger die Erträge aus US-Werten, belastet aber US-Konzerne mit viel Auslandsumsatz.",
    fakten: [{ text: `1 € = ${de(fx.w, 4)} $, ${usd > 0 ? "+" : ""}${de(usd * 100, 1)} % in 30 Tagen`, stand: fx.d }], von: st, bis: fensterBis(st, 10), maerkte: ["US-Aktien aus Euro-Sicht"],
    umsetzung: ["Bei „Eigene App“ (Konto in Euro) verändert der Wechselkurs das Ergebnis; Stopps und Ziele rechnet der Agent bereits in Euro um."], gegen: ["Währungen schwanken innerhalb eines Tages kaum genug, um Intraday-Trades zu prägen."], widerlegt: "Der Wechselkurs kehrt auf den Stand vor 30 Tagen zurück.", staerke: Math.min(1, Math.abs(usd) * 10) });

  // 7. Kalendereffekte (statistische Tendenzen, schwach)
  const monatsende = bald.find(e => /Letzter Handelstag/.test(e.titel));
  if (monatsende && tageZwischen(st, monatsende.datum) <= 5) out.push({ id: "monatswechsel", titel: `Monatswechsel (${monatsende.titel.replace("Letzter Handelstag des ", "")}ende ${tagDe(monatsende.datum)})`, art: "einordnung",
    kern: "Um den Monatswechsel fließt neues Geld in Fonds und Sparpläne; der letzte und die ersten Handelstage waren historisch überdurchschnittlich. Am Quartalsende kommen Umschichtungen der Fonds dazu.",
    fakten: [{ text: `${monatsende.titel}: ${tagDe(monatsende.datum)}` }], von: monatsende.datum, bis: fensterBis(monatsende.datum, 4), maerkte: ["Breiter Markt"],
    umsetzung: ["Leichte Bevorzugung von Long-Signalen in diesen Tagen; keine eigene Regel des Agenten."], gegen: ["Schwacher, gut bekannter Effekt; in vielen Jahren nicht vorhanden."], widerlegt: "—", staerke: 0.2 });
  const feiertag = bald.find(e => e.art === "feiertag" && e.land === "US" && /geschlossen/.test(e.titel));
  if (feiertag) out.push({ id: "feiertag", titel: `${feiertag.titel} (${tagDe(feiertag.datum)})`, art: "einordnung",
    kern: "Vor US-Feiertagen ist das Volumen oft dünn und die Stimmung freundlich; dünne Märkte reagieren aber stärker auf Nachrichten.",
    fakten: [{ text: `${feiertag.titel}: ${tagDe(feiertag.datum)}` }], von: plusTage(feiertag.datum, -1), bis: feiertag.datum, maerkte: ["US-Aktien"],
    umsetzung: ["Am Feiertag handelt der Agent nicht; am Vortag kleinere Positionen wegen dünnem Volumen."], gegen: ["Schwacher Effekt."], widerlegt: "—", staerke: 0.2 });
  return out.sort((a, b) => b.staerke - a.staerke);
}
