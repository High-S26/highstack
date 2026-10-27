"use client";
import { mitStellplaetzen, MODULE, standardSzenario, standardwerte, VORLAGEN, type Analyse, type ParamDef, type Simulation, type Szenario } from "@highstack/engine";
import { useEffect, useState } from "react";
import { findeMietspiegel, type Mietspiegel } from "@/lib/mietspiegel";
import { api } from "@/lib/client";
import { EINSTUFUNG, eur, kennzahl, num, pct, STRUKTUR, teur, vorzeichen } from "@/lib/format";
import type { Objektdatensatz } from "@/lib/typen";
import { Auswahl, Haken, Kacheln, Text, Zahl } from "../Felder";
import { Strategien } from "./Strategien";
import { useApp } from "../App";
import { Positionen } from "./Positionen";
import { ExterneFaktoren } from "./Extern";
import { Prognose } from "./Prognose";
import { Stellplaetze } from "./Stellplaetze";
import { Grundrissvorschau } from "./Ansicht";
import { Info } from "../Info";
import { erklaerung } from "@/lib/erklaerungen";
import { expertMeta } from "../Experten";
import { MietFelder, MietpfadPanel } from "./Mietpfad";

type Setze = (patch: Partial<Objektdatensatz>) => void;

export function Daten({ o, a, setze, zuUnterlagen }: { o: Objektdatensatz; a: Analyse; setze: Setze; zuUnterlagen?: () => void }) {
  const ob = o.objekt; const set = (p: Partial<typeof ob>) => setze({ objekt: { ...ob, ...p } });
  const pruef: [unknown, string, string][] = [[ob.kaufpreis, "Kaufpreis", ""], [ob.wohnflaeche, "Wohnfläche", ""], [a.bewertung.miete, "Miete", "Ist-Miete oder Marktmiete"], [ob.hausgeldNichtUmlagefaehig, "Nicht umlagefähige Kosten", "WEG-Abrechnung"], [ob.vergleichspreisQm, "Vergleichspreis", "z. B. Capital-Immobilienkompass"], [ob.marktmieteQm, "Marktmiete", "Mietspiegel"], [ob.energieklasse, "Energieklasse", "Energieausweis"], [ob.baujahr, "Baujahr", "Exposé"]];
  const vorhanden = pruef.filter(x => x[0] != null && x[0] !== "").length; const q = vorhanden / pruef.length;
  return (
    <section className="panel">
      <div className="ph"><h2>Objektdaten</h2></div>
      <details open={!ob.kaufpreis}><summary>Exposé-Text (für die Experten)</summary><textarea value={o.expose} onChange={e => setze({ expose: e.target.value })} placeholder="Text aus Exposé, Inserat oder Newsletter …" aria-label="Exposé-Text" /></details>
      <div className="grp">Das Wichtigste</div>
      <div className="fields">
        <Text voll label="Titel" wert={ob.titel} onChange={v => set({ titel: v })} />
        <Text label="Ort / Stadtteil" wert={ob.ort} onChange={v => set({ ort: v })} />
        <Auswahl label="Assetklasse" wert={ob.asset} optionen={[["ETW", "ETW"], ["MFH", "MFH"], ["EFH/ZFH", "EFH/ZFH"], ["Gewerbe", "Gewerbe"]]} onChange={v => set({ asset: v })} />
        <Zahl label="Kaufpreis" einheit="€" wert={ob.kaufpreis} onChange={v => set({ kaufpreis: v })} schritt={1000} />
        <Zahl label="Käuferprovision" prozent min={0} max={15} wert={ob.maklerProvision ?? null} onChange={v => set({ maklerProvision: v })} hinweis={ob.maklerProvision == null ? `leer: aus Ihrem Profil (${pct(a.params.makler, 2)})` : ob.maklerProvision === 0 ? "provisionsfrei" : undefined} />
        <Zahl label={ob.asset === "Gewerbe" ? "Nutzfläche" : "Wohnfläche"} einheit="m²" wert={ob.wohnflaeche} onChange={v => set({ wohnflaeche: v })} />
        <Auswahl label="Vermietung" wert={ob.leer ? "l" : "v"} optionen={[["v", "vermietet"], ["l", "leer / bezugsfrei"]]} onChange={v => set({ leer: v === "l" })} />
        {!ob.leer && <Zahl label="Ist-Kaltmiete" einheit="€/Monat" wert={ob.miete} onChange={v => set({ miete: v })} schritt={10} />}
        {ob.asset === "ETW" && <Zahl label="Hausgeld gesamt" einheit="€/Monat" wert={ob.hausgeldGesamt ?? null} onChange={v => { const auto = ob.hausgeldNichtUmlagefaehig == null || (ob.hausgeldGesamt != null && Math.round(ob.hausgeldGesamt * 0.4) === ob.hausgeldNichtUmlagefaehig); set({ hausgeldGesamt: v, ...(auto && v != null ? { hausgeldNichtUmlagefaehig: Math.round(v * 0.4) } : {}) }); }} hinweis="So wie im Exposé oder Wirtschaftsplan. Leer lassen, wenn nur der nicht umlagefähige Teil bekannt ist." />}
        <Zahl voll={ob.asset !== "ETW"} label={ob.asset === "ETW" ? "Davon nicht umlagefähig inkl. Rücklage" : "Nicht umlagefähige Kosten"} einheit="€/Monat" wert={ob.hausgeldNichtUmlagefaehig} onChange={v => set({ hausgeldNichtUmlagefaehig: v })} schritt={5} hinweis={ob.asset === "ETW" && ob.hausgeldGesamt ? (ob.hausgeldNichtUmlagefaehig != null && Math.round(ob.hausgeldGesamt * 0.4) === ob.hausgeldNichtUmlagefaehig ? "Geschätzt: 40 % des Hausgelds. Genauer Wert steht in der Hausgeldabrechnung." : `${ob.hausgeldNichtUmlagefaehig != null ? Math.round((ob.hausgeldNichtUmlagefaehig / ob.hausgeldGesamt) * 100) : 0} % des Hausgelds`) : ob.asset === "ETW" ? "Dieser Teil schmälert den Cashflow." : undefined} />
      </div>
      <MietFelder ob={ob} set={set} />
      <div className="grp">Grundriss</div>
      <Grundrissvorschau o={o} zuUnterlagen={zuUnterlagen ?? (() => undefined)} />
      <div className="grp">Stellplatz</div>
      <Stellplaetze ob={ob} set={set} />
      <div className="meter"><div className="ph"><span className="note">Datenqualität</span><span className="note">{Math.round(q * 100)} %</span></div><div className="track"><div className="fill" style={{ width: `${q * 100}%`, background: q >= 0.85 ? "var(--good)" : q >= 0.5 ? "var(--warn)" : "var(--crit)" }} /></div>
        <ul className="missing">{pruef.filter(x => x[0] == null || x[0] === "").slice(0, 4).map(([, l, h]) => <li key={l}><b>{l}</b>{h && ` · ${h}`}</li>)}</ul></div>
      <Markt o={o} set={set} />
      <details><summary>Genauer werden: Substanz und Steuern</summary>
        <div className="fields">
          <Zahl label="Baujahr" wert={ob.baujahr} onChange={v => set({ baujahr: v })} schritt={1} />
          <Auswahl label="Energieklasse" wert={ob.energieklasse ?? ""} optionen={[["", "unbekannt"], ...["A+", "A", "B", "C", "D", "E", "F", "G", "H"].map(x => [x, x] as [string, string])]} onChange={v => set({ energieklasse: v || null })} />
          {ob.asset === "ETW" && <Zahl label="Rücklage, Ihr Anteil" einheit="€" wert={ob.ruecklageAnteil} onChange={v => set({ ruecklageAnteil: v })} schritt={500} />}
          <Zahl voll label="Gebäudeanteil am Kaufpreis" prozent hinweis="für die Abschreibung" wert={ob.gebaeudeanteil} onChange={v => set({ gebaeudeanteil: v ?? 0.75 })} />
          <Haken label="Erbbaurecht" wert={ob.erbbaurecht} onChange={v => set({ erbbaurecht: v })} />
          <Haken label="Sonderumlage offen oder beschlossen" wert={ob.sonderumlage} onChange={v => set({ sonderumlage: v })} />
        </div>
      </details>
    </section>
  );
}

/** Playbook für genau diesen Deal: Angebotspreis gegen Kapitalrahmen und Zielpreise */
export function Playbook({ o, a, zuDurchspielen }: { o: Objektdatensatz; a: Analyse; zuDurchspielen?: () => void }) {
  const angebot = mitStellplaetzen(o.objekt).kaufpreis; const k = a.bewertung.kennzahlen; const z = a.zielpreise; const ap = a.params.anlageprofil;
  if (!angebot) return null;
  const marken: [string, number | null | undefined, string][] = [["Ihr Kapital trägt bis", k.kpMax, "kapital"], ["Cashflow ± 0 bis", z.cashflowNull, "cashflow"], [`${pct(ap.minBruttorendite)} Rendite bis`, z.mindestrendite, "rendite"]];
  const da = marken.filter((m): m is [string, number, string] => m[1] != null && isFinite(m[1]) && m[1] > 0);
  const werte = [angebot, ...da.map(m => m[1])]; const lo = Math.min(...werte) * 0.85, hi = Math.max(...werte) * 1.08;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const grenze = Math.min(...da.map(m => m[1]));
  const verhandeln = da.length ? angebot - grenze : null;
  return (
    <section className="panel playbook">
      <div className="ph"><h2>Playbook</h2><span className="tag">aus Ihrem Kapital und Anlageprofil</span></div>
      <div className="sr-skala" role="img" aria-label={`Angebot ${eur(angebot)}; ${da.map(([l, v]) => `${l} ${eur(v)}`).join("; ")}`}>
        <div className="sr-angebot" style={{ width: pos(angebot) }} />
        {da.map(([l, v, c]) => <div key={c} className={`sr-marke m-${c}${v >= angebot ? " ok" : ""}`} style={{ left: pos(v) }} title={`${l} ${eur(v)}`} />)}
      </div>
      <ul className="sr-liste"><li><span className="sr-punkt m-angebot" aria-hidden="true" /><span>Angebotspreis{o.objekt.stellplaetze?.some(x => x.erwerben && x.preis === "separat") ? " inkl. Stellplatz" : ""}</span><b>{eur(angebot)}</b><span /></li>{da.map(([l, v, c]) => <li key={c}><span className={`sr-punkt m-${c}`} aria-hidden="true" /><span>{l}</span><b>{eur(v)}</b><span className={v >= angebot ? "up" : "dn"}>{v >= angebot ? `${eur(v - angebot)} Luft` : `${eur(angebot - v)} darüber`}</span></li>)}</ul>
      <p className="say-k">{verhandeln == null ? "Für Zielpreise fehlt noch die Miete." : verhandeln <= 0 ? `Das Angebot liegt in allen Grenzen, ${eur(-verhandeln)} unter der engsten.` : `Damit alles aufgeht, müsste der Preis um ${eur(verhandeln)} (${pct(verhandeln / angebot, 0)}) sinken, oder Eigenkapital, Zins oder Miete ändern sich.`}
        {zuDurchspielen && <> <button type="button" className="linkbtn" onClick={zuDurchspielen}>Durchspielen</button></>}</p>
      <MietpfadPanel o={o.objekt} a={a} />
    </section>
  );
}

const MARKTFELDER: { k: "marktmieteQm" | "vergleichspreisQm" | "bodenrichtwert"; label: string; einheit: string; quelle: string }[] = [
  { k: "marktmieteQm", label: "Vergleichsmiete", einheit: "€/m²", quelle: "Mietspiegel" },
  { k: "vergleichspreisQm", label: "Vergleichspreis Kauf", einheit: "€/m²", quelle: "Gutachterausschuss" },
  { k: "bodenrichtwert", label: "Bodenrichtwert", einheit: "€/m²", quelle: "BORIS" },
];
/** Markt & Vergleich: selbst eintragen oder ermitteln lassen; ermittelte Werte zeigen Spanne und Quelle. */
let mietspiegelCache: Promise<Mietspiegel[]> | null = null;
function Markt({ o, set }: { o: Objektdatensatz; set: (p: Partial<Objektdatensatz["objekt"]>) => void }) {
  const { meldungMitAktion, admin } = useApp(); const ob = o.objekt;
  const [ms, setMs] = useState<Mietspiegel | null>(null);
  useEffect(() => { (mietspiegelCache ??= api.mietspiegelListe().then(r => r.liste).catch(() => [])).then(l => setMs(findeMietspiegel(l.filter(m => admin || m.status === "geprueft"), ob.ort ?? "", ob.titel ?? ""))); }, [ob.ort, ob.titel, admin]);
  const lagen = ms?.merkmale.find(m => m.key === "lage")?.klassen ?? [];
  const [laeuft, setLaeuft] = useState(false); const [info, setInfo] = useState<string | null>(null);
  const ermitteln = async (aenderung: Partial<Objektdatensatz["objekt"]> = {}) => {
    setLaeuft(true); setInfo(null);
    try {
      const r = await api.ermitteln(o.id, { ...ob, ...aenderung }); const vorher = { marktmieteQm: ob.marktmieteQm, vergleichspreisQm: ob.vergleichspreisQm, bodenrichtwert: ob.bodenrichtwert, herkunft: ob.herkunft, ...(Object.keys(aenderung).length ? { wohnlage: ob.wohnlage ?? null } : {}) };
      const quelle = r.quelle === "ki" ? `Markt-Analyst, ${r.stand}` : r.stand; const am = Date.now();
      const herkunft = { ...(ob.herkunft ?? {}), marktmieteQm: { quelle: r.quellen?.marktmieteQm ?? quelle, von: r.marktmieteQm.von, bis: r.marktmieteQm.bis, am }, vergleichspreisQm: { quelle, von: r.vergleichspreisQm.von, bis: r.vergleichspreisQm.bis, am }, ...(r.bodenrichtwert ? { bodenrichtwert: { quelle, von: r.bodenrichtwert.von, bis: r.bodenrichtwert.bis, am } } : {}) };
      set({ ...aenderung, marktmieteQm: r.marktmieteQm.wert, vergleichspreisQm: r.vergleichspreisQm.wert, ...(r.bodenrichtwert ? { bodenrichtwert: r.bodenrichtwert.wert } : {}), herkunft });
      setInfo(`${r.grundlage} Sicherheit: ${r.sicherheit}.${r.hinweise?.length ? ` Prüfen: ${r.hinweise.join(", ")}.` : ""}`);
      meldungMitAktion("Vergleichswerte ermittelt", "Rückgängig", () => set(vorher));
    } catch (e) { setInfo((e as Error).message); } finally { setLaeuft(false); }
  };
  return (
    <div className="markt">
      <div className="markt-kopf"><div><b>Markt &amp; Vergleich</b><span className="note">Selbst eintragen oder ermitteln lassen</span></div>
        <button type="button" className="btn sm" onClick={() => ermitteln()} disabled={laeuft || !(ob.ort?.trim() || ob.titel?.trim())} title={ob.ort?.trim() ? "" : "Erst Ort eintragen"}>{laeuft ? "Ermittelt …" : <><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M10 2.5l1.8 4.2 4.2 1.8-4.2 1.8L10 14.5l-1.8-4.2L4 8.5l4.2-1.8z" /></svg> Ermitteln</>}</button></div>
      {ms && <div className="markt-ms"><span className="note">✓ Mietspiegel {ms.stadt}{ms.gueltigAb ? ` (gültig ab ${new Date(ms.gueltigAb).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" })})` : ""} hinterlegt{admin && <> · <a href={`/admin/mietspiegel/${ms.id}`}>{ms.status === "entwurf" ? "Entwurf prüfen" : "bearbeiten"}</a></>}</span>
        {lagen.length > 0 && <div className="chips" role="radiogroup" aria-label="Wohnlage">{lagen.map(k => { const v = k.wert ?? k.label; return <button key={v} type="button" role="radio" className="chip" aria-checked={ob.wohnlage === v} aria-pressed={ob.wohnlage === v} onClick={() => { const neu = ob.wohnlage === v ? null : v; if (ob.herkunft?.marktmieteQm && !laeuft) ermitteln({ wohnlage: neu }); else set({ wohnlage: neu }); }}>{k.label}</button>; })}<span className="note">Wohnlage{ob.wohnlage ? "" : ": unbekannt, Spanne breiter"}</span></div>}
      </div>}
      <div className="fields">{MARKTFELDER.map(f => { const h = ob.herkunft?.[f.k]; return (
        <div key={f.k} className={`markt-feld${h ? " ermittelt" : ""}`}>
          <Zahl label={f.label} einheit={f.einheit} wert={ob[f.k]} onChange={v => { const { [f.k]: _weg, ...rest } = ob.herkunft ?? {}; set({ [f.k]: v, herkunft: rest }); }} hinweis={h ? `ermittelt: ${f.k === "marktmieteQm" ? `${num(h.von, 2)} bis ${num(h.bis, 2)} €` : `${eur(h.von)} bis ${eur(h.bis)}`} · ${h.quelle}` : `Quelle: ${f.quelle}`} />
        </div>); })}</div>
      {info && <p className="note markt-info">{info}</p>}
    </div>
  );
}

export function Ergebnisbereich({ a, apName, spielraum, passung }: { a: Analyse; apName: string; spielraum?: React.ReactNode; passung?: React.ReactNode }) {
  const b = a.bewertung; const k = b.kennzahlen; const p = a.params; const ap = p.anlageprofil;
  const reihenfolge = { crit: 0, warn: 1, good: 2, info: 3 } as const;
  const h = [...b.hinweise].sort((x, y) => reihenfolge[x.art] - reihenfolge[y.art]);
  const st = (ok: boolean | null, warn: boolean) => ok == null ? "na" : ok ? "good" : warn ? "warn" : "crit";
  const zeilen: [string, string, string, string][] = [
    ["Bruttorendite", pct(k.bruttorendite, 2), `≥ ${pct(ap.minBruttorendite)}`, st(k.bruttorendite == null ? null : k.bruttorendite >= ap.minBruttorendite, (k.bruttorendite ?? 0) >= ap.minBruttorendite * 0.85)],
    ["Kaufpreisfaktor", num(k.faktor, 1), ap.maxFaktor ? `≤ ${num(ap.maxFaktor, 1)}` : "–", st(k.faktor == null || !ap.maxFaktor ? null : k.faktor <= ap.maxFaktor, (k.faktor ?? 0) <= (ap.maxFaktor ?? 0) * 1.1)],
    ["Nettomietrendite", pct(k.nettomietrendite, 2), "auf Gesamtinvest", st(k.nettomietrendite == null ? null : k.nettomietrendite >= p.sollzins, false)],
    ["Cashflow / Monat", eur(k.cashflowMonat), `≥ ${eur(ap.minCashflow)}`, st(k.cashflowMonat == null ? null : k.cashflowMonat >= ap.minCashflow, (k.cashflowMonat ?? 0) >= ap.minCashflow - 100)],
    ["DSCR", num(k.dscr), `≥ ${num(p.minDscr)}`, st(k.dscr == null ? null : k.dscr >= p.minDscr, (k.dscr ?? 0) >= p.minDscr * 0.9)],
    ["Beleihungsauslauf", pct(k.beleihungsauslauf, 0), `≤ ${pct(p.maxBeleihungsauslauf, 0)}`, st(k.beleihungsauslauf == null ? null : k.beleihungsauslauf <= p.maxBeleihungsauslauf, false)],
    ["Preis vs. Markt", k.preisVsMarkt == null ? "–" : vorzeichen(k.preisVsMarkt, x => pct(x, 0)), "Vergleichspreis", st(k.preisVsMarkt == null ? null : k.preisVsMarkt <= 0.05, (k.preisVsMarkt ?? 1) <= 0.15)],
    ["Mietpotenzial", k.mietpotenzial == null ? "–" : vorzeichen(k.mietpotenzial, x => pct(x, 0)), "vs. Mietspiegel", st(k.mietpotenzial == null ? null : k.mietpotenzial >= 0, false)],
  ];
  return (
    <>
      <section className="panel">
        <div className="ph"><h2>Ergebnis zum Angebotspreis</h2><span className="tag">Anlageprofil: {apName}</span></div>
        <div className="verdict"><div className="score">{b.score == null ? "–" : Math.round(b.score)}<small>/100</small></div>
          <div style={{ display: "grid", gap: 6 }}><div><span className={`pill ${b.einstufung ? "p-" + b.einstufung : ""}`}>{b.einstufung ? EINSTUFUNG[b.einstufung] : "Daten fehlen"}</span></div>
            <div className="note">{b.ko.length ? "Durch ein K.O.-Kriterium ausgeschlossen." : b.einstufung === "opp" ? "Passt zum Anlageprofil. Nächste Schritte: Unterlagen und Experten." : b.einstufung === "watch" ? "Passt teilweise. Durchspielen und Gestaltung zeigen, was sich ändern müsste." : b.einstufung === "pass" ? "Passt zum Angebotspreis nicht. Durchspielen und Gestaltung zeigen, unter welchen Bedingungen doch." : "Bitte Kaufpreis, Fläche und Miete eintragen."}</div></div></div>
        <div className="lbl">Die wichtigsten Gründe</div>
        <ul className="flags">{h.slice(0, 3).map(x => <li key={x.text} className={x.art === "warn" ? "" : x.art}>{x.text}</li>)}</ul>
        {h.length > 3 && <details><summary>{h.length - 3} weitere Hinweise</summary><ul className="flags">{h.slice(3).map(x => <li key={x.text} className={x.art === "warn" ? "" : x.art}>{x.text}</li>)}</ul></details>}
      </section>
      {passung}
      {spielraum}
      <section className="panel"><h2>Budget &amp; Finanzierung</h2><Kacheln eintraege={[["Kaufpreis bis", eur(k.kpMax)], ["Nebenkosten", `${eur(k.nebenkosten)} · ${pct(k.nebenkostenSatz)}`], ["Gesamtinvestition", eur(k.gesamtinvestition)], ["Darlehen", eur(k.darlehen)], ["Rate / Monat", eur(k.rateMonat)], ["Finanzierungslücke", (k.finanzierungsluecke ?? 0) > 0 ? eur(k.finanzierungsluecke) : "keine"]]} /></section>
      <section className="panel"><details><summary>Alle Kennzahlen</summary>
        <div className="tbl"><table><thead><tr><th>Kennzahl</th><th className="num">Wert</th><th>Schwelle</th></tr></thead><tbody>{zeilen.map(([l, v, s, c]) => <tr key={l}><td><span className={`dot d-${c}`} />{l}{erklaerung(l) && <Info text={erklaerung(l)!} label={l} />}</td><td className="num">{v}</td><td className="note">{s}</td></tr>)}</tbody></table></div>
      </details></section>
    </>
  );
}

type Regel = { key: keyof Szenario; label: string; min: number; max: number; schritt: number; einheit: string; zeige: (v: number, a: Analyse) => string; frei: (v: number, a: Analyse) => number; aus: (n: number, a: Analyse) => number; hint?: string };
const kp0 = (a: Analyse) => a.simulation ? a.simulation.kaufpreis / (1 + a.szenario.kaufpreisAenderung) : 0;
const prozentRegel = (key: keyof Szenario, label: string, min: number, max: number, schritt: number, d = 2, vz = false): Regel => ({ key, label, min, max, schritt, einheit: "%", zeige: v => vz ? vorzeichen(v, x => pct(x, d)) : pct(v, d), frei: v => Math.round(v * 10000) / 100, aus: n => n / 100 });
/** Regler mit großen Spannen; im Feld daneben ist jeder Wert frei eintragbar, auch außerhalb der Spanne. */
const REGLER: Regel[] = [
  { key: "kaufpreisAenderung", label: "Kaufpreis nach Verhandlung", min: -0.6, max: 0.3, schritt: 0.005, einheit: "€", zeige: (v, a) => `${vorzeichen(v, x => pct(x, 1))}`, frei: (v, a) => Math.round(kp0(a) * (1 + v)), aus: (n, a) => kp0(a) ? n / kp0(a) - 1 : 0, hint: "Spanne −60 % bis +30 %, im Feld jeder Betrag" },
  { key: "eigenkapital", label: "Eigenkapital-Einsatz", min: 0, max: 0, schritt: 1000, einheit: "€", zeige: v => eur(v), frei: v => Math.round(v), aus: n => n },
  prozentRegel("sollzins", "Sollzins", 0, 0.12, 0.0005),
  prozentRegel("tilgung", "Anfangstilgung", 0, 0.1, 0.001, 1),
  { key: "anschlusszinsAufschlag", label: "Anschlusszins nach Zinsbindung", min: -0.03, max: 0.06, schritt: 0.0025, einheit: "%-Pkt.", zeige: v => `${vorzeichen(v, x => num(x * 100, 2))} %-Pkt.`, frei: v => Math.round(v * 10000) / 100, aus: n => n / 100 },
  { key: "mietFaktor", label: "Miete gegenüber heute", min: 0.5, max: 2, schritt: 0.01, einheit: "€/Monat", zeige: v => vorzeichen(v - 1, x => pct(x, 0)), frei: (v, a) => Math.round((a.simulation?.miete0 ?? 0) / (a.szenario.mietFaktor || 1) * v), aus: (n, a) => { const b = (a.simulation?.miete0 ?? 0) / (a.szenario.mietFaktor || 1); return b ? n / b : 1; } },
  prozentRegel("mietsteigerung", "Mietsteigerung p. a.", -0.03, 0.08, 0.0025, 2, true),
  prozentRegel("kostensteigerung", "Kostensteigerung p. a.", -0.02, 0.08, 0.0025),
  { key: "leerstandZusatz", label: "Leerstand zusätzlich", min: 0, max: 0.5, schritt: 1 / 24, einheit: "Monate/Jahr", zeige: v => `${num(v * 12, 1)} Mon. (${pct(v, 0)})`, frei: v => Math.round(v * 12 * 10) / 10, aus: n => Math.max(0, Math.min(12, n)) / 12 },
  prozentRegel("wertentwicklung", "Wertentwicklung p. a.", -0.06, 0.08, 0.0025, 2, true),
  { key: "haltedauer", label: "Haltedauer", min: 1, max: 40, schritt: 1, einheit: "Jahre", zeige: v => `${v} Jahre`, frei: v => v, aus: n => Math.max(1, Math.min(60, Math.round(n))) },
];

/** Ein Regler: Schieber für schnelles Spielen, Feld für den genauen, freien Wert. */
function Reglerzeile({ r, a, wert, setze, maxEk }: { r: Regel; a: Analyse; wert: number; setze: (v: number) => void; maxEk: number }) {
  const max = r.key === "eigenkapital" ? maxEk : r.max;
  const frei = r.frei(wert, a);
  return (
    <div className="sl">
      <span className="sl-l">{r.label}{erklaerung(r.label) && <Info text={erklaerung(r.label)!} label={r.label} />}</span><output>{r.zeige(wert, a)}</output>
      <input type="range" min={r.min} max={max} step={r.schritt} value={Math.min(max, Math.max(r.min, wert))} aria-label={r.label} onChange={e => setze(Number(e.target.value))} />
      <div className="sl-f"><Zahl label={<span className="sr">{r.label} genau</span>} einheit={r.einheit} wert={frei} onChange={n => n != null && setze(r.aus(n, a))} /></div>
      {r.hint && <span className="hint">{r.hint}</span>}
    </div>
  );
}

function Verlauf({ a }: { a: Analyse }) {
  const reihen = [["konservativ", a.vorlagen.konservativ, "var(--s-k)", 1.25], ["optimistisch", a.vorlagen.optimistisch, "var(--s-o)", 1.25], ["ihre", a.simulation, "var(--accent)", 2.5]].filter(r => r[1]) as [string, Simulation, string, number][];
  if (!reihen.length) return null;
  const H = a.szenario.haltedauer, W = 400, Hh = 210, L = 48, R = 56, T = 14, B = 26;
  const pts = (s: Simulation) => [{ t: 0, v: s.nettovermoegenStart }, ...s.jahre.map(j => ({ t: j.jahr, v: j.nettovermoegen }))];
  const alle = reihen.flatMap(r => pts(r[1]).map(x => x.v));
  const schritt = (() => { const raw = (Math.max(...alle) - Math.min(0, ...alle)) / 4 || 1000; const q = Math.pow(10, Math.floor(Math.log10(raw))); const f = raw / q; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * q; })();
  const lo = Math.floor(Math.min(0, ...alle) / schritt) * schritt, hi = Math.ceil(Math.max(...alle) / schritt) * schritt;
  const X = (t: number) => L + (t / H) * (W - L - R), Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (Hh - T - B);
  const ticks: number[] = []; for (let v = lo; v <= hi + 1e-6; v += schritt) ticks.push(v);
  const xt = H <= 10 ? 2 : H <= 20 ? 5 : 10; const xs: number[] = []; for (let t = 0; t <= H; t += xt) xs.push(t);
  const enden = reihen.map(([k, s, c]) => ({ k, c, v: s.nettovermoegenEnde, y: Y(s.nettovermoegenEnde) })).sort((x, y) => x.y - y.y);
  for (let i = 1; i < enden.length; i++) if (enden[i]!.y - enden[i - 1]!.y < 12) enden[i]!.y = enden[i - 1]!.y + 12;
  const zb = a.params.zinsbindung;
  return (
    <div className="chart"><svg viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label="Nettovermögen über die Haltedauer">
      {ticks.map(v => <g key={v}><line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={Math.abs(v) < 1e-6 ? "var(--muted)" : "var(--line)"} /><text x={L - 6} y={Y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">{teur(v)}</text></g>)}
      {xs.map(t => <text key={t} x={X(t)} y={Hh - 8} textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--f-mono)">{t === 0 ? "Kauf" : `J${t}`}</text>)}
      {zb < H && <><line x1={X(zb)} x2={X(zb)} y1={T} y2={Hh - B} stroke="var(--muted)" strokeDasharray="3 3" /><text x={X(zb) + 4} y={T + 9} fontSize="9.5" fill="var(--muted)">Ende Zinsbindung</text></>}
      {reihen.map(([k, s, c, w]) => <polyline key={k} points={pts(s).map(x => `${X(x.t).toFixed(1)},${Y(x.v).toFixed(1)}`).join(" ")} fill="none" stroke={c} strokeWidth={w} strokeLinejoin="round" />)}
      {enden.map(e => <text key={e.k} x={W - R + 6} y={e.y + 3.5} fontSize="10" fill={e.c} fontFamily="var(--f-mono)">{teur(e.v)}</text>)}
    </svg></div>
  );
}

export function Durchspielen({ o, a, setze }: { o: Objektdatensatz; a: Analyse; setze: Setze }) {
  const s = a.szenario; const p = a.params; const m = a.simulation;
  // Zielpreise rechnen mit dem Gesamtpreis inkl. mitgekaufter Stellplätze, also auch dagegen vergleichen
  const angebot = mitStellplaetzen(o.objekt).kaufpreis;
  const [metrik, setMetrik] = useState<"cf" | "irr" | "nv">("cf");
  const setzeWert = (k: keyof Szenario, v: number) => setze({ szenario: { ...o.szenario, [k]: v } });
  const vorlage = (n: keyof typeof VORLAGEN) => setze({ szenario: { ...o.szenario, ...VORLAGEN[n] } });
  const get = (x: Simulation | null) => !x ? null : metrik === "cf" ? x.cashflowJahr1Monat : metrik === "irr" ? x.irr : x.nettovermoegenEnde;
  const fmt = (v: number | null) => v == null ? "–" : metrik === "irr" ? pct(v) : metrik === "cf" ? eur(v) : teur(v);
  const basis = get(m);
  const tor = a.sensitivitaet.map(x => ({ label: x.label, sa: get(x.schlechter), sb: get(x.besser) })).map(x => ({ ...x, spanne: Math.max(Math.abs((x.sa ?? basis ?? 0) - (basis ?? 0)), Math.abs((x.sb ?? basis ?? 0) - (basis ?? 0))) })).sort((x, y) => y.spanne - x.spanne);
  const maxD = Math.max(...tor.map(x => x.spanne), 1e-9);
  const netM = m ? m.miete0 * (1 - m.ausfall) - m.hausgeld : 0;
  return (
    <>
      <section className="panel">
        <div className="ph"><h2>Durchspielen</h2><Zuruecksetzen o={o} setze={setze} /></div>
        <Strategien o={o} a={a} setze={setze} vorlage={vorlage} />
        <div className="simgrid">
          <div className="sliders">
            <Auswahl label="Mietentwicklung" wert={s.mietentwicklung ?? "mietrecht"} optionen={[["mietrecht", "nach Mietrecht"], ["pauschal", "pauschal"]]} onChange={v => setze({ szenario: { ...o.szenario, mietentwicklung: v } })} />
            {s.mietentwicklung !== "pauschal" && !a.mietrecht && <p className="note">Ohne Vergleichsmiete steigt die Miete pauschal.</p>}
            {s.mietentwicklung !== "pauschal" && a.mietrecht && <div className="fld"><div className="lrow"><label htmlFor="uebergang">Übergang (Besitz, Nutzen, Lasten)</label></div><input id="uebergang" type="month" value={o.szenario.stichtag ?? ""} onChange={x => setze({ szenario: { ...o.szenario, stichtag: x.target.value || undefined } })} /><div className="hint">{o.szenario.stichtag ? "Fristen im Mietpfad zählen ab diesem Monat." : "Leer: ab dem aktuellen Monat."}</div></div>}
            {REGLER.map(r => <Reglerzeile key={r.key} r={r.key === "mietsteigerung" && s.mietentwicklung !== "pauschal" && a.mietrecht ? { ...r, label: "Vergleichsmiete p. a." } : r} a={a} wert={s[r.key] as number} setze={v => setzeWert(r.key, v)} maxEk={Math.max(p.eigenkapital * 1.5, m?.gesamtinvestition ?? 0)} />)}</div>
          <div style={{ display: "grid", gap: 12, alignContent: "start" }}>
            {m ? <div className="res">{([["Cashflow Jahr 1 / Monat", eur(m.cashflowJahr1Monat)], ["Ø Cashflow / Monat", eur(m.cashflowSchnittMonat)], ["Zuzahlung gesamt", m.cashflowSumme + Math.min(0, m.beimKauf) < 0 ? eur(-(m.cashflowSumme + Math.min(0, m.beimKauf))) : "keine"], ["Nettovermögen am Ende", teur(m.nettovermoegenEnde)], ["Eigenkapitalrendite vor Steuern", pct(m.irr)], ["DSCR Jahr 1", num(m.dscrJahr1)]] as const).map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div> : <div className="empty">Für das Durchspielen fehlen Kaufpreis oder Miete.</div>}
            <Verlauf a={a} />
            <div className="legend"><span><i style={{ background: "var(--accent)" }} />Ihre Einstellung</span><span><i style={{ background: "var(--s-k)" }} />Konservativ</span><span><i style={{ background: "var(--s-o)" }} />Optimistisch</span></div>
          </div>
        </div>
        <Positionen o={o} a={a} setze={setze} />
        {m && <details><summary>Forecast Jahr für Jahr</summary><div className="tbl"><table><thead><tr>{["Jahr", "Miete", "Kosten", ...(o.szenario.positionen?.length ? ["Eigene Pos.", "Sondertilg."] : []), "Zins", "Tilgung", "Cashflow", "Restschuld", "Wert", "Nettovermögen"].map(h => <th key={h} className="num">{h}</th>)}</tr></thead><tbody>{m.jahre.map(j => { const zellen = [j.jahr, eur(j.miete), eur(j.kosten), ...(o.szenario.positionen?.length ? [eur(j.positionen), eur(j.sondertilgung)] : []), eur(j.zins), eur(j.tilgung), eur(j.cashflow), eur(j.restschuld), eur(j.wert), eur(j.nettovermoegen)]; const cfIdx = zellen.length - 4; return <tr key={j.jahr}>{zellen.map((v, i) => <td key={i} className={`num${i === cfIdx && j.cashflow < 0 ? " neg" : ""}`}>{v}</td>)}</tr>; })}</tbody></table></div></details>}
      </section>
      {m && <section className="panel">
        <div className="ph"><h2>Was bewegt das Ergebnis am stärksten?</h2><label style={{ gridAutoFlow: "column", alignItems: "center", gap: 8 }}>Messgröße<select style={{ width: "auto" }} value={metrik} onChange={e => setMetrik(e.target.value as typeof metrik)}><option value="cf">Cashflow Jahr 1</option><option value="irr">Eigenkapitalrendite</option><option value="nv">Nettovermögen am Ende</option></select></label></div>
        <p className="note">Ihre Einstellung: {fmt(basis)}. Jeweils ein Faktor wird verändert; rot schlechter, grün besser.</p>
        <div className="tornado">{tor.map(t => <div key={t.label} className="tr"><div>{t.label}</div><div><div className="tt"><div className="mid" />{[t.sa, t.sb].map((v, i) => v == null || basis == null || Math.abs(v - basis) < 1e-9 ? null : <div key={i} className={`seg ${v < basis ? "lo" : "hi"}`} style={{ left: `${50 + Math.min(0, (v - basis) / maxD * 48)}%`, width: `${Math.abs((v - basis) / maxD * 48)}%` }} />)}</div><div className="tv"><span>{fmt(Math.min(...[t.sa, t.sb, basis].filter((x): x is number => x != null)))}</span><span>{fmt(Math.max(...[t.sa, t.sb, basis].filter((x): x is number => x != null)))}</span></div></div></div>)}</div>
      </section>}
      {m && <Prognose o={o} a={a} setze={setze} />}
      {m && <ExterneFaktoren o={o} a={a} />}
      {m && <section className="panel">
        <h2>Schwellen &amp; Zielpreise</h2>
        <div className="tbl"><table><thead><tr><th>Damit der Cashflow ± 0 ist …</th><th className="num">nötig</th><th>bei Ihrer Einstellung</th></tr></thead><tbody>
          <tr><td>… Miete pro Monat</td><td className="num">{eur((m.hausgeld + m.rateMonat) / (1 - m.ausfall))}</td><td className="note">{eur(m.miete0)}</td></tr>
          <tr><td>… Sollzins höchstens</td><td className="num">{m.darlehen > 0 ? pct(netM * 12 / m.darlehen - s.tilgung, 2) : "–"}</td><td className="note">{pct(s.sollzins, 2)}</td></tr>
          <tr><td>… Eigenkapital mindestens</td><td className="num">{eur(Math.max(0, m.gesamtinvestition - netM * 12 / (s.sollzins + s.tilgung)))}</td><td className="note">{eur(s.eigenkapital)}</td></tr>
        </tbody></table></div>
        <div className="tiles">{([["Kaufpreis für Cashflow ± 0", a.zielpreise.cashflowNull], [`Kaufpreis für ${pct(p.anlageprofil.minBruttorendite)} Rendite`, a.zielpreise.mindestrendite], [`Kaufpreis für Faktor ${num(p.anlageprofil.maxFaktor, 0)}`, a.zielpreise.maxFaktor], [`Kaufpreis für DSCR ${num(p.minDscr)}`, a.zielpreise.dscr]] as const).map(([l, v]) => <div key={l}><span>{l}</span><strong>{eur(v)}</strong>{v != null && angebot ? <span className="note">{vorzeichen(v / angebot - 1, x => pct(x, 0))} zum Angebot{angebot !== o.objekt.kaufpreis ? " inkl. Stellplatz" : ""}</span> : null}</div>)}</div>
      </section>}
    </>
  );
}

export function Steuern({ a }: { a: Analyse }) {
  const t = a.steuern; const p = a.params; const [vergleich, setVergleich] = useState(p.struktur === "offen");
  if (!t) return <section className="panel"><h2>Steuern</h2><div className="empty">Für die Steuerrechnung fehlen Kaufpreis oder Miete.</div></section>;
  const f = p.struktur === "gbr" ? p.gbrAnteil : 1;
  const zeile = (l: string, xs: (string)[]) => <tr key={l}><td>{l}</td>{xs.map((x, i) => <td key={i} className="num">{x}</td>)}</tr>;
  const sign = (v: number) => v < 0 ? `Erstattung ${eur(-v)}` : eur(v);
  return (
    <section className="panel">
      <div className="ph"><h2>Nach Steuern: {STRUKTUR[p.struktur]}{p.struktur === "gbr" ? ` (Ihr Anteil ${pct(p.gbrAnteil, 0)})` : ""}</h2><span className="tag">auf Basis Ihrer Einstellung im Durchspielen</span></div>
      {p.struktur === "privat" || p.struktur === "gbr" ? <Kacheln eintraege={[["Cashflow nach Steuern, Jahr 1 / Monat", eur(t.privat.cashflowJahr1Monat * f)], ["Ø Cashflow nach Steuern / Monat", eur(t.privat.cashflowSchnittMonat * f)], ["Steuern laufend (Summe)", sign(t.privat.steuernLaufend * f)], ["Steuer auf Verkauf", eur(t.privat.steuerVerkauf * f)], ["Vermögenszuwachs nach Steuern", eur(t.privat.zuwachsNachSteuern * f)], ["Eigenkapitalrendite nach Steuern", pct(t.privat.irr)]]} />
        : p.struktur === "gmbh" ? <Kacheln eintraege={[["Cashflow nach Steuern, Jahr 1 / Monat", eur(t.gmbh.cashflowJahr1Monat)], ["Steuer auf Verkauf", eur(t.gmbh.steuerVerkauf)], ["Steuer bei Ausschüttung", eur(t.gmbhAusgeschuettet.steuerAusschuettung)], ["Zuwachs in der GmbH", eur(t.gmbh.zuwachsNachSteuern)], ["Zuwachs nach Ausschüttung", eur(t.gmbhAusgeschuettet.zuwachsNachSteuern)], ["Eigenkapitalrendite nach Ausschüttung", pct(t.gmbhAusgeschuettet.irr)]]} />
        : <p className="note">Sie haben die Struktur offen gelassen; unten sehen Sie alle Varianten nebeneinander. Das ist keine Empfehlung, sondern Grundlage für das Gespräch mit Ihrem Steuerberater.</p>}
      <ul className="flags"><li className="info">Abschreibung {pct(t.afaSatz)} auf den Gebäudeanteil: {eur(t.afaJahr)} pro Jahr.</li>{t.afaKaufAusgabenJahr > 0 && <li className="info">Ausgaben beim Kauf (eigene Positionen, z. B. Küche oder Renovierung): {eur(t.afaKaufAusgabenJahr)} pro Jahr, vereinfacht über 10 Jahre abgeschrieben. Renovierungen in den ersten drei Jahren über 15 % des Gebäudewerts gelten steuerlich meist als anschaffungsnahe Herstellungskosten und laufen dann über die Gebäude-Abschreibung; mit dem Steuerberater klären.</li>}{p.struktur !== "gmbh" && <li className={a.szenario.haltedauer >= 10 ? "good" : ""}>{a.szenario.haltedauer >= 10 ? `Haltedauer ${a.szenario.haltedauer} Jahre: Verkauf im Privatvermögen steuerfrei.` : "Haltedauer unter 10 Jahren: Der Veräußerungsgewinn ist steuerpflichtig."}</li>}</ul>
      <div className="row"><button type="button" className="btn ghost" onClick={() => setVergleich(v => !v)}>{vergleich ? "Vergleich ausblenden" : "Mit anderen Strukturen vergleichen"}</button></div>
      {vergleich && <div className="tbl"><table><thead><tr><th>Über die Haltedauer</th><th className="num">Privat</th><th className="num">GbR (gesamt)</th><th className="num">GmbH, im Mantel</th><th className="num">GmbH, ausgeschüttet</th></tr></thead><tbody>
        {zeile("Ø Cashflow nach Steuern / Monat", [eur(t.privat.cashflowSchnittMonat), eur(t.privat.cashflowSchnittMonat), eur(t.gmbh.cashflowSchnittMonat), eur(t.gmbh.cashflowSchnittMonat)])}
        {zeile("Steuern laufend (Summe)", [sign(t.privat.steuernLaufend), sign(t.privat.steuernLaufend), sign(t.gmbh.steuernLaufend), sign(t.gmbh.steuernLaufend)])}
        {zeile("Steuer auf Verkauf", [eur(t.privat.steuerVerkauf), eur(t.privat.steuerVerkauf), eur(t.gmbh.steuerVerkauf), eur(t.gmbh.steuerVerkauf)])}
        {zeile("Steuer auf Ausschüttung", ["–", "–", "–", eur(t.gmbhAusgeschuettet.steuerAusschuettung)])}
        {zeile("Vermögenszuwachs nach Steuern", [eur(t.privat.zuwachsNachSteuern), eur(t.privat.zuwachsNachSteuern), eur(t.gmbh.zuwachsNachSteuern), eur(t.gmbhAusgeschuettet.zuwachsNachSteuern)])}
        {zeile("Eigenkapitalrendite nach Steuern", [pct(t.privat.irr), pct(t.privat.irr), pct(t.gmbh.irr), pct(t.gmbhAusgeschuettet.irr)])}
      </tbody></table></div>}
      <details><summary>Steuerliche Annahmen</summary><p className="note">Körperschaftsteuer inkl. Soli 15,825 % mit erweiterter Gewerbesteuerkürzung, Abgeltungsteuer inkl. Soli 26,375 % bei Ausschüttung. Abschreibung nach Baujahr: vor 1925 2,5 %, bis 2022 2 %, ab 2023 3 % auf den Gebäudeanteil inkl. Kaufnebenkosten. Ohne Kirchensteuer, Teileinkünfteverfahren, Erhaltungsaufwand, Verkaufskosten und Sonderfälle wie gewerblichen Grundstückshandel. Nur zur Information, bitte mit Steuerberater klären.</p></details>
    </section>
  );
}

function ParamFeld({ d, wert, onChange }: { d: ParamDef; wert: number | string | boolean; onChange: (v: number | string | boolean) => void }) {
  if (d.typ === "auswahl") return <Auswahl label={d.label} wert={String(wert)} optionen={(d.optionen ?? []).map(x => [x.wert, x.label] as [string, string])} onChange={onChange} />;
  if (d.typ === "jaNein") return <Haken label={d.label} wert={wert === true || wert === "true"} onChange={onChange} />;
  return <Zahl label={d.label} prozent={d.typ === "prozent"} einheit={d.typ === "prozent" ? undefined : d.einheit} hinweis={d.hilfe} wert={Number(wert)} schritt={d.typ === "prozent" ? (d.schritt ?? 0.01) * 100 : d.schritt} onChange={v => onChange(v ?? 0)} />;
}

export function Gestaltung({ o, a, setze }: { o: Objektdatensatz; a: Analyse; setze: Setze }) {
  const an = (id: string, on: boolean) => { const m = { ...o.module }; if (on) m[id] = {}; else delete m[id]; setze({ module: m }); };
  const setzeWert = (id: string, k: string, v: number | string | boolean) => setze({ module: { ...o.module, [id]: { ...(o.module[id] ?? {}), [k]: v } } });
  return (
    <section className="panel">
      <div className="ph"><h2>Gestaltung</h2><span className="tag">was aus dem Objekt werden kann</span></div>
      <p className="note">Jedes Modul rechnet eine Variante neben dem Ist-Fall: Kosten, Zeit, Erlös, Marge, Eigenkapitalrendite und Genehmigungsrisiko. Aktive Module prüft der Projektentwickler im Teamlauf mit.</p>
      <div className="gest">{MODULE.map(m => { const aktiv = m.id in o.module; const werte = { ...standardwerte(m, o.objekt, a.params), ...(o.module[m.id] ?? {}) }; const r = a.module[m.id];
        const gruppen = [...new Set(m.parameter.map(p => p.gruppe))];
        return (
          <details key={m.id} className={`mod${aktiv ? " on" : ""}`} open={aktiv}>
            <summary><span><b>{m.name}</b><br /><span className="note">{m.kurz}</span></span><label className="switch" onClick={e => e.stopPropagation()}><input type="checkbox" role="switch" checked={aktiv} onChange={e => an(m.id, e.target.checked)} aria-label={`${m.name} aktiv`} /><span className="track-s" aria-hidden="true" /><span>{aktiv ? "aktiv" : "aus"}</span></label></summary>
            <div className="body">
              {!aktiv && <p className="note">Aktivieren, um mit Ihren Werten zu rechnen. Hürden: {m.huerden.slice(0, 2).join("; ")} …</p>}
              {aktiv && <>
                {gruppen.map(g => <div key={g} style={{ display: "grid", gap: 8 }}><div className="grp">{g}</div><div className="fields">{m.parameter.filter(p => p.gruppe === g).map(d => <ParamFeld key={d.key} d={d} wert={werte[d.key]!} onChange={v => setzeWert(m.id, d.key, v)} />)}</div></div>)}
                {r && <><div className="tiles">{r.kennzahlen.map(k => <div key={k.key}><span>{k.label}</span><strong>{kennzahl(k.wert, k.einheit)}</strong></div>)}</div>
                  {r.hinweise.length > 0 && <ul className="flags">{r.hinweise.map(h => <li key={h.text} className={h.art === "warn" ? "" : h.art}>{h.text}</li>)}</ul>}</>}
                <div><div className="lbl">Hürden und Rechtsstand</div><ul className="huerden">{m.huerden.map(h => <li key={h}>{h}</li>)}</ul></div>
                <p className="note">Prüfen im Team: {m.experten.map(e => expertMeta(e)?.rolle ?? e).join(", ")}</p>
              </>}
            </div>
          </details>); })}</div>
    </section>
  );
}

export const STANDARD_SZENARIO = standardSzenario;

function Zuruecksetzen({ o, setze }: { o: Objektdatensatz; setze: Setze }) {
  const { frage } = useApp();
  if (!Object.keys(o.szenario).length) return null;
  return <button className="btn ghost sm" type="button" onClick={async () => { const n = o.szenario.positionen?.length ?? 0; if (await frage({ titel: "Annahmen zurücksetzen?", text: `Alle Regler gehen auf die Werte aus Ihrem Profil zurück${n ? `, und ${n} eigene Positionen werden entfernt` : ""}.`, ja: "Zurücksetzen" })) setze({ szenario: {} }); }}>Zurücksetzen</button>;
}
