import type { Objekt } from "@highstack/engine";
import type { Marktwerte } from "@highstack/agents";

/**
 * Grobe Orientierung ohne KI (Testmodus oder Ausfall): Mietspiegel-Niveau, Kaufpreis Bestand und
 * Bodenrichtwert mittlere Lage für größere Städte, angepasst nach Baujahr, Größe und Energieklasse.
 * Bewusst breite Spannen; die KI-Schätzung oder der örtliche Mietspiegel ersetzen sie.
 */
const STAEDTE: [string, number, number, number][] = [
  ["münchen", 14.5, 8000, 2500], ["frankfurt", 11.5, 5200, 1500], ["stuttgart", 11.5, 4800, 1500], ["hamburg", 9.8, 5200, 1300],
  ["berlin", 7.8, 4800, 1500], ["düsseldorf", 10, 4300, 1200], ["köln", 10, 4300, 1100], ["bonn", 9.5, 3800, 700],
  ["mainz", 9.5, 4200, 900], ["wiesbaden", 9.5, 3900, 900], ["münster", 9.5, 3900, 700], ["nürnberg", 9.5, 3800, 900],
  ["neuss", 9, 3300, 600], ["hannover", 8.5, 3200, 600], ["bremen", 7.5, 2600, 400], ["dresden", 7, 2700, 450],
  ["leipzig", 6.8, 2600, 400], ["essen", 7.2, 2200, 380], ["dortmund", 7.2, 2300, 350], ["duisburg", 6.5, 1700, 280],
];
const rund = (v: number, s: number) => Math.round(Math.round(v / s) * s * 100) / 100;
/** Stadt nur aus dem Ort, als ganzes Wort („Hamburger Straße“ ist nicht Hamburg, „Interessenten“ nicht Essen); längster Treffer gewinnt */
export function stadtAus(ort: string | undefined) {
  const o = (ort ?? "").toLowerCase();
  return STAEDTE.filter(([n]) => new RegExp(`(^|[^a-zäöüß])${n}($|[^a-zäöüß])`).test(o)).sort((a, b) => b[0].length - a[0].length)[0] ?? null;
}

export function orientierung(o: Pick<Objekt, "ort" | "titel" | "baujahr" | "wohnflaeche" | "energieklasse">): Marktwerte {
  const stadt = stadtAus(o.ort);
  let [miete, kauf, boden] = stadt ? stadt.slice(1) as [number, number, number] : [8, 2800, 300];
  const bj = o.baujahr ?? null;
  if (bj && bj >= 2015) { miete *= 1.18; kauf *= 1.25; } else if (bj && bj >= 2000) { miete *= 1.08; kauf *= 1.1; } else if (bj && bj < 1950) { kauf *= 0.95; }
  if (o.wohnflaeche && o.wohnflaeche < 45) miete *= 1.08;
  if (o.energieklasse && /^[FGH]/.test(o.energieklasse)) { kauf *= 0.92; miete *= 0.97; }
  const b = stadt ? 0.15 : 0.3;
  const sp = (v: number, s: number) => ({ wert: rund(v, s), von: rund(v * (1 - b), s), bis: rund(v * (1 + b), s) });
  return {
    marktmieteQm: sp(miete, 0.1), vergleichspreisQm: sp(kauf, 50), bodenrichtwert: sp(boden, 10),
    grundlage: stadt ? `Grobe Orientierung für ${stadt[0][0].toUpperCase()}${stadt[0].slice(1)} nach typischem Mietspiegel- und Preisniveau, angepasst an Baujahr, Größe und Energieklasse. Ohne Stadtteil.` : "Keine Stadt erkannt: bundesweiter Durchschnitt, sehr grob.",
    stand: "Feste Grobtabelle von highstack (ohne KI), Niveau etwa 2025",
    sicherheit: stadt ? "mittel" : "niedrig",
    hinweise: ["Qualifizierten Mietspiegel der Stadt prüfen", "Kaufpreise: Grundstücksmarktbericht des Gutachterausschusses", "Bodenrichtwert: BORIS des Landes"],
  };
}
