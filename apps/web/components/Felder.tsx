"use client";
import { useId, useState, type ReactNode } from "react";

/** Deutsche Zahl lesen: „245.000“, „3,8“, „1.250,50“ */
export function leseZahl(t: string): number | null {
  const x = t.replace(/\s|€|%|m²/g, "").trim(); if (!x) return null;
  const norm = x.includes(",") ? x.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(x) ? x.replace(/\./g, "") : x;
  const v = Number(norm); return Number.isFinite(v) ? v : null;
}
const zeige = (v: number) => v.toLocaleString("de-DE", { maximumFractionDigits: 3 });

/** Zahlenfeld mit Tausenderpunkten, Einheit im Feld und Hilfetext darunter. `prozent`: gespeichert als Dezimalzahl. */
export function Zahl({ label, wert, onChange, prozent, einheit, voll, hinweis, leerErlaubt, min, max }: { label: ReactNode; wert: number | null | undefined; onChange: (v: number | null) => void; prozent?: boolean; schritt?: number; einheit?: string; voll?: boolean; hinweis?: string; leerErlaubt?: boolean; min?: number; max?: number }) {
  const id = useId();
  const intern = wert == null ? null : prozent ? Math.round(wert * 100000) / 1000 : wert;
  const [fokus, setFokus] = useState(false); const [roh, setRoh] = useState("");
  const anzeige = fokus ? roh : intern == null ? "" : zeige(intern);
  const v = leseZahl(roh); const fehler = fokus && roh.trim() !== "" && v == null ? "Bitte eine Zahl eingeben" : intern != null && ((min != null && intern < min) || (max != null && intern > max)) ? `Erlaubt: ${min ?? "…"} bis ${max ?? "…"}` : null;
  const suffix = prozent ? "%" : einheit;
  return (
    <div className={`fld${voll ? " full" : ""}${fehler ? " err" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="adorn">
        <input id={id} type="text" inputMode="decimal" autoComplete="off" value={anzeige} aria-describedby={hinweis || fehler ? `${id}-h` : undefined} aria-invalid={!!fehler}
          onFocus={e => { setRoh(intern == null ? "" : zeige(intern)); setFokus(true); requestAnimationFrame(() => e.target.select()); }}
          onBlur={() => setFokus(false)}
          onChange={e => { const t = e.target.value; setRoh(t); if (t.trim() === "") { onChange(leerErlaubt === false ? 0 : null); return; } const n = leseZahl(t); if (n != null) onChange(prozent ? n / 100 : n); }} />
        {suffix && <span className="sfx" aria-hidden="true">{suffix}</span>}
      </div>
      {(fehler || hinweis) && <div id={`${id}-h`} className={fehler ? "hint bad" : "hint"}>{fehler ?? hinweis}</div>}
    </div>
  );
}
export function Text({ label, wert, onChange, voll, platzhalter, hinweis }: { label: string; wert: string; onChange: (v: string) => void; voll?: boolean; platzhalter?: string; hinweis?: string }) {
  const id = useId();
  return <div className={`fld${voll ? " full" : ""}`}><label htmlFor={id}>{label}</label><input id={id} type="text" value={wert} placeholder={platzhalter} onChange={e => onChange(e.target.value)} />{hinweis && <div className="hint">{hinweis}</div>}</div>;
}
/** Auswahl: bis vier kurze Optionen als Segmente (alles auf einen Blick, ein Tipp), sonst als Liste. */
export function Auswahl<T extends string>({ label, wert, optionen, onChange, voll, liste }: { label: string; wert: T; optionen: [T, string][]; onChange: (v: T) => void; voll?: boolean; liste?: boolean }) {
  const id = useId();
  const segmente = !liste && optionen.length <= 4 && optionen.reduce((n, [, l]) => n + l.length, 0) <= 30;
  if (segmente) return (
    <div className={`fld${voll ? " full" : ""}`} role="radiogroup" aria-labelledby={id}>
      <span id={id} className="flabel">{label}</span>
      <div className="seg">{optionen.map(([v, l]) => <label key={v} className="segi"><input type="radio" name={id} value={v} checked={wert === v} onChange={() => onChange(v)} /><span>{l}</span></label>)}</div>
    </div>
  );
  return <div className={`fld${voll ? " full" : ""}`}><label htmlFor={id}>{label}</label><select id={id} value={wert} onChange={e => onChange(e.target.value as T)}>{optionen.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
}
/** Ja/Nein als Schalter */
export function Haken({ label, wert, onChange }: { label: string; wert: boolean; onChange: (v: boolean) => void }) {
  return <label className="switch full"><input type="checkbox" role="switch" checked={wert} onChange={e => onChange(e.target.checked)} /><span className="track-s" aria-hidden="true" /><span>{label}</span></label>;
}
/** Mehrere Begriffe (z. B. Regionen) als Marken: Enter oder Komma fügt hinzu, × entfernt. */
export function Marken({ label, werte, onChange, platzhalter, voll, hinweis }: { label: string; werte: string[]; onChange: (v: string[]) => void; platzhalter?: string; voll?: boolean; hinweis?: string }) {
  const id = useId(); const [t, setT] = useState("");
  const add = (x: string) => { const n = x.split(/[,;]+/).map(s => s.trim()).filter(s => s && !werte.includes(s)); if (n.length) onChange([...werte, ...n]); setT(""); };
  return (
    <div className={`fld${voll ? " full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="tags" onClick={e => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
        {werte.map(w => <span key={w} className="tagx">{w}<button type="button" aria-label={`${w} entfernen`} onClick={() => onChange(werte.filter(x => x !== w))}>×</button></span>)}
        <input id={id} value={t} placeholder={werte.length ? "" : platzhalter} onChange={e => { const v = e.target.value; if (/[,;]$/.test(v)) add(v); else setT(v); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(t); } else if (e.key === "Backspace" && !t && werte.length) onChange(werte.slice(0, -1)); }} onBlur={() => t && add(t)} />
      </div>
      {hinweis && <div className="hint">{hinweis}</div>}
    </div>
  );
}
export function Kacheln({ eintraege }: { eintraege: [string, ReactNode][] }) {
  return <div className="tiles">{eintraege.map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>;
}
export const BUNDESLAENDER: [string, string][] = [["NW", "Nordrhein-Westfalen (6,5 %)"], ["BW", "Baden-Württemberg (5 %)"], ["BY", "Bayern (3,5 %)"], ["BE", "Berlin (6 %)"], ["BB", "Brandenburg (6,5 %)"], ["HB", "Bremen (5 %)"], ["HH", "Hamburg (5,5 %)"], ["HE", "Hessen (6 %)"], ["MV", "Mecklenburg-Vorpommern (6 %)"], ["NI", "Niedersachsen (5 %)"], ["RP", "Rheinland-Pfalz (5 %)"], ["SL", "Saarland (6,5 %)"], ["SN", "Sachsen (5,5 %)"], ["ST", "Sachsen-Anhalt (5 %)"], ["SH", "Schleswig-Holstein (6,5 %)"], ["TH", "Thüringen (5 %)"]];
