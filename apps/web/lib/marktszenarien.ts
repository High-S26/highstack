import { wertAusMarkt, type Szenario } from "@highstack/engine";
import type { Marktfakt } from "./marktwissen";

/**
 * Marktszenarien: Annahmen für Durchspielen und Wertentwicklung, abgeleitet aus aktuellen Marktdaten.
 * Die Daten selbst werden nicht als Bericht gezeigt, sondern als Grundlage jeder Annahme genannt.
 * Regeln sind bewusst einfach und offen gelegt, damit jede Zahl nachvollziehbar bleibt.
 */
export interface Grundlage { parameter: string; wert: string; text: string; quelle?: string }
export interface Marktszenario { id: "konservativ" | "markt" | "optimistisch"; name: string; kurz: string; s: Partial<Szenario>; grundlagen: Grundlage[]; renditeShift: number; zerlegung: { ausMiete: number; ausRendite: number } }

const BANKMARGE = 0.01; const INFLATIONSZIEL = 0.02;
const zahlAus = (t?: string) => { if (!t) return null; const m = t.replace(/−/g, "-").match(/-?\d+(?:,\d+)?/g); if (!m) return null; const z = m.map(x => Number(x.replace(",", "."))); return z.reduce((a, b) => a + b, 0) / z.length; };
const pz = (v: number, d = 1) => `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d })} %`;

function finde(f: Marktfakt[], test: (x: Marktfakt) => boolean) { return f.filter(test).sort((a, b) => b.rang - a.rang)[0] ?? null; }
const q = (x: Marktfakt) => `${x.quelle} ${x.stand}${x.seite ? `, S. ${x.seite}` : ""}`;

export function marktszenarien(fakten: Marktfakt[], s: Szenario, sollzins: number, bruttorendite: number | null): Marktszenario[] {
  // Mietwachstum am Markt: Stadt vor Top 7 vor Deutschland
  const mw = finde(fakten, x => x.thema === "miete" && /wachstum/i.test(x.kennzahl) && x.wert != null)
    ?? finde(fakten, x => x.thema === "miete" && !!x.veraenderung && /neuvertrag/i.test(x.kennzahl));
  const markt = mw ? (mw.wert != null && /wachstum/i.test(mw.kennzahl) ? mw.wert / 100 : (zahlAus(mw.veraenderung) ?? 2) / 100) : null;
  const inf = finde(fakten, x => x.thema === "makro" && /inflation/i.test(x.kennzahl) && !/kern/i.test(x.kennzahl) && x.wert != null);
  const inflation = inf ? inf.wert! / 100 : null;
  const sw = finde(fakten, x => x.thema === "zins" && /swap/i.test(x.kennzahl)) ?? finde(fakten, x => x.thema === "zins" && /bundesanleihe/i.test(x.kennzahl));
  const swap = sw ? (sw.wert ?? zahlAus(sw.wertText) ?? 0) / 100 : null;
  const sr = finde(fakten, x => x.thema === "rendite" && x.segment === "wohnen" && x.wert != null);

  const mwBasis = markt != null ? Math.max(0, 0.5 * markt + 0.5 * INFLATIONSZIEL) : s.mietsteigerung;
  const kBasis = inflation != null ? 0.5 * inflation + 0.5 * INFLATIONSZIEL : s.kostensteigerung;
  const azBasis = swap != null ? swap + BANKMARGE : sollzins + s.anschlusszinsAufschlag;
  const y0 = bruttorendite ?? (sr?.wert != null ? sr.wert / 100 : 0.04);

  const bau = (id: Marktszenario["id"], name: string, kurz: string, mietst: number, kosten: number, anschluss: number, shift: number, leer: number): Marktszenario => {
    const w = wertAusMarkt(mietst, y0, shift, s.haltedauer);
    const grundlagen: Grundlage[] = [
      { parameter: "Mietsteigerung", wert: `${pz(mietst)} p. a.`, text: markt != null ? `Neuvermietung am Markt ${pz(markt)}; Bestandsmieten folgen langsamer (Mietspiegel, Kappungsgrenze), daher zur Hälfte Richtung 2 % gedämpft${id === "konservativ" ? ", minus 1 Punkt" : id === "optimistisch" ? "; hier volles Marktwachstum" : ""}.` : "Keine Marktdaten zum Ort: Ihre bisherige Annahme.", quelle: mw ? q(mw) : undefined },
      { parameter: "Kostensteigerung", wert: `${pz(kosten)} p. a.`, text: inflation != null ? `Inflation zuletzt ${pz(inflation)}, auf Sicht Richtung 2 % gedämpft${id === "konservativ" ? ", hier die aktuelle Inflation plus 0,5 Punkte" : id === "optimistisch" ? ", hier 2 %" : ""}.` : "Keine Inflationsdaten: Ihre bisherige Annahme.", quelle: inf ? q(inf) : undefined },
      { parameter: "Anschlusszins", wert: pz(anschluss, 2), text: swap != null ? `Zehnjähriger Swap um ${pz(swap, 2)} plus rund 1 Punkt Bankmarge${id === "konservativ" ? ", plus 1 Punkt Zinsrisiko" : id === "optimistisch" ? ", minus 0,5 Punkte" : ""}.` : "Keine Zinsdaten: Ihre bisherige Annahme.", quelle: sw ? q(sw) : undefined },
      { parameter: "Wertentwicklung", wert: `${pz(w.wertentwicklung)} p. a.`, text: `Wert folgt der Miete (${pz(w.ausMiete)}) und der Marktrendite: ${shift === 0 ? "Rendite bleibt wie heute" : shift > 0 ? `Rendite steigt um ${(shift * 100).toLocaleString("de-DE")} Punkte, das drückt den Wert` : `Rendite sinkt um ${(-shift * 100).toLocaleString("de-DE")} Punkte, das hebt den Wert`} (${pz(w.ausRendite)} p. a.).`, quelle: sr ? q(sr) : undefined },
      ...(leer ? [{ parameter: "Leerstand", wert: `+${pz(leer, 0)}`, text: "Puffer für längere Wechsel und schwächere Nachfrage." }] : []),
    ];
    return { id, name, kurz, renditeShift: shift, zerlegung: { ausMiete: w.ausMiete, ausRendite: w.ausRendite }, grundlagen,
      s: { mietsteigerung: mietst, kostensteigerung: kosten, anschlusszinsAufschlag: anschluss - sollzins, wertentwicklung: w.wertentwicklung, leerstandZusatz: leer } };
  };
  return [
    bau("konservativ", "Konservativ", "Zinsen höher, Renditen steigen, Mieten schwach", Math.max(0, mwBasis - 0.01), inflation != null ? inflation + 0.005 : kBasis + 0.01, azBasis + 0.01, 0.005, 0.03),
    bau("markt", "Marktlage", "Fortschreibung der aktuellen Marktdaten", mwBasis, kBasis, azBasis, 0, 0),
    bau("optimistisch", "Optimistisch", "Erholung: Zinsen etwas tiefer, Renditen sinken", markt ?? mwBasis + 0.01, INFLATIONSZIEL, azBasis - 0.005, -0.0025, 0),
  ];
}
export const hatMarktdaten = (f: Marktfakt[]) => f.some(x => x.thema === "miete" || x.thema === "zins" || x.thema === "makro");
