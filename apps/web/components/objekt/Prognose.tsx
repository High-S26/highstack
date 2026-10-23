"use client";
import { bandbreite, elastizitaeten, mitStellplaetzen, simuliere, zerlegung, type Analyse, type Szenario } from "@highstack/engine";
import { useEffect, useMemo, useState } from "react";
import { eur, pct, teur } from "@/lib/format";
import { hatMarktdaten, marktszenarien, type Ausblick } from "@/lib/marktszenarien";
import type { Marktfakt } from "@/lib/marktwissen";
import type { Objektdatensatz } from "@/lib/typen";
import { Info } from "../Info";

/**
 * Prognose im Durchspielen: Marktszenarien aus aktuellen Daten, Bandbreite der Wertentwicklung,
 * woraus das Ergebnis besteht und was jeder Parameter bewirkt.
 */
export function Prognose({ o, a, setze }: { o: Objektdatensatz; a: Analyse; setze: (p: Partial<Objektdatensatz>) => void }) {
  const [fakten, setFakten] = useState<Marktfakt[] | null>(null); const [ausblick, setAusblick] = useState<Ausblick | null>(null);
  useEffect(() => { fetch(`/api/objekte/${o.id}/marktlage`).then(r => r.ok ? r.json() : { fakten: [] }).then(d => { setFakten(d.fakten ?? []); setAusblick(d.ausblick ?? null); }).catch(() => setFakten([])); }, [o.id, o.objekt.ort, o.objekt.asset]);
  const ob = useMemo(() => mitStellplaetzen(o.objekt), [o.objekt]);
  const s = a.szenario; const p = a.params; const miete = a.bewertung.miete; const m = a.simulation;
  const szen = useMemo(() => fakten ? marktszenarien(fakten, s, s.sollzins, a.bewertung.kennzahlen.bruttorendite ?? null, ausblick) : [], [fakten, s, a.bewertung.kennzahlen.bruttorendite, ausblick]);
  const band = useMemo(() => bandbreite(p, ob, miete, s), [p, ob, miete, s]);
  const el = useMemo(() => elastizitaeten(p, ob, miete, s), [p, ob, miete, s]);
  if (!m || !band) return null;
  const z = zerlegung(m);
  const uebernehmen = (x: Partial<Szenario>) => setze({ szenario: { ...o.szenario, ...x } });
  return (
    <section className="panel prognose">
      <div className="ph"><h2>Prognose</h2><span className="tag">{fakten && (hatMarktdaten(fakten) || ausblick) ? "Annahmen aus aktuellen Marktdaten" : "Standardannahmen"}</span></div>

      <div className="pg-block">
        <div className="lrow"><h3>Marktszenarien</h3><Info label="Marktszenarien" text="Drei Sätze von Annahmen, abgeleitet aus aktuellen Marktdaten zu Mieten, Inflation, Zinsen und Renditen. Jede Annahme nennt ihre Grundlage. Übernehmen setzt die Werte im Durchspielen, Sie können danach frei weiter ändern." /></div>
        <div className="pg-szen">{szen.map(x => {
          const r = simuliere(p, ob, miete, { ...s, ...x.s }); const ze = r ? zerlegung(r) : null;
          return (
            <div key={x.id} className={`pg-karte k-${x.id}`}>
              <b>{x.name}</b><span className="note">{x.kurz}</span>
              <dl>{x.grundlagen.slice(0, 4).map(g => <div key={g.parameter}><dt>{g.parameter}</dt><dd>{g.wert}</dd></div>)}</dl>
              {r && ze && <div className="pg-erg"><div><span>Vermögen am Ende</span><strong>{teur(r.nettovermoegenEnde)}</strong></div><div><span>EK-Rendite</span><strong>{pct(r.irr)}</strong></div><div><span>Ø Cashflow</span><strong className={r.cashflowSchnittMonat < 0 ? "dn" : "up"}>{eur(r.cashflowSchnittMonat)}</strong></div></div>}
              <details><summary>Grundlage</summary><ul className="pg-grund">{x.grundlagen.map(g => <li key={g.parameter}><b>{g.parameter} {g.wert}</b> {g.text}{g.quelle && <span className="note"> Quelle: {g.quelle}</span>}</li>)}</ul></details>
              <button type="button" className="btn sm ghost" onClick={() => uebernehmen(x.s)}>Übernehmen</button>
            </div>); })}</div>
      </div>

      <div className="pg-block">
        <div className="lrow"><h3>Welche Wertentwicklung ist möglich?</h3><Info label="Bandbreite" text={`${band.n} Verläufe mit gestreuten Marktparametern um Ihre Einstellung: Mietsteigerung ±1, Wertentwicklung ±1,5, Anschlusszins ±1, Kosten ±1 Prozentpunkte (Standardabweichung), Leerstand nur nach oben. Das Band zeigt, wo 8 von 10 Verläufen liegen.`} /></div>
        <Faecher band={band} eigene={m.jahre.map(j => j.nettovermoegen)} />
        <p className="pg-satz">Nach {s.haltedauer} Jahren liegt das Nettovermögen in 8 von 10 Verläufen zwischen <b>{teur(band.jahre.at(-1)!.nv[0])}</b> und <b>{teur(band.jahre.at(-1)!.nv[2])}</b>. Das Gesamtergebnis vor Steuern (Vermögen plus Cashflows minus Eigenkapital) reicht von {teur(band.ergebnis[0])} bis {teur(band.ergebnis[2])}{band.verlustQuote > 0.005 ? <>; in <b>{pct(band.verlustQuote, 0)}</b> der Verläufe steht am Ende ein Verlust</> : "; kein Verlauf endet mit Verlust"}.</p>
      </div>

      <div className="two">
        <div className="pg-block">
          <div className="lrow"><h3>Woraus Ihr Ergebnis besteht</h3><Info label="Zerlegung" text="Bei Ihrer Einstellung, am Ende der Haltedauer, vor Steuern. Vermögen = Eigenkapital minus Kaufnebenkosten plus Tilgung plus Wertzuwachs; dazu kommen die Cashflows über die Jahre." /></div>
          <Wasserfall teile={[["Eigenkapital", z.eigenkapital], ["Kaufnebenkosten", z.nebenkosten], ["Tilgung", z.tilgung], ["Wertzuwachs", z.wertzuwachs], ["Cashflows", z.cashflow]]} summe={["Vermögen plus Cashflows", z.eigenkapital + z.ergebnis]} />
          <p className="note">Ergebnis gegenüber dem eingesetzten Eigenkapital: <b className={z.ergebnis < 0 ? "dn" : "up"}>{teur(z.ergebnis)}</b>.</p>
        </div>
        <div className="pg-block">
          <div className="lrow"><h3>Was ein Prozentpunkt bewirkt</h3><Info label="Wirkung" text="Jeweils ein Parameter wird um einen Prozentpunkt erhöht, alles andere bleibt wie eingestellt. Vermögen am Ende und Summe der Cashflows über die Haltedauer. Die Mietsteigerung wirkt hier nur auf die Cashflows; in den Marktszenarien folgt auch der Wert der Miete." /></div>
          {el && <div className="tbl"><table><thead><tr><th>Parameter</th><th className="num">Vermögen</th><th className="num">Cashflows</th><th className="num">EK-Rendite</th></tr></thead><tbody>
            {el.map(e => <tr key={e.key}><td>{e.label} <span className="note">{e.text}</span></td><td className={`num ${Math.abs(e.nv) < 500 ? "" : e.nv < 0 ? "dn" : "up"}`}>{Math.abs(e.nv) < 500 ? "–" : teur(e.nv)}</td><td className={`num ${Math.abs(e.cf) < 500 ? "" : e.cf < 0 ? "dn" : "up"}`}>{Math.abs(e.cf) < 500 ? "–" : teur(e.cf)}</td><td className="num">{e.irr == null ? "–" : `${e.irr >= 0 ? "+" : "−"}${Math.abs(e.irr * 100).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Pkt.`}</td></tr>)}
          </tbody></table></div>}
        </div>
      </div>
    </section>
  );
}

/** Fächer: Band 10–90 %, Median und Ihre Einstellung */
function Faecher({ band, eigene }: { band: NonNullable<ReturnType<typeof bandbreite>>; eigene: number[] }) {
  const W = 720, H = 220, L = 58, R = 64, T = 12, B = 26;
  const werte = [...band.jahre.flatMap(j => [j.nv[0], j.nv[2]]), ...eigene, 0];
  const lo = Math.min(...werte), hi = Math.max(...werte); const n = band.jahre.length;
  const X = (t: number) => L + ((t - 1) / Math.max(1, n - 1)) * (W - L - R); const Y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * (H - T - B);
  const flaeche = [...band.jahre.map(j => `${X(j.jahr)},${Y(j.nv[2])}`), ...[...band.jahre].reverse().map(j => `${X(j.jahr)},${Y(j.nv[0])}`)].join(" ");
  const linie = (xs: number[]) => xs.map((v, i) => `${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <div className="pg-faecher"><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Nettovermögen über ${n} Jahre: Band von ${teur(band.jahre.at(-1)!.nv[0])} bis ${teur(band.jahre.at(-1)!.nv[2])}`}>
      {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} className="pg-gitter" /><text x={L - 6} y={Y(v) + 3.5} textAnchor="end" className="pg-achse">{teur(v)}</text></g>)}
      {lo < 0 && <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} className="pg-null" />}
      <polygon points={flaeche} className="pg-band" />
      <polyline points={linie(band.jahre.map(j => j.nv[1]))} className="pg-median" />
      <polyline points={linie(eigene)} className="pg-eigen" />
      {[1, Math.ceil(n / 2), n].map(t => <text key={t} x={X(t)} y={H - 8} textAnchor="middle" className="pg-achse">Jahr {t}</text>)}
      <text x={W - R + 6} y={Y(band.jahre.at(-1)!.nv[2]) + 4} className="pg-achse">90 %</text>
      <text x={W - R + 6} y={Y(band.jahre.at(-1)!.nv[0]) + 4} className="pg-achse">10 %</text>
    </svg>
      <div className="legend"><span><i className="lg-band" />8 von 10 Verläufen</span><span><i style={{ background: "var(--gold)" }} />Mitte</span><span><i style={{ background: "var(--purple)" }} />Ihre Einstellung</span></div>
    </div>
  );
}

function Wasserfall({ teile, summe }: { teile: [string, number][]; summe: [string, number] }) {
  const max = Math.max(...teile.map(([, v]) => Math.abs(v)), Math.abs(summe[1]), 1);
  return (
    <div className="pg-wf">{[...teile, summe].map(([l, v], i) => (
      <div key={l} className={`pg-wf-z${i === teile.length ? " summe" : ""}`}><span>{l}</span><div className="pg-wf-b"><i className={v < 0 ? "neg" : ""} style={{ width: `${(Math.abs(v) / max) * 100}%` }} /></div><b className={v < 0 ? "dn" : ""}>{teur(v)}</b></div>))}
    </div>
  );
}
