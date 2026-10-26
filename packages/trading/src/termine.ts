/**
 * Wirtschaftskalender im Intraday-Handel. Termine stehen in deutscher Ortszeit; gehandelt wird nach New Yorker Zeit
 * (09:30 bis 16:00). Die Umrechnung beachtet die Zeitumstellung beider Länder (Ende Oktober und Anfang März liegen
 * Wochen, in denen der Abstand nur fünf statt sechs Stunden beträgt).
 *
 * Regeln (Erfahrungswerte, keine Garantie):
 * - Wichtige US-Daten und Zinsentscheide während der Handelszeit: keine neuen Einstiege kurz davor bis kurz danach;
 *   der erste Ausschlag nach Daten ist oft unruhig und dreht. Bei Zinsentscheiden bis nach der Pressekonferenz.
 * - Wichtige Daten vor Handelsbeginn (z. B. 08:30 New York): die Eröffnung springt; die ersten Minuten abwarten.
 * - Unternehmenszahlen vor Handelsbeginn: Kurslücke und hohe Schwankung, halbe Positionsgröße; Momentum der ersten
 *   30 Minuten ist an solchen Tagen am aussagekräftigsten.
 * - Zahlen nach Handelsschluss: in der letzten Stunde keine neuen Einstiege in diesen Wert (der Agent schließt ohnehin
 *   vor Schluss; neue Einstiege kurz vor Zahlen sind Glücksspiel). Am Folgetag wie Zahlen vor Handelsbeginn.
 */
export interface Kalendertermin { datum: string; zeit?: string; zeitpunkt?: "vorboerslich" | "nachboerslich"; titel: string; art: string; symbol?: string; wichtig?: boolean; land?: string; prognose?: string; vorwert?: string }
export interface Pause { von: number; bis: number; titel: string }
export interface Werteregel { faktor: number; keinEinstiegAb?: number; text: string }
export interface Idee { titel: string; text: string; symbol?: string; zeitDe?: string; zeitNy?: string }
export interface Terminlage { datum: string; pausen: Pause[]; werte: Record<string, Werteregel>; ideen: Idee[]; heute: (Kalendertermin & { zeitNy?: string; nyMinute?: number })[] }

/** Index-Schwergewichte: deren Zahlen bewegen den Gesamtmarkt */
const SCHWERGEWICHTE = new Set(["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "AVGO", "BRK.B", "JPM", "LLY", "V", "ORCL", "NFLX"]);
export const TERMIN_PAUSE = { vorher: 10, nachher: 15, zinsNachher: 45, eroeffnung: 10, schlussStunde: 330 } as const;

/** Offset einer Zeitzone zu UTC in Minuten an einem Zeitpunkt */
function versatz(zone: string, utc: number): number {
  const t = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(utc)).map(p => [p.type, p.value]));
  return (Date.UTC(Number(t.year), Number(t.month) - 1, Number(t.day), Number(t.hour) % 24, Number(t.minute)) - utc) / 60000;
}
/** Deutsche Ortszeit (Datum, HH:MM) → Minuten seit 09:30 New York am selben Tag; dazu die New Yorker Uhrzeit */
export function nyMinute(datum: string, zeit: string): { minute: number; zeitNy: string } {
  const [j, m, d] = datum.split("-").map(Number) as [number, number, number]; const [h, mi] = zeit.split(":").map(Number) as [number, number];
  const lokal = Date.UTC(j, m - 1, d, h, mi);
  const utc = lokal - versatz("Europe/Berlin", lokal) * 60000;
  const ny = utc + versatz("America/New_York", utc) * 60000; const nd = new Date(ny);
  const minuteNy = nd.getUTCHours() * 60 + nd.getUTCMinutes() + (Date.UTC(nd.getUTCFullYear(), nd.getUTCMonth(), nd.getUTCDate()) - Date.UTC(j, m - 1, d)) / 60000;
  return { minute: minuteNy - (9 * 60 + 30), zeitNy: `${String(nd.getUTCHours()).padStart(2, "0")}:${String(nd.getUTCMinutes()).padStart(2, "0")}` };
}
const vortag = (datum: string) => { const d = new Date(datum + "T12:00:00Z"); do d.setUTCDate(d.getUTCDate() - 1); while ([0, 6].includes(d.getUTCDay())); return d.toISOString().slice(0, 10); };
const uhr = (m: number) => { const x = 9 * 60 + 30 + m; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

/** Terminlage für einen Handelstag (Datum in New York) und die beobachteten Werte */
export function terminlage(termine: Kalendertermin[], datum: string, symbole: string[]): Terminlage {
  const lage: Terminlage = { datum, pausen: [], werte: {}, ideen: [], heute: [] };
  const beobachtet = new Set(symbole.map(s => s.toUpperCase())); const gestern = vortag(datum);
  const mitZeit = (t: Kalendertermin) => t.zeit ? nyMinute(t.datum, t.zeit) : null; const weitere: string[] = [];
  // gleicher marktweiter Termin aus zwei Quellen nur einmal (gleiche Art, Uhrzeit und Land)
  termine = termine.filter((t, i) => !t.symbol && t.zeit && t.wichtig ? termine.findIndex(x => !x.symbol && x.wichtig && x.datum === t.datum && x.zeit === t.zeit && x.art === t.art && x.land === t.land) === i : true);
  for (const t of termine) {
    if (t.datum !== datum && t.datum !== gestern) continue;
    const z = mitZeit(t); const heute = t.datum === datum;
    if (heute) lage.heute.push({ ...t, ...(z ? { zeitNy: z.zeitNy, nyMinute: z.minute } : {}) });
    const sym = t.symbol?.toUpperCase();
    // Unternehmenszahlen
    if (t.art === "zahlen" && sym) {
      // ohne Uhrzeit hilft die Angabe „vor Handelsbeginn“ / „nach Handelsschluss“
      const nachSchluss = z ? z.minute >= 390 : t.zeitpunkt === "nachboerslich" ? true : null; const vorBeginn = z ? z.minute < 0 : t.zeitpunkt === "vorboerslich" ? true : null;
      const wann = t.zeit ? `${t.zeit} Uhr` : t.zeitpunkt === "nachboerslich" ? "nach Handelsschluss" : t.zeitpunkt === "vorboerslich" ? "vor Handelsbeginn" : "";
      if (heute) {
        if (beobachtet.has(sym)) {
          if (vorBeginn) { lage.werte[sym] = { faktor: 0.5, text: `Zahlen vor Handelsbeginn (${wann}): Kurslücke und hohe Schwankung, halbe Positionsgröße` }; lage.ideen.push({ titel: `${sym}: Zahlen vor Handelsbeginn`, text: "Kurslücke wahrscheinlich. Am aussagekräftigsten ist die Richtung der ersten 30 Minuten (Strategie „Momentum“); gegen eine große Lücke nicht vorschnell handeln.", symbol: sym, zeitDe: t.zeit, zeitNy: z?.zeitNy }); }
          else if (nachSchluss) { lage.werte[sym] = { faktor: 1, keinEinstiegAb: TERMIN_PAUSE.schlussStunde, text: `Zahlen nach Handelsschluss (${wann}): ab ${uhr(TERMIN_PAUSE.schlussStunde)} New York keine neuen Einstiege` }; lage.ideen.push({ titel: `${sym}: Zahlen nach Handelsschluss`, text: "Vorher oft abwartender Handel. Der Agent schließt vor Schluss; in der letzten Stunde keine neuen Einstiege in diesen Wert. Morgen ist mit einer Kurslücke zu rechnen.", symbol: sym, zeitDe: t.zeit, zeitNy: z?.zeitNy }); }
          else if (z) { lage.pausen.push({ von: z.minute - TERMIN_PAUSE.vorher, bis: z.minute + TERMIN_PAUSE.nachher, titel: `${sym}: ${t.titel}` }); lage.werte[sym] = { faktor: 0.5, text: `Zahlen während der Handelszeit (${t.zeit} Uhr): halbe Positionsgröße, Pause um den Termin` }; }
          else { lage.werte[sym] = { faktor: 0.5, keinEinstiegAb: TERMIN_PAUSE.schlussStunde, text: "Zahlen heute, Uhrzeit unbekannt: halbe Positionsgröße, in der letzten Stunde keine neuen Einstiege" }; }
        } else if (SCHWERGEWICHTE.has(sym)) lage.ideen.push({ titel: `${sym}: Zahlen heute`, text: `Schwergewicht im Index${nachSchluss ? " (nach Handelsschluss)" : vorBeginn ? " (vor Handelsbeginn)" : ""}: die Reaktion kann Nasdaq, S&P 500 und Branchenwerte mitziehen (z. B. QQQ, SPY).`, symbol: sym, zeitDe: t.zeit, zeitNy: z?.zeitNy });
        else if (t.wichtig) weitere.push(sym);
      } else if (beobachtet.has(sym) && (nachSchluss || !z)) {
        lage.werte[sym] = { faktor: 0.5, text: `Zahlen gestern nach Handelsschluss: Kurslücke und hohe Schwankung, halbe Positionsgröße` };
        lage.ideen.push({ titel: `${sym}: Reaktion auf die Zahlen von gestern`, text: "Kurslücke zur Eröffnung. Hält die Richtung der ersten 30 Minuten, setzt sie sich oft fort (Momentum); dreht sie früh, wird die Lücke häufig teilweise geschlossen.", symbol: sym });
      }
      continue;
    }
    if (!heute) continue;
    // Wichtige Konjunkturdaten und Zinsentscheide (marktweit)
    if (t.wichtig && !sym && (t.land === "US" || t.art === "zinsentscheid")) {
      const zins = t.art === "zinsentscheid";
      if (z && z.minute >= -TERMIN_PAUSE.vorher && z.minute < 390) {
        lage.pausen.push({ von: Math.max(0, z.minute - TERMIN_PAUSE.vorher), bis: z.minute + (zins ? TERMIN_PAUSE.zinsNachher : TERMIN_PAUSE.nachher), titel: t.titel });
        lage.ideen.push({ titel: `${t.titel} um ${t.zeit} Uhr (${z.zeitNy} New York)`, text: zins ? "Entscheid und Pressekonferenz bewegen den ganzen Markt. Keine neuen Einstiege bis nach der Pressekonferenz; erste Ausschläge drehen oft." : `Keine neuen Einstiege von ${uhr(Math.max(0, z.minute - TERMIN_PAUSE.vorher))} bis ${uhr(z.minute + TERMIN_PAUSE.nachher)} New York. Danach zeigt die Richtung über die erste Viertelstunde oft die Stimmung des Tages.${t.prognose ? ` Erwartet: ${t.prognose}${t.vorwert ? `, zuvor ${t.vorwert}` : ""}.` : ""}`, zeitDe: t.zeit, zeitNy: z.zeitNy });
      } else if (z && z.minute < -TERMIN_PAUSE.vorher) {
        lage.pausen.push({ von: 0, bis: TERMIN_PAUSE.eroeffnung, titel: `Eröffnung nach ${t.titel}` });
        lage.ideen.push({ titel: `${t.titel} vor Handelsbeginn (${t.zeit} Uhr)`, text: `Die Eröffnung verarbeitet die Daten mit einer Lücke. Die ersten ${TERMIN_PAUSE.eroeffnung} Minuten keine neuen Einstiege.${t.prognose ? ` Erwartet: ${t.prognose}${t.vorwert ? `, zuvor ${t.vorwert}` : ""}.` : ""}`, zeitDe: t.zeit, zeitNy: z.zeitNy });
      } else if (!z) lage.ideen.push({ titel: t.titel, text: "Wichtiger Termin ohne Uhrzeit: das Marktumfeld verkleinert die Positionen für den ganzen Tag.", zeitDe: undefined });
    }
  }
  if (weitere.length) lage.ideen.push({ titel: `Weitere US-Zahlen heute: ${[...new Set(weitere)].join(", ")}`, text: "Nicht beobachtet; Branchenwerte können mitlaufen." });
  lage.heute.sort((a, b) => (a.zeit ?? "99").localeCompare(b.zeit ?? "99"));
  return lage;
}

/** Aktive Pause zur Minute seit Eröffnung */
export const pauseBei = (l: Terminlage | undefined, minute: number) => l?.pausen.find(p => minute >= p.von && minute < p.bis) ?? null;
