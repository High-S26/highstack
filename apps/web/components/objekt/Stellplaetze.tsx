"use client";
import type { Objekt, Stellplatz } from "@highstack/engine";
import { SP_ART, SP_NUTZUNG, SP_RECHT } from "@/lib/concierge";
import { eur, pct } from "@/lib/format";
import { Zahl } from "../Felder";
import { Info } from "../Info";

const neu = (preis: Stellplatz["preis"]): Stellplatz => ({ id: `sp-${Math.random().toString(36).slice(2, 8)}`, art: "tiefgarage", preis, kaufpreis: null, recht: "unbekannt", nutzung: "mieter", miete: null, hausgeld: null, erwerben: true });

function Chips<T extends string>({ label, wert, optionen, onChange }: { label: string; wert: T; optionen: [string, string, string?][]; onChange: (v: T) => void }) {
  return <div className="full"><span className="flabel">{label}</span><div className="chips" role="radiogroup" aria-label={label} style={{ marginTop: 6 }}>{optionen.map(([v, l, s]) => <button key={v} type="button" role="radio" className="chip" aria-checked={wert === v} aria-pressed={wert === v} title={s || undefined} onClick={() => onChange(v as T)}>{l}</button>)}</div></div>;
}

/** Stellplätze: erst eine freundliche Frage, dann pro Stellplatz Art, Preis, Rechtsform und Nutzung. */
export function Stellplaetze({ ob, set }: { ob: Objekt; set: (p: Partial<Objekt>) => void }) {
  const l = ob.stellplaetze ?? [];
  const aendere = (i: number, p: Partial<Stellplatz>) => set({ stellplaetze: l.map((x, n) => n === i ? { ...x, ...p } : x) });
  const gefragt = (w: "nein" | "ja") => ({ ...(ob.gefragt ?? {}), stellplatz: w });
  if (!l.length) return (
    <div className="sp-frage">
      <b>Gehört ein Stellplatz dazu?</b>
      <span className="note">{ob.gefragt?.stellplatz === "nein" ? "Kein Stellplatz. Falls doch, hier ergänzen." : "Oft separat verkauft, manchmal mit eigenem Grundbuch. Das ändert Preis, Rendite und spätere Optionen."}</span>
      <div className="chips">
        <button type="button" className="chip" onClick={() => set({ stellplaetze: [neu("inklusive")], gefragt: gefragt("ja") })}>Ja, im Preis</button>
        <button type="button" className="chip" onClick={() => set({ stellplaetze: [neu("separat")], gefragt: gefragt("ja") })}>Ja, separat zu kaufen</button>
        {ob.gefragt?.stellplatz !== "nein" && <button type="button" className="chip" onClick={() => set({ gefragt: gefragt("nein") })}>Nein</button>}
      </div>
    </div>
  );
  return <>{l.map((x, i) => {
    const rendite = x.preis === "separat" && x.kaufpreis && x.miete ? (x.miete * 12) / x.kaufpreis : null;
    return (
      <div key={x.id} className={`sp-karte${x.erwerben ? "" : " aus"}`}>
        <div className="ph"><b>{SP_ART.find(([v]) => v === x.art)?.[1]}{l.length > 1 ? ` ${i + 1}` : ""}</b>
          <span className="row">{x.preis === "separat" && <label className="chip"><input type="checkbox" checked={x.erwerben} onChange={e => aendere(i, { erwerben: e.target.checked })} /> mitkaufen</label>}
            <button type="button" className="linkbtn" onClick={() => set({ stellplaetze: l.filter((_, n) => n !== i) })}>Entfernen</button></span></div>
        <div className="fields">
          <Chips label="Art" wert={x.art} optionen={SP_ART} onChange={v => aendere(i, { art: v })} />
          <Chips label="Preis" wert={x.preis} optionen={[["inklusive", "Im Kaufpreis"], ["separat", "Eigener Preis"]]} onChange={v => aendere(i, { preis: v, kaufpreis: v === "inklusive" ? null : x.kaufpreis })} />
          {x.preis === "separat" && <Zahl label="Preis Stellplatz" einheit="€" wert={x.kaufpreis} onChange={v => aendere(i, { kaufpreis: v })} />}
          <div className="full"><span className="lrow"><span className="flabel">Rechtsform</span><Info label="Rechtsform Stellplatz" text="Teileigentum hat ein eigenes Grundbuchblatt: Sie können den Stellplatz später einzeln verkaufen oder an Dritte vermieten, die Bank kann ihn mitbeleihen. Ein Sondernutzungsrecht hängt an der Wohnung und ist nur an andere Eigentümer der Gemeinschaft übertragbar." /></span>
            <div className="chips" role="radiogroup" aria-label="Rechtsform" style={{ marginTop: 6 }}>{SP_RECHT.map(([v, lb, s]) => <button key={v} type="button" role="radio" className="chip" aria-checked={x.recht === v} aria-pressed={x.recht === v} title={s} onClick={() => aendere(i, { recht: v as Stellplatz["recht"] })}>{lb}</button>)}</div></div>
          <Chips label="Nutzung" wert={x.nutzung} optionen={SP_NUTZUNG} onChange={v => aendere(i, { nutzung: v })} />
          {x.nutzung === "fremd" && <Zahl label="Miete Stellplatz" einheit="€/Monat" wert={x.miete} onChange={v => aendere(i, { miete: v })} />}
          <Zahl label="Hausgeld Stellplatz, nicht umlagefähig" einheit="€/Monat" wert={x.hausgeld} onChange={v => aendere(i, { hausgeld: v })} />
        </div>
        {(rendite != null || (x.preis === "separat" && x.kaufpreis)) && <p className="note">{x.erwerben ? `Im Gesamtpreis enthalten: ${eur(x.kaufpreis)}.` : "Nicht eingerechnet."}{rendite != null && ` Für sich: ${pct(rendite)} Bruttorendite.`}{x.recht === "teileigentum" && " Später einzeln verkaufbar."}</p>}
      </div>
    );
  })}<button type="button" className="linkbtn" onClick={() => set({ stellplaetze: [...l, neu("separat")] })}>+ Weiteren Stellplatz</button></>;
}
