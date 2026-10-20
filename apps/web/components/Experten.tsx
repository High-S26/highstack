"use client";
import { EXPERTEN } from "@highstack/agents/src/experten";
import { useRef, useState } from "react";
import { api, strom, type Stromereignis } from "@/lib/client";
import type { Objektdatensatz } from "@/lib/typen";
import { useApp } from "./App";

type Bericht = { kernaussage?: string; bewertung?: string; kennzahlen?: { label: string; wert: string; hinweis?: string }[]; abschnitte?: { titel: string; punkte: string[] }[]; fragen?: { an: string; frage: string }[]; entwurf?: { titel: string; text: string }; naechste_schritte?: string[]; grenzen?: string };
type Komitee = { rollen: { rolle: string; urteil: string; konfidenz: string; begruendungen: string[]; warnsignale?: string[]; fragen?: string[] }[]; synthese: { urteil: string; zusammenfassung: string; widersprueche?: string[]; naechste_schritte: string[]; verhandlung?: string } };

export const FACHEXPERTEN = ["makler", "verwalter", "bank", "vermoegen", "steuer", "recht", "projektentwickler", "dokumentpruefer", "komitee"];
export const expertMeta = (id: string) => EXPERTEN.find(e => e.id === id)!;

function Kopieren({ text }: { text: string }) {
  const [ok, setOk] = useState(false); const pre = useRef<HTMLPreElement>(null);
  return <><button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch { const r = document.createRange(); r.selectNodeContents(pre.current!); const s = getSelection()!; s.removeAllRanges(); s.addRange(r); } }}>{ok ? "Kopiert" : "Kopieren"}</button><pre ref={pre} hidden>{text}</pre></>;
}

export function Ergebnis({ id, ergebnis }: { id: string; ergebnis: unknown }) {
  if (id === "komitee") {
    const k = ergebnis as Komitee; const cls = { Opportunity: "p-opp", Watch: "p-watch", Pass: "p-pass" }[k.synthese?.urteil] ?? "";
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div className="synth">
          <div className="row"><strong>Urteil des Komitees</strong><span className={`pill ${cls}`}>{k.synthese?.urteil}</span></div>
          <p>{k.synthese?.zusammenfassung}</p>
          {k.synthese?.verhandlung && <p><strong>Verhandlung: </strong>{k.synthese.verhandlung}</p>}
          {!!k.synthese?.widersprueche?.length && <><div className="lbl">Wo die Perspektiven auseinandergehen</div><ul>{k.synthese.widersprueche.map(x => <li key={x}>{x}</li>)}</ul></>}
          {!!k.synthese?.naechste_schritte?.length && <><div className="lbl">Nächste Schritte</div><ul>{k.synthese.naechste_schritte.map(x => <li key={x}>{x}</li>)}</ul></>}
        </div>
        <div className="roles">{k.rollen?.map(r => <article key={r.rolle} className="role">
          <div className="rh"><h4>{r.rolle}-Sicht</h4><span className={`note ${{ positiv: "u-pos", neutral: "u-neu", negativ: "u-neg" }[r.urteil] ?? ""}`}>{r.urteil} · Sicherheit {r.konfidenz}</span></div>
          {[["Begründung", r.begruendungen], ["Warnsignale", r.warnsignale], ["Fragen", r.fragen]].map(([t, l]) => (l as string[] | undefined)?.length ? <div key={t as string}><div className="lbl">{t as string}</div><ul>{(l as string[]).map(x => <li key={x}>{x}</li>)}</ul></div> : null)}
        </article>)}</div>
      </div>
    );
  }
  const b = ergebnis as Bericht;
  return (
    <div className="xres">
      {b.kernaussage && <div className="core">{b.kernaussage}</div>}
      {b.bewertung && <span className={`pill ${{ positiv: "p-opp", neutral: "p-watch", kritisch: "p-pass" }[b.bewertung] ?? ""}`}>{b.bewertung}</span>}
      {!!b.kennzahlen?.length && <div className="kz">{b.kennzahlen.map(k => <div key={k.label}><span>{k.label}</span><strong>{k.wert}</strong>{k.hinweis && <em>{k.hinweis}</em>}</div>)}</div>}
      {b.abschnitte?.map(a => <div key={a.titel} className="sec"><div className="lbl">{a.titel}</div><ul>{a.punkte.map(p => <li key={p}>{p}</li>)}</ul></div>)}
      {!!b.fragen?.length && <div className="sec"><div className="lbl">Offene Fragen</div><ul>{b.fragen.map(f => <li key={f.frage}><b>{f.an}: </b>{f.frage}</li>)}</ul></div>}
      {b.entwurf?.text && <div className="draft"><div className="ph"><b>{b.entwurf.titel || "Entwurf"}</b><Kopieren text={b.entwurf.text} /></div><pre>{b.entwurf.text}</pre></div>}
      {!!b.naechste_schritte?.length && <div className="sec"><div className="lbl">Nächste Schritte</div><ul>{b.naechste_schritte.map(x => <li key={x}>{x}</li>)}</ul></div>}
      {b.grenzen && <div className="limits">{b.grenzen}</div>}
    </div>
  );
}

function Rueckfrage({ objekt, id }: { objekt: Objektdatensatz; id: string }) {
  const { setzeObjekt, meldung } = useApp();
  const [verlauf, setVerlauf] = useState(objekt.experten[id]?.verlauf ?? []);
  const [frage, setFrage] = useState(""); const [laeuft, setLaeuft] = useState(false);
  const senden = async (e: React.FormEvent) => {
    e.preventDefault(); const q = frage.trim(); if (!q) return;
    setFrage(""); setLaeuft(true); setVerlauf(v => [...v, { rolle: "nutzer", text: q }]);
    try { const r = await api.rueckfrage(objekt.id, id, q); setVerlauf(r.verlauf as typeof verlauf); setzeObjekt({ ...objekt, experten: { ...objekt.experten, [id]: { ...objekt.experten[id]!, verlauf: r.verlauf as typeof verlauf } } }); }
    catch (err) { meldung((err as Error).message); }
    finally { setLaeuft(false); }
  };
  return (
    <div className="chat">
      <div className="lbl">Rückfrage an {id === "komitee" ? "das Komitee" : "den Experten"}</div>
      <div className="chatlog">{verlauf.map((m, i) => <div key={i} className={`bub ${m.rolle === "nutzer" ? "me" : "ai"}`}>{m.text}</div>)}{laeuft && <div className="bub ai">rechnet …</div>}</div>
      <form className="row" onSubmit={senden}><input style={{ flex: "1 1 220px" }} aria-label="Rückfrage" value={frage} onChange={e => setFrage(e.target.value)} placeholder={id === "bank" ? "z. B. Was ändert sich mit 30.000 € mehr Eigenkapital?" : id === "makler" ? "z. B. Wie weit kann ich unter 200.000 € gehen?" : "Ihre Frage …"} /><button className="btn sm" disabled={laeuft}>Fragen</button></form>
    </div>
  );
}

/** Ein Experte am Objekt: starten, live Schritte sehen, Ergebnis, Rückfragen. */
export function Expertenzeile({ objekt, id, onNeu }: { objekt: Objektdatensatz; id: string; onNeu: (o: Objektdatensatz) => void }) {
  const m = expertMeta(id); const stand = objekt.experten[id];
  const [schritte, setSchritte] = useState<string[]>([]); const [laeuft, setLaeuft] = useState(false); const [fehler, setFehler] = useState<string | null>(null);
  const start = async () => {
    setLaeuft(true); setSchritte([]); setFehler(null);
    try {
      await strom(`/api/objekte/${objekt.id}/experte`, { experte: id }, (e: Stromereignis) => { if (e.typ === "schritt" && e.text) setSchritte(s => [...s, e.text!]); if (e.typ === "fehler" || e.typ === "abbruch") setFehler(e.meldung ?? "Fehler"); });
      onNeu(await api.objekt(objekt.id));
    } catch (err) { setFehler((err as Error).message); } finally { setLaeuft(false); }
  };
  return (
    <div className="xrow">
      <div><div className="tag">{m.rolle}</div><div className="nm">{m.titel}</div><div className="note">{m.beschreibung}</div></div>
      <div className="row">{stand && <span className="badge b-on">Stand {new Date(stand.am).toLocaleDateString("de-DE")}</span>}<button type="button" className={`btn sm${stand ? " ghost" : ""}`} disabled={laeuft} onClick={start}>{laeuft ? "arbeitet …" : stand ? "Aktualisieren" : "Beauftragen"}</button></div>
      <div className="full">
        {(laeuft || fehler) && <div className="xres"><div className="lbl">Arbeitsschritte</div><ol className="alog">{schritte.map((s, i) => <li key={i}>{s}</li>)}</ol>{fehler && <div className="note dn">{fehler}</div>}</div>}
        {stand && !laeuft && <details><summary>Ergebnis anzeigen</summary><Ergebnis id={id} ergebnis={stand.ergebnis} /><details><summary>Arbeitsschritte ({stand.schritte.length})</summary><ol className="alog">{stand.schritte.map((s, i) => <li key={i}>{s}</li>)}</ol></details><Rueckfrage objekt={objekt} id={id} /></details>}
      </div>
    </div>
  );
}

/** Teamlauf mit Statustafel. */
export function Teamtafel({ objekt, onNeu }: { objekt: Objektdatensatz; onNeu: (o: Objektdatensatz) => void }) {
  const [status, setStatus] = useState<Record<string, { zustand: string; letzte: string }>>({});
  const [laeuft, setLaeuft] = useState(false); const [ende, setEnde] = useState<{ komitee: unknown; compliance: { freigabe: boolean; beanstandungen: { experte: string; problem: string; korrektur: string }[] } | null } | null>(null);
  const ctl = useRef<AbortController>();
  const team = ["makler", "verwalter", "bank", "vermoegen", "steuer", "recht", ...(Object.keys(objekt.module).length ? ["projektentwickler"] : []), ...(objekt.dokumente.some(d => d.text) ? ["dokumentpruefer"] : []), "komitee", "compliance"];
  const start = async () => {
    setLaeuft(true); setEnde(null); setStatus(Object.fromEntries(team.map(t => [t, { zustand: "wartet", letzte: expertMeta(t).beschreibung }])));
    ctl.current = new AbortController();
    try {
      await strom(`/api/objekte/${objekt.id}/team`, {}, e => {
        if (e.experte) setStatus(s => ({ ...s, [e.experte!]: { zustand: e.typ === "fertig" ? "fertig" : e.typ === "fehler" ? "Fehler" : "arbeitet", letzte: e.typ === "fertig" ? String((e.ergebnis as { kernaussage?: string; synthese?: { zusammenfassung: string } })?.kernaussage ?? (e.ergebnis as { synthese?: { zusammenfassung: string } })?.synthese?.zusammenfassung ?? "fertig") : e.text ?? e.meldung ?? "" } }));
        if (e.typ === "team_fertig") setEnde({ komitee: e.komitee, compliance: e.compliance as never });
      }, ctl.current.signal);
      onNeu(await api.objekt(objekt.id));
    } catch (err) { if ((err as Error).name !== "AbortError") setStatus(s => ({ ...s, _: { zustand: "Fehler", letzte: (err as Error).message } })); }
    finally { setLaeuft(false); }
  };
  const cls = (z: string) => ({ wartet: "b-plan", arbeitet: "b-warn", fertig: "b-on" } as Record<string, string>)[z] ?? "b-plan";
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="row"><button type="button" className="btn" disabled={laeuft} onClick={start}>{laeuft ? "Team arbeitet …" : "Ganzes Team beauftragen"}</button>{laeuft && <button type="button" className="btn ghost sm" onClick={() => ctl.current?.abort()}>Stopp</button>}<span className="note">{team.length} Rollen · einige Minuten</span></div>
      {Object.keys(status).length > 0 && <div className="board">{Object.entries(status).map(([id, s]) => <div key={id} className="agrow"><div><div className="nm">{id === "_" ? "Teamlauf" : `${expertMeta(id).rolle} · ${expertMeta(id).titel}`}</div><div className="note">{s.letzte}</div></div><span className={`badge ${cls(s.zustand)}`}>{s.zustand}</span></div>)}</div>}
      {ende?.compliance && !ende.compliance.freigabe && <ul className="flags">{ende.compliance.beanstandungen.map((b, i) => <li key={i} className="crit">Compliance ({b.experte}): {b.problem} – {b.korrektur}</li>)}</ul>}
      {!!ende?.komitee && <Ergebnis id="komitee" ergebnis={ende.komitee} />}
    </div>
  );
}
