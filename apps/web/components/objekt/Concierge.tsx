"use client";
import type { Analyse, Objekt } from "@highstack/engine";
import { useEffect, useRef, useState } from "react";
import { conciergeStand, fragen } from "@/lib/concierge";
import { eur, pct } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";
import { leseZahl } from "../Felder";
import { api } from "@/lib/client";

/**
 * Concierge: fragt fehlende Angaben einzeln ab, wichtigste zuerst.
 * Jede Frage sagt, warum sie zählt und wo die Antwort steht; „Weiß ich nicht“ setzt eine
 * gekennzeichnete Annahme oder merkt sich die Lücke. Nach jeder Antwort zeigt er die Wirkung.
 */
export function Concierge({ o, a, setze, zuUnterlagen, aus }: { o: Objektdatensatz; a: Analyse; setze: (p: Partial<Objektdatensatz>) => void; zuUnterlagen: () => void; aus: () => void }) {
  const liste = fragen(o.objekt); const f = liste[0]; const stand = conciergeStand(o.objekt);
  const [eingabe, setEingabe] = useState(""); const [wahl, setWahl] = useState<string | null>(null);
  const [echo, setEcho] = useState<string | null>(null); const [wo, setWo] = useState(false); const [ermittelt, setErmittelt] = useState(false);
  const vorher = useRef<{ r: number | null; c: number | null } | null>(null); const feld = useRef<HTMLInputElement>(null);
  const k = a.bewertung.kennzahlen;
  // Wirkung der letzten Antwort zeigen
  useEffect(() => {
    const v = vorher.current; if (!v) return; vorher.current = null;
    const teile: string[] = [];
    if (k.bruttorendite != null && k.bruttorendite !== v.r) teile.push(`Rendite ${pct(k.bruttorendite)}`);
    if (k.cashflowMonat != null && k.cashflowMonat !== v.c) teile.push(`Cashflow ${eur(k.cashflowMonat)} im Monat`);
    setEcho(e => teile.length ? `${e ?? "Übernommen."} Jetzt: ${teile.join(", ")}.` : e);
  }, [k.bruttorendite, k.cashflowMonat]);
  useEffect(() => { setEingabe(""); setWahl(null); setWo(false); if (f?.typ === "zahl") feld.current?.focus({ preventScroll: true }); }, [f?.id, f?.typ]);

  const anwenden = (patch: Partial<Objekt>, text: string) => { vorher.current = { r: k.bruttorendite ?? null, c: k.cashflowMonat ?? null }; setEcho(text); setze({ objekt: { ...o.objekt, ...patch } }); };
  const merke = (id: string, w: "nein" | "unbekannt", patch: Partial<Objekt> = {}) => ({ ...patch, gefragt: { ...(o.objekt.gefragt ?? {}), ...(patch.gefragt ?? {}), [id]: w } });
  if (!f) return (
    <section className="panel concierge fertig" aria-live="polite">
      <div className="cg-kopf"><span className="cg-avatar" aria-hidden="true">✓</span><div><b>Alles Wichtige ist da.</b><span className="note">{echo ?? "Der Concierge meldet sich, wenn etwas fehlt."}</span></div>
        <button type="button" className="linkbtn" onClick={aus}>Concierge ausblenden</button></div>
    </section>
  );
  // Bestätigung nennt den Wert, damit klar ist, was angekommen ist
  const absenden = (v: string | number) => anwenden(f.antwort(v), f.bestaetigung?.(v) ?? (typeof v === "number" ? `Übernommen: ${v.toLocaleString("de-DE", { maximumFractionDigits: 2 })}${f.einheit ? ` ${f.einheit}` : ""}.` : `Übernommen: ${f.optionen?.find(([w]) => w === v)?.[1] ?? v}.`));
  const zahlOk = leseZahl(eingabe) != null && (leseZahl(eingabe) ?? 0) > 0;
  const unbekannt = () => { const u = f.unbekannt?.(); anwenden(merke(f.id, "unbekannt", u?.patch), u ? `${u.text}. Sie können sie jederzeit ändern.` : "Gemerkt. Die Experten weisen auf die Lücke hin."); };
  return (
    <section className="panel concierge" aria-labelledby="cg-frage">
      <div className="cg-kopf">
        <span className="cg-avatar" aria-hidden="true">?</span>
        <div><span className="lrow"><b>Concierge</b><span className="tag">{f.thema}</span></span><span className="note">{stand.beantwortet} geklärt · noch {liste.length} {liste.length === 1 ? "Frage" : "Fragen"}</span></div>
        <div className="cg-ring" style={{ ["--p" as string]: `${(stand.beantwortet / Math.max(1, stand.gesamt)) * 100}` }} aria-hidden="true" />
        <button type="button" className="linkbtn" onClick={aus} title="Selbst ausfüllen, ohne Concierge">Selbst ausfüllen</button>
      </div>
      {echo && <p className="cg-echo" aria-live="polite">{echo}</p>}
      <h3 id="cg-frage" className="cg-frage">{f.frage}</h3>
      <p className="note cg-warum">{f.warum}</p>
      <form className="cg-antwort" onSubmit={e => { e.preventDefault(); if (f.typ === "zahl" && zahlOk) absenden(leseZahl(eingabe)!); else if (f.typ === "wahl" && wahl) absenden(wahl); }}>
        {f.typ === "zahl" ? <div className="cg-zahl"><input ref={feld} inputMode="decimal" value={eingabe} onChange={e => setEingabe(e.target.value)} aria-labelledby="cg-frage" placeholder={f.einheit === "€" ? "z. B. 250.000" : ""} />{f.einheit && <span>{f.einheit}</span>}</div>
          : <div className="cg-wahl" role="radiogroup" aria-labelledby="cg-frage">{f.optionen!.map(([v, l, s]) => <button key={v} type="button" role="radio" aria-checked={wahl === v} className="wiz-karte" onClick={() => setWahl(v)} onDoubleClick={() => absenden(v)}><b>{l}</b>{s && <span>{s}</span>}</button>)}</div>}
        <div className="row">
          <button type="submit" className="btn" disabled={f.typ === "zahl" ? !zahlOk : !wahl}>Übernehmen</button>
          {f.ermitteln && <button type="button" className="btn ghost" disabled={ermittelt} onClick={async () => { setErmittelt(true); try { const r = await api.ermitteln(o.id, o.objekt); anwenden({ marktmieteQm: r.marktmieteQm.wert, vergleichspreisQm: o.objekt.vergleichspreisQm ?? r.vergleichspreisQm.wert, herkunft: { ...(o.objekt.herkunft ?? {}), marktmieteQm: { quelle: r.stand, von: r.marktmieteQm.von, bis: r.marktmieteQm.bis, am: Date.now() } } }, `Ermittelt: ${r.marktmieteQm.wert.toLocaleString("de-DE")} €/m² (${r.marktmieteQm.von.toLocaleString("de-DE")} bis ${r.marktmieteQm.bis.toLocaleString("de-DE")}), ${r.stand}.`); } catch (e) { setEcho((e as Error).message); } finally { setErmittelt(false); } }}>{ermittelt ? "Ermittelt …" : "Ermitteln lassen"}</button>}
          <button type="button" className="btn ghost" onClick={unbekannt}>Weiß ich nicht</button>
          <button type="button" className="linkbtn" onClick={() => setWo(x => !x)} aria-expanded={wo}>Wo finde ich das?</button>
        </div>
      </form>
      {wo && <div className="cg-wo"><p>{f.wo}</p><button type="button" className="btn sm ghost" onClick={zuUnterlagen}>Unterlage hochladen und auslesen lassen</button></div>}
    </section>
  );
}
