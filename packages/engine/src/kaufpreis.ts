import type { Assetklasse, Objekt, Params } from "./types";
import { eurDe, nebenkostenSatz, stellplatzSumme } from "./core";
import { flaechen, regulierung, type Mietpfad } from "./mietrecht";

/**
 * Kaufpreis-Check: Faktor und Preis je m² gegen den Markt, Ursache der Abweichung und Ertragswert als Gegenprobe.
 * Rechnet mit der Wohnung allein (ohne separat gekaufte Stellplätze), damit der Vergleich mit Marktwerten je m² stimmt;
 * der Faktor auf die Gesamtinvestition enthält Stellplätze und Nebenkosten.
 */

/** Liegenschaftszins (Standard je Objektart, Spanne ±0,5 %-Pkt.). Örtliche Werte stehen im Grundstücksmarktbericht des Gutachterausschusses. */
export const LIEGENSCHAFTSZINS: Record<Assetklasse, number> = { ETW: 0.02, MFH: 0.03, "EFH/ZFH": 0.02, Gewerbe: 0.05 };
/** In angespannten Märkten (Verordnung am Ort) liegen die Sätze meist niedriger */
export const LZ_ABSCHLAG_ANGESPANNT = 0.005;
/** Gesamtnutzungsdauer Wohngebäude nach ImmoWertV Anlage 1; Gewerbe (Büro) 60 Jahre */
export const GESAMTNUTZUNGSDAUER: Record<Assetklasse, number> = { ETW: 80, MFH: 80, "EFH/ZFH": 80, Gewerbe: 60 };
/** Untergrenze der Restnutzungsdauer für ein instand gehaltenes Gebäude (Annahme) */
export const MIN_RESTNUTZUNG = 30;
/**
 * Bewirtschaftungskosten nach ImmoWertV Anlage 3, auf 2026 fortgeschrieben und gerundet:
 * Verwaltung je Wohnung und Jahr, Instandhaltung je m² und Jahr, Mietausfallwagnis in % des Rohertrags.
 */
export const BEWIRTSCHAFTUNG = { verwaltungWohnung: 360, verwaltungEtw: 430, instandhaltungQm: 14, mietausfall: 0.02, gewerbeQuote: 0.18, stellplatzJahr: 110 };

export type Preislage = "guenstig" | "markt" | "teuer" | "deutlich-teuer";
export const PREISLAGE: Record<Preislage, string> = { guenstig: "günstig", markt: "marktüblich", teuer: "teuer", "deutlich-teuer": "deutlich teuer" };
/** Abweichung des Faktors vom Marktfaktor: bis ±10 % gilt als marktüblich */
export const preislage = (abw: number): Preislage => abw <= -0.1 ? "guenstig" : abw <= 0.1 ? "markt" : abw <= 0.25 ? "teuer" : "deutlich-teuer";

export interface Ertragswert {
  rohertrag: number; bewirtschaftung: number; reinertrag: number;
  liegenschaftszins: number; lzEigen: boolean;
  restnutzungsdauer: number; rndEigen: boolean; gesamtnutzungsdauer: number;
  barwertfaktor: number;
  bodenwert: number; bodenwertQuelle: "bodenrichtwert" | "gebaeudeanteil";
  /** Ertragswert der Wohnung (gleiche Abgrenzung wie der Kaufpreis der Wohnung) */
  wert: number; von: number; bis: number;
  /** Angebot gegenüber Ertragswert (+ = Angebot darüber) */
  abweichung: number;
  annahmen: string[];
}

export interface KaufpreisCheck {
  kaufpreis: number; flaeche: number;
  preisQm: number; vergleichspreisQm: number | null; preisAbw: number | null;
  istMiete: number | null; vergleichsmiete: number | null; mietAbw: number | null;
  /** Kaufpreis ÷ Jahreskaltmiete heute */
  faktorIst: number | null;
  /** Kaufpreis ÷ ortsübliche Vergleichsmiete (nachhaltig erzielbar) */
  faktorVergleich: number | null;
  /** (Kaufpreis + Stellplätze) × (1 + Nebenkosten) ÷ Jahresmiete inkl. Stellplätze */
  faktorGesamt: number | null;
  /** Faktor, nachdem die Miete nach Mietrecht angehoben ist */
  faktorNachAnpassung: { faktor: number; miete: number; wann: string } | null;
  /** Ortsüblicher Faktor: Vergleichspreis ÷ (Vergleichsmiete × 12) */
  marktfaktor: number | null;
  /** Faktor des Objekts (heute bzw. bei Leerstand auf die Vergleichsmiete) gegenüber dem Marktfaktor */
  faktorAbw: number | null;
  lage: Preislage | null;
  /** Woher die Abweichung kommt */
  ursache: "preis" | "miete" | "beides" | null;
  /** Preis, bei dem der Faktor marktüblich wäre (Marktfaktor × heutige Miete) */
  preisMarktfaktor: number | null;
  /** Preis nach Vergleichspreis je m² */
  preisVergleich: number | null;
  ertragswert: Ertragswert | null;
  aussagen: string[];
  fehlt: string[];
}

const pctDe = (v: number, d = 0) => `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d })} %`;
const facDe = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const sgnPct = (v: number) => `${Math.abs(v) < 0.005 ? "±" : v > 0 ? "+" : "−"}${pctDe(Math.abs(v))}`;

/** Barwertfaktor (Vervielfältiger) für n Jahre zum Zins i */
export const barwertfaktor = (i: number, n: number) => i > 0 ? (1 - Math.pow(1 + i, -n)) / i : n;

/** Ertragswert der Wohnung nach dem allgemeinen Ertragswertverfahren (ImmoWertV §§ 27–34), vereinfacht */
export function ertragswert(o: Objekt, mieteMonat: number, flaeche: number, kaufpreis: number, jahr = new Date().getFullYear()): Ertragswert {
  const asset = o.asset; const reg = regulierung(o);
  const roh = mieteMonat * 12;
  const bwk = asset === "Gewerbe" ? roh * BEWIRTSCHAFTUNG.gewerbeQuote
    : (asset === "ETW" ? BEWIRTSCHAFTUNG.verwaltungEtw : BEWIRTSCHAFTUNG.verwaltungWohnung * Math.max(1, asset === "MFH" ? Math.round(flaeche / 70) : 1)) + BEWIRTSCHAFTUNG.instandhaltungQm * flaeche + roh * BEWIRTSCHAFTUNG.mietausfall;
  const re = roh - bwk;
  const lzEigen = o.liegenschaftszins != null && o.liegenschaftszins > 0;
  const lz = lzEigen ? o.liegenschaftszins! : Math.max(0.005, LIEGENSCHAFTSZINS[asset] - (reg.angespannt && reg.geprueft ? LZ_ABSCHLAG_ANGESPANNT : 0));
  const gnd = GESAMTNUTZUNGSDAUER[asset];
  const rndEigen = o.restnutzungsdauer != null && o.restnutzungsdauer > 0;
  const rnd = rndEigen ? o.restnutzungsdauer! : o.baujahr ? Math.max(MIN_RESTNUTZUNG, gnd - (jahr - o.baujahr)) : 40;
  const bwQuelle: Ertragswert["bodenwertQuelle"] = o.bodenrichtwert && o.grundstueckAnteilQm ? "bodenrichtwert" : "gebaeudeanteil";
  const bw = bwQuelle === "bodenrichtwert" ? o.bodenrichtwert! * o.grundstueckAnteilQm! : kaufpreis * (1 - (o.gebaeudeanteil || 0.75));
  const wert = (z: number) => Math.max(0, re * barwertfaktor(z, rnd) + bw * Math.pow(1 + z, -rnd));
  const w = wert(lz);
  const annahmen = [
    `Rohertrag aus der ${o.marktmieteQm ? "ortsüblichen Vergleichsmiete" : "Ist-Miete"}, wie es das Verfahren vorsieht (marktüblich erzielbar).`,
    asset === "Gewerbe" ? `Bewirtschaftungskosten pauschal ${pctDe(BEWIRTSCHAFTUNG.gewerbeQuote)} des Rohertrags.` : `Bewirtschaftungskosten nach ImmoWertV, fortgeschrieben: Verwaltung ${eurDe(asset === "ETW" ? BEWIRTSCHAFTUNG.verwaltungEtw : BEWIRTSCHAFTUNG.verwaltungWohnung)} € je Wohnung, Instandhaltung ${BEWIRTSCHAFTUNG.instandhaltungQm} €/m², Mietausfallwagnis ${pctDe(BEWIRTSCHAFTUNG.mietausfall)}.`,
    lzEigen ? `Liegenschaftszins ${pctDe(lz, 2)} (Ihre Angabe).` : `Liegenschaftszins ${pctDe(lz, 2)}: Standard für ${asset}${reg.angespannt && reg.geprueft ? ", abgesenkt für angespannten Markt" : ""}. Der örtliche Wert steht im Grundstücksmarktbericht des Gutachterausschusses (z. B. BORIS).`,
    rndEigen ? `Restnutzungsdauer ${rnd} Jahre (Ihre Angabe).` : o.baujahr ? `Restnutzungsdauer ${rnd} Jahre: Gesamtnutzungsdauer ${gnd} Jahre ab Baujahr ${o.baujahr}${gnd - (jahr - o.baujahr) < MIN_RESTNUTZUNG ? `, mindestens ${MIN_RESTNUTZUNG} Jahre bei laufender Instandhaltung` : ""}. Modernisierungen verlängern sie.` : "Restnutzungsdauer 40 Jahre angenommen (Baujahr fehlt).",
    bwQuelle === "bodenrichtwert" ? `Bodenwert ${eurDe(bw)} € aus Bodenrichtwert × Grundstücksanteil.` : `Bodenwert ${eurDe(bw)} € geschätzt aus dem Gebäudeanteil (${pctDe(o.gebaeudeanteil || 0.75)}). Genauer mit Bodenrichtwert und Grundstücksanteil.`,
  ];
  return {
    rohertrag: roh, bewirtschaftung: bwk, reinertrag: re, liegenschaftszins: lz, lzEigen, restnutzungsdauer: rnd, rndEigen, gesamtnutzungsdauer: gnd,
    barwertfaktor: barwertfaktor(lz, rnd), bodenwert: bw, bodenwertQuelle: bwQuelle,
    wert: w, von: wert(lz + 0.005), bis: wert(Math.max(0.0025, lz - 0.005)), abweichung: kaufpreis / w - 1, annahmen,
  };
}

/** Kaufpreis-Check. `pfad` (aus der Analyse) liefert den Faktor nach Mietanpassung. */
export function kaufpreisCheck(p: Params, o: Objekt, pfad?: Mietpfad | null): KaufpreisCheck | null {
  const kp = o.kaufpreis; const fl = flaechen(o).gesamt;
  if (!kp || !fl) return null;
  const sp = stellplatzSumme(o);
  const ist = o.leer ? null : o.miete ?? null;
  const vgl = o.marktmieteQm ? o.marktmieteQm * fl : null;
  const preisQm = kp / fl;
  const vp = o.vergleichspreisQm ?? null;
  const preisAbw = vp ? preisQm / vp - 1 : null;
  const mietAbw = ist && vgl ? ist / vgl - 1 : null;
  const faktorIst = ist ? kp / (ist * 12) : null;
  const faktorVergleich = vgl ? kp / (vgl * 12) : null;
  const basisGesamt = (ist ?? vgl);
  const faktorGesamt = basisGesamt ? (kp + sp.kaufpreis) * (1 + nebenkostenSatz(p)) / ((basisGesamt + sp.miete) * 12) : null;
  const marktfaktor = vp && o.marktmieteQm ? vp / (o.marktmieteQm * 12) : null;
  const objFaktor = faktorIst ?? faktorVergleich;
  const faktorAbw = objFaktor && marktfaktor ? objFaktor / marktfaktor - 1 : null;
  const lage = faktorAbw != null ? preislage(faktorAbw) : null;

  // Ursache: Faktor/Marktfaktor = (Preis je m² / Vergleichspreis) ÷ (Miete je m² / Vergleichsmiete); Anteile über Logarithmen
  let ursache: KaufpreisCheck["ursache"] = null;
  if (faktorAbw != null && Math.abs(faktorAbw) > 0.03 && preisAbw != null) {
    const lp = Math.log(1 + preisAbw); const lm = mietAbw != null ? -Math.log(1 + mietAbw) : 0;
    const gleich = Math.sign(lp) === Math.sign(faktorAbw); const mGleich = Math.sign(lm) === Math.sign(faktorAbw);
    const tp = gleich ? Math.abs(lp) : 0; const tm = mGleich ? Math.abs(lm) : 0;
    ursache = tp + tm === 0 ? null : tp / (tp + tm) >= 0.7 ? "preis" : tm / (tp + tm) >= 0.7 ? "miete" : "beides";
  }

  let faktorNachAnpassung: KaufpreisCheck["faktorNachAnpassung"] = null;
  if (pfad && ist && pfad.potenzialMonat > 0 && pfad.vertrag !== "leer") {
    const ziel = pfad.vergleichErreicht ? pfad.vergleichsmiete : pfad.mieteNach.at(-1)?.miete ?? null;
    const wann = pfad.vergleichErreicht ? `ab ${pfad.vergleichErreicht}` : `nach ${pfad.mieteNach.at(-1)?.jahre ?? 0} Jahren`;
    if (ziel && ziel > ist * 1.005) faktorNachAnpassung = { faktor: kp / (ziel * 12), miete: ziel, wann };
  }
  const preisMarktfaktor = marktfaktor && (ist ?? vgl) ? marktfaktor * (ist ?? vgl)! * 12 : null;
  const preisVergleich = vp ? vp * fl : null;
  const ewMiete = vgl ?? ist;
  const ew = ewMiete ? ertragswert(o, ewMiete, fl, kp) : null;

  const fehlt: string[] = [];
  if (!vp) fehlt.push("Vergleichspreis je m²");
  if (!o.marktmieteQm) fehlt.push("ortsübliche Vergleichsmiete");
  if (!o.baujahr) fehlt.push("Baujahr (Restnutzungsdauer)");

  const a: string[] = [];
  if (objFaktor && marktfaktor && faktorAbw != null) {
    a.push(`${faktorIst ? "Faktor" : "Faktor auf die Vergleichsmiete"} ${facDe(objFaktor)} gegenüber ${facDe(marktfaktor)} am Markt (${sgnPct(faktorAbw)}): ${PREISLAGE[lage!]}.`);
    if (preisAbw != null && mietAbw != null && ursache) {
      const pT = `Preis je m² ${sgnPct(preisAbw)} zum Vergleichspreis`, mT = `Miete ${sgnPct(mietAbw)} zur Vergleichsmiete`;
      if (faktorAbw > 0) a.push(ursache === "miete" ? `Der hohe Faktor liegt vor allem an der niedrigen Miete (${mT}; ${pT}). Das ist Potenzial, kein Überpreis, wenn sich die Miete anheben lässt.`
        : ursache === "preis" ? `Der hohe Faktor liegt am Preis (${pT}; ${mT}). Ansatz für die Verhandlung.`
        : `Preis und Miete tragen beide bei (${pT}; ${mT}).`);
      else a.push(ursache === "miete" ? `Der niedrige Faktor kommt von einer hohen Miete (${mT}). Prüfen, ob sie nachhaltig ist; bei Mieterwechsel gilt die Mietpreisbremse.` : ursache === "preis" ? `Der Preis je m² liegt unter dem Markt (${pT}).` : `Preis unter dem Markt und Miete darüber (${pT}; ${mT}).`);
    }
    else if (preisAbw != null && mietAbw != null) a.push(`Preis je m² ${sgnPct(preisAbw)} zum Vergleichspreis, Miete ${sgnPct(mietAbw)} zur Vergleichsmiete.`);
  }
  if (faktorNachAnpassung && faktorIst) a.push(`Nach der Mietanpassung (${faktorNachAnpassung.wann}) sinkt der Faktor auf ${facDe(faktorNachAnpassung.faktor)}.`);
  if (preisMarktfaktor && lage && lage !== "markt" && lage !== "guenstig") {
    // Liegt es an der Miete, ist der Preis auf die nachhaltige Miete zu messen; der Abschlag auf die heutige Miete ist Verhandlungsspielraum
    if (ursache === "miete" && faktorVergleich && marktfaktor) a.push(`Auf die Vergleichsmiete gerechnet liegt der Faktor bei ${facDe(faktorVergleich)} (${sgnPct(faktorVergleich / marktfaktor - 1)} zum Markt). Auf die heutige Miete wäre ein Preis um ${eurDe(preisMarktfaktor)} € marktüblich; die Spanne dazwischen ist der Preis für das Mietpotenzial und Argument in der Verhandlung.`);
    else a.push(`Marktüblich wäre ein Preis um ${eurDe(preisMarktfaktor)} € (Marktfaktor × heutige Miete).`);
  }
  if (ew) a.push(`Ertragswert rund ${eurDe(ew.wert)} € (Spanne ${eurDe(ew.von)} bis ${eurDe(ew.bis)} €); das Angebot liegt ${ew.abweichung >= 0 ? `${pctDe(ew.abweichung)} darüber` : `${pctDe(-ew.abweichung)} darunter`}.`);

  return {
    kaufpreis: kp, flaeche: fl, preisQm, vergleichspreisQm: vp, preisAbw, istMiete: ist, vergleichsmiete: vgl, mietAbw,
    faktorIst, faktorVergleich, faktorGesamt, faktorNachAnpassung, marktfaktor, faktorAbw, lage, ursache,
    preisMarktfaktor, preisVergleich, ertragswert: ew, aussagen: a, fehlt,
  };
}
