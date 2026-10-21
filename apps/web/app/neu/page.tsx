"use client";
import { analyse, type Objekt } from "@highstack/engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/App";
import { Auswahl, Text, Zahl } from "@/components/Felder";
import { api } from "@/lib/client";
import { EINSTUFUNG, eur, num, pct } from "@/lib/format";
import { LEERES_OBJEKT } from "@/lib/vorgaben";

type Quelle = "pdf" | "link" | "text" | "hand";
const QUELLEN: { id: Quelle; titel: string; text: string; icon: string }[] = [
  { id: "pdf", titel: "Exposé hochladen", text: "PDF vom Makler oder Portal. Wird ausgelesen und als Unterlage abgelegt.", icon: "M6 2.5h6l4 4v11H6zM12 2.5v4h4M8.5 11h5M8.5 14h5" },
  { id: "link", titel: "Link zum Inserat", text: "Adresse der Anzeige einfügen. Manche Portale sperren das Lesen, dann hilft Text oder PDF.", icon: "M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2l-1 1M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2l1-1" },
  { id: "text", titel: "Text einfügen", text: "Anzeige, Suchagent-Mail oder Newsletter kopieren und einfügen.", icon: "M4 5h12M4 9h12M4 13h8" },
  { id: "hand", titel: "Von Hand", text: "Die wichtigsten Angaben selbst eintragen. Dauert eine Minute.", icon: "M13.5 3.5l3 3-9 9H4.5v-3zM11.5 5.5l3 3" },
];
const FELDER: { k: keyof Objekt; label: string; fmt: (v: unknown) => string }[] = [
  { k: "kaufpreis", label: "Kaufpreis", fmt: v => eur(v as number) },
  { k: "wohnflaeche", label: "Wohnfläche", fmt: v => `${num(v as number, 0)} m²` },
  { k: "ort", label: "Ort", fmt: v => String(v) },
  { k: "miete", label: "Kaltmiete", fmt: v => `${eur(v as number)} im Monat` },
  { k: "hausgeldNichtUmlagefaehig", label: "Hausgeld, nicht umlagefähig", fmt: v => `${eur(v as number)} im Monat` },
  { k: "leer", label: "Vermietung", fmt: v => v ? "leer / bezugsfrei" : "vermietet" },
  { k: "baujahr", label: "Baujahr", fmt: v => String(v) },
  { k: "energieklasse", label: "Energieklasse", fmt: v => String(v) },
];
const PFLICHT: (keyof Objekt)[] = ["kaufpreis", "wohnflaeche", "ort", "miete", "hausgeldNichtUmlagefaehig"];

export default function NeuesObjekt() {
  const { profil, anlageprofil, setzeObjekt, meldung } = useApp(); const router = useRouter();
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1);
  const [quelle, setQuelle] = useState<Quelle | null>(null);
  const [datei, setDatei] = useState<File | null>(null); const [url, setUrl] = useState(""); const [text, setText] = useState(""); const [ueber, setUeber] = useState(false);
  const [ob, setOb] = useState<Objekt>({ ...LEERES_OBJEKT, titel: "" });
  const [gefunden, setGefunden] = useState<string[]>([]); const [expose, setExpose] = useState(""); const [hinweis, setHinweis] = useState<string | null>(null); const [herkunft, setHerkunft] = useState<"ki" | "muster" | "keine">("keine");
  const [sichtbar, setSichtbar] = useState(0); const [apId, setApId] = useState(profil!.aktivesAnlageprofil); const [legtAn, setLegtAn] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);

  const bereit = quelle === "hand" || (quelle === "pdf" && !!datei) || (quelle === "link" && /^https?:\/\/\S+\.\S+/.test(url.trim())) || (quelle === "text" && text.trim().length > 30);
  const auslesen = async () => {
    if (quelle === "hand") { setSchritt(3); return; }
    setSchritt(2); setSichtbar(0); setHinweis(null);
    try {
      const r = await api.erfassen({ datei: quelle === "pdf" ? datei! : undefined, url: quelle === "link" ? url.trim() : undefined, text: quelle === "text" ? text : undefined });
      setOb(o => ({ ...o, ...r.felder, titel: r.felder.titel ?? o.titel })); setGefunden(r.gefunden); setExpose(r.text); setHinweis(r.hinweis ?? null); setHerkunft(r.quelle);
    } catch (e) { setHinweis((e as Error).message); setGefunden([]); }
  };
  // Gefundene Angaben nacheinander zeigen, dann weiter
  const zeilen = FELDER.filter(f => gefunden.includes(f.k) || PFLICHT.includes(f.k));
  useEffect(() => {
    if (schritt !== 2 || !expose && !hinweis) return;
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (ruhig) { setSichtbar(zeilen.length + 1); return; }
    if (sichtbar <= zeilen.length) { const t = setTimeout(() => setSichtbar(n => n + 1), 220); return () => clearTimeout(t); }
  }, [schritt, expose, hinweis, sichtbar, zeilen.length]);

  const ap = anlageprofil(apId);
  const a = useMemo(() => profil ? analyse({ investor: profil.investor, anlageprofil: ap, objekt: ob }) : null, [profil, ap, ob]);
  const vorhanden = PFLICHT.filter(k => ob[k] != null && ob[k] !== "" && !(k === "miete" && ob.leer));
  const anzahlPflicht = PFLICHT.filter(k => !(k === "miete" && ob.leer)).length;
  const set = (p: Partial<Objekt>) => setOb(o => ({ ...o, ...p }));
  const markiert = (k: keyof Objekt) => gefunden.includes(k) ? "gefunden" : (ob[k] == null || ob[k] === "") && PFLICHT.includes(k) ? "fehlt" : "";

  const { objekte } = useApp();
  const beispiel = async () => { const da = objekte.find(x => x.objekt.titel?.startsWith("Beispiel:")); if (da) { router.push(`/objekt/${da.id}`); return; } const o = await api.neuesObjekt({ beispiel: true }); setzeObjekt(o); router.push(`/objekt/${o.id}`); };
  const anlegen = async () => {
    setLegtAn(true);
    try {
      const o = await api.neuesObjekt({ anlageprofilId: apId, objekt: { ...ob, titel: ob.titel.trim() || [ob.asset, ob.ort].filter(Boolean).join(", ") || "Neues Objekt" }, expose });
      let fertig = o;
      if (datei) { try { const r = await api.hochladen(o.id, [datei], "sonst"); fertig = { ...o, dokumente: r.dokumente }; } catch { /* Objekt steht, Upload kann im Reiter Unterlagen wiederholt werden */ } }
      setzeObjekt(fertig); meldung("Objekt angelegt"); router.push(`/objekt/${o.id}?tab=ergebnis`);
    } catch (e) { meldung((e as Error).message); setLegtAn(false); }
  };

  const k = a?.bewertung.kennzahlen; const einst = a?.bewertung.einstufung;
  return (
    <div className="view wiz">
      <div className="wiz-kopf">
        <Link className="btn ghost sm" href="/pruefen">Abbrechen</Link>
        <ol className="wiz-steps" aria-label="Schritte">{["Quelle", "Auslesen", "Prüfen"].map((l, i) => <li key={l} className={i + 1 < schritt ? "done" : i + 1 === schritt ? "now" : ""} aria-current={i + 1 === schritt ? "step" : undefined}><span>{i + 1 < schritt ? "✓" : i + 1}</span>{l}</li>)}</ol>
      </div>

      {schritt === 1 && <section className="wiz-body">
        <h1>Neues Objekt</h1>
        <p className="lead">Womit möchten Sie starten? Aus Exposé, Link oder Text lesen wir die Eckdaten selbst aus; Sie prüfen nur noch.</p>
        <div className="wiz-wahl" role="radiogroup" aria-label="Quelle">{QUELLEN.map(q => (
          <button key={q.id} type="button" role="radio" aria-checked={quelle === q.id} className="wiz-karte" onClick={() => { setQuelle(q.id); if (q.id === "pdf" && !datei) setTimeout(() => eingabe.current?.click(), 0); }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={q.icon} /></svg>
            <b>{q.titel}</b><span>{q.text}</span>
          </button>))}</div>
        {quelle === "pdf" && <div className={`drop${ueber ? " over" : ""}`} onDragOver={e => { e.preventDefault(); setUeber(true); }} onDragLeave={() => setUeber(false)} onDrop={e => { e.preventDefault(); setUeber(false); const f = e.dataTransfer.files[0]; if (f) setDatei(f); }}>
          <b>{datei ? datei.name : "Exposé hier ablegen"}</b><span className="note">{datei ? `${Math.round(datei.size / 1024)} KB · bereit zum Auslesen` : "PDF bis 20 MB"}</span>
          <label className="btn sm ghost upl">{datei ? "Andere Datei" : "Datei auswählen"}<input ref={eingabe} type="file" accept="application/pdf" onChange={e => setDatei(e.target.files?.[0] ?? null)} /></label>
        </div>}
        {quelle === "link" && <div className="fld"><label htmlFor="link">Link zur Anzeige</label><input id="link" type="url" inputMode="url" autoFocus value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" /></div>}
        {quelle === "text" && <div className="fld"><label htmlFor="txt">Text der Anzeige</label><textarea id="txt" autoFocus style={{ minHeight: 180 }} value={text} onChange={e => setText(e.target.value)} placeholder="Titel, Preis, Fläche, Miete, Hausgeld … einfach alles einfügen" /></div>}
        {profil!.anlageprofile.length > 1 && <Auswahl label="Prüfen gegen Anlageprofil" wert={apId} optionen={profil!.anlageprofile.map(x => [x.id, x.name] as [string, string])} onChange={setApId} />}
        <div className="row"><button type="button" className="btn" disabled={!bereit} onClick={auslesen}>{quelle === "hand" ? "Weiter" : "Auslesen"}</button>{!quelle && <span className="note">Wählen Sie oben, womit Sie starten.</span>}</div>
        <p className="note">Erst einmal schauen, wie es aussieht? <button type="button" className="linkbtn" onClick={beispiel}>Beispielobjekt öffnen</button></p>
      </section>}

      {schritt === 2 && <section className="wiz-body">
        <h1>{sichtbar > zeilen.length ? (gefunden.length ? `${gefunden.length} Angaben gefunden` : "Nichts gefunden") : "Wird ausgelesen …"}</h1>
        <p className="lead">{herkunft === "ki" ? "Der Daten-Analyst hat das Exposé gelesen." : expose ? "Typische Angaben im Text erkannt." : "Einen Moment."}</p>
        {!expose && !hinweis ? <div className="lesend" aria-live="polite"><span /><span /><span /></div> :
          <ul className="fund" aria-live="polite">{zeilen.slice(0, sichtbar).map(f => { const da = gefunden.includes(f.k); return <li key={f.k} className={da ? "ok" : "fehlt"}><span className="m">{da ? "✓" : "–"}</span><b>{f.label}</b><span>{da ? f.fmt(ob[f.k]) : "nicht gefunden, gleich ergänzen"}</span></li>; })}</ul>}
        {hinweis && <p className="hint">{hinweis}</p>}
        {(sichtbar > zeilen.length || (!expose && hinweis)) && <div className="row"><button type="button" className="btn" onClick={() => setSchritt(3)}>Weiter zum Prüfen</button><button type="button" className="btn ghost" onClick={() => setSchritt(1)}>Andere Quelle</button></div>}
      </section>}

      {schritt === 3 && <section className="wiz-body wiz-pruefen">
        <div>
          <h1>Passt das?</h1>
          <p className="lead">{gefunden.length ? "Gefundene Werte sind markiert. Ergänzen Sie, was fehlt; Sie können alles später ändern." : "Tragen Sie die Eckdaten ein. Fünf Angaben reichen für das erste Ergebnis."}</p>
          <div className="fields">
            <div className={`full erf ${gefunden.includes("titel") ? "gefunden" : ""}`}><Text label="Titel" wert={ob.titel} onChange={v => set({ titel: v })} platzhalter="z. B. 2-Zi.-ETW Bilk" /></div>
            <div className={`erf ${markiert("ort")}`}><Text label="Ort / Stadtteil" wert={ob.ort} onChange={v => set({ ort: v })} /></div>
            <Auswahl label="Assetklasse" wert={ob.asset} optionen={[["ETW", "ETW"], ["MFH", "MFH"], ["EFH/ZFH", "EFH/ZFH"], ["Gewerbe", "Gewerbe"]]} onChange={v => set({ asset: v })} />
            <div className={`erf ${markiert("kaufpreis")}`}><Zahl label="Kaufpreis" einheit="€" wert={ob.kaufpreis} onChange={v => set({ kaufpreis: v })} /></div>
            <div className={`erf ${markiert("wohnflaeche")}`}><Zahl label="Wohnfläche" einheit="m²" wert={ob.wohnflaeche} onChange={v => set({ wohnflaeche: v })} /></div>
            <Auswahl label="Vermietung" wert={ob.leer ? "l" : "v"} optionen={[["v", "vermietet"], ["l", "leer / bezugsfrei"]]} onChange={v => set({ leer: v === "l" })} />
            {!ob.leer && <div className={`erf ${markiert("miete")}`}><Zahl label="Ist-Kaltmiete" einheit="€/Monat" wert={ob.miete} onChange={v => set({ miete: v })} /></div>}
            <div className={`erf ${markiert("hausgeldNichtUmlagefaehig")}`}><Zahl label={ob.asset === "ETW" ? "Hausgeld, nicht umlagefähig inkl. Rücklage" : "Nicht umlagefähige Kosten"} einheit="€/Monat" wert={ob.hausgeldNichtUmlagefaehig} onChange={v => set({ hausgeldNichtUmlagefaehig: v })} hinweis={gefunden.includes("hausgeldNichtUmlagefaehig") && herkunft === "muster" ? "geschätzt: 40 % des Hausgelds" : undefined} /></div>
            <div className={`erf ${markiert("baujahr")}`}><Zahl label="Baujahr" wert={ob.baujahr} onChange={v => set({ baujahr: v })} /></div>
          </div>
        </div>
        <aside className="wiz-vorschau" aria-live="polite">
          <div className="ring" style={{ ["--p" as string]: `${(vorhanden.length / anzahlPflicht) * 100}` }}><b>{vorhanden.length}/{anzahlPflicht}</b><span>Eckdaten</span></div>
          <div className="vs">
            {einst ? <><span className={`pill p-${einst}`}><b>{Math.round(a!.bewertung.score ?? 0)}</b>{EINSTUFUNG[einst]}</span>
              <dl><div><dt>Bruttorendite</dt><dd>{pct(k!.bruttorendite)}</dd></div><div><dt>Faktor</dt><dd>{num(k!.faktor, 1)}</dd></div><div><dt>Cashflow</dt><dd className={(k!.cashflowMonat ?? 0) < 0 ? "dn" : "up"}>{eur(k!.cashflowMonat)} im Monat</dd></div></dl>
              <p className="note">Erste Einschätzung gegen „{ap.name}“. Im Objekt sehen Sie die Gründe.</p></>
              : <p className="note">Sobald Kaufpreis, Fläche und Miete stehen, erscheint hier die erste Einschätzung.</p>}
          </div>
          <button type="button" className="btn" disabled={legtAn || !ob.kaufpreis} onClick={anlegen}>{legtAn ? "Legt an …" : "Objekt anlegen"}</button>
          {!ob.kaufpreis && <span className="note">Mindestens der Kaufpreis wird gebraucht.</span>}
        </aside>
      </section>}
    </div>
  );
}
