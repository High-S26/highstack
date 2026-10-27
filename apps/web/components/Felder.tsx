"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { erklaerung } from "@/lib/erklaerungen";
import { Info } from "./Info";

const Beschriftung = ({ htmlFor, label, info }: { htmlFor?: string; label: ReactNode; info?: string }) => {
  const t = info ?? erklaerung(label);
  return <div className="lrow"><label htmlFor={htmlFor}>{label}</label>{t && <Info text={t} label={typeof label === "string" ? label : undefined} />}</div>;
};

export { leseZahl } from "@/lib/zahl";
import { leseZahl } from "@/lib/zahl";
const zeige = (v: number, gruppe = true) => v.toLocaleString("de-DE", { maximumFractionDigits: 3, useGrouping: gruppe });

/** Zahlenfeld mit Tausenderpunkten, Einheit im Feld und Hilfetext darunter. `prozent`: gespeichert als Dezimalzahl. */
export function Zahl({ label, wert, onChange, prozent, einheit, voll, hinweis, leerErlaubt, min, max, info }: { info?: string; label: ReactNode; wert: number | null | undefined; onChange: (v: number | null) => void; prozent?: boolean; schritt?: number; einheit?: string; voll?: boolean; hinweis?: string; leerErlaubt?: boolean; min?: number; max?: number }) {
  const id = useId();
  const intern = wert == null ? null : prozent ? Math.round(wert * 100000) / 1000 : wert;
  const [fokus, setFokus] = useState(false); const [roh, setRoh] = useState(""); const [verworfen, setVerworfen] = useState<string | null>(null);
  // Kurze Bestätigung nach dem Verlassen des Felds: die Eingabe ist angekommen
  const [ok, setOk] = useState<string | null>(null); const okTimer = useRef<ReturnType<typeof setTimeout>>();
  // Wert beim Betreten des Felds: ist die Eingabe am Ende ungültig, gilt wieder dieser (nicht ein Zwischenstand beim Tippen)
  const [vorher, setVorher] = useState<number | null>(null);
  const gruppe = !(typeof label === "string" && /Baujahr|Jahr$/.test(label));
  const anzeige = fokus ? roh : intern == null ? "" : zeige(intern, gruppe);
  // Beträge, Flächen und Jahre sind nie negativ; Beträge höchstens 1 Mrd.
  const betragArtig = !prozent && !!einheit && /€|m²|Jahre|Min\.|\$/.test(einheit);
  const lo = min ?? (betragArtig ? 0 : undefined); const hi = max ?? (betragArtig && /€|\$/.test(einheit!) ? 1e9 : undefined);
  const ausserhalb = (n: number) => (lo != null && n < lo) || (hi != null && n > hi);
  const v = leseZahl(roh); const vIntern = v == null ? null : v;
  const fehler = fokus && roh.trim() !== "" && v == null ? "Bitte eine Zahl eingeben" : fokus && vIntern != null && ausserhalb(vIntern) ? `Erlaubt: ${lo != null ? zeige(lo) : "…"} bis ${hi != null ? zeige(hi) : "…"}` : !fokus && intern != null && ausserhalb(intern) ? `Erlaubt: ${lo != null ? zeige(lo) : "…"} bis ${hi != null ? zeige(hi) : "…"}` : null;
  const suffix = prozent ? "%" : einheit;
  return (
    <div className={`fld${voll ? " full" : ""}${fehler || verworfen ? " err" : ""}`}>
      <Beschriftung htmlFor={id} label={label} info={info} />
      <div className="adorn">
        <input id={id} type="text" inputMode="decimal" autoComplete="off" value={anzeige} aria-describedby={hinweis || fehler ? `${id}-h` : undefined} aria-invalid={!!fehler}
          onFocus={e => { setRoh(intern == null ? "" : zeige(intern, gruppe)); setVorher(wert ?? null); setFokus(true); setVerworfen(null); setOk(null); requestAnimationFrame(() => e.target.select()); }}
          onBlur={() => { setFokus(false); const n = leseZahl(roh); if (roh.trim() && (n == null || ausserhalb(n))) { const alt = vorher == null ? null : prozent ? Math.round(vorher * 100000) / 1000 : vorher; if (vorher !== (wert ?? null)) onChange(vorher); setVerworfen(`„${roh.trim()}“ nicht übernommen (${n == null ? "keine Zahl" : `erlaubt ${lo != null ? zeige(lo) : "…"} bis ${hi != null ? zeige(hi) : "…"}`}); es gilt weiter ${alt == null ? "kein Wert" : zeige(alt, gruppe)}.`); }
            else if ((wert ?? null) !== vorher) { setOk((wert ?? null) == null ? "✓ Gelöscht" : `✓ Übernommen: ${zeige(intern!, gruppe)}${suffix ? ` ${suffix}` : ""}`); clearTimeout(okTimer.current); okTimer.current = setTimeout(() => setOk(null), 4000); } }}
          onChange={e => { const t = e.target.value; setRoh(t); if (t.trim() === "") { onChange(leerErlaubt === false ? 0 : null); return; } const n = leseZahl(t); if (n != null && !ausserhalb(n)) onChange(prozent ? n / 100 : n); }} />
        {suffix && <span className="sfx" aria-hidden="true">{suffix}</span>}
      </div>
      {(fehler || verworfen || ok || hinweis) && <div id={`${id}-h`} className={fehler || verworfen ? "hint bad" : ok ? "hint ok" : "hint"} role={verworfen ? "alert" : ok ? "status" : undefined}>{fehler ?? verworfen ?? ok ?? hinweis}</div>}
    </div>
  );
}
export function Text({ label, wert, onChange, voll, platzhalter, hinweis }: { label: string; wert: string; onChange: (v: string) => void; voll?: boolean; platzhalter?: string; hinweis?: string }) {
  const id = useId();
  return <div className={`fld${voll ? " full" : ""}`}><Beschriftung htmlFor={id} label={label} /><input id={id} type="text" value={wert} placeholder={platzhalter} onChange={e => onChange(e.target.value)} />{hinweis && <div className="hint">{hinweis}</div>}</div>;
}
/** Auswahl: bis vier kurze Optionen als Segmente (alles auf einen Blick, ein Tipp), sonst als Liste. */
export function Auswahl<T extends string>({ label, wert, optionen, onChange, voll, liste }: { label: string; wert: T; optionen: [T, string][]; onChange: (v: T) => void; voll?: boolean; liste?: boolean }) {
  const id = useId();
  const segmente = !liste && optionen.length <= 4 && optionen.reduce((n, [, l]) => n + l.length, 0) <= 30;
  if (segmente) return (
    <div className={`fld${voll ? " full" : ""}`} role="radiogroup" aria-labelledby={id}>
      <div className="lrow"><span id={id} className="flabel">{label}</span>{erklaerung(label) && <Info text={erklaerung(label)!} label={label} />}</div>
      <div className="seg">{optionen.map(([v, l]) => <label key={v} className="segi"><input type="radio" name={id} value={v} checked={wert === v} onChange={() => onChange(v)} /><span>{l}</span></label>)}</div>
    </div>
  );
  return <div className={`fld${voll ? " full" : ""}`}><Beschriftung htmlFor={id} label={label} /><select id={id} value={wert} onChange={e => onChange(e.target.value as T)}>{optionen.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>;
}
/** Ja/Nein als Schalter */
export function Haken({ label, wert, onChange }: { label: string; wert: boolean; onChange: (v: boolean) => void }) {
  const t = erklaerung(label);
  return <div className="full swrow"><label className="switch"><input type="checkbox" role="switch" checked={wert} onChange={e => onChange(e.target.checked)} /><span className="track-s" aria-hidden="true" /><span>{label}</span></label>{t && <Info text={t} label={label} />}</div>;
}
/** Mehrere Begriffe (z. B. Regionen) als Marken: Enter oder Komma fügt hinzu, × entfernt. */
export function Marken({ label, werte, onChange, platzhalter, voll, hinweis, normalisiere, pruefe }: { label: string; werte: string[]; onChange: (v: string[]) => void; platzhalter?: string; voll?: boolean; hinweis?: string; normalisiere?: (s: string) => string; pruefe?: (s: string) => string | null }) {
  const id = useId(); const [t, setT] = useState(""); const [fehler, setFehler] = useState<string | null>(null);
  // erst normalisieren, dann auf Doppelte prüfen (aapl = AAPL); ungültige Einträge bleiben im Feld stehen
  const add = (x: string) => {
    const roh = x.split(/[,;]+/).map(s => (normalisiere ? normalisiere(s) : s.trim())).filter(Boolean);
    const falsch = pruefe ? roh.map(s => pruefe(s)).find(Boolean) ?? null : null; const gut = roh.filter(s => !pruefe || !pruefe(s));
    const n = [...new Set(gut)].filter(s => !werte.includes(s)); if (n.length) onChange([...werte, ...n]);
    setFehler(falsch); setT(falsch ? roh.filter(s => pruefe?.(s)).join(", ") : "");
  };
  return (
    <div className={`fld${voll ? " full" : ""}`}>
      <Beschriftung htmlFor={id} label={label} />
      <div className="tags" onClick={e => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}>
        {werte.map(w => <span key={w} className="tagx">{w}<button type="button" aria-label={`${w} entfernen`} onClick={() => onChange(werte.filter(x => x !== w))}>×</button></span>)}
        <input id={id} value={t} placeholder={werte.length ? "" : platzhalter} onChange={e => { const v = e.target.value; setFehler(null); if (/[,;]$/.test(v)) add(v); else setT(v); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(t); } else if (e.key === "Backspace" && !t && werte.length) onChange(werte.slice(0, -1)); }} onBlur={() => t && add(t)} />
      </div>
      {(fehler || hinweis) && <div className={fehler ? "hint bad" : "hint"} role={fehler ? "alert" : undefined}>{fehler ?? hinweis}</div>}
    </div>
  );
}
export function Kacheln({ eintraege }: { eintraege: [string, ReactNode][] }) {
  return <div className="tiles">{eintraege.map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>;
}
export const BUNDESLAENDER: [string, string][] = [["NW", "Nordrhein-Westfalen (6,5 %)"], ["BW", "Baden-Württemberg (5 %)"], ["BY", "Bayern (3,5 %)"], ["BE", "Berlin (6 %)"], ["BB", "Brandenburg (6,5 %)"], ["HB", "Bremen (5 %)"], ["HH", "Hamburg (5,5 %)"], ["HE", "Hessen (6 %)"], ["MV", "Mecklenburg-Vorpommern (6 %)"], ["NI", "Niedersachsen (5 %)"], ["RP", "Rheinland-Pfalz (5 %)"], ["SL", "Saarland (6,5 %)"], ["SN", "Sachsen (5,5 %)"], ["ST", "Sachsen-Anhalt (5 %)"], ["SH", "Schleswig-Holstein (6,5 %)"], ["TH", "Thüringen (5 %)"]];
