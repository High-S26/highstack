"use client";
import type { ReactNode } from "react";

/** Zahlenfeld. Bei `prozent` wird der Dezimalwert als Prozentzahl angezeigt und gespeichert als Dezimalzahl. */
export function Zahl({ label, wert, onChange, prozent, schritt, einheit, voll, hinweis, leerErlaubt }: { label: ReactNode; wert: number | null | undefined; onChange: (v: number | null) => void; prozent?: boolean; schritt?: number; einheit?: string; voll?: boolean; hinweis?: string; leerErlaubt?: boolean }) {
  const anzeige = wert == null ? "" : prozent ? String(Math.round(wert * 100000) / 1000) : String(wert);
  return (
    <label className={voll ? "full" : undefined}>
      <span>{label}{einheit ? ` (${einheit})` : prozent ? " (%)" : ""}{hinweis && <span className="note"> · {hinweis}</span>}</span>
      <input type="number" inputMode="decimal" step={schritt ?? "any"} value={anzeige}
        onChange={e => { const t = e.target.value; if (t === "") { onChange(leerErlaubt === false ? 0 : null); return; } const v = Number(t); if (Number.isFinite(v)) onChange(prozent ? v / 100 : v); }} />
    </label>
  );
}
export function Text({ label, wert, onChange, voll, platzhalter }: { label: string; wert: string; onChange: (v: string) => void; voll?: boolean; platzhalter?: string }) {
  return <label className={voll ? "full" : undefined}>{label}<input type="text" value={wert} placeholder={platzhalter} onChange={e => onChange(e.target.value)} /></label>;
}
export function Auswahl<T extends string>({ label, wert, optionen, onChange, voll }: { label: string; wert: T; optionen: [T, string][]; onChange: (v: T) => void; voll?: boolean }) {
  return <label className={voll ? "full" : undefined}>{label}<select value={wert} onChange={e => onChange(e.target.value as T)}>{optionen.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>;
}
export function Haken({ label, wert, onChange }: { label: string; wert: boolean; onChange: (v: boolean) => void }) {
  return <label className="check full"><input type="checkbox" checked={wert} onChange={e => onChange(e.target.checked)} /> {label}</label>;
}
export function Kacheln({ eintraege }: { eintraege: [string, ReactNode][] }) {
  return <div className="tiles">{eintraege.map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>;
}
export const BUNDESLAENDER: [string, string][] = [["NW", "Nordrhein-Westfalen (6,5 %)"], ["BW", "Baden-Württemberg (5 %)"], ["BY", "Bayern (3,5 %)"], ["BE", "Berlin (6 %)"], ["BB", "Brandenburg (6,5 %)"], ["HB", "Bremen (5 %)"], ["HH", "Hamburg (5,5 %)"], ["HE", "Hessen (6 %)"], ["MV", "Mecklenburg-Vorpommern (6 %)"], ["NI", "Niedersachsen (5 %)"], ["RP", "Rheinland-Pfalz (5 %)"], ["SL", "Saarland (6,5 %)"], ["SN", "Sachsen (5,5 %)"], ["ST", "Sachsen-Anhalt (5 %)"], ["SH", "Schleswig-Holstein (6,5 %)"], ["TH", "Thüringen (5 %)"]];
