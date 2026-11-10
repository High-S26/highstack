/**
 * DAX-Tagestrade: Signal zur Eröffnung, Wahl des Produkts (ETF oder Knock-out) und Rückblick ohne Rückschaufehler.
 *
 * Entscheidung zur Xetra-Eröffnung (9:00) mit dem, was dann bekannt ist: DAX bis zum Vortag, US-Schluss vom Vorabend,
 * Nikkei vom selben Morgen, Eröffnungslücke. Ausstieg zum Schluss (17:30) oder am Stopp.
 * Welche Faktoren zählen und in welche Richtung, lernt das Modell nur aus Tagen vor dem jeweiligen Tag (Walk-forward).
 * Faktoren ohne belegten Vorteil bekommen Gewicht 0. Nur Information, keine Anlageberatung.
 */

export interface Tageskerze { d: string; o: number; h: number; l: number; c: number }
export const DAX_ISIN = "DE0008469008";
/** iShares Core DAX UCITS ETF (DE), bildet den DAX 1:1 ab */
export const DAX_ETF_ISIN = "DE0005933931";

export type FaktorId = "us" | "asien" | "trend" | "vortag" | "luecke";
export const FAKTOREN: Record<FaktorId, { name: string; text: string }> = {
  us: { name: "US-Schluss am Vorabend", text: "S&P 500 am Vorabend, nach dem DAX-Schluss" },
  asien: { name: "Asien am Morgen", text: "Nikkei 225, schließt vor der DAX-Eröffnung" },
  trend: { name: "Trend", text: "DAX über oder unter den 20- und 50-Tage-Durchschnitten" },
  vortag: { name: "Vortag", text: "Richtung des DAX am Vortag" },
  luecke: { name: "Eröffnungslücke", text: "Eröffnung gegenüber dem Vortagesschluss" },
};
const SCHWELLE: Record<FaktorId, number> = { us: 0.003, asien: 0.005, trend: 0, vortag: 0.003, luecke: 0.0025 };

export interface Faktorwert { id: FaktorId; wert: -1 | 0 | 1; roh: number | null; text: string }
export interface Faktorgewicht { id: FaktorId; n: number; treffer: number; schnitt: number; t: number; gewicht: number }

/** Lage am Morgen von `datum`: nur Daten, die zur Eröffnung bekannt sind */
export interface Morgenlage { datum: string; dax: Tageskerze[]; spx: Tageskerze[]; nikkei: Tageskerze[]; eroeffnung: number | null }

const sma = (k: Tageskerze[], n: number) => k.length >= n ? k.slice(-n).reduce((a, x) => a + x.c, 0) / n : null;
const sgn = (v: number, s: number): -1 | 0 | 1 => v > s ? 1 : v < -s ? -1 : 0;
const pct = (v: number, d = 1) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d })} %`;

/** Durchschnittliche Tagesspanne (True Range) der letzten n Tage in Punkten */
export function atr(k: Tageskerze[], n = 14): number | null {
  if (k.length < n + 1) return null; let s = 0;
  for (let i = k.length - n; i < k.length; i++) { const x = k[i]!, v = k[i - 1]!; s += Math.max(x.h - x.l, Math.abs(x.h - v.c), Math.abs(x.l - v.c)); }
  return s / n;
}

export function faktoren(m: Morgenlage): Faktorwert[] {
  const d = m.dax; const letzte = d.at(-1); const vor = d.at(-2);
  const spx = m.spx.filter(x => x.d < m.datum); const s1 = spx.at(-1), s0 = spx.at(-2);
  const nk = m.nikkei.find(x => x.d === m.datum); const nkVor = m.nikkei.filter(x => x.d < m.datum).at(-1);
  const r: Faktorwert[] = [];
  const us = s1 && s0 ? s1.c / s0.c - 1 : null;
  r.push({ id: "us", wert: us == null ? 0 : sgn(us, SCHWELLE.us), roh: us, text: us == null ? "keine Daten" : `S&P 500 ${pct(us)} (${s1!.d})` });
  const as = nk && nkVor ? nk.c / nkVor.c - 1 : null;
  r.push({ id: "asien", wert: as == null ? 0 : sgn(as, SCHWELLE.asien), roh: as, text: as == null ? "Nikkei heute noch ohne Schluss" : `Nikkei ${pct(as)}` });
  const s20 = sma(d, 20), s50 = sma(d, 50);
  const tr = letzte && s20 && s50 ? (letzte.c > s20 && s20 > s50 ? 1 : letzte.c < s20 && s20 < s50 ? -1 : 0) : 0;
  r.push({ id: "trend", wert: tr, roh: letzte && s50 ? letzte.c / s50 - 1 : null, text: !s50 ? "zu wenig Historie" : tr === 1 ? "Aufwärtstrend (über 20- und 50-Tage-Linie)" : tr === -1 ? "Abwärtstrend (unter 20- und 50-Tage-Linie)" : "kein klarer Trend" });
  const vt = letzte && vor ? letzte.c / vor.c - 1 : null;
  r.push({ id: "vortag", wert: vt == null ? 0 : sgn(vt, SCHWELLE.vortag), roh: vt, text: vt == null ? "keine Daten" : `DAX gestern ${pct(vt)}` });
  const lu = letzte && m.eroeffnung ? m.eroeffnung / letzte.c - 1 : null;
  r.push({ id: "luecke", wert: lu == null ? 0 : sgn(lu, SCHWELLE.luecke), roh: lu, text: lu == null ? "Eröffnung noch offen" : `Eröffnung ${pct(lu, 2)} zum Vortag` });
  return r;
}

/** Ein Handelstag der Historie mit den Faktoren zur Eröffnung und dem Ergebnis bis zum Schluss */
interface Lerntag { d: string; f: Record<FaktorId, number>; o: number; h: number; l: number; c: number; atr: number }

/** Historie in Lerntage zerlegen. Nur Tage mit DAX-Kerze; Faktoren aus Daten vor der Eröffnung. */
export function lerntage(dax: Tageskerze[], spx: Tageskerze[], nikkei: Tageskerze[]): Lerntag[] {
  const out: Lerntag[] = []; let si = 0, ni = 0;
  for (let i = 60; i < dax.length; i++) {
    const t = dax[i]!; const hist = dax.slice(Math.max(0, i - 60), i);
    while (si < spx.length && spx[si]!.d < t.d) si++;
    while (ni < nikkei.length && nikkei[ni]!.d <= t.d) ni++;
    const m: Morgenlage = { datum: t.d, dax: hist, spx: spx.slice(Math.max(0, si - 3), si), nikkei: nikkei.slice(Math.max(0, ni - 3), ni), eroeffnung: t.o };
    const a = atr(hist); if (!a) continue;
    const f = Object.fromEntries(faktoren(m).map(x => [x.id, x.wert])) as Record<FaktorId, number>;
    out.push({ d: t.d, f, o: t.o, h: t.h, l: t.l, c: t.c, atr: a });
  }
  return out;
}

/** Gewichte aus vergangenen Tagen: Richtung und Stärke nur, wenn der Vorteil statistisch belegt ist (|t| ≥ 2) */
export function gewichte(tage: Lerntag[]): Faktorgewicht[] {
  return (Object.keys(FAKTOREN) as FaktorId[]).map(id => {
    const r = tage.filter(x => x.f[id] !== 0).map(x => x.f[id]! * (x.c / x.o - 1));
    const n = r.length; if (n < 30) return { id, n, treffer: 0, schnitt: 0, t: 0, gewicht: 0 };
    const m = r.reduce((a, b) => a + b, 0) / n; const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
    const t = sd > 0 ? m / (sd / Math.sqrt(n)) : 0;
    return { id, n, treffer: r.filter(x => x > 0).length / n, schnitt: m, t, gewicht: Math.abs(t) >= 2 ? Math.sign(t) * Math.min(1, Math.abs(t) / 4) : 0 };
  });
}

export const SIGNAL_SCHWELLE = 0.35;
export const STOPP_ATR = 0.5;
const punkte = (f: Record<FaktorId, number>, g: Faktorgewicht[]) => g.reduce((a, x) => a + x.gewicht * (f[x.id] ?? 0), 0);

export interface Rueckblicktag { d: string; richtung: "long" | "short"; ergebnis: number; gestoppt: boolean }
export interface DaxRueckblick {
  von: string; bis: string; tage: number;
  trades: number; trefferquote: number; schnitt: number; summe: number; gewinnfaktor: number | null; maxRueckgang: number;
  /** Vergleich: jeden Tag zur Eröffnung kaufen, zum Schluss verkaufen (mit Stopp und Kosten wie oben) */
  immerLong: { trades: number; trefferquote: number; schnitt: number; summe: number };
  faktoren: Faktorgewicht[];
  letzte: Rueckblicktag[];
  kosten: number;
}

/** Ergebnis eines Tagestrades in Prozent des DAX (Stopp in ATR, Kosten je Runde als Anteil) */
function tradeErgebnis(t: Lerntag, richtung: "long" | "short", kosten: number) {
  const stopp = STOPP_ATR * t.atr;
  if (richtung === "long") { const s = t.o - stopp; if (t.l <= s) return { r: -stopp / t.o - kosten, gestoppt: true }; return { r: t.c / t.o - 1 - kosten, gestoppt: false }; }
  const s = t.o + stopp; if (t.h >= s) return { r: -stopp / t.o - kosten, gestoppt: true }; return { r: 1 - t.c / t.o - kosten, gestoppt: false };
}

/**
 * Walk-forward-Rückblick: an jedem Tag entscheiden nur die Gewichte aus den Tagen davor (mindestens `lernen` Tage).
 * Kosten je Runde (Spread, Gebühren) als Anteil am Basiswert, Standard 0,03 %.
 */
export function rueckblickDax(dax: Tageskerze[], spx: Tageskerze[], nikkei: Tageskerze[], opts: { lernen?: number; kosten?: number; neuLernenAlle?: number } = {}): DaxRueckblick | null {
  const tage = lerntage(dax, spx, nikkei); const L = opts.lernen ?? 500; const k = opts.kosten ?? 0.0003; const alle = opts.neuLernenAlle ?? 20;
  if (tage.length < L + 50) return null;
  const ergebnisse: Rueckblicktag[] = []; const base: number[] = []; let g = gewichte(tage.slice(0, L));
  for (let i = L; i < tage.length; i++) {
    if ((i - L) % alle === 0) g = gewichte(tage.slice(0, i));
    const t = tage[i]!; const p = punkte(t.f, g);
    base.push(tradeErgebnis(t, "long", k).r);
    if (Math.abs(p) < SIGNAL_SCHWELLE) continue;
    const richtung = p > 0 ? "long" : "short"; const e = tradeErgebnis(t, richtung, k);
    ergebnisse.push({ d: t.d, richtung, ergebnis: e.r, gestoppt: e.gestoppt });
  }
  const r = ergebnisse.map(x => x.ergebnis); const gew = r.filter(x => x > 0).reduce((a, b) => a + b, 0); const verl = -r.filter(x => x < 0).reduce((a, b) => a + b, 0);
  let hoch = 0, kum = 0, dd = 0; for (const x of r) { kum += x; hoch = Math.max(hoch, kum); dd = Math.max(dd, hoch - kum); }
  const stat = (v: number[]) => ({ trades: v.length, trefferquote: v.length ? v.filter(x => x > 0).length / v.length : 0, schnitt: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0, summe: v.reduce((a, b) => a + b, 0) });
  return {
    von: tage[L]!.d, bis: tage.at(-1)!.d, tage: tage.length - L, ...stat(r), gewinnfaktor: verl > 0 ? gew / verl : null, maxRueckgang: dd,
    immerLong: stat(base), faktoren: gewichte(tage), letzte: ergebnisse.slice(-15).reverse(), kosten: k,
  };
}

export interface Tagessignal {
  datum: string; richtung: "long" | "short" | "keine"; punkte: number; staerke: number;
  faktoren: (Faktorwert & { gewicht: number })[];
  gruende: string[]; gegen: string[];
  bezug: number | null; atr: number | null; stoppPunkte: number | null; stopp: number | null;
  /** Hinweise aus dem Wirtschaftskalender (Pausen, Risiko) */
  termine: string[];
  risikoFaktor: number;
}

/** Signal für heute mit Gewichten aus der ganzen Historie bis gestern */
export function tagessignal(m: Morgenlage, g: Faktorgewicht[], termine: { titel: string; zeit?: string | null; wichtig?: boolean }[] = []): Tagessignal {
  const f = faktoren(m); const gw = Object.fromEntries(g.map(x => [x.id, x.gewicht])) as Record<FaktorId, number>;
  const p = f.reduce((a, x) => a + (gw[x.id] ?? 0) * x.wert, 0);
  const richtung = p >= SIGNAL_SCHWELLE ? "long" : p <= -SIGNAL_SCHWELLE ? "short" : "keine";
  const mitG = f.map(x => ({ ...x, gewicht: gw[x.id] ?? 0 }));
  const beitrag = (x: typeof mitG[number]) => x.gewicht * x.wert;
  const dafuer = mitG.filter(x => richtung !== "keine" && Math.sign(beitrag(x)) === (richtung === "long" ? 1 : -1));
  const dagegen = mitG.filter(x => richtung !== "keine" && beitrag(x) !== 0 && Math.sign(beitrag(x)) !== (richtung === "long" ? 1 : -1));
  const a = atr(m.dax); const bezug = m.eroeffnung ?? m.dax.at(-1)?.c ?? null; const sp = a ? STOPP_ATR * a : null;
  const wichtig = termine.filter(t => t.wichtig !== false);
  const gruende = dafuer.map(x => `${FAKTOREN[x.id].name}: ${x.text}${x.gewicht < 0 ? " (wirkte bisher eher gegenläufig)" : ""}`);
  if (richtung === "keine") gruende.push(mitG.every(x => x.gewicht === 0) ? "Kein Faktor hatte in der Historie einen belegten Vorteil." : "Die Faktoren mit belegtem Vorteil geben heute keine klare Richtung.");
  const gegen = dagegen.map(x => `${FAKTOREN[x.id].name}: ${x.text}`);
  if (!m.eroeffnung) gegen.push("Eröffnung noch nicht bekannt: Die Lücke fließt erst ab 9:00 ein.");
  return {
    datum: m.datum, richtung, punkte: p, staerke: Math.min(1, Math.abs(p) / 1.5), faktoren: mitG, gruende, gegen,
    bezug, atr: a, stoppPunkte: sp, stopp: bezug && sp ? (richtung === "short" ? bezug + sp : bezug - sp) : null,
    termine: wichtig.map(t => `${t.zeit ? `${t.zeit} ` : ""}${t.titel}`), risikoFaktor: wichtig.length ? 0.5 : 1,
  };
}

export interface Produktplan {
  budget: number; risikoEuro: number; stoppProzent: number; gebuehren: number;
  etf: { einsatz: number; verlustBeiStopp: number; jeProzent: number };
  ko: { hebel: number; barriere: number; abstandProzent: number; einsatz: number; verlustBeiStopp: number; jeProzent: number; stoppImProdukt: number };
  szenarien: { dax: number; etf: number; ko: number }[];
  hinweise: string[];
}

/**
 * Produkt zum Signal. Knock-out: Barriere deutlich jenseits des Stopps (mindestens 3 × Stopp-Abstand und 1,5 Tagesspannen),
 * damit der eigene Stopp vor dem Knock-out greift; Hebel daraus, höchstens `maxHebel`.
 * Einsatz so, dass am Stopp höchstens `risikoProzent` des Budgets verloren gehen (inkl. Gebühren).
 */
export function produktplan(p: { dax: number; richtung: "long" | "short"; atr: number; budget: number; risikoProzent: number; gebuehrJeOrder?: number; maxHebel?: number; risikoFaktor?: number }): Produktplan {
  const geb = (p.gebuehrJeOrder ?? 0.99) * 2; const maxH = p.maxHebel ?? 20;
  const stoppP = STOPP_ATR * p.atr; const stoppPct = stoppP / p.dax;
  const risiko = Math.max(0, p.budget * p.risikoProzent * (p.risikoFaktor ?? 1));
  const abstandMin = Math.max(3 * stoppP, 1.5 * p.atr) / p.dax;
  const hebel = Math.max(1, Math.min(maxH, 1 / abstandMin)); const abstand = 1 / hebel;
  const barriere = p.richtung === "long" ? p.dax * (1 - abstand) : p.dax * (1 + abstand);
  const verfuegbar = Math.max(0, risiko - geb);
  const etfE = Math.min(p.budget, verfuegbar / stoppPct); const koE = Math.min(p.budget, verfuegbar / (stoppPct * hebel));
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const szen = [0.01, 0.005, -stoppPct, -0.01].map(dx => { const mit = p.richtung === "long" ? dx : -dx; const stopp = Math.max(mit, -stoppPct); return { dax: dx, etf: r2(etfE * stopp - geb), ko: r2(koE * Math.max(-1, stopp * hebel) - geb) }; });
  const hinweise: string[] = [];
  if (geb / Math.max(1, koE) > 0.05) hinweise.push(`Die Gebühren (${r2(geb).toLocaleString("de-DE")} € für Kauf und Verkauf) sind ${Math.round(geb / Math.max(1, koE) * 100)} % des Einsatzes. Bei so kleinen Beträgen fressen sie den Vorteil; Scalable PRIME+ handelt ab 250 € ohne Ordergebühr.`);
  if (risiko <= geb) hinweise.push("Das Risiko je Trade ist kleiner als die Gebühren: Bei diesem Budget lohnt sich kein Tagestrade.");
  if (hebel >= maxH) hinweise.push(`Hebel auf ${maxH} begrenzt; die Barriere liegt dadurch weiter weg als nötig.`);
  hinweise.push("Knock-out: Wird die Barriere erreicht, verfällt das Produkt fast wertlos. Der Hebel ändert sich mit dem Kurs; Werte sind Näherungen.");
  return {
    budget: p.budget, risikoEuro: r2(risiko), stoppProzent: stoppPct, gebuehren: geb,
    etf: { einsatz: r2(etfE), verlustBeiStopp: r2(etfE * stoppPct + geb), jeProzent: r2(etfE * 0.01) },
    ko: { hebel: Math.round(hebel * 10) / 10, barriere: Math.round(barriere), abstandProzent: abstand, einsatz: r2(koE), verlustBeiStopp: r2(koE * stoppPct * hebel + geb), jeProzent: r2(koE * 0.01 * hebel), stoppImProdukt: stoppPct * hebel },
    szenarien: szen, hinweise,
  };
}

/** CSV mit Tageskerzen lesen (Stooq: Date,Open,High,Low,Close[,Volume]; auch Semikolon und deutsche Zahlen) */
export function leseKerzenCsv(csv: string): Tageskerze[] {
  const zeilen = csv.trim().split(/\r?\n/); if (zeilen.length < 2) return [];
  const sep = zeilen[0]!.includes(";") ? ";" : ",";
  const kopf = zeilen[0]!.toLowerCase().split(sep).map(s => s.trim().replace(/"/g, ""));
  const ix = (...n: string[]) => kopf.findIndex(k => n.includes(k));
  const iD = ix("date", "datum"), iO = ix("open", "eröffnung", "erster"), iH = ix("high", "hoch"), iL = ix("low", "tief"), iC = ix("close", "schluss", "schlusskurs", "letzter");
  if ([iD, iO, iH, iL, iC].some(i => i < 0)) throw new Error("CSV braucht die Spalten Date, Open, High, Low, Close.");
  const z = (s: string | undefined) => { if (!s) return NaN; const t = s.replace(/"/g, "").trim(); return Number(sep === ";" ? t.replace(/\./g, "").replace(",", ".") : t); };
  const datum = (s: string) => { const t = s.replace(/"/g, "").trim(); const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); return m ? `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}` : t.slice(0, 10); };
  return zeilen.slice(1).map(l => l.split(sep)).map(c => ({ d: datum(c[iD] ?? ""), o: z(c[iO]), h: z(c[iH]), l: z(c[iL]), c: z(c[iC]) }))
    .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k.d) && [k.o, k.h, k.l, k.c].every(v => Number.isFinite(v) && v > 0))
    .sort((a, b) => a.d.localeCompare(b.d));
}

export interface Ideevariante {
  id: "etf" | "ko-gleich" | "ko-voll";
  titel: string; text: string;
  hebel: number; einsatz: number;
  /** Ausgewogen: Barriere des Knock-outs (Punkte), nur bei Knock-outs */
  barriere: number | null;
  /** Verlust bzw. Gewinn in Euro (inkl. Gebühren) */
  amStopp: number; amZiel: number; beiPlus1: number; beiMinus1: number;
  /** Wertänderung des Produkts am Stopp bzw. Ziel (Anteil, für Stopp- und Ziel-Kurs im Produkt) */
  stoppProdukt: number; zielProdukt: number;
  /** Ab dieser DAX-Bewegung (gegen die Idee) ist der Einsatz ganz weg */
  totalverlustBei: number | null;
}

/**
 * Eigene Idee „DAX steigt/fällt, Betrag X“ in drei Umsetzungen:
 * ETF mit dem Betrag, Knock-out mit gleicher Marktgröße (Einsatz = Betrag ÷ Hebel), Knock-out mit dem vollen Betrag.
 * Stopp eine halbe Tagesspanne, Ziel eine ganze (Chance zu Risiko 2 : 1), Ausstieg spätestens zum Schluss.
 */
export function ideeVarianten(p: { dax: number; richtung: "long" | "short"; atr: number; betrag: number; gebuehrJeOrder?: number; maxHebel?: number }): Ideevariante[] {
  const geb = (p.gebuehrJeOrder ?? 0.99) * 2; const plan = produktplan({ dax: p.dax, richtung: p.richtung, atr: p.atr, budget: p.betrag, risikoProzent: 1, gebuehrJeOrder: 0, maxHebel: p.maxHebel });
  const h = plan.ko.hebel; const sp = plan.stoppProzent; const zp = 2 * sp;
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const v = (id: Ideevariante["id"], titel: string, text: string, hebel: number, einsatz: number): Ideevariante => ({
    id, titel, text, hebel, einsatz: r2(einsatz), barriere: hebel > 1 ? plan.ko.barriere : null,
    amStopp: r2(-einsatz * sp * hebel - geb), amZiel: r2(einsatz * zp * hebel - geb), beiPlus1: r2(einsatz * Math.min(1, 0.01 * hebel) * (p.richtung === "long" ? 1 : -1) - geb), beiMinus1: r2(-einsatz * Math.min(1, 0.01 * hebel) * (p.richtung === "long" ? 1 : -1) - geb),
    stoppProdukt: Math.min(0.95, sp * hebel), zielProdukt: zp * hebel, totalverlustBei: hebel > 1 ? plan.ko.abstandProzent : null,
  });
  return [
    v("etf", "DAX-ETF", "Bewegt sich wie der DAX. Kein Totalverlust, kleinste Schwankung.", 1, p.betrag),
    v("ko-gleich", `Knock-out, Hebel ${h}`, "Gleiche Marktgröße wie der ETF mit einem Bruchteil des Geldes; der Rest bleibt frei.", h, p.betrag / h),
    v("ko-voll", `Knock-out, Hebel ${h}, voller Betrag`, `Der ganze Betrag mit Hebel: ${h}-fache Wirkung, an der Barriere Totalverlust.`, h, p.betrag),
  ];
}

/** Einordnung einer eigenen Idee gegen Modell und Grundrate */
export function ideeEinordnung(richtung: "long" | "short", s: Tagessignal | null, r: DaxRueckblick | null) {
  const grund = r ? (richtung === "long" ? r.immerLong.trefferquote : 1 - r.immerLong.trefferquote) : null;
  const modell = !s || s.richtung === "keine" ? "neutral" : s.richtung === richtung ? "dafuer" : "dagegen";
  const text = modell === "dafuer" ? "Das Modell sieht heute dieselbe Richtung." : modell === "dagegen" ? "Das Modell sieht heute die Gegenrichtung. Prüfen, was Sie wissen, das die Zahlen nicht zeigen." : "Das Modell sieht heute keinen belegten Vorteil in eine Richtung.";
  return { modell, text, grundrate: grund, modellTreffer: modell === "dafuer" && r ? r.trefferquote : null };
}

export interface Chancen { tage: number; ziel: number; stopp: number; schluss: number; schlussSchnitt: number; erwartung: number; von: string; bis: string }

/**
 * Wie oft wurde im Lauf eines Tages (Eröffnung bis Schluss) das Ziel vor dem Stopp erreicht?
 * Ziel und Stopp in Tagesspannen (ATR der 14 Tage davor). Aus Tageskerzen ist die Reihenfolge im Tag unbekannt:
 * Wurden beide berührt, zählt vorsichtig der Stopp. `erwartung`: Ergebnis je Trade in % des Basiswerts, vor Kosten.
 */
export function tagesChancen(k: Tageskerze[], richtung: "long" | "short", zielAtr = 1, stoppAtr = STOPP_ATR, jahre = 8): Chancen | null {
  const ab = k.length - jahre * 252; const r: { e: number; z: "ziel" | "stopp" | "schluss" }[] = []; let von = "";
  for (let i = Math.max(15, ab); i < k.length; i++) {
    const a = atr(k.slice(i - 15, i)); if (!a) continue; const t = k[i]!; if (!von) von = t.d;
    const zp = zielAtr * a, sp = stoppAtr * a;
    const up = richtung === "long" ? t.h - t.o : t.o - t.l, down = richtung === "long" ? t.o - t.l : t.h - t.o;
    if (down >= sp) r.push({ e: -sp / t.o, z: "stopp" });
    else if (up >= zp) r.push({ e: zp / t.o, z: "ziel" });
    else r.push({ e: (richtung === "long" ? t.c - t.o : t.o - t.c) / t.o, z: "schluss" });
  }
  if (r.length < 100) return null;
  const n = r.length; const sch = r.filter(x => x.z === "schluss");
  return { tage: n, ziel: r.filter(x => x.z === "ziel").length / n, stopp: r.filter(x => x.z === "stopp").length / n, schluss: sch.length / n, schlussSchnitt: sch.length ? sch.reduce((a, x) => a + x.e, 0) / sch.length : 0, erwartung: r.reduce((a, x) => a + x.e, 0) / n, von, bis: k.at(-1)!.d };
}

export interface Verdopplung { faelle: number; verdoppelt: number; ausgeknockt: number; offen: number; offenSchnitt: number; bewegung: number; tage: number }

/**
 * „Rally“: Mit einem Knock-out mit Hebel h verdoppelt sich der Einsatz bei einer Bewegung von etwa 1/h in die eigene Richtung,
 * der Totalverlust kommt bei 1/h dagegen. Wie oft geschah was innerhalb von `tage` Handelstagen (Kerzenhoch/-tief, vorsichtig: beides am selben Tag = Knock-out)?
 */
export function verdopplungsChance(k: Tageskerze[], richtung: "long" | "short", hebel: number, tage: number, jahre = 10): Verdopplung | null {
  const a = 1 / hebel; const ab = Math.max(0, k.length - jahre * 252 - tage); let dop = 0, ko = 0, off = 0, offSum = 0, n = 0;
  for (let i = ab; i + tage <= k.length; i++) {
    const s = k[i]!.o; const ziel = richtung === "long" ? s * (1 + a) : s * (1 - a); const barr = richtung === "long" ? s * (1 - a) : s * (1 + a);
    let erg: "d" | "k" | null = null;
    for (let j = i; j < i + tage; j++) {
      const t = k[j]!; const gegen = richtung === "long" ? t.l <= barr : t.h >= barr; const fuer = richtung === "long" ? t.h >= ziel : t.l <= ziel;
      if (gegen) { erg = "k"; break; } if (fuer) { erg = "d"; break; }
    }
    n++; if (erg === "d") dop++; else if (erg === "k") ko++; else { off++; const c = k[i + tage - 1]!.c; offSum += Math.max(-1, (richtung === "long" ? c / s - 1 : 1 - c / s) * hebel); }
  }
  if (n < 50) return null;
  return { faelle: n, verdoppelt: dop / n, ausgeknockt: ko / n, offen: off / n, offenSchnitt: off ? offSum / off : 0, bewegung: a, tage };
}

export type Ziel = "tagestrade" | "rally";
export interface Option {
  nr: 1 | 2 | 3; titel: string; text: string; produkt: "etf" | "ko"; richtung: "long" | "short"; hebel: number; einsatz: number;
  barriere: number | null; stoppProdukt: number; zielProdukt: number;
  /** Wahrscheinlichkeiten aus der Historie */
  pZiel: number | null; pStopp: number | null; pOffen: number | null;
  /** erwartetes Ergebnis in Euro vor Gebühren und nach Gebühren */
  erwartung: number | null; erwartungNetto: number | null;
  zielEuro: number; stoppEuro: number;
  hinweis: string;
}

/**
 * Optionen 1–3 für den Assistenten.
 * Tagestrade: Hebel so, dass das Ziel (eine Tagesspanne) die Zielrendite bringt; vorsichtige Variante mit halbem Hebel; ETF zum Vergleich.
 * Rally: Knock-outs mit Hebel 10, 20 und 40 auf „Einsatz verdoppeln“ innerhalb des Horizonts.
 */
export function optionen(p: { kerzen: Tageskerze[]; dax: number; richtung: "long" | "short"; betrag: number; ziel: Ziel; zielRendite?: number; horizontTage?: number; gebuehrJeOrder?: number; maxHebel?: number }): Option[] {
  const geb = (p.gebuehrJeOrder ?? 0.99) * 2; const a = atr(p.kerzen) ?? p.dax * 0.01; const atrP = a / p.dax; const maxH = p.maxHebel ?? 50;
  const r2 = (v: number) => Math.round(v * 100) / 100; const barriere = (h: number) => Math.round(p.richtung === "long" ? p.dax * (1 - 1 / h) : p.dax * (1 + 1 / h));
  if (p.ziel === "tagestrade") {
    const c = tagesChancen(p.kerzen, p.richtung);
    const zr = p.zielRendite ?? 0.075; const hZiel = Math.max(2, Math.min(maxH, Math.round(zr / atrP))); const hVor = Math.max(2, Math.round(hZiel / 2));
    // Barriere muss weit hinter dem Stopp liegen (mind. 3 × Stopp): sonst Hebel senken
    const hSicher = (h: number) => Math.min(h, Math.floor(1 / (3 * STOPP_ATR * atrP)));
    const mk = (nr: 1 | 2 | 3, titel: string, text: string, produkt: "etf" | "ko", hebel: number): Option => {
      const zielP = atrP * hebel, stoppP = STOPP_ATR * atrP * hebel; const e = c ? c.erwartung * hebel * p.betrag : null;
      return { nr, titel, text, produkt, richtung: p.richtung, hebel, einsatz: p.betrag, barriere: produkt === "ko" ? barriere(hebel) : null, stoppProdukt: Math.min(0.95, stoppP), zielProdukt: zielP,
        pZiel: c?.ziel ?? null, pStopp: c?.stopp ?? null, pOffen: c?.schluss ?? null, erwartung: e != null ? r2(e) : null, erwartungNetto: e != null ? r2(e - geb) : null,
        zielEuro: r2(p.betrag * zielP - geb), stoppEuro: r2(-p.betrag * stoppP - geb),
        hinweis: produkt === "etf" ? `Ohne Hebel sind an einem Tag realistisch ${(atrP * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % drin, nicht ${Math.round(zr * 100)} %.` : `Ziel bei DAX ${p.richtung === "long" ? "+" : "−"}${(atrP * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %, Stopp bei ${p.richtung === "long" ? "−" : "+"}${(STOPP_ATR * atrP * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %.` };
    };
    const h2 = hSicher(hZiel), h1 = hSicher(hVor);
    return [
      mk(1, `Vorsichtig: Knock-out Hebel ${h1}`, `Halbe Zielrendite (etwa ${Math.round(atrP * h1 * 100)} %), halbes Risiko.`, "ko", h1),
      mk(2, `Passend zum Ziel: Knock-out Hebel ${h2}`, `Eine typische Tagesbewegung bringt etwa ${Math.round(atrP * h2 * 100)} %.`, "ko", h2),
      mk(3, "Ohne Hebel: DAX-ETF", "Zum Vergleich: kleinstes Risiko, kleinste Wirkung.", "etf", 1),
    ];
  }
  const T = p.horizontTage ?? 5;
  return ([10, 20, 40] as const).filter(h => h <= maxH).slice(0, 3).map((h, i) => {
    const v = verdopplungsChance(p.kerzen, p.richtung, h, T);
    const e = v ? (v.verdoppelt * 1 + v.ausgeknockt * -1 + v.offen * v.offenSchnitt) * p.betrag : null;
    return {
      nr: (i + 1) as 1 | 2 | 3, titel: `Knock-out Hebel ${h}`, text: `Verdopplung bei DAX ${p.richtung === "long" ? "+" : "−"}${Math.round(100 / h * 10) / 10} %, Totalverlust bei ${p.richtung === "long" ? "−" : "+"}${Math.round(100 / h * 10) / 10} %.`,
      produkt: "ko", richtung: p.richtung, hebel: h, einsatz: p.betrag, barriere: barriere(h), stoppProdukt: 0.95, zielProdukt: 1,
      pZiel: v?.verdoppelt ?? null, pStopp: v?.ausgeknockt ?? null, pOffen: v?.offen ?? null, erwartung: e != null ? r2(e) : null, erwartungNetto: e != null ? r2(e - geb) : null,
      zielEuro: r2(p.betrag - geb), stoppEuro: r2(-p.betrag - geb),
      hinweis: `Innerhalb von ${T} Handelstagen; sonst Verkauf zum Kurs am Ende.`,
    };
  });
}

/**
 * Tageskerzen aus der Chart-Antwort von Yahoo Finance (/v8/finance/chart, interval=1d).
 * Datum in der Zeitzone der Börse (gmtoffset), Tage mit Lücken werden ausgelassen.
 */
export function leseYahooChart(j: unknown): Tageskerze[] {
  const r = (j as { chart?: { result?: { timestamp?: number[]; meta?: { gmtoffset?: number }; indicators?: { quote?: { open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }[] } }[]; error?: { description?: string } | null } })?.chart;
  if (r?.error) throw new Error(r.error.description ?? "Yahoo: Fehler");
  const x = r?.result?.[0]; const t = x?.timestamp ?? []; const q = x?.indicators?.quote?.[0]; const off = x?.meta?.gmtoffset ?? 0;
  if (!q) return [];
  const out: Tageskerze[] = [];
  t.forEach((ts, i) => {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].some(v => v == null || !Number.isFinite(v) || v <= 0)) return;
    out.push({ d: new Date((ts + off) * 1000).toISOString().slice(0, 10), o: o!, h: h!, l: l!, c: c! });
  });
  // doppelte Tage (z. B. laufender Tag) zusammenfassen: letzter Eintrag gilt
  const m = new Map(out.map(k => [k.d, k])); return [...m.values()].sort((a, b) => a.d.localeCompare(b.d));
}
