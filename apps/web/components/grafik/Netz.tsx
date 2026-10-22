"use client";
import type { Achse } from "@/lib/match";

export interface Reihe { name: string; achsen: Achse[]; farbe?: string }
const FARBEN = ["var(--purple)", "var(--gold)", "var(--good)", "var(--crit)"];

/** Netzdiagramm (Radar). Groß mit Beschriftung, klein als Symbol in Listen. Gestrichelt: Anspruch (70 = Opportunity). */
import { matchAchsen } from "@/lib/match";
import type { Analyse, Objekt } from "@highstack/engine";

/** Passung zum Anlageprofil: Netz plus Balken mit Erklärung je Achse */
export function Passung({ o, a }: { o: Objekt; a: Analyse }) {
  const achsen = matchAchsen(o, a);
  return (
    <section className="panel">
      <div className="ph"><h2>Passung zum Anlageprofil</h2><span className="tag">gestrichelt: Anspruch für Opportunity</span></div>
      <div className="match">
        <Netz reihen={[{ name: o.titel || "Objekt", achsen }]} groesse={280} />
        <ul className="match-legende">{achsen.map(x => <li key={x.key} title={x.text}><span>{x.label}<span className="note"> · {x.text}</span></span><b>{x.wert == null ? "–" : x.wert}</b><span className="bal"><i className={x.wert != null && x.wert < 70 ? "unter" : ""} style={{ width: `${x.wert ?? 0}%` }} /></span></li>)}</ul>
      </div>
    </section>
  );
}

export function Netz({ reihen, groesse = 260, klein = false, anspruch = 70 }: { reihen: Reihe[]; groesse?: number; klein?: boolean; anspruch?: number }) {
  const achsen = reihen[0]?.achsen ?? []; const n = achsen.length; if (!n) return null;
  const rand = klein ? 2 : 54; const R = groesse / 2 - rand; const c = groesse / 2;
  const punkt = (i: number, v: number) => { const w = -Math.PI / 2 + (i / n) * Math.PI * 2; return [c + Math.cos(w) * R * v / 100, c + Math.sin(w) * R * v / 100] as const; };
  const poly = (werte: number[]) => werte.map((v, i) => punkt(i, v).join(",")).join(" ");
  const titel = reihen.map(rh => `${rh.name}: ${rh.achsen.map(x => `${x.label} ${x.wert ?? "fehlt"}`).join(", ")}`).join("; ");
  return (
    <svg className={`netz${klein ? " klein" : ""}`} viewBox={`0 0 ${groesse} ${groesse}`} width={groesse} height={groesse} role="img" aria-label={titel}>
      {[25, 50, 75, 100].map(s => <polygon key={s} points={poly(achsen.map(() => s))} className="netz-gitter" />)}
      {!klein && achsen.map((_, i) => { const [x, y] = punkt(i, 100); return <line key={i} x1={c} y1={c} x2={x} y2={y} className="netz-gitter" />; })}
      <polygon points={poly(achsen.map(() => anspruch))} className="netz-anspruch" />
      {reihen.map((rh, ri) => { const f = rh.farbe ?? FARBEN[ri % FARBEN.length]; return (
        <g key={rh.name} style={{ ["--f" as string]: f }}>
          <polygon points={poly(rh.achsen.map(x => x.wert ?? 0))} className="netz-flaeche" />
          {!klein && rh.achsen.map((x, i) => { const [px, py] = punkt(i, x.wert ?? 0); return x.wert == null ? null : <circle key={x.key} cx={px} cy={py} r={3.2} className="netz-punkt" />; })}
        </g>); })}
      {!klein && achsen.map((x, i) => {
        const [lx, ly] = punkt(i, 100 + (22 / R) * 100); const anker = Math.abs(lx - c) < 4 ? "middle" : lx > c ? "start" : "end";
        const w = reihen.length === 1 ? x.wert : null;
        return <text key={x.key} x={lx} y={ly} textAnchor={anker} dominantBaseline="middle" className={`netz-label${x.wert == null ? " fehlt" : ""}`}><tspan>{x.label}</tspan>{reihen.length === 1 && <tspan x={lx} dy="1.2em" className="netz-wert">{w == null ? "fehlt" : w}</tspan>}</text>;
      })}
    </svg>
  );
}
