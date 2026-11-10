"use client";
import { DAX_ETF_ISIN, type Ideevariante, type Journaleintrag, type Option, type Tagessignal } from "@highstack/trading";
import { useEffect, useState } from "react";
import { Zahl } from "../Felder";
import { Positionen, ScalableOrder, type Journal, type ScStand } from "./DaxTag";

type Ziel = "tagestrade" | "rally" | "dividende";
interface Antwort { dax: number; quelle: string; richtung: "long" | "short" | null; signal: Tagessignal | null; einordnung?: { modell: string; text: string; grundrate: number | null; modellTreffer: number | null }; optionen: Option[]; termine?: string[]; hinweis?: string; fehler?: string }

const eur = (v: number | null | undefined, d = 2) => v == null ? "–" : `${v.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d })} €`;
const pct = (v: number | null | undefined, d = 0) => v == null ? "–" : `${(v * 100).toLocaleString("de-DE", { maximumFractionDigits: d, minimumFractionDigits: d })} %`;
const pkt = (v: number | null | undefined) => v == null ? "–" : Math.round(v).toLocaleString("de-DE");
const BROKER = ["Scalable Capital", "Trade Republic", "ING", "comdirect", "andere App"] as const;
const SUCHE: Record<string, string> = {
  "Scalable Capital": "Suche „DAX“ → Reiter Derivate → Knock-out",
  "Trade Republic": "Suche „DAX“ → Derivate → Knock-out",
  ING: "Wertpapiersuche → Derivate → Knock-out-Produkte, Basiswert DAX",
  comdirect: "Informer → Zertifikate/Hebelprodukte → Knock-out, Basiswert DAX",
  "andere App": "Hebelprodukte bzw. Knock-outs mit Basiswert DAX",
};
const post = async (url: string, body: unknown) => { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.fehler ?? `Fehler ${r.status}`); return j; };

/** Geführter Einstieg: Ziel → Rahmen → Analyse mit drei Optionen → Umsetzen (Scalable oder Schritt für Schritt) → Überwachen */
export function Assistent() {
  const [schritt, setSchritt] = useState(1);
  const [ziel, setZiel] = useState<Ziel>("tagestrade"); const [betrag, setBetrag] = useState<number | null>(250);
  const [richtung, setRichtung] = useState<"modell" | "long" | "short">("modell"); const [zielRendite, setZielRendite] = useState<number | null>(0.075); const [horizont, setHorizont] = useState<number | null>(5);
  const [a, setA] = useState<Antwort | null>(null); const [laedt, setLaedt] = useState(false); const [fehler, setFehler] = useState<string | null>(null);
  const [wahl, setWahl] = useState<Option | null>(null); const [st, setSt] = useState<ScStand | null>(null); const [jr, setJr] = useState<Journal | null>(null);
  const ladeSc = () => fetch("/api/trading/scalable").then(r => r.json()).then(setSt).catch(() => setSt({ an: false }));
  const ladeJr = () => fetch("/api/trading/journal").then(r => r.json()).then(setJr).catch(() => null);
  useEffect(() => { ladeSc(); ladeJr(); }, []);
  const analysieren = async () => {
    setLaedt(true); setFehler(null); setWahl(null);
    try {
      const r = await fetch(`/api/trading/assistent?${new URLSearchParams({ ziel, betrag: String(betrag ?? 250), richtung, zielRendite: String(zielRendite ?? 0.075), horizont: String(horizont ?? 5) })}`);
      const j = await r.json(); if (!r.ok) throw new Error(j.fehler); setA(j); setSchritt(3);
    } catch (e) { setFehler((e as Error).message); } finally { setLaedt(false); }
  };
  const offen = jr?.eintraege.filter(e => e.status === "offen") ?? [];
  const Kopf = ({ n, t }: { n: number; t: string }) => <button type="button" className={`as-schritt${schritt === n ? " an" : schritt > n ? " fertig" : ""}`} onClick={() => n < schritt && setSchritt(n)} disabled={n > schritt}><b>{schritt > n ? "✓" : n}</b> {t}</button>;

  return (
    <section className="panel assistent">
      <div className="ph"><h2>Los geht’s</h2><span className="tag">highstack führt, Sie bestätigen</span></div>
      {offen.length > 0 && <Positionen eintraege={offen} st={st} neu={() => { ladeJr(); ladeSc(); }} />}
      <nav className="as-nav" aria-label="Schritte"><Kopf n={1} t="Ziel" /><Kopf n={2} t="Rahmen" /><Kopf n={3} t="Optionen" /><Kopf n={4} t="Umsetzen" /></nav>

      {schritt === 1 && <div className="as-karten">
        {([["tagestrade", "Tagestrade", "Heute rein, spätestens 17:30 raus. Ziel z. B. 5–10 % auf den Einsatz."], ["rally", "Rally: Einsatz verdoppeln", "Hohes Risiko: Knock-out mit großem Hebel, Ziel +100 % in wenigen Tagen, Totalverlust möglich."], ["dividende", "Langfristig: Dividendenaktie Deutschland", "Kommt als Nächstes: braucht Dividenden- und Bilanzdaten deutscher Werte."]] as const).map(([k, t, x]) => (
          <button key={k} type="button" className={`as-karte${ziel === k ? " an" : ""}`} disabled={k === "dividende"} onClick={() => { setZiel(k); setSchritt(2); }}><b>{t}</b><span className="note">{x}</span>{k === "dividende" && <span className="tag">bald</span>}</button>
        ))}
      </div>}

      {schritt === 2 && <>
        <div className="fields">
          <Zahl label="Spielgeld" einheit="€" min={10} max={1e6} wert={betrag} onChange={setBetrag} hinweis="Nur Geld, dessen Verlust Sie verkraften" />
          <div className="fld"><div className="lrow"><label htmlFor="as-markt">Markt</label></div><select id="as-markt" value="DAX" onChange={() => undefined}><option value="DAX">DAX</option><option disabled>Nasdaq-100 (bald)</option><option disabled>Gold, Öl (bald)</option></select></div>
          {ziel === "tagestrade" ? <Zahl label="Zielrendite am Tag" prozent min={1} max={50} wert={zielRendite} onChange={setZielRendite} hinweis="auf den Einsatz; bestimmt den Hebel" /> : <Zahl label="Horizont" einheit="Handelstage" min={1} max={60} wert={horizont} onChange={setHorizont} hinweis="so lange darf die Rally laufen" />}
        </div>
        <div className="lbl">Richtung</div>
        <div className="dax-seg" role="radiogroup" aria-label="Richtung">{([["modell", "highstack entscheiden lassen"], ["long", "DAX steigt"], ["short", "DAX fällt"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={richtung === k} className={richtung === k ? "on" : ""} onClick={() => setRichtung(k)}>{l}</button>)}</div>
        <div className="row"><button type="button" className="btn" disabled={laedt || !betrag} onClick={analysieren}>{laedt ? "Analysiert …" : "Analysieren"}</button></div>
        {fehler && <p className="note warn-t">{fehler}</p>}
      </>}

      {schritt === 3 && a && <>
        <p className="note">DAX {pkt(a.dax)} ({a.quelle}){a.signal ? ` · Modell: ${a.signal.richtung === "keine" ? "keine Richtung" : a.signal.richtung}` : ""}</p>
        {a.hinweis && <p className="note warn-t">{a.hinweis}</p>}
        {a.einordnung && <p className={`note${a.einordnung.modell === "dagegen" ? " warn-t" : ""}`}>{a.einordnung.text}</p>}
        {!!a.termine?.length && <p className="note warn-t">Heute wichtig: {a.termine.join(" · ")}.</p>}
        <div className="as-optionen">{a.optionen.map(o => (
          <button key={o.nr} type="button" className={`as-option${wahl?.nr === o.nr ? " an" : ""}`} onClick={() => setWahl(o)}>
            <span className="as-nr">Option {o.nr}</span><b>{o.titel}</b><span className="note">{o.text}</span>
            <span className="as-zahlen">
              <span>{ziel === "rally" ? "Verdoppelt" : "Ziel erreicht"} <b>{pct(o.pZiel)}</b></span>
              <span>{ziel === "rally" ? "Totalverlust" : "Stopp"} <b className="neg">{pct(o.pStopp)}</b></span>
              <span>{ziel === "rally" ? "Weder noch" : "Schluss dazwischen"} <b>{pct(o.pOffen)}</b></span>
            </span>
            <span className="as-zahlen"><span>Am Ziel <b>{eur(o.zielEuro)}</b></span><span>Am Stopp <b className="neg">{eur(o.stoppEuro)}</b></span><span>Erwartung <b className={(o.erwartungNetto ?? 0) < 0 ? "neg" : ""}>{eur(o.erwartungNetto)}</b></span></span>
            <span className="note">{o.hinweis}</span>
          </button>))}
        </div>
        {a.optionen.length > 0 && <p className="note">Wahrscheinlichkeiten aus den letzten {ziel === "rally" ? "10" : "8"} Jahren DAX-Tageskursen, ohne Blick auf die Zukunft; berührte der Kurs an einem Tag Ziel und Stopp, zählt vorsichtig der Stopp. Ziel und Stopp liegen bei allen Optionen an denselben DAX-Marken; der Hebel ändert nur die Euro-Beträge. „Erwartung“ ist der Durchschnitt aller Fälle nach Gebühren. Ist sie negativ, verdient im Schnitt nur, wer bessere Informationen hat als die Statistik.</p>}
        <div className="row"><button type="button" className="btn" disabled={!wahl} onClick={() => setSchritt(4)}>Option {wahl?.nr ?? ""} umsetzen</button><button type="button" className="btn ghost" onClick={() => setSchritt(2)}>Rahmen ändern</button></div>
      </>}

      {schritt === 4 && a && wahl && <Umsetzen o={wahl} a={a} st={st} quelle={richtung === "modell" ? "modell" : "eigene"} fertig={() => { ladeJr(); ladeSc(); setSchritt(1); setA(null); setWahl(null); }} />}
      <p className="note">Information und Werkzeug, keine Anlageberatung. Hebelprodukte können bis zum Totalverlust führen.</p>
    </section>
  );
}

/** Schritt 4: mit Scalable automatisch oder Schritt für Schritt in jeder Broker-App */
function Umsetzen({ o, a, st, quelle, fertig }: { o: Option; a: Antwort; st: ScStand | null; quelle: "eigene" | "modell"; fertig: () => void }) {
  const automatisch = !!st?.angemeldet;
  const [weg, setWeg] = useState<"scalable" | "hand">(automatisch ? "scalable" : "hand");
  const [broker, setBroker] = useState<string>("Scalable Capital"); const [erledigt, setErledigt] = useState<number[]>([]);
  const [wkn, setWkn] = useState(""); const [hebel, setHebel] = useState<number | null>(o.produkt === "etf" ? 1 : o.hebel); const [brief, setBrief] = useState<number | null>(null);
  const [kauf, setKauf] = useState<number | null>(null); const [stueckIst, setStueckIst] = useState<number | null>(null); const [msg, setMsg] = useState<string | null>(null);
  const daxStopp = o.stoppProdukt / o.hebel, daxZiel = o.zielProdukt / o.hebel; const h = hebel || o.hebel;
  const stueck = brief ? Math.floor(o.einsatz / brief) : null; const limit = brief ? Math.round(brief * 1.005 * 100) / 100 : null;
  const stoppP = Math.min(0.95, daxStopp * h), zielP = daxZiel * h;
  const ok = (n: number) => setErledigt(e => e.includes(n) ? e : [...e, n]); const istOk = (n: number) => erledigt.includes(n);
  const variante: Ideevariante = { id: o.produkt === "etf" ? "etf" : "ko-voll", titel: o.titel, text: o.text, hebel: o.hebel, einsatz: o.einsatz, barriere: o.barriere, amStopp: o.stoppEuro, amZiel: o.zielEuro, beiPlus1: 0, beiMinus1: 0, stoppProdukt: o.stoppProdukt, zielProdukt: o.zielProdukt, totalverlustBei: o.produkt === "ko" ? 1 / o.hebel : null };
  const insJournal = async () => {
    try {
      await post("/api/trading/journal", { aktion: "neu", eintrag: { basis: "DAX", richtung: o.richtung, quelle, idee: `${o.titel} über ${broker}`, produkt: { isin: wkn.trim().toUpperCase(), name: wkn.trim().toUpperCase() || null, art: o.produkt, hebel: h }, einstieg: { kurs: kauf }, stueck: stueckIst ?? stueck, stoppProdukt: stoppP, zielProdukt: zielP } });
      setMsg("Im Journal. Die Position steht oben unter „Offene Positionen“."); setTimeout(fertig, 1200);
    } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <>
      <p><b>Option {o.nr}: {o.titel}</b> · Einsatz {eur(o.einsatz)} · {o.richtung === "long" ? "DAX steigt" : "DAX fällt"}</p>
      <div className="dax-seg" role="radiogroup" aria-label="Weg">
        <button type="button" role="radio" aria-checked={weg === "scalable"} className={weg === "scalable" ? "on" : ""} disabled={!automatisch} onClick={() => setWeg("scalable")}>Mit Scalable automatisch{automatisch ? "" : " (nicht verbunden)"}</button>
        <button type="button" role="radio" aria-checked={weg === "hand"} className={weg === "hand" ? "on" : ""} onClick={() => setWeg("hand")}>Schritt für Schritt in meiner App</button>
      </div>
      {weg === "scalable" && <ScalableOrder st={st} variante={variante} richtung={o.richtung} kontext={{ basis: "DAX", richtung: o.richtung, quelle, idee: o.titel, modell: { richtung: a.signal?.richtung ?? "keine", punkte: a.signal?.punkte ?? 0 } }} neu={fertig} />}
      {weg === "hand" && <ol className="as-anleitung">
        <Schritt erledigt={erledigt} n={1} titel="Broker-App öffnen und anmelden">
          <div className="fld"><div className="lrow"><label htmlFor="as-broker">Ihre App</label></div><select id="as-broker" value={broker} onChange={e => setBroker(e.target.value)}>{BROKER.map(b => <option key={b}>{b}</option>)}</select></div>
          <button type="button" className="btn sm" onClick={() => ok(1)}>Bin angemeldet</button>
        </Schritt>
        <Schritt erledigt={erledigt} n={2} titel="Wertpapier suchen" frei={istOk(1)}>
          {o.produkt === "etf" ? <p>Suchen Sie <b>WKN 593393</b> (ISIN {DAX_ETF_ISIN}, iShares Core DAX).</p> :
            <p>{SUCHE[broker]}. Filter: <b>{o.richtung === "long" ? "Long / Call" : "Short / Put"}</b>, Barriere <b>{o.richtung === "long" ? "höchstens" : "mindestens"} {pkt(o.barriere)}</b>, Hebel um <b>{o.hebel}</b>, Laufzeit <b>Open End</b>. Emittent egal; nehmen Sie den mit dem kleinsten Abstand zwischen Geld- und Briefkurs.</p>}
          <div className="fields">
            <div className="fld"><div className="lrow"><label htmlFor="as-wkn">WKN oder ISIN des gewählten Papiers</label></div><input id="as-wkn" value={wkn} maxLength={12} onChange={e => setWkn(e.target.value)} placeholder={o.produkt === "etf" ? "593393" : "z. B. HS5DAX"} /></div>
            {o.produkt === "ko" && <Zahl label="Hebel laut App" min={1} max={200} wert={hebel} onChange={setHebel} />}
            <Zahl label="Briefkurs (Kaufkurs) jetzt" einheit="€" min={0.001} max={1e6} wert={brief} onChange={setBrief} />
          </div>
          <button type="button" className="btn sm" disabled={!wkn.trim() || !brief || (o.produkt === "ko" && !hebel)} onClick={() => ok(2)}>Weiter</button>
        </Schritt>
        <Schritt erledigt={erledigt} n={3} titel="Kauforder eingeben" frei={istOk(2)}>
          <ul className="sr-liste">
            <li><span /><span>Kauf</span><b>{stueck ?? "–"} Stück {wkn.toUpperCase()}</b><span /></li>
            <li><span /><span>Ordertyp</span><b>Limit {eur(limit)}</b><span className="note">gültig bis heute</span></li>
            <li><span /><span>Volumen etwa</span><b>{stueck && brief ? eur(stueck * brief) : "–"}</b><span /></li>
            <li><span /><span>Handelsplatz</span><b>Standard der App</b><span className="note">(gettex, LS Exchange o. ä.)</span></li>
          </ul>
          {stueck === 0 && <p className="note warn-t">Für {eur(o.einsatz)} reicht es bei diesem Kurs nicht für ein Stück.</p>}
          <p className="note">Das Limit liegt 0,5 % über dem Briefkurs: Die Order wird sofort ausgeführt, aber nicht zu einem Ausreißer-Kurs.</p>
          <div className="fields"><Zahl label="Tatsächlicher Kaufkurs" einheit="€" min={0.001} max={1e6} wert={kauf} onChange={setKauf} hinweis="aus der Ausführungsbestätigung" /><Zahl label="Gekaufte Stück" min={1} max={1e9} wert={stueckIst ?? stueck} onChange={setStueckIst} /></div>
          <button type="button" className="btn sm" disabled={!kauf} onClick={() => ok(3)}>Kauf ist ausgeführt</button>
        </Schritt>
        <Schritt erledigt={erledigt} n={4} titel="Absichern und Ziel festlegen" frei={istOk(3)}>
          <ul className="sr-liste">
            {o.zielProdukt >= 1 ? <li><span /><span>Stopp</span><b>keiner</b><span className="note">Die Knock-out-Barriere {pkt(o.barriere)} ist der Stopp (Totalverlust)</span></li> : <li><span /><span>Stop-Loss-Verkauf sofort einstellen</span><b className="neg">{kauf ? eur(Math.round(kauf * (1 - stoppP) * 100) / 100) : "–"}</b><span className="note">DAX {o.richtung === "long" ? "−" : "+"}{pct(daxStopp, 2)}</span></li>}
            <li><span /><span>Ziel (Verkauf)</span><b>{kauf ? eur(Math.round(kauf * (1 + zielP) * 100) / 100) : "–"}</b><span className="note">{pct(zielP)} auf den Einsatz</span></li>
            {o.zielProdukt < 1 && <li><span /><span>Spätestens verkaufen</span><b>heute 17:25</b><span className="note">Tagestrade</span></li>}
          </ul>
          <p className="note">Die meisten Apps erlauben nur eine Verkaufsorder gleichzeitig: Stopp in der App setzen, das Ziel überwacht highstack und meldet sich. Am Ziel erst den Stopp löschen, dann verkaufen.</p>
          <button type="button" className="btn" onClick={insJournal}>{o.zielProdukt >= 1 ? "Position überwachen" : "Stopp ist gesetzt, Position überwachen"}</button>
        </Schritt>
      </ol>}
      {msg && <p className="note" role="status">{msg}</p>}
    </>
  );
}

/** Ein Schritt der Anleitung: offen, erledigt (✓) oder noch gesperrt */
function Schritt({ n, titel, children, frei = true, erledigt }: { n: number; titel: string; children: React.ReactNode; frei?: boolean; erledigt: number[] }) {
  const ok = erledigt.includes(n);
  return <li className={`as-anl${ok ? " ok" : ""}${frei ? "" : " zu"}`}><b>{ok ? "✓" : n}. {titel}</b>{frei && !ok && <div className="as-anl-i">{children}</div>}</li>;
}
