import type { Ereignis } from "./types";

/**
 * Wirtschaftskalender aus eingefügtem Text lesen (Terminlisten von Nachrichtenseiten, Wochenvorschauen, eigene Listen).
 * Erkannt werden Tagesüberschriften („Montag, 26. Oktober“, „26.10.2026“), Uhrzeiten (deutsche Ortszeit), Länder
 * („US/“, „USA:“, „D:“), Unternehmens- und Konjunkturtermine sowie „Prognose“ und „zuvor/Vorwert“.
 * Übernommen werden nur Fakten (Datum, Uhrzeit, Termin) mit Quelle, keine Texte.
 */
export type Termin = Omit<Ereignis, "id">;

const MONATE = ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"];
const LAND: [RegExp, string][] = [[/^(US|USA|Vereinigte Staaten)$/i, "US"], [/^(DE|D|DEU|Deutschland)$/i, "DE"], [/^(EU|EZ|EWU|Eurozone|Euroraum)$/i, "EU"], [/^(GB|UK|Großbritannien)$/i, "GB"], [/^(JP|Japan)$/i, "JP"], [/^(CN|China)$/i, "CN"], [/^(FR|Frankreich)$/i, "FR"], [/^(IT|Italien)$/i, "IT"], [/^(ES|Spanien)$/i, "ES"], [/^(CH|Schweiz)$/i, "CH"], [/^(NL|Niederlande)$/i, "NL"], [/^(AT|Österreich)$/i, "AT"]];

/** Große US-Werte: Name im Termin → Börsenkürzel (für Agenten, die diese Werte beobachten) */
export const US_WERTE: [RegExp, string][] = [
  [/\bApple\b/i, "AAPL"], [/\bMicrosoft\b/i, "MSFT"], [/\b(Alphabet|Google)\b/i, "GOOGL"], [/\bAmazon\b/i, "AMZN"], [/\bMeta( Platforms)?\b/i, "META"],
  [/\bNvidia\b/i, "NVDA"], [/\bTesla\b/i, "TSLA"], [/\b(AMD|Advanced Micro)\b/i, "AMD"], [/\bIntel\b/i, "INTC"], [/\bNetflix\b/i, "NFLX"],
  [/\bBroadcom\b/i, "AVGO"], [/\bOracle\b/i, "ORCL"], [/\bSalesforce\b/i, "CRM"], [/\bAdobe\b/i, "ADBE"], [/\bIBM\b/, "IBM"], [/\bQualcomm\b/i, "QCOM"],
  [/\bMicron\b/i, "MU"], [/\bTexas Instruments\b/i, "TXN"], [/\bPalantir\b/i, "PLTR"], [/\bSuper Micro\b/i, "SMCI"], [/\bArm Holdings\b/i, "ARM"],
  [/\bExxon/i, "XOM"], [/\bChevron\b/i, "CVX"], [/\bCoca-Cola\b/i, "KO"], [/\bPepsiCo\b/i, "PEP"], [/\bMcDonald/i, "MCD"], [/\bVisa\b/i, "V"], [/\bMastercard\b/i, "MA"],
  [/\bJPMorgan\b/i, "JPM"], [/\bBank of America\b/i, "BAC"], [/\bGoldman Sachs\b/i, "GS"], [/\bMorgan Stanley\b/i, "MS"], [/\bWells Fargo\b/i, "WFC"], [/\bCitigroup\b/i, "C"],
  [/\bBoeing\b/i, "BA"], [/\bCaterpillar\b/i, "CAT"], [/\bPfizer\b/i, "PFE"], [/\bMerck & Co\b/i, "MRK"], [/\bEli Lilly\b/i, "LLY"], [/\bJohnson & Johnson\b/i, "JNJ"],
  [/\bProcter/i, "PG"], [/\bWalmart\b/i, "WMT"], [/\bStarbucks\b/i, "SBUX"], [/\bUber\b/i, "UBER"], [/\bPayPal\b/i, "PYPL"], [/\bUnitedHealth\b/i, "UNH"],
  [/\bBerkshire\b/i, "BRK.B"], [/\bWalt Disney|\bDisney\b/i, "DIS"], [/\bNike\b/i, "NKE"], [/\bFord Motor\b/i, "F"], [/\bGeneral Motors\b/i, "GM"], [/\bHoneywell\b/i, "HON"],
  [/\bVerizon\b/i, "VZ"], [/\bAT&T\b/i, "T"], [/\bComcast\b/i, "CMCSA"], [/\bAirbnb\b/i, "ABNB"], [/\bCoinbase\b/i, "COIN"], [/\bShopify\b/i, "SHOP"], [/\bSpotify\b/i, "SPOT"],
];

const UNTERNEHMEN = /\b(Q[1-4]|[1-4]Q|Quartals?zahlen|Quartalsergebnis|Geschäftszahlen|Ergebnis|Umsatz|Jahreszahlen|Bilanz|Hauptversammlung|\bHV\b|Kapitalmarkttag|Investorentag|Trading Update|Inc\.?|Corp\.?|AG\b|SE\b|plc\b|N\.V\.|Ltd)\b/i;
/** Einordnung eines Termins: Art, Wichtigkeit für US-Intraday, Börsenkürzel */
export function ordneTermin(titel: string, land?: string): Pick<Ereignis, "art" | "wichtig" | "symbol" | "unternehmen"> {
  const t = titel; const us = land === "US"; const ez = land === "EU";
  if (/Zinsentscheid|Leitzins|FOMC|Fed-?Sitzung|Notenbank.*Entscheid|Ratssitzung|geldpolitische|Zinsbeschluss/i.test(t)) return { art: "zinsentscheid", wichtig: us || ez || /Fed|FOMC|EZB/i.test(t) };
  if (/Verbraucherpreis|Inflation|\bCPI\b|\bPCE\b|Erzeugerpreis|\bPPI\b|HVPI/i.test(t)) return { art: "inflation", wichtig: us && /Verbraucherpreis|\bCPI\b|\bPCE\b|Inflation/i.test(t) };
  if (/Arbeitsmarkt|Beschäftigung außerhalb|Nonfarm|Arbeitslosen|Erstanträge|ADP|Stellen|JOLTS/i.test(t)) return { art: "arbeitsmarkt", wichtig: us && /Arbeitsmarktbericht|Beschäftigung außerhalb|Nonfarm|Arbeitsmarktdaten/i.test(t) };
  const sym = US_WERTE.find(([r]) => r.test(t))?.[1];
  if (/Hauptversammlung|\bHV\b/i.test(t)) return { art: "hauptversammlung", wichtig: false, ...(sym ? { symbol: sym } : {}), unternehmen: firma(t) };
  if (sym || (UNTERNEHMEN.test(t) && !/Index|BIP|Einkaufsmanager|Umsätze im Einzelhandel|Einzelhandelsumsatz|Auftragseingang|Industrie|Handelsbilanz|Leistungsbilanz/i.test(t))) return { art: "zahlen", wichtig: !!sym, ...(sym ? { symbol: sym } : {}), unternehmen: firma(t) };
  if (/BIP|Bruttoinlandsprodukt|Einkaufsmanager|\bISM\b|PMI|Einzelhandel|Auftragseingang|Industrieproduktion|ifo|ZEW|Verbrauchervertrauen|Konsumklima|Michigan|Philly|Empire|Hausverkäufe|Baubeginne|Handelsbilanz|Leistungsbilanz/i.test(t)) return { art: "konjunktur", wichtig: us && /BIP|Bruttoinlandsprodukt|ISM|Einzelhandelsumsatz|Einzelhandel/i.test(t) };
  return { art: "sonstiges", wichtig: false };
}
const firma = (t: string) => t.split(/,|:|\s+-\s+/)[0]!.replace(/^\s*(US|DE|EU)\//, "").trim().slice(0, 80);

const iso = (j: number, m: number, d: number) => `${j}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const gueltig = (j: number, m: number, d: number) => { const x = new Date(Date.UTC(j, m - 1, d)); return x.getUTCMonth() === m - 1 && x.getUTCDate() === d; };

export function leseTermine(text: string, opts: { jahr?: number; quelle?: string } = {}): { termine: Termin[]; ohneTag: number } {
  const jahr0 = opts.jahr ?? new Date().getFullYear();
  const zeilen = text.replace(/ /g, " ").split(/\r?\n/).map(z => z.trim()).filter(Boolean);
  const out: Termin[] = []; let tag: string | null = null; let ohneTag = 0; let letzter: Termin | null = null;
  for (const z of zeilen) {
    // Tagesüberschrift
    const k = z.match(new RegExp(`^(?:(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\\s*(?:den\\s+)?)?(\\d{1,2})\\.\\s*(${MONATE.join("|")}|maerz)(?:\\s+(\\d{4}))?\\s*:?$`, "i"))
      ?? z.match(/^(?:(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag),?\s*)?(\d{1,2})\.(\d{1,2})\.(\d{4})?\s*:?$/i);
    if (k) {
      const d = Number(k[1]); const mRoh = k[2]!.toLowerCase(); const m = /^\d+$/.test(mRoh) ? Number(mRoh) : MONATE.indexOf(mRoh.replace("maerz", "märz")) + 1; const j = k[3] ? Number(k[3]) : jahr0;
      tag = gueltig(j, m, d) ? iso(j, m, d) : tag; letzter = null; continue;
    }
    // Prognose / Vorwert zum vorigen Termin
    const pr = z.match(/^(?:PROGNOSE|Prognose|Erwartung|Konsens)\s*:?\s*(.+)$/); if (pr && letzter) { letzter.prognose = pr[1]!.slice(0, 60); continue; }
    const vw = z.match(/^(?:zuvor|Vorwert|vorher|Vormonat|vorläufig)\s*:?\s*(.+)$/i); if (vw && letzter) { letzter.vorwert = vw[1]!.slice(0, 60); continue; }
    if (/^(TAGESTHEMA|TERMINE|UNTERNEHMEN|KONJUNKTUR|SONSTIGE|Alle Angaben|Quelle|Anzeige|Mehr zum Thema|Datum|Uhrzeit)\b/i.test(z) || z.length < 5) continue;
    // Termin: [Uhrzeit] [Land/] Titel [, Uhrzeit]
    const t = z.match(/^(?:[-–•*]\s*)?(?:(\d{1,2})[:.](\d{2})\s*(?:Uhr)?\s*[-–:]?\s*)?(?:([A-ZÄÖÜ][A-Za-zäöüß]{0,20})\s*[/:]\s*)?(.+)$/);
    if (!t) continue;
    let zeit = t[1] ? `${t[1].padStart(2, "0")}:${t[2]}` : undefined; const landRoh = t[3]; let titel = t[4]!.trim();
    const land = landRoh ? LAND.find(([r]) => r.test(landRoh))?.[1] : undefined;
    if (landRoh && !land) titel = `${landRoh}/${titel}`; // kein Land, gehört zum Titel
    // Uhrzeit am Ende („…, 22:05 Uhr“)
    const ende = titel.match(/[,(]\s*(\d{1,2})[:.](\d{2})\s*(?:Uhr)?\)?\s*$/); if (!zeit && ende) { zeit = `${ende[1]!.padStart(2, "0")}:${ende[2]}`; titel = titel.slice(0, ende.index).trim(); }
    if (!/[A-Za-zÄÖÜäöü]{3}/.test(titel) || (!zeit && !land && !UNTERNEHMEN.test(titel) && !/Zins|Inflation|Arbeitsmarkt|BIP|Index|Einkaufsmanager|Daten|Bericht|Sitzung|Rede|Konferenz/i.test(titel))) continue;
    if (!tag) { ohneTag++; continue; }
    if (zeit && (Number(zeit.slice(0, 2)) > 23 || Number(zeit.slice(3)) > 59)) zeit = undefined;
    const e: Termin = { datum: tag, titel: titel.slice(0, 160), ...ordneTermin(titel, land), ...(zeit ? { zeit } : {}), ...(land ? { land } : {}), ...(opts.quelle ? { quelle: opts.quelle } : {}) };
    if (!e.unternehmen) delete e.unternehmen;
    out.push(e); letzter = e;
  }
  return { termine: out, ohneTag };
}
