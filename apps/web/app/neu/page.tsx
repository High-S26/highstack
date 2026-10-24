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
import { useAbbrechen, WizFuss, WizKopf } from "@/components/Assistent";
import { Stellplaetze } from "@/components/objekt/Stellplaetze";
import { fragen, SP_ART } from "@/lib/concierge";

type Quelle = "pdf" | "link" | "text" | "hand" | "concierge";
const QUELLEN: { id: Quelle; titel: string; text: string; icon: string }[] = [
  { id: "pdf", titel: "Exposé hochladen", text: "PDF vom Makler oder Portal. Wird ausgelesen und als Unterlage abgelegt.", icon: "M6 2.5h6l4 4v11H6zM12 2.5v4h4M8.5 11h5M8.5 14h5" },
  { id: "link", titel: "Link zum Inserat", text: "Adresse der Anzeige einfügen. Manche Portale sperren das Lesen, dann hilft Text oder PDF.", icon: "M8.5 11.5a3 3 0 0 0 4.2 0l2.8-2.8a3 3 0 0 0-4.2-4.2l-1 1M11.5 8.5a3 3 0 0 0-4.2 0l-2.8 2.8a3 3 0 0 0 4.2 4.2l1-1" },
  { id: "text", titel: "Text einfügen", text: "Anzeige, Suchagent-Mail oder Newsletter kopieren und einfügen.", icon: "M4 5h12M4 9h12M4 13h8" },
  { id: "concierge", titel: "Fragen lassen", text: "Kein Exposé zur Hand? Der Concierge fragt Schritt für Schritt und sagt, wo die Angaben stehen.", icon: "M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13M8 8a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.7M10 13.5v.1" },
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
  { k: "erbbaurecht", label: "Erbbaurecht", fmt: v => v ? "ja (K.O.-Kriterium möglich)" : "nein" },
  { k: "sonderumlage", label: "Sonderumlage", fmt: v => v ? "ja / offen" : "nein" },
];
const PFLICHT: (keyof Objekt)[] = ["kaufpreis", "wohnflaeche", "ort", "miete", "hausgeldNichtUmlagefaehig"];

export default function NeuesObjekt() {
  const { profil, anlageprofil, setzeObjekt, meldung, setzeProfil } = useApp(); const router = useRouter();
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1);
  const [quelle, setQuelle] = useState<Quelle | null>(null);
  const [datei, setDatei] = useState<File | null>(null); const [url, setUrl] = useState(""); const [text, setText] = useState(""); const [ueber, setUeber] = useState(false);
  const [ob, setOb] = useState<Objekt>({ ...LEERES_OBJEKT, titel: "" });
  const [gefunden, setGefunden] = useState<string[]>([]); const [expose, setExpose] = useState(""); const [hinweis, setHinweis] = useState<string | null>(null); const [herkunft, setHerkunft] = useState<"ki" | "muster" | "keine">("keine");
  const [sichtbar, setSichtbar] = useState(0); const [apId, setApId] = useState(profil!.aktivesAnlageprofil); const [legtAn, setLegtAn] = useState(false);
  const eingabe = useRef<HTMLInputElement>(null);

  const begleitet = (profil!.modus ?? "unterstuetzt") === "unterstuetzt";
  const bereit = quelle === "hand" || quelle === "concierge" || (quelle === "pdf" && !!datei) || (quelle === "link" && /^https?:\/\/\S+\.\S+/.test(url.trim())) || (quelle === "text" && text.trim().length > 30);
  const auslesen = async () => {
    if (quelle === "hand") { setSchritt(3); return; }
    if (quelle === "concierge") { if (!begleitet) setzeProfil({ ...profil!, modus: "unterstuetzt" }); await anlegen(); return; }
    setSchritt(2); setSichtbar(0); setHinweis(null);
    try {
      const r = await api.erfassen({ datei: quelle === "pdf" ? datei! : undefined, url: quelle === "link" ? url.trim() : undefined, text: quelle === "text" ? text : undefined });
      setOb(o => ({ ...o, ...r.felder, titel: r.felder.titel ?? o.titel })); setGefunden(r.gefunden); setExpose(r.text); setHinweis(r.hinweis ?? null); setHerkunft(r.quelle);
    } catch (e) { setHinweis((e as Error).message); setGefunden([]); }
  };
  // Gefundene Angaben nacheinander zeigen, dann weiter
  const spZeile = { k: "stellplaetze" as keyof Objekt, label: "Stellplatz", fmt: () => (ob.stellplaetze ?? []).map(x => `${SP_ART.find(([v]) => v === x.art)?.[1]}${x.preis === "separat" ? x.kaufpreis ? `, zzgl. ${eur(x.kaufpreis)}` : ", separat" : ", im Preis"}${x.recht === "teileigentum" ? ", eigenes Grundbuch" : ""}`).join(" · ") };
  const zeilen = [...FELDER, ...(gefunden.includes("stellplaetze") ? [spZeile] : [])].filter(f => gefunden.includes(f.k) || PFLICHT.includes(f.k));
  const offen = fragen(ob);
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
  const geaendert = !!quelle || !!ob.kaufpreis || !!ob.titel.trim();
  const abbrechen = useAbbrechen("/pruefen", geaendert, "Das Objekt wird nicht angelegt; ausgelesene Werte gehen verloren.");
  const anlegen = async () => {
    setLegtAn(true);
    try {
      const o = await api.neuesObjekt({ anlageprofilId: apId, objekt: { ...ob, titel: ob.titel.trim() || [ob.asset, ob.ort].filter(Boolean).join(", ") || "Neues Objekt" }, expose });
      let fertig = o;
      if (datei) { try { const r = await api.hochladen(o.id, [datei]); fertig = { ...o, dokumente: r.dokumente }; } catch { /* Objekt steht, Upload kann im Reiter Unterlagen wiederholt werden */ } }
      setzeObjekt(fertig); meldung("Objekt angelegt"); router.push(`/objekt/${o.id}?tab=ergebnis`);
    } catch (e) { meldung((e as Error).message); setLegtAn(false); }
  };

  const k = a?.bewertung.kennzahlen; const einst = a?.bewertung.einstufung;
  return (
    <div className="view wiz">
      <WizKopf schritte={quelle === "hand" ? ["Quelle", "Eingeben"] : ["Quelle", "Auslesen", "Prüfen"]} aktuell={quelle === "hand" && schritt === 3 ? 2 : schritt} gehe={n => setSchritt(n === 2 && quelle === "hand" ? 3 : n as 1 | 2 | 3)} abbrechen={abbrechen} />

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
        <WizFuss weiter={auslesen} weiterAus={!bereit || legtAn} weiterText={quelle === "hand" ? "Weiter" : quelle === "concierge" ? (legtAn ? "Legt an …" : "Los geht’s") : "Auslesen"} hinweis={!quelle ? "Wählen Sie oben, womit Sie starten." : undefined} />
        <p className="note">Erst einmal schauen, wie es aussieht? <button type="button" className="linkbtn" onClick={beispiel}>Beispielobjekt öffnen</button></p>
      </section>}

      {schritt === 2 && <section className="wiz-body">
        <h1>{sichtbar > zeilen.length ? (gefunden.length ? `${gefunden.length} Angaben gefunden` : "Nichts gefunden") : "Wird ausgelesen …"}</h1>
        <p className="lead">{herkunft === "ki" ? "Der Daten-Analyst hat das Exposé gelesen." : expose ? "Typische Angaben im Text erkannt." : "Einen Moment."}</p>
        {!expose && !hinweis ? <div className="lesend" aria-live="polite"><span /><span /><span /></div> :
          <ul className="fund" aria-live="polite">{zeilen.slice(0, sichtbar).map(f => { const da = gefunden.includes(f.k); return <li key={f.k} className={da ? "ok" : "fehlt"}><span className="m">{da ? "✓" : "–"}</span><b>{f.label}</b><span>{da ? f.fmt(ob[f.k]) : "nicht gefunden, gleich ergänzen"}</span></li>; })}</ul>}
        {hinweis && <p className="hint">{hinweis}</p>}
        <WizFuss zurueck={() => setSchritt(1)} weiter={() => setSchritt(3)} weiterText="Weiter zum Prüfen" weiterAus={!(sichtbar > zeilen.length || (!expose && hinweis))} />
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
            <div className={`erf ${markiert("hausgeldNichtUmlagefaehig")}`}><Zahl label={ob.asset === "ETW" ? "Hausgeld, nicht umlagefähig inkl. Rücklage" : "Nicht umlagefähige Kosten"} einheit="€/Monat" wert={ob.hausgeldNichtUmlagefaehig} onChange={v => set({ hausgeldNichtUmlagefaehig: v })} hinweis={ob.hausgeldGesamt ? `aus ${eur(ob.hausgeldGesamt)} Hausgeld laut Exposé` : undefined} /></div>
            <div className={`erf ${markiert("baujahr")}`}><Zahl label="Baujahr" wert={ob.baujahr} onChange={v => set({ baujahr: v })} /></div>
            <div className={`erf ${markiert("erbbaurecht")}`}><Auswahl label="Erbbaurecht" wert={ob.erbbaurecht ? "j" : "n"} optionen={[["n", "nein"], ["j", "ja"]]} onChange={v => set({ erbbaurecht: v === "j" })} /></div>
            <div className={`erf ${markiert("sonderumlage")}`}><Auswahl label="Sonderumlage" wert={ob.sonderumlage ? "j" : "n"} optionen={[["n", "keine"], ["j", "ja / offen"]]} onChange={v => set({ sonderumlage: v === "j" })} /></div>
            <div className="full sp-wiz"><span className="lrow"><span className="flabel">Stellplatz</span>{gefunden.includes("stellplaetze") && <span className="tag up">✓ im Text gefunden</span>}</span><Stellplaetze ob={ob} set={set} /></div>
          </div>
          <WizFuss zurueck={() => setSchritt(quelle === "hand" ? 1 : 2)} />
        </div>
        <aside className="wiz-vorschau" aria-live="polite">
          <div className="ring" style={{ ["--p" as string]: `${(vorhanden.length / anzahlPflicht) * 100}` }}><b>{vorhanden.length}/{anzahlPflicht}</b><span>Eckdaten</span></div>
          <div className="vs">
            {einst ? <><span className={`pill p-${einst}`}><b>{Math.round(a!.bewertung.score ?? 0)}</b>{EINSTUFUNG[einst]}</span>
              <dl><div><dt>Bruttorendite</dt><dd>{pct(k!.bruttorendite)}</dd></div><div><dt>Faktor</dt><dd>{num(k!.faktor, 1)}</dd></div><div><dt>Cashflow</dt><dd className={(k!.cashflowMonat ?? 0) < 0 ? "dn" : "up"}>{eur(k!.cashflowMonat)} im Monat</dd></div></dl>
              <p className="note">Erste Einschätzung gegen „{ap.name}“. Im Objekt sehen Sie die Gründe.</p></>
              : <p className="note">Sobald Kaufpreis, Fläche und Miete stehen, erscheint hier die erste Einschätzung.</p>}
          </div>
          {begleitet && offen.length > 0 && <div className="cg-vorschau"><span className="lrow"><span className="cg-avatar sm" aria-hidden="true">?</span><b>Concierge klärt danach {offen.length} {offen.length === 1 ? "Frage" : "Fragen"}</b></span>
            <span className="note">{[...new Set(offen.map(f => f.thema))].slice(0, 4).join(", ")}{new Set(offen.map(f => f.thema)).size > 4 ? " und mehr" : ""}. Einzeln, wichtigste zuerst, mit Hinweis wo es steht.</span></div>}
          <button type="button" className="btn" disabled={legtAn || (!ob.kaufpreis && !begleitet)} onClick={anlegen}>{legtAn ? "Legt an …" : begleitet && offen.length ? "Anlegen und Fragen klären" : "Objekt anlegen"}</button>
          {!ob.kaufpreis && !begleitet && <span className="note">Mindestens der Kaufpreis wird gebraucht.</span>}
        </aside>
      </section>}
    </div>
  );
}
