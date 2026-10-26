import type { Aussenart, Objekt } from "./types";

/**
 * Mietrecht für die Kalkulation (Stand Oktober 2026, Informationsmodell, keine Rechtsberatung):
 * - Bestand (§ 558 BGB): Erhöhung bis zur ortsüblichen Vergleichsmiete, frühestens 15 Monate nach Beginn oder letzter Erhöhung
 *   (Verlangen nach 12 Monaten, wirksam ab dem dritten Monat danach), höchstens 20 % in drei Jahren (Kappungsgrenze),
 *   in Gebieten mit Verordnung 15 %. Modernisierungsumlagen (§ 559) zählen nicht dazu.
 * - Neuvermietung (§ 556d ff.): mit Mietpreisbremse höchstens Vergleichsmiete + 10 %, eine höhere Vormiete darf bleiben (§ 556e).
 *   Die Mietpreisbremse ist bis 31.12.2029 verlängert.
 * - Indexmiete (§ 557b): Anpassung an die Inflation höchstens einmal im Jahr, keine Erhöhung nach § 558.
 * - Staffelmiete (§ 557a): feste Stufen, mindestens ein Jahr Abstand, keine Erhöhung nach § 558.
 * - Entwurf Mietrecht II (Kabinett 29.04.2026, im Bundestag): Indexmieten in angespannten Märkten gedeckelt
 *   (Anteil über 3 % Inflation nur zur Hälfte). Noch kein Gesetz, daher nur als Hinweis.
 */
export const MIETRECHT = { sperrMonate: 15, /** Verlangen nach dem Kauf: wirksam ab dem dritten Monat nach Zugang */ fruehestensMonat: 3, kappung: { angespannt: 0.15, normal: 0.2 }, kappungJahre: 3, bremse: 0.1, mindestSchritt: 0.03, indexMonate: 12, bremseBis: "31.12.2029" } as const;

export const AUSSENART: Record<Aussenart, { label: string; anrechnung: number }> = {
  balkon: { label: "Balkon", anrechnung: 0.25 }, loggia: { label: "Loggia", anrechnung: 0.25 }, terrasse: { label: "Terrasse", anrechnung: 0.25 },
  dachterrasse: { label: "Dachterrasse", anrechnung: 0.25 }, wintergarten: { label: "Wintergarten (unbeheizt)", anrechnung: 0.5 }, garten: { label: "Garten", anrechnung: 0 },
};

/** Wohnfläche mit angerechneter Außenfläche: Grundlage für Miete und Preis je m² */
export function flaechen(o: Pick<Objekt, "wohnflaeche" | "aussenflaeche">) {
  const a = o.aussenflaeche; const wf = o.wohnflaeche;
  const angerechnet = a?.qm && !a.inWohnflaeche ? a.qm * Math.min(0.5, Math.max(0, a.anrechnung)) : 0;
  return { wohnflaeche: wf, aussen: a?.qm ?? null, angerechnet, gesamt: wf != null ? wf + angerechnet : null };
}

/** Orte mit Mietpreisbremse und abgesenkter Kappungsgrenze (Auswahl großer Städte mit Quelle); sonst Angabe am Objekt */
const REGULIERT: { muster: RegExp; text: string }[] = [
  { muster: /D(ü|ue)sseldorf|K(ö|oe)ln|Bonn|M(ü|ue)nster|Aachen|Neuss|Ratingen|Meerbusch|Kaarst|Erkrath/i, text: "Mieterschutzverordnung NRW (seit 01.03.2025): Kappungsgrenze 15 % bis 28.02.2030, Mietpreisbremse bis 2029" },
  { muster: /Berlin/i, text: "Berlin: Kappungsgrenze 15 %, Mietpreisbremse stadtweit" },
  { muster: /Hamburg/i, text: "Hamburg: Kappungsgrenze 15 %, Mietpreisbremse stadtweit" },
  { muster: /M(ü|ue)nchen/i, text: "München: Kappungsgrenze 15 %, Mietpreisbremse (Mieterschutzverordnung Bayern)" },
  { muster: /Frankfurt/i, text: "Frankfurt am Main: Kappungsgrenze 15 %, Mietpreisbremse (Hessen)" },
  { muster: /Stuttgart/i, text: "Stuttgart: Kappungsgrenze 15 %, Mietpreisbremse (Baden-Württemberg)" },
];
export interface Regulierung { angespannt: boolean; kappung: number; bremse: boolean; text: string; geprueft: boolean }
export function regulierung(o: Pick<Objekt, "ort" | "mietregulierung">): Regulierung {
  const r = (angespannt: boolean, text: string, geprueft: boolean): Regulierung => ({ angespannt, kappung: angespannt ? MIETRECHT.kappung.angespannt : MIETRECHT.kappung.normal, bremse: angespannt, text, geprueft });
  if (o.mietregulierung === "angespannt") return r(true, "Angespannter Wohnungsmarkt (Ihre Angabe): Kappungsgrenze 15 %, Mietpreisbremse", true);
  if (o.mietregulierung === "normal") return r(false, "Keine Verordnung am Ort (Ihre Angabe): Kappungsgrenze 20 %, keine Mietpreisbremse", true);
  const t = REGULIERT.find(x => x.muster.test(o.ort ?? ""));
  if (t) return r(true, t.text, true);
  return r(true, "Ob am Ort Mietpreisbremse und abgesenkte Kappungsgrenze gelten, ist nicht hinterlegt: vorsichtig mit 15 % und Mietpreisbremse gerechnet. Bitte bei der Gemeinde oder dem Land prüfen.", false);
}

const aktuellerMonat = () => new Date().toISOString().slice(0, 7);
/** Monate von a bis b (JJJJ-MM) */
export function monateZwischen(a: string, b: string): number {
  const [ja, ma] = a.split("-").map(Number) as [number, number]; const [jb, mb] = b.split("-").map(Number) as [number, number];
  return (jb - ja) * 12 + (mb - ma);
}
/** Monat x Monate nach dem Stichtag als „MM/JJJJ“ */
export function monatLabel(stichtag: string, m: number): string {
  const [j, mo] = stichtag.split("-").map(Number) as [number, number]; const t = j * 12 + (mo - 1) + m;
  return `${String((t % 12) + 1).padStart(2, "0")}/${Math.floor(t / 12)}`;
}

export interface Mietschritt { monat: number; datum: string; miete: number; vorher: number; art: "558" | "neuvermietung" | "index" | "staffel" | "leerstand"; grund: string }
export interface Mietpfad {
  /** Kaltmiete der Wohnung je Haltejahr (Summe der Monate, ohne pauschalen Mietausfall) */
  jahre: number[];
  start: number; flaeche: number; istQm: number;
  vergleichsmieteQm: number; vergleichsmiete: number;
  /** Ist-Miete gegenüber Vergleichsmiete (+ = darüber) */
  abstand: number;
  potenzialMonat: number;
  zulaessigNeuvermietung: number | null;
  neuvermietungHeute: number;
  regulierung: Regulierung;
  vertrag: "standard" | "staffel" | "index" | "leer";
  ersteErhoehung: Mietschritt | null;
  vergleichErreicht: string | null;
  mieteNach: { jahre: number; miete: number }[];
  schritte: Mietschritt[];
  hinweise: string[];
}

const de = (v: number, d = 0) => v.toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d });

/**
 * Mietpfad Monat für Monat über die Haltedauer: wann und wie weit die Miete rechtlich steigen darf.
 * vmSteigerung: jährliche Entwicklung der ortsüblichen Vergleichsmiete; inflation: für Indexmieten.
 * null, wenn Fläche oder Vergleichsmiete fehlen.
 */
export function mietpfad(o: Objekt, opts: { jahre: number; vmSteigerung: number; inflation: number; stichtag?: string }): Mietpfad | null {
  const fl = flaechen(o).gesamt; const vmQm = o.marktmieteQm;
  if (!fl || !vmQm || !(fl > 0) || !(vmQm > 0)) return null;
  const heute = opts.stichtag ?? aktuellerMonat();
  const reg = regulierung(o); const mv = o.mietvertrag ?? { art: "standard" as const };
  const g = opts.vmSteigerung; const H = Math.max(1, Math.min(60, Math.round(opts.jahre)));
  const vm = (m: number) => vmQm * fl * Math.pow(1 + g, m / 12);
  const ziel = (m: number) => (o.neuvermietungQm && o.neuvermietungQm > 0 ? o.neuvermietungQm : vmQm) * fl * Math.pow(1 + g, m / 12);
  const zul = (m: number) => reg.bremse ? vm(m) * (1 + MIETRECHT.bremse) : Infinity;
  const neuvermietung = (m: number, vormiete: number) => Math.min(ziel(m), Math.max(zul(m), vormiete));
  const hinweise: string[] = []; const schritte: Mietschritt[] = [];
  const leer = o.leer || !o.miete;
  let miete: number; let art: "standard" | "staffel" | "index" = leer ? "standard" : mv.art; let letzte: number;
  if (leer) { miete = neuvermietung(0, 0); letzte = 0; schritte.push({ monat: 0, datum: monatLabel(heute, 0), miete, vorher: 0, art: "neuvermietung", grund: reg.bremse ? `Neuvermietung zu ${de(miete / fl, 2)} €/m² (zulässig bis ${de(zul(0) / fl, 2)} €/m², Vergleichsmiete + 10 %)` : `Neuvermietung zu ${de(miete / fl, 2)} €/m²` }); }
  else {
    miete = o.miete!;
    if (mv.letzteErhoehung && /^\d{4}-\d{2}$/.test(mv.letzteErhoehung)) letzte = -Math.max(0, monateZwischen(mv.letzteErhoehung, heute));
    else { letzte = 0; if (art === "standard") hinweise.push("Datum der letzten Mieterhöhung unbekannt: vorsichtig gerechnet, als sei die Miete gerade erhöht worden (nächste Erhöhung frühestens in 15 Monaten). Datum beim Verkäufer erfragen."); }
  }
  const start = miete; const verlauf: number[] = [];
  /** Miete vor m Monaten (für die Kappungsgrenze); vor dem Kauf gilt die Startmiete */
  let vertragsbeginn = leer ? 0 : -Infinity;
  const mieteVor = (m: number) => { const k = Math.max(m, vertragsbeginn); return k < 0 ? start : verlauf[k] ?? start; };
  const wechsel = !leer && mv.mieterwechselJahr && mv.mieterwechselJahr >= 1 ? (Math.round(mv.mieterwechselJahr) - 1) * 12 : null;
  let leerMonat = -1;
  for (let m = 0; m < H * 12; m++) {
    if (m === wechsel) {
      const neu = neuvermietung(m + 1, miete);
      schritte.push({ monat: m, datum: monatLabel(heute, m), miete: 0, vorher: miete, art: "leerstand", grund: "Mieterwechsel: ein Monat ohne Miete" });
      schritte.push({ monat: m + 1, datum: monatLabel(heute, m + 1), miete: neu, vorher: miete, art: "neuvermietung", grund: neu < miete ? `Neuvermietung unter der bisherigen Miete (Ziel ${de(ziel(m + 1) / fl, 2)} €/m²)` : reg.bremse ? `Neuvermietung, zulässig bis ${de(Math.max(zul(m + 1), miete) / fl, 2)} €/m² (Vergleichsmiete + 10 % oder Vormiete)` : "Neuvermietung zur Marktmiete" });
      miete = neu; art = "standard"; letzte = m + 1; leerMonat = m; vertragsbeginn = m + 1;
    } else {
      if (art === "standard" && m - letzte >= MIETRECHT.sperrMonate && (m >= MIETRECHT.fruehestensMonat || leer)) {
        const kappe = mieteVor(m - MIETRECHT.kappungJahre * 12) * (1 + reg.kappung);
        const neu = Math.min(vm(m), kappe);
        if (neu >= miete * (1 + MIETRECHT.mindestSchritt)) {
          schritte.push({ monat: m, datum: monatLabel(heute, m), miete: neu, vorher: miete, art: "558", grund: neu >= vm(m) - 0.5 ? "Erhöhung bis zur ortsüblichen Vergleichsmiete (§ 558 BGB)" : `Erhöhung bis zur Kappungsgrenze (${de(reg.kappung * 100)} % in drei Jahren)` });
          miete = neu; letzte = m;
        }
      } else if (art === "index" && m - letzte >= MIETRECHT.indexMonate && m >= MIETRECHT.fruehestensMonat) {
        const neu = miete * Math.pow(1 + opts.inflation, (m - letzte) / 12);
        if (neu > miete) { schritte.push({ monat: m, datum: monatLabel(heute, m), miete: neu, vorher: miete, art: "index", grund: `Indexanpassung (Inflation ${de(opts.inflation * 100, 1)} % p. a.)` }); miete = neu; letzte = m; }
      } else if (art === "staffel" && m - letzte >= 12 && (mv.staffelProzent ?? 0) !== 0) {
        const neu = miete * (1 + (mv.staffelProzent ?? 0));
        schritte.push({ monat: m, datum: monatLabel(heute, m), miete: neu, vorher: miete, art: "staffel", grund: `Staffel laut Vertrag (${de((mv.staffelProzent ?? 0) * 100, 1)} %)` }); miete = neu; letzte = m;
      }
    }
    verlauf[m] = m === leerMonat ? 0 : miete;
  }
  const jahre = Array.from({ length: H }, (_, t) => verlauf.slice(t * 12, t * 12 + 12).reduce((a, x) => a + x, 0));
  const vergleichsmiete = vm(0);
  const erreichtM = verlauf.findIndex((x, m) => x > 0 && x >= vm(m) * 0.995);
  const ersteErhoehung = schritte.find(x => x.art === "558" || x.art === "index" || x.art === "staffel") ?? null;
  const mieteNach = [1, 3, 5, 10].filter(j => j <= H).map(j => ({ jahre: j, miete: verlauf[j * 12 - 1] ?? miete }));

  if (!leer && art === "standard" && start > vergleichsmiete * 1.005) hinweise.push(`Die Ist-Miete liegt ${de((start / vergleichsmiete - 1) * 100)} % über der Vergleichsmiete: keine Erhöhung nach § 558 möglich, bis die Vergleichsmiete aufholt. Bei einem Mieterwechsel darf die Vormiete bleiben, eine höhere Miete nur ohne Mietpreisbremse.`);
  if (!leer && mv.art === "index") hinweise.push(`Indexmiete: keine Erhöhung nach § 558, Anpassung höchstens jährlich an die Inflation.${reg.angespannt ? " Der Entwurf Mietrecht II würde Indexanpassungen über 3 % Inflation in angespannten Märkten nur zur Hälfte zulassen (noch kein Gesetz)." : ""}`);
  if (!leer && mv.art === "staffel") hinweise.push("Staffelmiete: Erhöhungen nur laut Staffel, keine Erhöhung nach § 558. Bei Mietpreisbremse muss jede Stufe für sich zulässig sein.");
  if (!reg.geprueft) hinweise.push(reg.text);
  if (o.neuvermietungQm && reg.bremse && o.neuvermietungQm * fl > zul(0)) hinweise.push(`Angestrebte Neuvermietungsmiete ${de(o.neuvermietungQm, 2)} €/m² liegt über dem zulässigen Rahmen (${de(zul(0) / fl, 2)} €/m²); gerechnet wird mit dem zulässigen Wert, es sei denn, eine Ausnahme greift (Neubau ab Oktober 2014, umfassende Modernisierung, höhere Vormiete).`);

  return {
    jahre, start, flaeche: fl, istQm: start / fl, vergleichsmieteQm: vmQm, vergleichsmiete,
    abstand: start / vergleichsmiete - 1, potenzialMonat: Math.max(0, vergleichsmiete - (leer ? 0 : start)),
    zulaessigNeuvermietung: reg.bremse ? Math.max(zul(0), leer ? 0 : start) : null, neuvermietungHeute: neuvermietung(0, leer ? 0 : start),
    regulierung: reg, vertrag: leer ? "leer" : mv.art, ersteErhoehung, vergleichErreicht: erreichtM >= 0 ? monatLabel(heute, erreichtM) : null,
    mieteNach, schritte, hinweise,
  };
}
