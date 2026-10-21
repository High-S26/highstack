"use client";
import type { Analyse, Position } from "@highstack/engine";
import { eur } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";
import { id } from "@/lib/vorgaben";
import { Info } from "../Info";

const ART: [Position["art"], string][] = [["einnahme", "Einnahme"], ["ausgabe", "Ausgabe"], ["sondertilgung", "Sondertilgung"]];
const TAKT: [Position["takt"], string][] = [["monatlich", "monatlich"], ["jaehrlich", "jährlich"], ["einmalig", "einmalig"]];
const VORLAGEN: Omit<Position, "id">[] = [
  { name: "Stellplatz", art: "einnahme", betrag: 80, takt: "monatlich", abJahr: 1, dynamisch: true },
  { name: "Küche", art: "ausgabe", betrag: 6000, takt: "einmalig", abJahr: 0 },
  { name: "Renovierung bei Kauf", art: "ausgabe", betrag: 15000, takt: "einmalig", abJahr: 0 },
  { name: "Sondertilgung", art: "sondertilgung", betrag: 10000, takt: "einmalig", abJahr: 5 },
  { name: "Instandhaltung Sondereigentum", art: "ausgabe", betrag: 600, takt: "jaehrlich", abJahr: 1, dynamisch: true },
];
const zahl = (t: string) => { const n = Number(t.replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

/** Eigene Positionen: frei benannt, mit Betrag, Takt und Zeitraum. Fließen in Cashflow, Rendite und Forecast. */
export function Positionen({ o, a, setze }: { o: Objektdatensatz; a: Analyse; setze: (p: Partial<Objektdatensatz>) => void }) {
  const liste = o.szenario.positionen ?? [];
  const speichere = (l: Position[]) => setze({ szenario: { ...o.szenario, positionen: l } });
  const aendere = (pid: string, patch: Partial<Position>) => speichere(liste.map(x => x.id === pid ? { ...x, ...patch } : x));
  const neu = (v?: Omit<Position, "id">) => speichere([...liste, { id: id(), ...(v ?? { name: "", art: "ausgabe", betrag: 0, takt: "monatlich", abJahr: 1 }) }]);
  const m = a.simulation;
  const wirkung = m ? m.jahre[0]!.positionen / 12 : 0;
  const sonder = m ? m.jahre.reduce((s, j) => s + j.sondertilgung, 0) : 0;
  return (
    <div className="posbox">
      <div className="ph"><div className="lrow"><h3>Eigene Positionen</h3><Info label="Eigene Positionen" text="Alles, was die Regler nicht abdecken: Stellplatz, Küche, Renovierung, Sondertilgung, Hausmeister. Jahr 0 heißt beim Kauf und erhöht den Kapitaleinsatz. „Wächst mit“ steigert Einnahmen mit der Mietsteigerung und Ausgaben mit der Kostensteigerung." /></div>
        {liste.length > 0 && m && <span className="note">Wirkung Jahr 1: {wirkung >= 0 ? "+" : ""}{eur(wirkung)} im Monat{m.beimKauf ? ` · beim Kauf ${eur(m.beimKauf)}` : ""}{sonder ? ` · Sondertilgung gesamt ${eur(sonder)}` : ""}</span>}</div>
      {liste.length > 0 && <div className="poslist">
        <div className="posrow poshead" aria-hidden="true"><span>Bezeichnung</span><span>Art</span><span>Betrag</span><span>Takt</span><span>ab Jahr</span><span>bis Jahr</span><span>wächst mit</span><span /></div>
        {liste.map(x => (
          <div key={x.id} className="posrow">
            <input aria-label="Bezeichnung" value={x.name} placeholder="z. B. Stellplatz" onChange={e => aendere(x.id, { name: e.target.value })} />
            <select aria-label="Art" value={x.art} onChange={e => aendere(x.id, { art: e.target.value as Position["art"], ...(e.target.value === "sondertilgung" ? { dynamisch: false } : {}) })}>{ART.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <div className="adorn"><input aria-label="Betrag" inputMode="decimal" value={x.betrag ? x.betrag.toLocaleString("de-DE") : ""} placeholder="0" onChange={e => aendere(x.id, { betrag: Math.abs(zahl(e.target.value)) })} /><span className="sfx">€</span></div>
            <select aria-label="Takt" value={x.takt} onChange={e => aendere(x.id, { takt: e.target.value as Position["takt"], ...(e.target.value === "einmalig" ? { bisJahr: null } : { abJahr: Math.max(1, x.abJahr) }) })}>{TAKT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <input aria-label="ab Jahr" inputMode="numeric" value={String(x.abJahr)} onChange={e => aendere(x.id, { abJahr: Math.max(x.takt === "einmalig" ? 0 : 1, Math.round(zahl(e.target.value))) })} />
            <input aria-label="bis Jahr" inputMode="numeric" disabled={x.takt === "einmalig"} value={x.bisJahr ?? ""} placeholder={x.takt === "einmalig" ? "–" : "Ende"} onChange={e => aendere(x.id, { bisJahr: e.target.value.trim() ? Math.round(zahl(e.target.value)) : null })} />
            <label className="switch"><input type="checkbox" role="switch" disabled={x.art === "sondertilgung" || x.takt === "einmalig"} checked={!!x.dynamisch} onChange={e => aendere(x.id, { dynamisch: e.target.checked })} aria-label="wächst mit Miet- bzw. Kostensteigerung" /><span className="track-s" aria-hidden="true" /></label>
            <button type="button" className="icon danger" aria-label={`${x.name || "Position"} entfernen`} onClick={() => speichere(liste.filter(y => y.id !== x.id))}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg></button>
          </div>))}
      </div>}
      <div className="chips"><button type="button" className="chip add" onClick={() => neu()}>+ Position</button>{VORLAGEN.filter(v => !liste.some(x => x.name === v.name)).map(v => <button key={v.name} type="button" className="chip" onClick={() => neu(v)}>{v.name}</button>)}</div>
    </div>
  );
}
