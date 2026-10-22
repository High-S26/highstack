"use client";
import { externeFaktoren, messe, mitStellplaetzen, WERT_STUFEN, ZINS_STUFEN, type Analyse, type Messgroesse } from "@highstack/engine";
import { useMemo, useState } from "react";
import { eur, pct, teur, vorzeichen } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";
import { Info } from "../Info";

const GROESSEN: [Messgroesse, string][] = [["irr", "Eigenkapitalrendite"], ["nv", "Nettovermögen am Ende"], ["cf", "Ø Cashflow im Monat"], ["cfMin", "Schwächstes Jahr im Monat"]];

/** Externe Faktoren: Zins- und Wertentwicklung als Matrix, Markteinflüsse als Tornado, Stresstests. */
export function ExterneFaktoren({ o, a }: { o: Objektdatensatz; a: Analyse }) {
  const [g, setG] = useState<Messgroesse>("irr");
  const e = useMemo(() => externeFaktoren(a.params, mitStellplaetzen(o.objekt), a.bewertung.miete, a.szenario), [a, o.objekt]);
  if (!e) return null;
  const fmt = (v: number | null) => v == null ? "–" : g === "irr" ? pct(v, 1) : g === "nv" ? teur(v) : eur(v);
  const basis = messe(e.basis, g)!;
  // Matrix: Farbe relativ zur Basis (Gold besser, Rot schlechter)
  const werte = e.matrix.flat().map(m => messe(m, g)).filter((v): v is number => v != null);
  const spanne = Math.max(...werte.map(v => Math.abs(v - basis)), 1e-9);
  const farbe = (v: number | null) => { if (v == null) return "transparent"; const t = (v - basis) / spanne; return t >= 0 ? `color-mix(in srgb, var(--good) ${Math.round(12 + t * 55)}%, var(--surface))` : `color-mix(in srgb, var(--crit) ${Math.round(12 - t * 55)}%, var(--surface))`; };
  const s = a.szenario;
  const tor = e.faktoren.map(f => ({ ...f, a: messe(f.schlechter, g), b: messe(f.besser, g) })).map(f => ({ ...f, d: Math.max(Math.abs((f.a ?? basis) - basis), Math.abs((f.b ?? basis) - basis)) })).sort((x, y) => y.d - x.d);
  const maxD = Math.max(...tor.map(t => t.d), 1e-9);
  return (
    <section className="panel extern">
      <div className="ph"><h2>Externe Faktoren</h2>
        <label className="lrow">Messgröße<select style={{ width: "auto" }} value={g} onChange={x => setG(x.target.value as Messgroesse)}>{GROESSEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label></div>
      <p className="note">Was Zinsmarkt, Preise und Inflation mit diesem Deal machen, bei Ihrer Einstellung ({fmt(basis)}). Nicht verhandelbar, aber vorher durchdenkbar.</p>

      <div className="ex-block">
        <div className="lrow"><h3>Zins nach der Zinsbindung × Wertentwicklung</h3><Info label="Matrix" text={`Zeilen: Anschlusszins gegenüber Ihrer Annahme (heute ${pct(s.sollzins + s.anschlusszinsAufschlag, 2)} nach ${a.params.zinsbindung} Jahren). Spalten: jährliche Wertentwicklung der Immobilie rund um Ihre Annahme. Das umrandete Feld ist Ihre Einstellung.`} /></div>
        <div className="matrix" role="table" aria-label="Szenario-Matrix">
          <div role="row" className="mx-zeile kopf"><span role="columnheader" className="mx-ecke">Zins ↓ · Wert →</span>{WERT_STUFEN.map(w => <span role="columnheader" key={w}>{pct(s.wertentwicklung + w, 1)} p. a.</span>)}</div>
          {ZINS_STUFEN.map((dz, i) => <div role="row" key={dz} className="mx-zeile"><span role="rowheader">{dz === 0 ? "wie angenommen" : `${vorzeichen(dz, x => (x * 100).toLocaleString("de-DE"))} %-Pkt.`}</span>
            {WERT_STUFEN.map((w, j) => { const v = messe(e.matrix[i]![j]!, g); const nah = dz === 0 && w === 0; return <span role="cell" key={w} className={nah ? "nah" : ""} style={{ background: farbe(v) }}>{fmt(v)}</span>; })}
          </div>)}
        </div>
      </div>

      <div className="ex-block">
        <h3>Was am stärksten wirkt</h3>
        <div className="tornado">{tor.map(t => <div key={t.label} className="tr"><div>{t.label}<span className="note"> · {t.text}</span></div><div><div className="tt"><div className="mid" />{[t.a, t.b].map((v, i) => v == null || Math.abs(v - basis) < 1e-9 ? null : <div key={i} className={`seg ${v < basis ? "lo" : "hi"}`} style={{ left: `${50 + Math.min(0, (v - basis) / maxD * 48)}%`, width: `${Math.abs((v - basis) / maxD * 48)}%` }} />)}</div><div className="tv"><span>{fmt(Math.min(...[t.a, t.b, basis].filter((x): x is number => x != null)))}</span><span>{fmt(Math.max(...[t.a, t.b, basis].filter((x): x is number => x != null)))}</span></div></div></div>)}</div>
      </div>

      <div className="ex-block">
        <h3>Stresstest</h3>
        <div className="stress">{[{ id: "basis", name: "Ihre Einstellung", text: "wie im Durchspielen eingestellt", sim: e.basis }, ...e.stress].map(x => { const v = messe(x.sim, g); const d = v != null && x.id !== "basis" ? v - basis : null; return (
          <div key={x.id} className={`st-karte${x.id === "basis" ? " basis" : ""}`}>
            <b>{x.name}</b><span className="note">{x.text}</span>
            <strong className={d == null ? "" : d < 0 ? "dn" : "up"}>{fmt(v)}</strong>
            {d != null && <span className={d < 0 ? "dn" : "up"}>{g === "irr" ? `${vorzeichen(d * 100, z => z.toLocaleString("de-DE", { maximumFractionDigits: 1 }))} %-Pkt.` : vorzeichen(d, z => g === "nv" ? teur(z) : eur(z))}</span>}
            {x.sim && <span className="note">schwächstes Jahr {eur(Math.min(...x.sim.jahre.map(j => j.cashflow)) / 12)} im Monat</span>}
          </div>); })}</div>
      </div>
    </section>
  );
}
