"use client";
import { EXPERTEN } from "@highstack/agents/src/experten";
import Link from "next/link";
import { useRef, useState } from "react";
import { api, strom, verbrauchText, type Kurzurteil, type Stromereignis, type Verbrauchsanzeige } from "@/lib/client";
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
  const { profil } = useApp();
  const m = expertMeta(id); const stand = objekt.experten[id]; const imTeam = profil?.experten?.[id] !== false;
  const [schritte, setSchritte] = useState<string[]>([]); const [laeuft, setLaeuft] = useState(false); const [fehler, setFehler] = useState<string | null>(null);
  const [verbrauch, setVerbrauch] = useState<Verbrauchsanzeige | null>(null);
  const start = async (neu = false) => {
    setLaeuft(true); setSchritte([]); setFehler(null); setVerbrauch(null);
    try {
      await strom(`/api/objekte/${objekt.id}/experte`, { experte: id, neu }, (e: Stromereignis) => { if (e.typ === "schritt" && e.text) setSchritte(s => [...s, e.text!]); if (e.typ === "verbrauch") setVerbrauch(e as unknown as Verbrauchsanzeige); if (e.typ === "fehler" || e.typ === "abbruch") setFehler(e.meldung ?? "Fehler"); });
      onNeu(await api.objekt(objekt.id));
    } catch (err) { setFehler((err as Error).message); } finally { setLaeuft(false); }
  };
  return (
    <div className="xrow">
      <div><div className="tag">{m.rolle}{!imTeam && " · im Team ausgeschaltet"}</div><div className="nm">{m.titel}</div><div className="note">{m.beschreibung}</div></div>
      <div className="row">{stand && <span className="badge b-on">Stand {new Date(stand.am).toLocaleDateString("de-DE")}</span>}<button type="button" className={`btn sm${stand ? " ghost" : ""}`} disabled={laeuft} onClick={() => start()}>{laeuft ? "arbeitet …" : stand ? "Aktualisieren" : "Beauftragen"}</button></div>
      <div className="full">
        {verbrauch && !laeuft && <div className="note verbrauch">{verbrauch.ausSpeicher ? <>Eingaben unverändert – gespeichertes Ergebnis, kein Modellaufruf. <button type="button" className="linkbtn" onClick={() => start(true)}>Trotzdem neu erstellen</button></> : verbrauchText(verbrauch)}</div>}
        {(laeuft || fehler) && <div className="xres"><div className="lbl">Arbeitsschritte</div><ol className="alog">{schritte.map((s, i) => <li key={i}>{s}</li>)}</ol>{fehler && <div className="note dn">{fehler}</div>}</div>}
        {stand && !laeuft && <details><summary>Ergebnis anzeigen</summary><Ergebnis id={id} ergebnis={stand.ergebnis} /><details><summary>Arbeitsschritte ({stand.schritte.length})</summary><ol className="alog">{stand.schritte.map((s, i) => <li key={i}>{s}</li>)}</ol></details><Rueckfrage objekt={objekt} id={id} /></details>}
      </div>
    </div>
  );
}

/** Teamlauf: Kacheln je Rolle mit Stand, Fortschritt, danach Urteil des Komitees oben. */
export function Teamtafel({ objekt, onNeu }: { objekt: Objektdatensatz; onNeu: (o: Objektdatensatz) => void }) {
  const { profil } = useApp();
  type Zst = { zustand: "wartet" | "arbeitet" | "fertig" | "gespeichert" | "Fehler" | "aus"; text: string };
  const an = (id: string) => profil?.experten?.[id] !== false;
  const rollen = ["makler", "verwalter", "bank", "vermoegen", "steuer", "recht", ...(Object.keys(objekt.module).length ? ["projektentwickler"] : []), ...(objekt.dokumente.some(d => d.text) ? ["dokumentpruefer"] : []), "komitee"];
  const kern = (e: unknown) => String((e as { kernaussage?: string })?.kernaussage ?? (e as { synthese?: { zusammenfassung: string } })?.synthese?.zusammenfassung ?? "");
  const ausSpeicher = (): Record<string, Zst> => Object.fromEntries(rollen.map(r => [r, !an(r) ? { zustand: "aus", text: "im Team ausgeschaltet" } : objekt.experten[r] ? { zustand: "gespeichert", text: kern(objekt.experten[r]!.ergebnis) } : { zustand: "wartet", text: expertMeta(r).beschreibung }]));
  const [status, setStatus] = useState<Record<string, Zst>>(ausSpeicher);
  const [laeuft, setLaeuft] = useState(false); const [fehler, setFehler] = useState<string | null>(null);
  const [ende, setEnde] = useState<{ komitee: unknown; compliance: { freigabe: boolean; quelle?: string; beanstandungen: { experte: string; problem: string; korrektur: string }[] } | null } | null>(null);
  const [gate, setGate] = useState<string | null>(null); const [verbrauch, setVerbrauch] = useState<Verbrauchsanzeige | null>(null);
  const ctl = useRef<AbortController>();
  const aktiv = rollen.filter(an);
  const start = async (erzwingen = false) => {
    setLaeuft(true); setEnde(null); setGate(null); setVerbrauch(null); setFehler(null);
    ctl.current = new AbortController();
    try {
      await strom(`/api/objekte/${objekt.id}/team`, { erzwingen }, e => {
        if (e.typ === "team_uebersprungen") setGate(String(e.grund));
        if (e.typ === "team_start") setStatus(s => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.zustand === "aus" ? v : { zustand: "wartet", text: v.text }])));
        if (e.typ === "verbrauch") setVerbrauch(e as unknown as Verbrauchsanzeige);
        if (e.experte && rollen.includes(e.experte)) setStatus(s => ({ ...s, [e.experte!]: { zustand: e.typ === "fertig" ? (e.ausSpeicher ? "gespeichert" : "fertig") : e.typ === "fehler" ? "Fehler" : "arbeitet", text: e.typ === "fertig" ? kern(e.ergebnis) : e.text ?? e.meldung ?? s[e.experte!]?.text ?? "" } }));
        if (e.typ === "team_fertig") setEnde({ komitee: e.komitee, compliance: e.compliance as never });
        if (e.typ === "abbruch") setFehler(e.meldung ?? "Abgebrochen");
      }, ctl.current.signal);
      onNeu(await api.objekt(objekt.id));
    } catch (err) { if ((err as Error).name !== "AbortError") setFehler((err as Error).message); }
    finally { setLaeuft(false); }
  };
  const fertig = aktiv.filter(r => ["fertig", "gespeichert"].includes(status[r]?.zustand ?? "")).length;
  const komitee = ende?.komitee ?? (an("komitee") ? objekt.experten.komitee?.ergebnis : null);
  const LABEL: Record<Zst["zustand"], string> = { wartet: "wartet", arbeitet: "arbeitet …", fertig: "fertig", gespeichert: "vorhanden", Fehler: "Fehler", aus: "aus" };
  return (
    <div className="team">
      <div className="team-h">
        <button type="button" className="btn" disabled={laeuft} onClick={() => start()}>{laeuft ? "Team arbeitet …" : "Ganzes Team beauftragen"}</button>
        {laeuft && <button type="button" className="btn ghost sm" onClick={() => ctl.current?.abort()}>Stopp</button>}
        <span className="note">{aktiv.length} von {rollen.length} Rollen aktiv · unveränderte Ergebnisse werden wiederverwendet · <Link href="/experten">Experten an- und ausschalten</Link></span>
      </div>
      {laeuft && <div className="prog" role="progressbar" aria-valuemin={0} aria-valuemax={aktiv.length} aria-valuenow={fertig}><div style={{ width: `${(fertig / Math.max(1, aktiv.length)) * 100}%` }} /><span>{fertig} von {aktiv.length} fertig</span></div>}
      {gate && <div className="gate"><b>Teamlauf nicht gestartet</b><p>{gate}</p><div className="row"><button type="button" className="btn ghost sm" onClick={() => start(true)}>Trotzdem beauftragen</button><span className="note">Tipp: erst Kurzurteil im Tab Ergebnis, Gestaltung oder Unterlagen ergänzen.</span></div></div>}
      {fehler && <div className="gate"><b>Teamlauf unterbrochen</b><p>{fehler}</p></div>}
      {!!komitee && !laeuft && <Ergebnis id="komitee" ergebnis={komitee} />}
      {ende?.compliance && !ende.compliance.freigabe && <ul className="flags">{ende.compliance.beanstandungen.map((b, i) => <li key={i} className="crit">Compliance ({b.experte}): {b.problem}. {b.korrektur}</li>)}</ul>}
      {ende?.compliance?.freigabe && <p className="note">Compliance: freigegeben ({ende.compliance.quelle === "modell" ? "nach Modellprüfung" : "Regelprüfung, ohne Modellaufruf"}).</p>}
      <div className="tgrid">{rollen.map(r => { const st: Zst = !an(r) ? { zustand: "aus", text: "im Team ausgeschaltet" } : status[r]!.zustand === "aus" ? { zustand: objekt.experten[r] ? "gespeichert" : "wartet", text: objekt.experten[r] ? kern(objekt.experten[r]!.ergebnis) : expertMeta(r).beschreibung } : status[r]!; const m = expertMeta(r); return (
        <div key={r} className={`tcard z-${st.zustand}`}>
          <div className="tc-h"><span className="tc-r">{m.rolle}</span><span className="tc-s">{LABEL[st.zustand]}</span></div>
          <b>{m.titel}</b>
          <p>{st.text}</p>
        </div>); })}</div>
      {verbrauch && !laeuft && <div className="note verbrauch">Verbrauch dieses Laufs: {verbrauchText(verbrauch)}</div>}
    </div>
  );
}

/** Stufe 1: Kurzurteil mit einem Modellaufruf, nach den gerechneten Zahlen. */
export function Kurzurteilpanel({ objekt, onNeu }: { objekt: Objektdatensatz; onNeu: (o: Objektdatensatz) => void }) {
  const stand = objekt.experten.kurzurteil?.ergebnis as Kurzurteil | undefined;
  const [laeuft, setLaeuft] = useState(false); const [fehler, setFehler] = useState<string | null>(null); const [verbrauch, setVerbrauch] = useState<Verbrauchsanzeige & { ausSpeicher?: boolean | number } | null>(null);
  const start = async (neu = false) => {
    setLaeuft(true); setFehler(null);
    try { const r = await api.kurzurteil(objekt.id, neu); setVerbrauch({ ...r.verbrauch, ausSpeicher: r.ausSpeicher ? 1 : 0 }); onNeu(await api.objekt(objekt.id)); }
    catch (e) { setFehler((e as Error).message); } finally { setLaeuft(false); }
  };
  const cls = { Opportunity: "p-opp", Watch: "p-watch", Pass: "p-pass" }[stand?.einstufung ?? ""] ?? "";
  return (
    <section className="panel">
      <div className="ph"><h2>Kurzurteil</h2><span className="tag">1 Modellaufruf · Sekunden</span></div>
      {!stand && <p className="note">Eine erste Einschätzung auf Basis der gerechneten Zahlen: Kernaussage, die wichtigsten Fragen, ein Verhandlungsansatz. Für die Tiefenprüfung gibt es die Experten.</p>}
      {stand && <div className="xres">
        <div className="row"><span className={`pill ${cls}`}>{stand.einstufung}</span></div>
        <div className="core">{stand.kernaussage}</div>
        {!!stand.fragen?.length && <div className="sec"><div className="lbl">Zuerst klären</div><ul>{stand.fragen.map(f => <li key={f.frage}><b>{f.an}: </b>{f.frage}</li>)}</ul></div>}
        {stand.verhandlungsansatz && <div className="sec"><div className="lbl">Verhandlungsansatz</div><p>{stand.verhandlungsansatz}</p></div>}
        {stand.naechster_schritt && <div className="sec"><div className="lbl">Nächster Schritt</div><p>{stand.naechster_schritt}</p></div>}
      </div>}
      <div className="row" style={{ marginTop: 10 }}>
        <button type="button" className={`btn sm${stand ? " ghost" : ""}`} disabled={laeuft} onClick={() => start()}>{laeuft ? "denkt …" : stand ? "Aktualisieren" : "Kurzurteil holen"}</button>
        {verbrauch && !laeuft && <span className="note verbrauch">{verbrauch.ausSpeicher ? <>Zahlen unverändert – gespeichertes Urteil. <button type="button" className="linkbtn" onClick={() => start(true)}>Neu erstellen</button></> : verbrauchText(verbrauch)}</span>}
        {fehler && <span className="note dn">{fehler}</span>}
      </div>
    </section>
  );
}
