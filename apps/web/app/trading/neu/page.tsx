"use client";
import { GRENZEN as G, hinweise, neueEinstellungen, pruefeEinstellungen, STRATEGIEN, VORLAGEN, type AgentEinstellungen, type StrategieTyp } from "@highstack/trading";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/App";
import { useAbbrechen, WizFuss, WizKopf } from "@/components/Assistent";
import { Marken, Text, Zahl } from "@/components/Felder";
import { Info } from "@/components/Info";
import { BROKER_WAHL } from "@/lib/tradingTexte";

const SCHRITTE = ["Broker", "Ziel & Grenzen", "Strategie", "Betrieb"] as const;
const WERTE_VORSCHLAG = ["AAPL", "MSFT", "NVDA", "AMD", "TSLA", "META", "AMZN", "GOOGL", "SPY", "QQQ"];

/** Agent einstellen: Broker, Grenzen mit Vorschlägen, Strategie, Betriebsart */
export default function NeuerAgent() {
  const { meldung } = useApp(); const router = useRouter();
  const [schritt, setSchritt] = useState(1); const [e, setE] = useState<AgentEinstellungen>(neueEinstellungen(500));
  const [vorlage, setVorlage] = useState("vorsichtig"); const [zugang, setZugang] = useState({ keyId: "", secret: "" }); const [legt, setLegt] = useState(false);
  const set = (p: Partial<AgentEinstellungen>) => setE(x => ({ ...x, ...p }));
  const abbrechen = useAbbrechen("/trading", schritt > 1);
  const nimmVorlage = (id: string, k = e.startkapital) => { setVorlage(id); set(VORLAGEN.find(v => v.id === id)!.werte(k)); };
  const h = hinweise(e);
  // Gleiche Prüfung wie auf dem Server; Fehler je Schritt zeigen und Weiter sperren
  const pf = pruefeEinstellungen(e).fehler;
  const FELDER2 = ["name", "startkapital", "tagesziel", "tagesverlust", "risikoProTrade", "maxPosition", "maxTradesTag", "maxPositionen", "schlussVorEnde"];
  const f2 = pf.filter(x => FELDER2.includes(x.feld)); const f3 = pf.filter(x => !FELDER2.includes(x.feld) && x.feld !== "broker");
  const Fehler = ({ l }: { l: typeof pf }) => l.length ? <ul className="flags">{l.map(x => <li key={x.feld + x.text} className="crit">{x.text}</li>)}</ul> : null;
  const brauchtZugang = e.broker === "alpaca-paper" || e.broker === "manuell";
  const anlegen = async () => {
    setLegt(true);
    try {
      const r = await fetch("/api/trading", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ einstellungen: e, zugang: zugang.keyId && zugang.secret ? zugang : undefined }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.fehler); router.push(`/trading/${d.id}`);
    } catch (x) { meldung((x as Error).message); setLegt(false); }
  };
  return (
    <div className="view wiz">
      <WizKopf schritte={SCHRITTE} aktuell={schritt} gehe={setSchritt} abbrechen={abbrechen} />
      <section className="wiz-body">
        {schritt === 1 && <>
          <h1>Wo soll der Agent handeln?</h1>
          <p className="lead">Der Broker ist austauschbar. Starten Sie in der Simulation; Strategie und Grenzen bleiben beim Wechsel erhalten.</p>
          <div className="wiz-wahl" role="radiogroup" aria-label="Broker">{BROKER_WAHL.map(b => (
            <button key={b.art} type="button" role="radio" aria-checked={e.broker === b.art} disabled={b.status !== "bereit"} className="wiz-karte" onClick={() => set({ broker: b.art, ...(b.art === "manuell" ? { modus: "vorschlag", richtung: "long" } : {}) })}>
              <b>{b.titel}{b.status !== "bereit" && <span className="tag"> {b.status === "geplant" ? "folgt" : "gesperrt"}</span>}</b><span>{b.text}</span>
            </button>))}</div>
          {e.broker === "manuell" && <div className="fields"><Text label="Welche App?" wert={e.brokerApp ?? ""} onChange={v => set({ brokerApp: v })} platzhalter="z. B. Trade Republic" /></div>}
          {brauchtZugang && <div className="tr-zugang">
            <span className="lrow"><b>Alpaca-Zugang</b><Info label="Alpaca-Zugang" text="Kostenloses Konto auf alpaca.markets anlegen, im Paper-Bereich unter API Keys einen Schlüssel erzeugen. Er wird verschlüsselt gespeichert und nie angezeigt. Beim Broker „Eigene App“ dient er nur als Kursquelle." /></span>
            <div className="fields"><Text label="API Key ID" wert={zugang.keyId} onChange={v => setZugang(z => ({ ...z, keyId: v }))} /><div className="fld"><label htmlFor="sec">Secret Key</label><input id="sec" type="password" autoComplete="off" value={zugang.secret} onChange={x => setZugang(z => ({ ...z, secret: x.target.value }))} /></div></div>
            <span className="note">Können Sie auch später im Agenten eintragen.</span>
          </div>}
          <WizFuss weiter={() => setSchritt(2)} />
        </>}
        {schritt === 2 && <>
          <h1>Ziel und Grenzen</h1>
          <p className="lead">Das Tagesziel ist eine Ausstiegsregel: Ist es erreicht, schließt der Agent alles und hört für heute auf. Ebenso beim Verlustlimit.</p>
          <div className="fields">
            <Zahl label="Startkapital" einheit="€" min={G.startkapital[0]} max={G.startkapital[1]} wert={e.startkapital} onChange={v => { const k = v ?? 500; set({ startkapital: k }); nimmVorlage(vorlage, k); }} />
            <Text label="Name" wert={e.name} onChange={v => set({ name: v })} />
          </div>
          <span className="flabel">Vorschlag übernehmen</span>
          <div className="wiz-wahl" role="radiogroup" aria-label="Vorschläge">{VORLAGEN.map(v => <button key={v.id} type="button" role="radio" aria-checked={vorlage === v.id} className="wiz-karte" onClick={() => nimmVorlage(v.id)}><b>{v.name}</b><span>{v.text}</span></button>)}</div>
          <div className="fields">
            <Zahl label="Tagesziel (dann Schluss)" einheit="€" min={1} max={e.startkapital} wert={e.tagesziel} onChange={v => set({ tagesziel: v ?? 0 })} />
            <Zahl label="Verlustlimit je Tag (dann Stopp)" einheit="€" min={1} max={Math.round(e.startkapital / 2)} wert={e.tagesverlust} onChange={v => set({ tagesverlust: v ?? 0 })} />
            <Zahl label="Risiko je Trade" prozent min={G.risikoProTrade[0] * 100} max={G.risikoProTrade[1] * 100} wert={e.risikoProTrade} onChange={v => set({ risikoProTrade: v ?? 0.005 })} info="Abstand vom Einstieg bis zum Stopp mal Stückzahl, in Prozent des Kontos. Bestimmt die Positionsgröße." />
            <Zahl label="Höchstens je Position" prozent min={G.maxPosition[0] * 100} max={G.maxPosition[1] * 100} wert={e.maxPosition} onChange={v => set({ maxPosition: v ?? 0.2 })} />
            <Zahl label="Trades je Tag höchstens" min={G.maxTradesTag[0]} max={G.maxTradesTag[1]} wert={e.maxTradesTag} onChange={v => set({ maxTradesTag: v ?? 3 })} />
            <Zahl label="Positionen gleichzeitig" min={G.maxPositionen[0]} max={G.maxPositionen[1]} wert={e.maxPositionen} onChange={v => set({ maxPositionen: v ?? 2 })} />
            <Zahl label="Alles schließen vor Handelsende" einheit="Min." min={G.schlussVorEnde[0]} max={G.schlussVorEnde[1]} wert={e.schlussVorEnde} onChange={v => set({ schlussVorEnde: v ?? 15 })} />
          </div>
          {h.length > 0 && <ul className="flags">{h.map(x => <li key={x.text} className={x.art === "crit" ? "crit" : x.art === "warn" ? "" : "info"}>{x.text}</li>)}</ul>}
          <Fehler l={f2} />
          <WizFuss zurueck={() => setSchritt(1)} weiter={() => setSchritt(3)} weiterAus={f2.length > 0} />
        </>}
        {schritt === 3 && <>
          <h1>Strategie und Werte</h1>
          <p className="lead">Woran der Agent Einstiege erkennt. Jedes Signal wird mit Grund, Stopp und Ziel protokolliert.</p>
          <div className="wiz-wahl" role="radiogroup" aria-label="Strategie">{(Object.keys(STRATEGIEN) as StrategieTyp[]).map(k => <button key={k} type="button" role="radio" aria-checked={e.strategie === k} className="wiz-karte" onClick={() => set({ strategie: k })}><b>{STRATEGIEN[k].name}</b><span>{STRATEGIEN[k].text}</span></button>)}</div>
          <div className="fields">
            {e.strategie === "ausbruch" && <><Zahl label="Eröffnungsspanne" einheit="Min." wert={e.werte.spanneMin} onChange={v => set({ werte: { ...e.werte, spanneMin: v ?? 15 } })} /><Zahl label="Volumen mindestens" einheit="× Schnitt" wert={e.werte.volumenFaktor} onChange={v => set({ werte: { ...e.werte, volumenFaktor: v ?? 1.5 } })} /></>}
            {e.strategie !== "ausbruch" && <Zahl label="Abweichung mindestens" einheit="σ" wert={e.werte.z} onChange={v => set({ werte: { ...e.werte, z: v ?? 2 } })} info="Wie ungewöhnlich eine Bewegung sein muss, in Standardabweichungen." />}
            <Zahl label="Rückblick" einheit="Min." wert={e.werte.fenster} onChange={v => set({ werte: { ...e.werte, fenster: v ?? 30 } })} />
            <Zahl label="Ziel" einheit="× Risiko" wert={e.werte.zielR} onChange={v => set({ werte: { ...e.werte, zielR: v ?? 2 } })} />
          </div>
          <Marken voll label="Werte, die der Agent beobachtet" werte={e.symbole} onChange={v => set({ symbole: v.map(x => x.toUpperCase()) })} platzhalter="Kürzel, z. B. AAPL, dann Enter" hinweis="US-Aktien und ETFs (Kürzel wie bei der Börse)" />
          <div className="chips">{WERTE_VORSCHLAG.filter(x => !e.symbole.includes(x)).map(x => <button key={x} type="button" className="chip" onClick={() => set({ symbole: [...e.symbole, x] })}>+ {x}</button>)}</div>
          <span className="flabel">Richtung</span>
          <div className="chips">{([["long", "Nur Long (steigende Kurse)"], ["long-short", "Long und Short"]] as const).map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={e.richtung === v} disabled={v === "long-short" && e.broker === "manuell"} onClick={() => set({ richtung: v })}>{l}</button>)}</div>
          <Fehler l={f3} />
          <WizFuss zurueck={() => setSchritt(2)} weiter={() => setSchritt(4)} weiterAus={f3.length > 0} />
        </>}
        {schritt === 4 && <>
          <h1>Wie selbstständig?</h1>
          <div className="wiz-wahl" role="radiogroup" aria-label="Betriebsart">
            <button type="button" role="radio" aria-checked={e.modus === "vorschlag"} className="wiz-karte" onClick={() => set({ modus: "vorschlag" })}><b>Vorschläge</b><span>Der Agent legt jede Order mit Begründung vor, Sie bestätigen. Ausstiege bei Stopp oder Ziel führt er selbst aus (außer bei der eigenen App).</span></button>
            <button type="button" role="radio" aria-checked={e.modus === "auto"} disabled={e.broker === "manuell"} className="wiz-karte" onClick={() => set({ modus: "auto" })}><b>Automatik</b><span>Der Agent handelt selbst, aber nur innerhalb Ihrer Grenzen. Not-Aus jederzeit.</span></button>
          </div>
          <label className="chk"><input type="checkbox" checked={e.marktlage !== false} onChange={x => set({ marktlage: x.target.checked })} /> Marktumfeld berücksichtigen: bei Stress an den Märkten oder vor wichtigen Terminen (Zinsentscheid, Inflationsdaten) kleinere Positionen</label>
          <div className="tr-zus"><dl>
            {([["Broker", BROKER_WAHL.find(b => b.art === e.broker)!.titel + (e.brokerApp ? ` (${e.brokerApp})` : "")], ["Startkapital", `${e.startkapital.toLocaleString("de-DE")} €`], ["Tagesziel / Verlustlimit", `+${e.tagesziel} € / −${e.tagesverlust} €`], ["Risiko je Trade", `${(e.risikoProTrade * 100).toLocaleString("de-DE")} %`], ["Strategie", STRATEGIEN[e.strategie].name], ["Werte", e.symbole.join(", ")], ["Richtung", e.richtung === "long" ? "nur Long" : "Long und Short"], ["Schluss", `${e.schlussVorEnde} Min. vor Handelsende alles schließen`]] as const).map(([l, v]) => <div key={l}><dt>{l}</dt><dd>{v}</dd></div>)}
          </dl></div>
          {h.filter(x => x.art === "crit").map(x => <p key={x.text} className="hint">{x.text}</p>)}
          <p className="note">Information und Werkzeug, keine Anlageberatung. Sie entscheiden über Einsatz und Grenzen; Verluste sind möglich.</p>
          <WizFuss zurueck={() => setSchritt(3)} weiter={anlegen} weiterText={legt ? "Legt an …" : "Agent anlegen"} weiterAus={legt || pf.length > 0} />
        </>}
      </section>
    </div>
  );
}
