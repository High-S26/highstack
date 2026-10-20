"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Anlageprofil, Assetklasse, Struktur } from "@highstack/engine";
import { useApp } from "@/components/App";
import { Auswahl, BUNDESLAENDER, Marken, Text, Zahl } from "@/components/Felder";
import { eur, pct } from "@/lib/format";
import { api } from "@/lib/client";

const SCHRITTE = 4;
export default function Start() {
  const { profil, setzeProfil } = useApp(); const router = useRouter();
  const [schritt, setSchritt] = useState(1);
  const [inv, setInv] = useState(profil!.investor);
  const [ap, setAp] = useState<Anlageprofil>(profil!.anlageprofile[0]!);
  const nk = ({ NW: .065, BW: .05, BY: .035, BE: .06, BB: .065, HB: .05, HH: .055, HE: .06, MV: .06, NI: .05, RP: .05, SL: .065, SN: .055, ST: .05, SH: .065, TH: .05 } as Record<string, number>)[inv.bundesland]! + inv.notar + inv.makler;
  const fertig = async () => {
    const strat = ap.strategie;
    const a: Anlageprofil = { ...ap, minBruttorendite: strat === "Cashflow" ? 0.06 : strat === "Wertsteigerung" ? 0.035 : 0.05, maxFaktor: strat === "Cashflow" ? 17 : strat === "Wertsteigerung" ? 30 : 22, minCashflow: strat === "Wertsteigerung" ? -150 : 0, gewichte: { rendite: strat === "Cashflow" ? 40 : 25, lage: strat === "Wertsteigerung" ? 40 : 25, substanz: 20, finanzierung: 25 }, ko: { ...ap.ko, energieGH: inv.risiko === "vorsichtig" } };
    const p = { ...profil!, onboarded: true, investor: inv, anlageprofile: [a], aktivesAnlageprofil: a.id };
    await api.speichereProfil(p); setzeProfil(p); router.replace("/");
  };
  return (
    <div className="panel center">
      <div className="steps" aria-hidden="true">{Array.from({ length: SCHRITTE }, (_, i) => <span key={i} className={i < schritt ? "on" : ""} />)}</div>
      <div className="tag">Schritt {schritt} von {SCHRITTE}</div>
      {schritt === 1 && <div className="fields">
        <h2 className="full">Ihr Investorenprofil: Kapital</h2>
        <p className="note full">Das Investorenprofil beschreibt, wer investiert. Was Sie suchen, legen Sie gleich im Anlageprofil fest.</p>
        <Zahl label="Eigenkapital" einheit="€" wert={inv.eigenkapital} onChange={v => setInv({ ...inv, eigenkapital: v ?? 0 })} schritt={1000} />
        <Zahl label="Kreditrahmen" einheit="€" wert={inv.kreditrahmen} onChange={v => setInv({ ...inv, kreditrahmen: v ?? 0 })} schritt={1000} />
        <Auswahl voll label="Bundesland (für die Grunderwerbsteuer)" wert={inv.bundesland} optionen={BUNDESLAENDER} onChange={v => setInv({ ...inv, bundesland: v })} />
        <p className="note full">Damit liegt Ihr maximaler Kaufpreis bei rund {eur((inv.eigenkapital + inv.kreditrahmen) / (1 + nk))}; {pct(nk)} gehen für Grunderwerbsteuer, Notar, Grundbuch und Makler ab.</p>
      </div>}
      {schritt === 2 && <div className="fields">
        <h2 className="full">Wie wollen Sie erwerben?</h2>
        <p className="note full">Danach richten sich Steuern und Rechnung. Sie können das jederzeit ändern.</p>
        <div className="opts full" role="radiogroup" aria-label="Erwerbsstruktur">
          {([["privat", "Privat", "Im eigenen Namen"], ["gbr", "GbR", "Mit Partner oder Familie"], ["gmbh", "GmbH", "Vermögensverwaltend, bestehend oder geplant"], ["offen", "Noch offen", "Wir zeigen den Vergleich"]] as [Struktur, string, string][]).map(([v, l, s]) => <label key={v} className="opt"><input type="radio" name="st" checked={inv.struktur === v} onChange={() => setInv({ ...inv, struktur: v })} />{l}<small>{s}</small></label>)}
        </div>
        {inv.struktur !== "gmbh" && <Zahl label="Persönlicher Grenzsteuersatz" prozent wert={inv.grenzsteuersatz} onChange={v => setInv({ ...inv, grenzsteuersatz: v ?? 0 })} />}
        {inv.struktur === "gbr" && <Zahl label="Ihr Anteil an der GbR" prozent wert={inv.gbrAnteil} onChange={v => setInv({ ...inv, gbrAnteil: v ?? 0 })} />}
        {(inv.struktur === "gmbh" || inv.struktur === "offen") && <Zahl label="Laufende Kosten der GmbH" einheit="€/Jahr" wert={inv.gmbhKostenJahr} onChange={v => setInv({ ...inv, gmbhKostenJahr: v ?? 0 })} />}
      </div>}
      {schritt === 3 && <div className="fields">
        <h2 className="full">Finanzierung und Risiko</h2>
        <Zahl label="Sollzins" prozent wert={inv.sollzins} onChange={v => setInv({ ...inv, sollzins: v ?? 0 })} schritt={0.05} />
        <Zahl label="Anfangstilgung" prozent wert={inv.tilgung} onChange={v => setInv({ ...inv, tilgung: v ?? 0 })} schritt={0.1} />
        <Zahl label="Zinsbindung" einheit="Jahre" wert={inv.zinsbindung} onChange={v => setInv({ ...inv, zinsbindung: v ?? 10 })} />
        <Auswahl label="Risikoneigung" wert={inv.risiko} optionen={[["vorsichtig", "Vorsichtig"], ["ausgewogen", "Ausgewogen"], ["offensiv", "Offensiv"]]} onChange={v => setInv({ ...inv, risiko: v })} />
      </div>}
      {schritt === 4 && <div className="fields">
        <h2 className="full">Ihr erstes Anlageprofil: Was suchen Sie?</h2>
        <Text voll label="Name" wert={ap.name} onChange={v => setAp({ ...ap, name: v })} />
        <div className="opts full" role="radiogroup" aria-label="Strategie">
          {([["Cashflow", "Laufender Überschuss zuerst"], ["Mix", "Cashflow und Wertzuwachs"], ["Wertsteigerung", "Gute Lagen, langer Atem"], ["Value-Add", "Sanieren, umnutzen, Mieten heben"]] as [Anlageprofil["strategie"], string][]).map(([v, s]) => <label key={v} className="opt"><input type="radio" name="strat" checked={ap.strategie === v} onChange={() => setAp({ ...ap, strategie: v })} />{v}<small>{s}</small></label>)}
        </div>
        <Marken voll label="Regionen" platzhalter="z. B. Düsseldorf, dann Enter" hinweis="Städte oder Stadtteile. Enter oder Komma fügt hinzu." werte={ap.regionen} onChange={v => setAp({ ...ap, regionen: v })} />
        <div className="full"><div className="note" style={{ marginBottom: 6 }}>Assetklassen</div>
          <div className="chips">{(["ETW", "MFH", "EFH/ZFH", "Gewerbe"] as Assetklasse[]).map(a => <label key={a} className="chip"><input type="checkbox" checked={ap.assetklassen.includes(a)} onChange={e => setAp({ ...ap, assetklassen: e.target.checked ? [...ap.assetklassen, a] : ap.assetklassen.filter(x => x !== a) })} /> {a}</label>)}</div>
        </div>
      </div>}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <button className="btn ghost" type="button" style={{ visibility: schritt === 1 ? "hidden" : "visible" }} onClick={() => setSchritt(s => s - 1)}>Zurück</button>
        <button className="btn" type="button" onClick={() => schritt < SCHRITTE ? setSchritt(s => s + 1) : fertig()}>{schritt < SCHRITTE ? "Weiter" : "Spielraum anzeigen"}</button>
      </div>
    </div>
  );
}
