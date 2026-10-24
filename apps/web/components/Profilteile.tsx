"use client";
import { RISIKO_VORGABEN } from "@/lib/vorgaben";
import { params, spielraum, type Anlageprofil, type Assetklasse, type Investorenprofil } from "@highstack/engine";
import { eur, num, pct, STRUKTUR } from "@/lib/format";
import { useApp } from "./App";
import { Auswahl, BUNDESLAENDER, Haken, Marken, Text, Zahl } from "./Felder";
import { Info } from "./Info";
import { erklaerung } from "@/lib/erklaerungen";

export function Finanzierungsrahmen({ apId }: { apId: string }) {
  const { profil, setzeProfil, anlageprofil } = useApp();
  const ap = anlageprofil(apId); const p = params(profil!.investor, ap); const sr = spielraum(p);
  return (
    <section className="room">
      <div className="ph">
        <h2>Ihr Finanzierungsrahmen</h2>
        <div className="chips">{profil!.anlageprofile.map(a => <button key={a.id} type="button" className="chip" aria-pressed={a.id === ap.id} onClick={() => setzeProfil({ ...profil!, aktivesAnlageprofil: a.id })}>{a.name}</button>)}</div>
      </div>
      <div className="sub">Investorenprofil ({eur(p.eigenkapital)} Eigenkapital, {eur(p.kreditrahmen)} Kredit, {STRUKTUR[p.struktur]}) kombiniert mit Anlageprofil „{ap.name}“ ({ap.strategie}{ap.regionen.length ? `, ${ap.regionen.join(", ")}` : ""})</div>
      <div className="k">
        {([["Kaufpreis bis", eur(sr.kpMax)], ["Rate pro Monat", eur(sr.rate)], ["Cashflow ± 0 ab", `${pct(sr.noetigeRendite)} Rendite`], ["entspricht Faktor bis", num(sr.noetigerFaktor, 1)], ["Beleihungsauslauf", pct(sr.beleihungsauslauf, 0)]] as const).map(([l, v]) => { const t = erklaerung(l === "Kaufpreis bis" ? "Kaufpreis bis " : l); return <div key={l}><span>{l}{t && <Info text={t} label={l} />}</span><strong>{v}</strong></div>; })}
      </div>
      <div className="say">{sr.traegtSich
        ? `Ihr Ziel von ${pct(ap.minBruttorendite)} Bruttorendite trägt sich bei dieser Finanzierung: Zum Höchstpreis bleiben rund ${eur(sr.cashflowBeiZielrendite)} pro Monat.`
        : `Ihr Ziel von ${pct(ap.minBruttorendite)} Bruttorendite reicht bei dieser Finanzierung nicht für Cashflow ± 0: Zum Höchstpreis zahlen Sie rund ${eur(-sr.cashflowBeiZielrendite)} pro Monat zu. Gesucht sind Objekte ab ${pct(sr.noetigeRendite)} Rendite (Faktor bis ${num(sr.noetigerFaktor, 1)}), mehr Eigenkapital oder eine Wertsteigerungs-Strategie mit bewusster Zuzahlung.`}</div>
      <div className="sub">Gilt für alle Deals. Was bei einem bestimmten Objekt aufgeht, zeigt dort das Playbook unter Ergebnis. Annahme: 15 % der Miete für nicht umlagefähige Kosten, {pct(p.mietausfall, 0)} Mietausfall.</div>
    </section>
  );
}

export function Investorformular() {
  const { profil, setzeProfil } = useApp();
  const inv = profil!.investor;
  const set = <K extends keyof Investorenprofil>(k: K, v: Investorenprofil[K]) => setzeProfil({ ...profil!, investor: { ...inv, [k]: v } });
  return (
    <section className="panel">
      <div className="ph"><h2>Investorenprofil</h2><span className="tag">wer Sie sind</span></div>
      <div className="fields">
        <Zahl label="Eigenkapital" einheit="€" wert={inv.eigenkapital} onChange={v => set("eigenkapital", v ?? 0)} schritt={1000} />
        <Zahl label="Kreditrahmen" einheit="€" wert={inv.kreditrahmen} onChange={v => set("kreditrahmen", v ?? 0)} schritt={1000} />
        <Auswahl liste label="Bundesland" wert={inv.bundesland} optionen={BUNDESLAENDER} onChange={v => set("bundesland", v)} />
        <Auswahl label="Erwerb als" wert={inv.struktur} optionen={[["privat", "Privat"], ["gbr", "GbR"], ["gmbh", "GmbH"], ["offen", "Noch offen"]]} onChange={v => set("struktur", v)} />
        {inv.struktur !== "gmbh" && <Zahl label="Grenzsteuersatz" prozent wert={inv.grenzsteuersatz} onChange={v => set("grenzsteuersatz", v ?? 0)} />}
        {inv.struktur === "gbr" && <Zahl label="Ihr Anteil an der GbR" prozent wert={inv.gbrAnteil} onChange={v => set("gbrAnteil", v ?? 0)} />}
        {(inv.struktur === "gmbh" || inv.struktur === "offen") && <><Zahl label="GmbH laufende Kosten" einheit="€/Jahr" wert={inv.gmbhKostenJahr} onChange={v => set("gmbhKostenJahr", v ?? 0)} /><Zahl label="GmbH Gründungskosten" einheit="€" wert={inv.gmbhGruendung} onChange={v => set("gmbhGruendung", v ?? 0)} /></>}
        <Zahl label="Sollzins" prozent wert={inv.sollzins} onChange={v => set("sollzins", v ?? 0)} schritt={0.05} />
        <Zahl label="Anfangstilgung" prozent wert={inv.tilgung} onChange={v => set("tilgung", v ?? 0)} schritt={0.1} />
        <Zahl label="Zinsbindung" einheit="Jahre" wert={inv.zinsbindung} onChange={v => set("zinsbindung", v ?? 10)} />
        <Auswahl label="Risikoneigung" wert={inv.risiko} optionen={[["vorsichtig", "Vorsichtig"], ["ausgewogen", "Ausgewogen"], ["offensiv", "Offensiv"]]} onChange={v => setzeProfil({ ...profil!, investor: { ...inv, risiko: v, tilgung: RISIKO_VORGABEN[v].tilgung, minDscr: RISIKO_VORGABEN[v].minDscr } })} />
        <p className="note full">{RISIKO_VORGABEN[inv.risiko].text}. Tilgung und DSCR können Sie danach frei anpassen.</p>
      </div>
      <details><summary>Nebenkosten und Bankannahmen</summary>
        <div className="fields">
          <Zahl label="Notar + Grundbuch" prozent wert={inv.notar} onChange={v => set("notar", v ?? 0)} />
          <Zahl label="Maklerprovision" prozent wert={inv.makler} onChange={v => set("makler", v ?? 0)} />
          <Zahl label="Mietausfallwagnis" prozent wert={inv.mietausfall} onChange={v => set("mietausfall", v ?? 0)} />
          <Zahl label="Abschlag Beleihungswert" prozent wert={inv.beleihungsabschlag} onChange={v => set("beleihungsabschlag", v ?? 0)} />
          <Zahl label="Max. Beleihungsauslauf" prozent wert={inv.maxBeleihungsauslauf} onChange={v => set("maxBeleihungsauslauf", v ?? 1)} />
          <Zahl label="Min. Kapitaldienstdeckung (DSCR)" wert={inv.minDscr} onChange={v => set("minDscr", v ?? 1)} schritt={0.05} />
        </div>
      </details>
    </section>
  );
}

const ASSETS: Assetklasse[] = ["ETW", "MFH", "EFH/ZFH", "Gewerbe"];
export function Anlageprofilformular({ apId, kompakt }: { apId: string; kompakt?: boolean }) {
  const { profil, setzeProfil } = useApp();
  const ap = profil!.anlageprofile.find(a => a.id === apId) ?? profil!.anlageprofile[0]!;
  const set = (patch: Partial<Anlageprofil>) => setzeProfil({ ...profil!, anlageprofile: profil!.anlageprofile.map(a => a.id === ap.id ? { ...a, ...patch } : a) });
  const finanzierbar = spielraum(params(profil!.investor, { ...ap, preisMax: null })).kpMaxFinanzierbar;
  return (
    <section className="panel">
      <div className="ph"><h2>{kompakt ? "Suchkriterien" : `Anlageprofil: ${ap.name}`}</h2><span className="tag">was Sie suchen</span></div>
      <div className="fields">
        <Text label="Name" wert={ap.name} onChange={v => set({ name: v })} />
        <Auswahl label="Strategie" wert={ap.strategie} optionen={[["Cashflow", "Cashflow"], ["Mix", "Mix"], ["Wertsteigerung", "Wertsteigerung"], ["Value-Add", "Value-Add"]]} onChange={v => set({ strategie: v })} />
        <Marken label="Regionen" voll werte={ap.regionen} platzhalter="z. B. Düsseldorf, dann Enter" hinweis="Städte oder Stadtteile. Enter oder Komma fügt hinzu." onChange={v => set({ regionen: v })} />
        <div className="full"><div className="note" style={{ marginBottom: 6 }}>Assetklassen</div>
          <div className="chips">{ASSETS.map(a => <label key={a} className="chip"><input type="checkbox" checked={ap.assetklassen.includes(a)} onChange={e => set({ assetklassen: e.target.checked ? [...ap.assetklassen, a] : ap.assetklassen.filter(x => x !== a) })} /> {a}</label>)}</div>
        </div>
        <Zahl label="Kaufpreis bis" einheit="€" hinweis={`Finanzierbar wären ${eur(finanzierbar)}`} wert={ap.preisMax} onChange={v => set({ preisMax: v })} schritt={5000} />
        <Zahl label="Min. Bruttorendite" prozent wert={ap.minBruttorendite} onChange={v => set({ minBruttorendite: v ?? 0 })} schritt={0.1} />
        <Zahl label="Max. Kaufpreisfaktor" wert={ap.maxFaktor} onChange={v => set({ maxFaktor: v })} schritt={0.5} />
        <Zahl label="Min. Cashflow" einheit="€/Monat" min={-10000} max={100000} wert={ap.minCashflow} onChange={v => set({ minCashflow: v ?? 0 })} schritt={10} />
      </div>
      <details><summary>Haltedauer, Gewichtung, K.O.-Kriterien</summary>
        <div className="fields">
          <Zahl label="Haltedauer" einheit="Jahre" min={1} max={60} wert={ap.haltedauer} onChange={v => set({ haltedauer: v == null ? 10 : Math.min(60, Math.max(1, Math.round(v))) })} />
          <span />
          <Zahl label="Gewicht Rendite" wert={ap.gewichte.rendite} onChange={v => set({ gewichte: { ...ap.gewichte, rendite: v ?? 0 } })} schritt={5} />
          <Zahl label="Gewicht Preis & Lage" wert={ap.gewichte.lage} onChange={v => set({ gewichte: { ...ap.gewichte, lage: v ?? 0 } })} schritt={5} />
          <Zahl label="Gewicht Substanz" wert={ap.gewichte.substanz} onChange={v => set({ gewichte: { ...ap.gewichte, substanz: v ?? 0 } })} schritt={5} />
          <Zahl label="Gewicht Finanzierbarkeit" wert={ap.gewichte.finanzierung} onChange={v => set({ gewichte: { ...ap.gewichte, finanzierung: v ?? 0 } })} schritt={5} />
          <Haken label="K.O. bei Erbbaurecht" wert={ap.ko.erbbaurecht} onChange={v => set({ ko: { ...ap.ko, erbbaurecht: v } })} />
          <Haken label="K.O. bei offener Sonderumlage" wert={ap.ko.sonderumlage} onChange={v => set({ ko: { ...ap.ko, sonderumlage: v } })} />
          <Haken label="K.O. bei Energieklasse G/H" wert={ap.ko.energieGH} onChange={v => set({ ko: { ...ap.ko, energieGH: v } })} />
        </div>
      </details>
    </section>
  );
}
