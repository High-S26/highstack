"use client";
import { params, spielraum, type Anlageprofil, type Assetklasse, type Investorenprofil, type Struktur } from "@highstack/engine";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useApp } from "@/components/App";
import { Auswahl, BUNDESLAENDER, Marken, Text, Zahl } from "@/components/Felder";
import { Spielraum } from "@/components/Profilteile";
import { api } from "@/lib/client";
import { eur, pct } from "@/lib/format";
import { nachStrategie } from "@/lib/vorgaben";
import { WizFuss, WizKopf } from "@/components/Assistent";

const SCHRITTE = ["Kapital", "Erwerb", "Finanzierung", "Suche", "Spielraum"] as const;
const STRUKTUR: [Struktur, string, string][] = [["privat", "Privat", "Im eigenen Namen"], ["gbr", "GbR", "Mit Partner oder Familie"], ["gmbh", "GmbH", "Vermögensverwaltend, bestehend oder geplant"], ["offen", "Noch offen", "Wir rechnen beide Wege zum Vergleich"]];
const RISIKO: [Investorenprofil["risiko"], string, string][] = [["vorsichtig", "Vorsichtig", "Lieber mehr Eigenkapital und schneller tilgen, wenig Überraschungen"], ["ausgewogen", "Ausgewogen", "Solide Rendite, vertretbare Schwankungen"], ["offensiv", "Offensiv", "Hebel nutzen, Zuzahlung für Wertsteigerung ok"]];
const STRATEGIE: [Anlageprofil["strategie"], string][] = [["Cashflow", "Laufender Überschuss zuerst"], ["Mix", "Cashflow und Wertzuwachs"], ["Wertsteigerung", "Gute Lagen, langer Atem"], ["Value-Add", "Sanieren, umnutzen, Mieten heben"]];

/** Einrichtung in fünf kurzen Schritten mit Live-Vorschau des Spielraums. */
export default function Start() {
  const { profil, setzeProfil, setzeObjekt, frage } = useApp(); const router = useRouter();
  const [schritt, setSchritt] = useState(0);
  const [inv, setInv] = useState(profil!.investor);
  const [ap, setAp] = useState<Anlageprofil>(profil!.anlageprofile[0]!);
  const sr = useMemo(() => spielraum(params(inv, { ...ap, preisMax: null })), [inv, ap]);
  const setI = (p: Partial<Investorenprofil>) => setInv(x => ({ ...x, ...p }));
  const fertigesProfil = () => {
    const a = nachStrategie({ ...ap, name: ap.name.trim() || "Mein erstes Investment" }, inv.risiko);
    return { ...profil!, onboarded: true, investor: inv, anlageprofile: [a], aktivesAnlageprofil: a.id };
  };
  const zumSpielraum = async () => { const p = fertigesProfil(); await api.speichereProfil(p); setzeProfil(p); setSchritt(5); };
  const mitBeispiel = async () => { const p = { ...profil!, onboarded: true }; await api.speichereProfil(p); setzeProfil(p); const o = await api.neuesObjekt({ beispiel: true }); setzeObjekt(o); router.replace(`/objekt/${o.id}`); };
  const weiter = () => schritt === 4 ? zumSpielraum() : setSchritt(s => s + 1);
  // Abbrechen: Erstnutzer starten mit Standardwerten, Wiederkehrende verwerfen nur die Änderungen
  const erstmals = !profil!.onboarded;
  const abbrechen = async () => {
    if (schritt === 5) { router.push("/"); return; }
    if (erstmals) {
      if (!await frage({ titel: "Einrichtung später?", text: "Sie starten mit typischen Standardwerten (50.000 € Eigenkapital, 230.000 € Kredit). Alles lässt sich jederzeit unter Profil ändern.", ja: "Mit Standardwerten starten", nein: "Weiter einrichten" })) return;
      const p = { ...profil!, onboarded: true }; await api.speichereProfil(p); setzeProfil(p); router.replace("/"); return;
    }
    if (await frage({ titel: "Abbrechen?", text: "Ihre Änderungen in diesem Assistenten werden nicht übernommen. Ihr Profil bleibt wie es war.", ja: "Abbrechen", nein: "Weiter bearbeiten", gefahr: true })) router.push("/");
  };

  if (schritt === 0) return (
    <div className="view wiz willkommen">
      <h1>Willkommen bei highstack</h1>
      <p className="lead">Ihr privates Family Office für Immobilien. In zwei Minuten wissen Sie, welcher Kaufpreis zu Ihnen passt, und können das erste Objekt prüfen.</p>
      <ul className="vorteile">
        <li><b>Spielraum kennen</b><span>Höchster Kaufpreis, Rate und nötige Rendite aus Ihrem Kapital</span></li>
        <li><b>Objekte prüfen</b><span>Exposé hochladen, Ergebnis sehen, Annahmen durchspielen</span></li>
        <li><b>Experten fragen</b><span>Makler, Bank, Verwalter, Steuer und Recht als Team, auf Abruf</span></li>
      </ul>
      <div className="row"><button type="button" className="btn" onClick={() => setSchritt(1)}>Einrichten</button><button type="button" className="btn ghost" onClick={mitBeispiel}>Erst ein Beispiel ansehen</button>{!erstmals && <button type="button" className="btn ghost" onClick={() => router.push("/")}>Abbrechen</button>}</div>
      <p className="note">Alles lässt sich später unter Profil ändern. highstack informiert, berät aber nicht.</p>
    </div>
  );

  return (
    <div className="view wiz">
      <WizKopf schritte={SCHRITTE} aktuell={schritt} gehe={n => setSchritt(n)} abbrechen={abbrechen} abbrechenText={schritt === 5 ? "Zur Übersicht" : erstmals ? "Später einrichten" : "Abbrechen"} />
      {schritt < 5 ? <div className="wiz-body wiz-pruefen">
        <div className="wiz-body">
          {schritt === 1 && <>
            <h1>Wie viel Kapital haben Sie?</h1>
            <p className="lead">Eigenkapital ohne Notreserve und der Kreditrahmen, den Sie aufnehmen würden.</p>
            <div className="fields">
              <Zahl label="Eigenkapital" einheit="€" wert={inv.eigenkapital} onChange={v => setI({ eigenkapital: v ?? 0 })} />
              <Zahl label="Kreditrahmen" einheit="€" wert={inv.kreditrahmen} onChange={v => setI({ kreditrahmen: v ?? 0 })} />
              <Auswahl voll label="Bundesland" wert={inv.bundesland} optionen={BUNDESLAENDER} onChange={v => setI({ bundesland: v })} />
            </div>
          </>}
          {schritt === 2 && <>
            <h1>Wer kauft?</h1>
            <p className="lead">Davon hängen die Steuern ab. Sie können das jederzeit ändern.</p>
            <div className="wiz-wahl" role="radiogroup" aria-label="Erwerbsstruktur">{STRUKTUR.map(([v, l, s]) => <button key={v} type="button" role="radio" aria-checked={inv.struktur === v} className="wiz-karte" onClick={() => setI({ struktur: v })}><b>{l}</b><span>{s}</span></button>)}</div>
            <div className="fields">
              {inv.struktur !== "gmbh" && <Zahl label="Persönlicher Grenzsteuersatz" prozent wert={inv.grenzsteuersatz} onChange={v => setI({ grenzsteuersatz: v ?? 0 })} />}
              {inv.struktur === "gbr" && <Zahl label="Ihr Anteil an der GbR" prozent wert={inv.gbrAnteil} onChange={v => setI({ gbrAnteil: v ?? 0 })} />}
              {(inv.struktur === "gmbh" || inv.struktur === "offen") && <Zahl label="Laufende Kosten der GmbH" einheit="€/Jahr" wert={inv.gmbhKostenJahr} onChange={v => setI({ gmbhKostenJahr: v ?? 0 })} />}
            </div>
          </>}
          {schritt === 3 && <>
            <h1>Finanzierung und Risiko</h1>
            <p className="lead">Typische Werte sind eingetragen. Wenn Sie ein Bankangebot haben, nehmen Sie dessen Werte.</p>
            <div className="fields">
              <Zahl label="Sollzins" prozent wert={inv.sollzins} onChange={v => setI({ sollzins: v ?? 0 })} />
              <Zahl label="Anfangstilgung" prozent wert={inv.tilgung} onChange={v => setI({ tilgung: v ?? 0 })} />
              <Zahl label="Zinsbindung" einheit="Jahre" wert={inv.zinsbindung} onChange={v => setI({ zinsbindung: v ?? 10 })} />
            </div>
            <div className="wiz-wahl" role="radiogroup" aria-label="Risikoneigung">{RISIKO.map(([v, l, s]) => <button key={v} type="button" role="radio" aria-checked={inv.risiko === v} className="wiz-karte" onClick={() => setI({ risiko: v })}><b>{l}</b><span>{s}</span></button>)}</div>
          </>}
          {schritt === 4 && <>
            <h1>Was suchen Sie?</h1>
            <p className="lead">Ihr erstes Anlageprofil. Danach misst highstack jedes Objekt.</p>
            <div className="wiz-wahl" role="radiogroup" aria-label="Strategie">{STRATEGIE.map(([v, s]) => <button key={v} type="button" role="radio" aria-checked={ap.strategie === v} className="wiz-karte" onClick={() => setAp({ ...ap, strategie: v })}><b>{v}</b><span>{s}</span></button>)}</div>
            <div className="fields">
              <Marken voll label="Regionen" platzhalter="z. B. Düsseldorf, dann Enter" hinweis="Städte oder Stadtteile. Enter oder Komma fügt hinzu." werte={ap.regionen} onChange={v => setAp({ ...ap, regionen: v })} />
              <div className="full"><span className="flabel">Objektarten</span><div className="chips" style={{ marginTop: 6 }}>{(["ETW", "MFH", "EFH/ZFH", "Gewerbe"] as Assetklasse[]).map(a => <label key={a} className="chip"><input type="checkbox" checked={ap.assetklassen.includes(a)} onChange={e => setAp({ ...ap, assetklassen: e.target.checked ? [...ap.assetklassen, a] : ap.assetklassen.filter(x => x !== a) })} /> {a}</label>)}</div></div>
              <Text voll label="Name des Anlageprofils" wert={ap.name} onChange={v => setAp({ ...ap, name: v })} platzhalter="Mein erstes Investment" />
            </div>
          </>}
          <WizFuss zurueck={() => setSchritt(s => s - 1)} weiter={weiter} weiterText={schritt === 4 ? "Spielraum anzeigen" : "Weiter"} />
        </div>
        <aside className="wiz-vorschau" aria-live="polite">
          <span className="flabel">Ihr Spielraum, live</span>
          <div className="vs"><dl>
            <div><dt>Kaufpreis bis</dt><dd>{eur(sr.kpMax)}</dd></div>
            <div><dt>Rate pro Monat</dt><dd>{eur(sr.rate)}</dd></div>
            <div><dt>Cashflow ± 0 ab</dt><dd>{pct(sr.noetigeRendite)} Rendite</dd></div>
          </dl></div>
          <p className="note">Rechnet mit jeder Eingabe neu. Nebenkosten für Grunderwerbsteuer, Notar und Makler sind abgezogen.</p>
        </aside>
      </div> : <div className="wiz-body">
        <h1>Das ist Ihr Spielraum</h1>
        <Spielraum apId={profil!.aktivesAnlageprofil} />
        <h2 className="wiz-h2">Womit möchten Sie anfangen?</h2>
        <div className="wiz-wahl">
          <button type="button" className="wiz-karte" onClick={() => router.push("/neu")}><b>Ein Objekt prüfen</b><span>Exposé, Link oder Text einfügen, Ergebnis in einer Minute</span></button>
          <button type="button" className="wiz-karte" onClick={() => router.push("/suchen/neu")}><b>Einen Suchauftrag anlegen</b><span>Was und wo Sie suchen; Treffer werden gerankt</span></button>
          <button type="button" className="wiz-karte" onClick={() => router.push("/")}><b>Erst umsehen</b><span>Zur Übersicht mit Ihren ersten Schritten</span></button>
        </div>
        <WizFuss zurueck={() => setSchritt(4)} />
      </div>}
    </div>
  );
}
