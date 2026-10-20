import { analyse, type Analyseeingabe } from "./analyse";
import { nebenkostenSatz, params, simuliere, standardSzenario } from "./core";
import type { Szenario } from "./types";

export interface Strategievorschlag {
  name: string;
  szenario: Partial<Szenario>;
  gruende: string[];
  cashflowMonat: number | null;
  irr: number | null;
}
const eur = (v: number) => `${Math.round(v).toLocaleString("de-DE")} €`;
const pz = (v: number, d = 0) => `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d })} %`;

/**
 * Vorschlag aus Sicht der Vermögensverwaltung, rein gerechnet: Verhandlung, Eigenkapital, Tilgung, Miete und Haltedauer
 * so wählen, dass das Ziel-Cashflow des Anlageprofils erreicht wird, passend zur Risikoneigung. Keine Empfehlung im Einzelfall.
 */
export function strategieVorschlag(e: Analyseeingabe): Strategievorschlag | null {
  const a = analyse(e); const p = params(e.investor, e.anlageprofil); const o = e.objekt;
  if (!a.simulation || !o.kaufpreis || !a.bewertung.miete) return null;
  const r = e.investor.risiko; const ziel = e.anlageprofil.minCashflow ?? 0;
  const gruende: string[] = [];
  const basis = { ...standardSzenario(p), ...(e.szenario ?? {}) };
  const s: Szenario = { ...basis };
  // Tilgung nach Risikoneigung
  s.tilgung = r === "vorsichtig" ? 0.03 : r === "offensiv" ? 0.01 : 0.02;
  gruende.push(`Tilgung ${pz(s.tilgung, 1)} passend zur Risikoneigung „${r}“.`);
  // Miete Richtung Mietspiegel, vermietet höchstens +15 % (Kappungsgrenze)
  if (o.marktmieteQm && o.wohnflaeche) {
    const markt = o.marktmieteQm * o.wohnflaeche; const ist = a.bewertung.miete;
    if (markt > ist * 1.02) { s.mietFaktor = Math.min(markt / ist, o.leer ? markt / ist : 1.15); gruende.push(`Miete auf ${eur(ist * s.mietFaktor)} heben (${o.leer ? "Neuvermietung zum Mietspiegel" : "höchstens 15 % wegen Kappungsgrenze"}).`); }
  }
  // Verhandlung: realistischer Spielraum nach Risikoneigung
  const maxNachlass = r === "offensiv" ? 0.15 : r === "vorsichtig" ? 0.08 : 0.1;
  const cf = (x: Szenario) => simuliere(p, o, a.bewertung.miete, x)?.cashflowJahr1Monat ?? -Infinity;
  let nachlass = 0;
  while (nachlass < maxNachlass && cf({ ...s, kaufpreisAenderung: -nachlass }) < ziel) nachlass += 0.005;
  s.kaufpreisAenderung = -Math.min(nachlass, maxNachlass);
  if (nachlass > 0) gruende.push(`Kaufpreis um ${pz(nachlass, 1)} verhandeln, auf ${eur(o.kaufpreis * (1 - nachlass))}.`);
  // Eigenkapital: vorsichtig voll, sonst so viel wie für das Ziel nötig
  const nk = o.kaufpreis * (1 + s.kaufpreisAenderung) * nebenkostenSatz(p);
  if (r === "vorsichtig") s.eigenkapital = p.eigenkapital;
  else {
    let ek = Math.min(p.eigenkapital, nk);
    while (ek < p.eigenkapital && cf({ ...s, eigenkapital: ek }) < ziel) ek = Math.min(p.eigenkapital, ek + 2500);
    s.eigenkapital = ek;
  }
  gruende.push(`Eigenkapital ${eur(s.eigenkapital)} einsetzen${s.eigenkapital >= p.eigenkapital ? " (alles Verfügbare)" : `, ${eur(p.eigenkapital - s.eigenkapital)} bleiben als Reserve`}.`);
  // Haltedauer: privat mindestens über die Spekulationsfrist
  if (e.investor.struktur !== "gmbh" && s.haltedauer < 11) { s.haltedauer = 11; gruende.push("Haltedauer über 10 Jahre, damit der Verkaufsgewinn privat steuerfrei bleibt."); }
  const sim = simuliere(p, o, a.bewertung.miete, s);
  const erreicht = (sim?.cashflowJahr1Monat ?? -Infinity) >= ziel;
  if (!erreicht) gruende.push(`Ziel-Cashflow ${eur(ziel)} wird auch so nicht erreicht. Nötig wäre ein Kaufpreis um ${a.zielpreise.cashflowNull ? eur(a.zielpreise.cashflowNull) : "–"}, eine Gestaltung oder eine Wertsteigerungsstrategie mit bewusster Zuzahlung.`);
  const szenario: Partial<Szenario> = { kaufpreisAenderung: s.kaufpreisAenderung, eigenkapital: s.eigenkapital, tilgung: s.tilgung, mietFaktor: s.mietFaktor, haltedauer: s.haltedauer };
  return { name: erreicht ? "Vorschlag Vermögensverwaltung" : "Vorschlag Vermögensverwaltung (Ziel verfehlt)", szenario, gruende, cashflowMonat: sim?.cashflowJahr1Monat ?? null, irr: sim?.irr ?? null };
}
