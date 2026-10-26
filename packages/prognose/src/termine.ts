import type { Ereignis } from "./types";

/**
 * Wirtschaftskalender aus Text lesen: Terminlisten von Wirtschaftsseiten (Format „10:00 DE/Ifo-Geschäftsklimaindex“
 * unter Tagesüberschriften), Tabellen in Artikeln („28. Oktober, 19 Uhr MEZ  Fed-Zinsentscheid“), eigene Listen.
 * Uhrzeiten werden in deutsche Ortszeit umgerechnet (MEZ/MESZ; ET und UTC werden umgerechnet).
 * Übernommen werden nur Fakten (Datum, Uhrzeit, Termin) mit Quelle, keine Texte.
 */
export type Termin = Omit<Ereignis, "id">;

const MONATE = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const MONAT_RE = `(${MONATE.join("|")}|maerz)`;
const ZAHLWORT: Record<string, number> = { null: 0, eins: 1, ein: 1, eine: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwölf: 12, dreizehn: 13, vierzehn: 14, fünfzehn: 15, sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20 };
const LAENDER: [RegExp, string][] = [[/^(USA|Vereinigte Staaten)$/i, "US"], [/^(D|Deutschland)$/i, "DE"], [/^(EZ|EWU|Eurozone|Euroraum)$/i, "EU"], [/^(UK|Großbritannien)$/i, "GB"], [/^Japan$/i, "JP"], [/^China$/i, "CN"], [/^Frankreich$/i, "FR"], [/^Schweiz$/i, "CH"]];
const landAus = (x: string) => /^[A-Z]{2}$/.test(x) ? x : LAENDER.find(([r]) => r.test(x))?.[1];

/** Große US-Werte: Name im Termin → Börsenkürzel (für Agenten, die diese Werte beobachten) */
export const US_WERTE: [RegExp, string][] = [
  [/\bApple\b/i, "AAPL"], [/\bMicrosoft\b/i, "MSFT"], [/\b(Alphabet|Google)\b/i, "GOOGL"], [/\bAmazon(\.com)?\b/i, "AMZN"], [/\bMeta( Platforms)?\b/i, "META"],
  [/\bNvidia\b/i, "NVDA"], [/\bTesla\b/i, "TSLA"], [/\b(AMD|Advanced Micro)\b/i, "AMD"], [/\bIntel\b/i, "INTC"], [/\bNetflix\b/i, "NFLX"],
  [/\bBroadcom\b/i, "AVGO"], [/\bOracle\b/i, "ORCL"], [/\bSalesforce\b/i, "CRM"], [/\bAdobe\b/i, "ADBE"], [/\bIBM\b/, "IBM"], [/\bQualcomm\b/i, "QCOM"],
  [/\bMicron\b/i, "MU"], [/\bTexas Instruments\b/i, "TXN"], [/\bPalantir\b/i, "PLTR"], [/\bSuper Micro\b/i, "SMCI"], [/\bArm Holdings\b/i, "ARM"],
  [/\bExxon/i, "XOM"], [/\bChevron\b/i, "CVX"], [/\bCoca-Cola\b/i, "KO"], [/\bPepsiCo\b/i, "PEP"], [/\bMcDonald/i, "MCD"], [/\bVisa\b/i, "V"], [/\bMastercard\b/i, "MA"],
  [/\bJPMorgan\b/i, "JPM"], [/\bBank of America\b/i, "BAC"], [/\bGoldman Sachs\b/i, "GS"], [/\bMorgan Stanley\b/i, "MS"], [/\bWells Fargo\b/i, "WFC"], [/\bCitigroup\b/i, "C"],
  [/\bBoeing\b/i, "BA"], [/\bCaterpillar\b/i, "CAT"], [/\bPfizer\b/i, "PFE"], [/\bMerck & Co\b/i, "MRK"], [/\bEli Lilly\b/i, "LLY"], [/\bJohnson & Johnson\b/i, "JNJ"],
  [/\bProcter/i, "PG"], [/\bWalmart\b/i, "WMT"], [/\bStarbucks\b/i, "SBUX"], [/\bUber\b/i, "UBER"], [/\bPaypal\b/i, "PYPL"], [/\bUnitedHealth\b/i, "UNH"],
  [/\bBerkshire\b/i, "BRK.B"], [/\bWalt Disney|\bDisney\b/i, "DIS"], [/\bNike\b/i, "NKE"], [/\bFord Motor\b/i, "F"], [/\bGeneral Motors\b/i, "GM"], [/\bHoneywell\b/i, "HON"],
  [/\bVerizon\b/i, "VZ"], [/\bAT&T\b/i, "T"], [/\bComcast\b/i, "CMCSA"], [/\bAirbnb\b/i, "ABNB"], [/\bCoinbase\b/i, "COIN"], [/\bShopify\b/i, "SHOP"], [/\bSpotify\b/i, "SPOT"],
  [/\bUnited Parcel Service\b|\(UPS\)/i, "UPS"], [/\bT-Mobile US\b/i, "TMUS"], [/\bGE Healthcare\b/i, "GEHC"], [/\bGE Vernova\b/i, "GEV"], [/\bGE Aerospace\b/i, "GE"],
  [/\bFedex\b/i, "FDX"], [/\bEbay\b/i, "EBAY"], [/\bAbbvie\b/i, "ABBV"], [/\bAmgen\b/i, "AMGN"], [/\bGilead\b/i, "GILD"], [/\bBristol-Myers\b/i, "BMY"],
  [/\bConocoPhillips\b/i, "COP"], [/\bBooking Holdings\b/i, "BKNG"], [/\bServiceNow\b/i, "NOW"], [/\bLockheed\b/i, "LMT"], [/\bRTX\b|\bRaytheon\b/i, "RTX"], [/\b3M\b/, "MMM"],
  [/\bAmerican Express\b/i, "AXP"], [/\bBlackRock\b/i, "BLK"], [/\bCisco\b/i, "CSCO"], [/\bApplied Materials\b/i, "AMAT"], [/\bLam Research\b/i, "LRCX"], [/\bKLA\b/, "KLAC"],
];

const FIRMA = /\b(Inc|Corp|Co|Company|AG|SE|plc|SA|NV|N\.V\.|Ltd|ASA|SpA|KGaA|Holdings?|Group|Groep|GmbH|AB|Oyj)\b\.?/;
const BERICHT = /\b(Ergebnis|Umsatz|Trading (Update|Statement)|Production Report|Quartalszahlen|Geschäftszahlen|Quartalsergebnis|Jahreszahlen|Bilanz|Zahlen)\b/i;
// Abkürzungen mit exakter Schreibweise (sonst trifft „BoE“ auch „Boeing“)
const INSTITUTION = /^(EZB\b|Fed\b|Federal Reserve|BoJ\b|BoE\b|SNB\b|Bundesbank|Reserve Bank|Bank of (Canada|England|Japan)|Notenbank|Acea\b|Opec|IWF\b|OECD\b|Destatis|Eurostat)/;

/** Einordnung eines Termins: Art, Wichtigkeit für US-Intraday, Börsenkürzel */
export function ordneTermin(titel: string, land?: string): Pick<Ereignis, "art" | "wichtig" | "symbol" | "unternehmen"> {
  const t = titel; const us = land === "US"; const ez = land === "EU";
  const inst = INSTITUTION.test(t);
  if (/Börsenfeiertag|verkürzter Handel|Börse geschlossen|Feiertag/i.test(t)) return { art: "feiertag", wichtig: us };
  if (/Optionsverfall|Verfall|Hexensabbat|Triple Witching/i.test(t)) return { art: "verfall", wichtig: us && /großer Verfall|Hexensabbat|Triple Witching/i.test(t) };
  if (!/Umfrage|Protokoll|Rede|Keynote|Austausch|Bericht zur|Tender|Zuteilung|Geldmenge/i.test(t) && /Zinsentscheid|Leitzins|FOMC|Fed-?Sitzung|Ratssitzung|Sitzung des geldpolitischen Rats|Zinsbeschluss|geldpolitische Entscheidung/i.test(t)) return { art: "zinsentscheid", wichtig: us || ez || /Fed\b|FOMC|EZB/i.test(t) };
  if (/\bRede\b|Keynote|Anhörung|Pressekonferenz zum|Austausch mit/i.test(t)) return { art: "rede", wichtig: false };
  if (/Verbraucherpreis|Inflation|\bCPI\b|\bPCE\b|Erzeugerpreis|\bPPI\b|HVPI|Persönliche Ausgaben|Arbeitskostenindex|Import-?\/?\s*Exportpreise/i.test(t)) return { art: "inflation", wichtig: us && /Verbraucherpreis|\bCPI\b|\bPCE\b|Inflation|Persönliche Ausgaben/i.test(t) };
  if (/Arbeitsmarkt|Beschäftigung außerhalb|Nonfarm|Arbeitslosen|Erstanträge|ADP|offene Stellen|JOLTS|Erwerbstätigkeit/i.test(t)) return { art: "arbeitsmarkt", wichtig: us && /Arbeitsmarktbericht|Beschäftigung außerhalb|Nonfarm|Arbeitsmarktdaten/i.test(t) };
  if (/Erstnotiz|Börsengang|\bIPO\b/i.test(t)) return { art: "ipo", wichtig: false, ...(US_WERTE.find(([r]) => r.test(t)) ? { symbol: US_WERTE.find(([r]) => r.test(t))![1] } : {}) };
  const sym = inst ? undefined : US_WERTE.find(([r]) => r.test(t))?.[1];
  if (/Hauptversammlung|\bHV\b/i.test(t)) return { art: "hauptversammlung", wichtig: false, ...(sym ? { symbol: sym } : {}), unternehmen: firma(t) };
  if (!inst && (sym || (BERICHT.test(t) && (FIRMA.test(t) || /Quartalszahlen|Geschäftszahlen/i.test(t))))) return { art: "zahlen", wichtig: !!sym, ...(sym ? { symbol: sym } : {}), unternehmen: firma(t) };
  if (/BIP|Bruttoinlandsprodukt|Einkaufsmanager|\bISM\b|PMI|Einzelhandel|Auftragseingang|Industrieproduktion|ifo|ZEW|Verbrauchervertrauen|Konsumklima|Michigan|Philly|Empire|Hausverkäufe|Neubauverkäufe|Baubeginne|Baugenehmigungen|Handelsbilanz|Leistungsbilanz|Wirtschaftsstimmung|Geschäftsklima|Activity Index|Privater Verbrauch|Rohöl|Öllagerbestände|Lagerbestände/i.test(t)) return { art: "konjunktur", wichtig: us && /BIP|Bruttoinlandsprodukt|ISM|Einzelhandelsumsatz|Einzelhandel/i.test(t) };
  return { art: "sonstiges", wichtig: false };
}
const firma = (t: string) => t.split(/,|:|\s+-\s+/)[0]!.trim().slice(0, 80);

const iso = (j: number, m: number, d: number) => `${j}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const gueltig = (j: number, m: number, d: number) => { const x = new Date(Date.UTC(j, m - 1, d)); return x.getUTCMonth() === m - 1 && x.getUTCDate() === d; };
function versatz(zone: string, utc: number): number {
  const t = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(utc)).map(p => [p.type, p.value]));
  return (Date.UTC(Number(t.year), Number(t.month) - 1, Number(t.day), Number(t.hour) % 24, Number(t.minute)) - utc) / 60000;
}
/** Uhrzeit einer Zeitzone (ET, UTC, MEZ …) in deutsche Ortszeit umrechnen; Ergebnis Datum und HH:MM */
export function inDeutscheZeit(datum: string, h: number, m: number, zone: string): { datum: string; zeit: string } {
  const [j, mo, d] = datum.split("-").map(Number) as [number, number, number]; const lokal = Date.UTC(j, mo - 1, d, h, m);
  const z = zone.toUpperCase();
  const utc = /^(UTC|GMT|Z)$/.test(z) ? lokal : /^(ET|EST|EDT|NY|NEW YORK)$/.test(z) ? lokal - versatz("America/New_York", lokal) * 60000 : lokal - versatz("Europe/Berlin", lokal) * 60000;
  const de = new Date(utc + versatz("Europe/Berlin", utc) * 60000);
  return { datum: de.toISOString().slice(0, 10), zeit: `${String(de.getUTCHours()).padStart(2, "0")}:${String(de.getUTCMinutes()).padStart(2, "0")}` };
}

/** Zeitangabe hinter einem Datum: „19 Uhr MEZ“, „8:30 Uhr ET“, „acht Uhr UTC“, „nach Börsenschluss“ */
const ZEITSPEZ = new RegExp(`^\\s*,?\\s*(?:um\\s+)?(?:(\\d{1,2})(?:[:.](\\d{2}))?|(${Object.keys(ZAHLWORT).join("|")}))\\s*Uhr\\s*(MEZ|MESZ|CET|CEST|ET|EST|EDT|UTC|GMT|New York)?|^\\s*,?\\s*(nach\\s+(?:Börsen|Handels)schluss|nachbörslich|vor\\s+(?:Börsen|Handels)(?:beginn|eröffnung|start)|vorbörslich)`, "i");
const RAUSCHEN = /n-tv\.de|Wochenvorschau:|^https?:|^\d+\/\d+$|^[=_\-–]{4,}|Keine Gewähr|Termin ohne Uhrzeit|Uhrzeiten in aktueller|^Quelle:|^(Anzeige\s*)+$|DAS KÖNNTE|Das könnte Sie|^Datum\s+Ereignis$|Artikel drucken|Link kopieren|bevorzugen$|^\d{2}\.\d{2}\.\d{2},\s*\d{1,2}:\d{2}/i;

export function leseTermine(text: string, opts: { jahr?: number; quelle?: string } = {}): { termine: Termin[]; ohneTag: number } {
  const jahr0 = opts.jahr ?? new Date().getFullYear();
  const zeilen = text.replace(/ /g, " ").split(/\r?\n/).map(z => z.replace(/\s+/g, " ").trim()).filter(z => z && !RAUSCHEN.test(z));
  // Terminlisten im Stil „10:00 DE/…“: Zeilen ohne Uhrzeit und ohne Land setzen den vorigen Termin fort
  const listenstil = zeilen.filter(z => /^(\d{1,2}[:.]\d{2}\s+)?[A-Z]{2}\/\S/.test(z)).length >= 3;
  const out: Termin[] = []; let tag: string | null = null; let ohneTag = 0; const st: { letzter: Termin | null } = { letzter: null }; let vorige = ""; let vorigeFrei = false;
  const tabelle = new Set<Termin>();
  const neu = (e: Termin) => { if (!e.unternehmen) delete e.unternehmen; out.push(e); st.letzter = e; };
  const datumAus = (d: number, mRoh: string, jRoh?: string) => { const m = /^\d+$/.test(mRoh) ? Number(mRoh) : MONATE.indexOf(mRoh.toLowerCase().replace("maerz", "märz")) + 1; const j = jRoh ? Number(jRoh) : jahr0; return m >= 1 && gueltig(j, m, d) ? iso(j, m, d) : null; };
  for (let i = 0; i < zeilen.length; i++) {
    const z = zeilen[i]!; const frei = vorigeFrei; vorigeFrei = false;
    // Tagesüberschrift
    const k = z.match(new RegExp(`^(?:(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\\s*(?:den\\s+)?)?(\\d{1,2})\\.\\s*${MONAT_RE}(?:\\s+(\\d{4}))?\\s*:?$`, "i"))
      ?? z.match(/^(?:(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\s*)?(\d{1,2})\.(\d{1,2})\.(\d{4})?\s*:?$/i);
    if (k) { tag = datumAus(Number(k[1]), k[2]!, k[3]) ?? tag; st.letzter = null; vorige = z; continue; }
    // Prognose / Vorwert zum vorigen Termin
    const pr = z.match(/^(?:PROGNOSE|Prognose|Erwartung|Konsens)\s*:?\s*(.+)$/); if (pr && st.letzter) { st.letzter.prognose = pr[1]!.slice(0, 60); vorige = z; continue; }
    const vw = z.match(/^(?:zuvor|Vorwert|vorher|Vormonat)\s*:?\s*(.+)$/i); if (vw && st.letzter) { st.letzter.vorwert = vw[1]!.slice(0, 60); vorige = z; continue; }
    if (/^(TAGESTHEMA|TERMINE|UNTERNEHMEN|KONJUNKTUR|SONSTIGE|Alle Angaben|Die wichtigsten Ereignisse)\b/i.test(z) || z.length < 4) { vorige = z; continue; }

    // Tabellen- oder Listenzeile mit Datum vorn: „28. Oktober, 19 Uhr MEZ Fed-Zinsentscheid“, „27.-28. Oktober FOMC-Sitzung“
    const dz = z.match(new RegExp(`^(\\d{1,2})\\.(?:\\s*[-–]\\s*(\\d{1,2})\\.)?\\s*${MONAT_RE}(?:\\s+(\\d{4}))?(.*)$`, "i"));
    if (dz) {
      let rest = dz[5]!;
      // abgeschnittene Zeitangabe („28. Oktober, nach“ / „Börsenschluss Quartalszahlen …“): nächste Zeile anhängen
      if (/,\s*(nach|vor|um)?\s*$/i.test(rest) && zeilen[i + 1]) { rest = `${rest} ${zeilen[++i]}`; }
      const datum = datumAus(Number(dz[2] ?? dz[1]), dz[3]!, dz[4]);
      if (!datum) { vorige = z; continue; }
      const zs = rest.match(ZEITSPEZ); let zeit: string | undefined; let zeitpunkt: Termin["zeitpunkt"]; let tagE = datum;
      if (zs) {
        if (zs[5]) zeitpunkt = /nach/i.test(zs[5]) ? "nachboerslich" : "vorboerslich";
        else { const h = zs[1] ? Number(zs[1]) : ZAHLWORT[zs[3]!.toLowerCase()]!; const mi = zs[2] ? Number(zs[2]) : 0; if (h <= 23 && mi <= 59) { const r = inDeutscheZeit(datum, h, mi, zs[4] ?? "MEZ"); zeit = r.zeit; tagE = r.datum; } }
        rest = rest.slice(zs[0].length);
      }
      let titel = rest.replace(/^[\s,:;|–-]+/, "").trim();
      // Tabellenzeile umbrochen: Termin stand in der Zeile davor (und endet ggf. in der Zeile danach)
      if (!titel && frei && /[A-Za-zÄÖÜäöü]{3}/.test(vorige)) { titel = vorige; if (/\($/.test(titel) || (/\([^)]*$/.test(titel) && zeilen[i + 1] && /\)\s*$/.test(zeilen[i + 1]!) && zeilen[i + 1]!.length < 40)) titel = `${titel} ${zeilen[++i]}`; }
      if (!titel || !/[A-Za-zÄÖÜäöü]{3}/.test(titel)) { vorige = z; continue; }
      const spanne = !!dz[2]; // „27.-28. Oktober“: mehrtägige Sitzung, kein Termin mit Uhrzeit
      for (const e of aufteilen(titel)) { const lh = landHinweis(e); const o = ordneTermin(e, lh); const x: Termin = { datum: tagE, titel: e.slice(0, 160), ...o, ...(spanne ? { art: "sonstiges" as const, wichtig: false } : {}), ...(zeit ? { zeit } : {}), ...(zeitpunkt ? { zeitpunkt } : {}), ...(lh ? { land: lh } : {}), ...(opts.quelle ? { quelle: opts.quelle } : {}) }; neu(x); tabelle.add(x); }
      vorige = z; continue;
    }

    // Termin: [Uhrzeit] [Land/] Titel [, Uhrzeit]
    const t = z.match(/^(?:[-–•*]\s*)?(?:(\d{1,2})[:.](\d{2})\s*(?:Uhr)?\s*[-–:]?\s*)?(?:([A-ZÄÖÜ][A-Za-zäöüß]{0,20})\s*[/:]\s*(?=\S))?(.+)$/);
    const zeitVorn = !!t?.[1]; const landRoh = t?.[3]; const land = landRoh ? landAus(landRoh) : undefined;
    // Fortsetzung des vorigen Termins (Zeilenumbruch in der Quelle)
    const eigenerTermin = (FIRMA.test(z) && BERICHT.test(z)) || /[,(]\s*\d{1,2}[:.]\d{2}\s*(Uhr)?\)?\s*$/.test(z);
    const fortsetzung = st.letzter && !tabelle.has(st.letzter) && !zeitVorn && !land && ((listenstil && !eigenerTermin) || /^[(a-zäöü]/.test(z) || /[,(]$|\b(der|des|die|von|zur|zum|mit|und|bei|für|Laufzeit)$/i.test(vorige) || new RegExp(`^${MONAT_RE}\\s+\\d{4}`, "i").test(z));
    if (fortsetzung && st.letzter) { const l = st.letzter; l.titel = `${l.titel} ${z}`.replace(/\s+/g, " ").slice(0, 200); vorige = z; continue; }
    if (!t) { vorige = z; vorigeFrei = true; continue; }
    let zeit = zeitVorn ? `${t[1]!.padStart(2, "0")}:${t[2]}` : undefined; let titel = t[4]!.trim();
    if (landRoh && !land) titel = `${landRoh}/${titel}`;
    const ende = titel.match(/[,(]\s*(\d{1,2})[:.](\d{2})\s*(?:Uhr)?\)?\s*$/); if (!zeit && ende) { zeit = `${ende[1]!.padStart(2, "0")}:${ende[2]}`; titel = titel.slice(0, ende.index).trim(); }
    if (!/[A-Za-zÄÖÜäöü]{3}/.test(titel) || (!zeit && !land && !FIRMA.test(titel) && !BERICHT.test(titel) && !/Zins|Inflation|Arbeitsmarkt|BIP|Index|Einkaufsmanager|Daten|Bericht|Sitzung|Rede|Konferenz|Feiertag|Verfall/i.test(titel))) { vorige = z; vorigeFrei = true; continue; }
    if (!tag) { ohneTag++; vorige = z; vorigeFrei = true; continue; }
    if (zeit && (Number(zeit.slice(0, 2)) > 23 || Number(zeit.slice(3)) > 59)) zeit = undefined;
    titel = titel.replace(/\b(Ergebnis|Umsatz|Update|Statement|Report)\s+([1-4])0\b/g, "$1 $2Q"); // Lesefehler „30“ statt „3Q“
    const zp: Termin["zeitpunkt"] = /nachbörslich|nach Börsenschluss/i.test(titel) ? "nachboerslich" : /vorbörslich|vor Börsenbeginn/i.test(titel) ? "vorboerslich" : undefined;
    neu({ datum: tag, titel: titel.slice(0, 160), ...ordneTermin(titel, land), ...(zeit ? { zeit } : {}), ...(zp ? { zeitpunkt: zp } : {}), ...(land ? { land } : {}), ...(opts.quelle ? { quelle: opts.quelle } : {}) });
    vorige = z;
  }
  // Einordnung nach dem vollständigen Titel prüfen (Fortsetzungen), Art nur verfeinern, nicht verschlechtern
  for (const e of out) { if (e.art === "sonstiges" && !tabelle.has(e)) { const n = ordneTermin(e.titel, e.land); if (n.art !== "inflation" || /^(Verbraucherpreis|Inflation|PCE)/i.test(e.titel)) Object.assign(e, n); if (!e.unternehmen) delete e.unternehmen; } }
  // Gleicher Zinsentscheid mit und ohne Uhrzeit (z. B. Sitzung und Entscheid): den ohne Uhrzeit verwerfen
  const ergebnis = out.filter(e => !(e.art === "zinsentscheid" && !e.zeit && out.some(x => x !== e && x.art === "zinsentscheid" && x.datum === e.datum && x.zeit && x.land === e.land)));
  return { termine: ergebnis, ohneTag };
}

/** „Quartalszahlen Microsoft und Alphabet“ → je Unternehmen ein Termin; sonst der Titel selbst */
function aufteilen(titel: string): string[] {
  const m = titel.match(/^(Quartalszahlen|Zahlen|Bilanzen|Geschäftszahlen)\s+(?:von\s+)?(.+)$/i);
  if (!m) return [titel];
  const namen = m[2]!.split(/\s*(?:,|\bund\b|&)\s*/).map(x => x.trim()).filter(Boolean);
  return namen.length > 1 ? namen.map(n => `${m[1]} ${n}`) : [titel];
}
const landHinweis = (t: string): string | undefined => /Fed\b|FOMC|Federal Reserve|PCE|US-|Nonfarm/i.test(t) || US_WERTE.some(([r]) => r.test(t)) ? "US" : undefined;
