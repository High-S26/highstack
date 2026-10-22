"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { EINSTUFUNG, eur, num, pct } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";
import { useApp } from "./App";
import { Netz } from "./grafik/Netz";
import { matchAchsen } from "@/lib/match";

type Sortierung = "score" | "neu" | "preis" | "rendite";
const SORT: [Sortierung, string][] = [["score", "Beste Passung"], ["neu", "Zuletzt geändert"], ["preis", "Preis aufsteigend"], ["rendite", "Rendite absteigend"]];

function Zeile({ o, kandidat, gewaehlt, waehle }: { o: Objektdatensatz; kandidat?: boolean; gewaehlt: boolean; waehle: (an: boolean) => void }) {
  const { analyseVon, anlageprofil, setzeObjekt, loesche, frage } = useApp();
  const router = useRouter();
  const a = analyseVon(o); const k = a.bewertung.kennzahlen; const cls = a.bewertung.einstufung;
  const pruefen = async () => { const n = await api.aendereObjekt(o.id, { status: "pruefung" }); setzeObjekt(n); router.push(`/objekt/${o.id}`); };
  const titel = o.objekt.titel || "Ohne Titel";
  return (
    <div className={`orow mit-netz${gewaehlt ? " sel" : ""}`}>
      <input type="checkbox" className="pick" checked={gewaehlt} onChange={e => waehle(e.target.checked)} aria-label={`${titel} auswählen`} />
      <Netz reihen={[{ name: titel, achsen: matchAchsen(o.objekt, a) }]} groesse={48} klein />
      <div className="body">
        <Link className="t" href={`/objekt/${o.id}`}>{titel}</Link>
        <div className="m">{[o.objekt.ort, o.objekt.kaufpreis ? eur(o.objekt.kaufpreis) : null, o.objekt.wohnflaeche ? `${o.objekt.wohnflaeche} m²` : null, anlageprofil(o.anlageprofilId).name].filter(Boolean).join(", ")}</div>
        <div className="k">
          {k.bruttorendite != null && <span>Rendite {pct(k.bruttorendite)}</span>}
          {k.faktor != null && <span>Faktor {num(k.faktor, 1)}</span>}
          {k.cashflowMonat != null && <span className={k.cashflowMonat < 0 ? "dn" : "up"}>Cashflow {eur(k.cashflowMonat)} im Monat</span>}
          {Object.keys(o.module).length > 0 && <span>{Object.keys(o.module).length} Gestaltung</span>}
          {!a.bewertung.regionOk && <span className="note">außerhalb Ihrer Regionen</span>}
        </div>
      </div>
      <div className="a">
        {cls ? <span className={`pill p-${cls}`}>{a.bewertung.score != null && <b>{Math.round(a.bewertung.score)}</b>}{EINSTUFUNG[cls]}</span> : <span className="pill">Daten fehlen</span>}
        {kandidat && <button type="button" className="btn sm" onClick={pruefen}>Prüfen</button>}
        <button type="button" className="icon danger" onClick={async () => { if (kandidat || await frage({ titel: "Objekt löschen?", text: `„${titel}“ wird mit Unterlagen und Expertenergebnissen gelöscht. Direkt danach können Sie es noch rückgängig machen.`, ja: "Löschen", gefahr: true })) loesche([o.id], kandidat ? `„${titel}“ verworfen` : `„${titel}“ gelöscht`); }} aria-label={kandidat ? `${titel} verwerfen` : `${titel} löschen`} title={kandidat ? "Verwerfen" : "Löschen"}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 10h7.4l.8-10M8.5 9v4.5M11.5 9v4.5" /></svg>
        </button>
      </div>
    </div>
  );
}

/** Objektliste mit Filter, Sortierung, Mehrfachauswahl und Löschen mit Rückgängig. */
export function Objektliste({ objekte, leer, kandidat, werkzeuge = true }: { objekte: Objektdatensatz[]; leer: React.ReactNode; kandidat?: boolean; werkzeuge?: boolean }) {
  const { analyseVon, loesche, setzeObjekt, meldung, frage } = useApp();
  const [filter, setFilter] = useState(""); const [sort, setSort] = useState<Sortierung>("score"); const [wahl, setWahl] = useState<Set<string>>(new Set());
  const liste = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const x = objekte.filter(o => !f || `${o.objekt.titel} ${o.objekt.ort}`.toLowerCase().includes(f)).map(o => ({ o, a: analyseVon(o) }));
    const wert = ({ o, a }: (typeof x)[number]) => sort === "score" ? -(a.bewertung.score ?? -1) : sort === "neu" ? -o.geaendert : sort === "preis" ? (o.objekt.kaufpreis ?? Infinity) : -(a.bewertung.kennzahlen.bruttorendite ?? -1);
    return x.sort((p, q) => wert(p) - wert(q)).map(y => y.o);
  }, [objekte, filter, sort, analyseVon]);
  if (!objekte.length) return <div className="empty">{leer}</div>;
  const gewaehlt = liste.filter(o => wahl.has(o.id)); const alle = gewaehlt.length === liste.length && liste.length > 0;
  const waehle = (id: string, an: boolean) => setWahl(s => { const n = new Set(s); if (an) n.add(id); else n.delete(id); return n; });
  const alleIn = async () => { for (const o of gewaehlt) setzeObjekt(await api.aendereObjekt(o.id, { status: "pruefung" })); meldung(`${gewaehlt.length} in die Prüfung übernommen`); setWahl(new Set()); };
  return (
    <div className="olist-wrap">
      {werkzeuge && objekte.length > 1 && <div className="toolbar">
        <label className="check"><input type="checkbox" checked={alle} onChange={e => setWahl(e.target.checked ? new Set(liste.map(o => o.id)) : new Set())} aria-label="Alle auswählen" /></label>
        <input type="search" className="filter" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Nach Titel oder Ort filtern" aria-label="Filtern" />
        <select value={sort} onChange={e => setSort(e.target.value as Sortierung)} aria-label="Sortieren">{SORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </div>}
      {gewaehlt.length >= 2 && gewaehlt.length <= 4 && <section className="panel vergleich" aria-label="Vergleich">
        <Netz reihen={gewaehlt.map(o => ({ name: o.objekt.titel || "Objekt", achsen: matchAchsen(o.objekt, analyseVon(o)) }))} groesse={300} />
        <div className="vergleich-leg">{gewaehlt.map((o, i) => <span key={o.id} style={{ ["--f" as string]: ["var(--purple)", "var(--gold)", "var(--good)", "var(--crit)"][i] }}><i />{o.objekt.titel || "Objekt"} · {Math.round(analyseVon(o).bewertung.score ?? 0)}</span>)}</div>
      </section>}
      {gewaehlt.length > 0 && <div className="bulk" role="region" aria-label="Auswahl">
        <span>{gewaehlt.length} ausgewählt</span>
        {kandidat && <button type="button" className="btn sm" onClick={alleIn}>In Prüfung übernehmen</button>}
        <button type="button" className="btn sm danger" onClick={async () => { if (!await frage({ titel: kandidat ? `${gewaehlt.length} Treffer verwerfen?` : `${gewaehlt.length} Objekte löschen?`, text: kandidat ? "Die Treffer verschwinden aus dem Suchauftrag." : "Die Objekte werden mit Unterlagen und Expertenergebnissen gelöscht.", ja: kandidat ? "Verwerfen" : "Löschen", gefahr: true })) return; loesche(gewaehlt.map(o => o.id), `${gewaehlt.length} ${kandidat ? "verworfen" : "gelöscht"}`); setWahl(new Set()); }}>{kandidat ? "Verwerfen" : "Löschen"}</button>
        <button type="button" className="btn sm ghost" onClick={() => setWahl(new Set())}>Auswahl aufheben</button>
      </div>}
      <div className="olist">{liste.length ? liste.map(o => <Zeile key={o.id} o={o} kandidat={kandidat} gewaehlt={wahl.has(o.id)} waehle={an => waehle(o.id, an)} />) : <div className="empty">Kein Treffer für „{filter}“.</div>}</div>
    </div>
  );
}
