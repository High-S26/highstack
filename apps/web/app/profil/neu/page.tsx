"use client";
import type { Anlageprofil, Assetklasse } from "@highstack/engine";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/App";
import { Marken, Text, Zahl } from "@/components/Felder";
import { neuesAnlageprofil, nachStrategie } from "@/lib/vorgaben";
import { useAbbrechen, WizFuss, WizKopf } from "@/components/Assistent";

const STRATEGIE: [Anlageprofil["strategie"], string][] = [["Cashflow", "Laufender Überschuss zuerst"], ["Mix", "Cashflow und Wertzuwachs"], ["Wertsteigerung", "Gute Lagen, langer Atem"], ["Value-Add", "Sanieren, umnutzen, Mieten heben"]];

/** Weiteres Anlageprofil in zwei Schritten: Strategie, dann was und wo. */
export default function NeuesAnlageprofil() {
  const { profil, setzeProfil, meldung } = useApp(); const router = useRouter();
  const [schritt, setSchritt] = useState<1 | 2>(1);
  const [ap, setAp] = useState<Anlageprofil>(() => ({ ...neuesAnlageprofil(""), regionen: [] }));
  const abbrechen = useAbbrechen("/profil", schritt > 1, "Das Anlageprofil wird nicht angelegt.");
  const anlegen = () => {
    const a = nachStrategie({ ...ap, name: ap.name.trim() || `${ap.strategie}${ap.regionen[0] ? ` ${ap.regionen[0]}` : ""}` }, profil!.investor.risiko);
    setzeProfil({ ...profil!, anlageprofile: [...profil!.anlageprofile, a], aktivesAnlageprofil: a.id }); meldung(`Anlageprofil „${a.name}“ angelegt`); router.push("/profil");
  };
  return (
    <div className="view wiz">
      <WizKopf schritte={["Strategie", "Was und wo"]} aktuell={schritt} gehe={n => setSchritt(n as 1 | 2)} abbrechen={abbrechen} />
      {schritt === 1 ? <section className="wiz-body">
        <h1>Neues Anlageprofil</h1>
        <p className="lead">Ein Anlageprofil beschreibt, was Sie suchen. Jedes Objekt wird daran gemessen. Welche Strategie?</p>
        <div className="wiz-wahl" role="radiogroup" aria-label="Strategie">{STRATEGIE.map(([v, s]) => <button key={v} type="button" role="radio" aria-checked={ap.strategie === v} className="wiz-karte" onClick={() => setAp({ ...ap, strategie: v })} onDoubleClick={() => { setAp({ ...ap, strategie: v }); setSchritt(2); }}><b>{v}</b><span>{s}</span></button>)}</div>
        <WizFuss weiter={() => setSchritt(2)} />
      </section> : <section className="wiz-body">
        <h1>Was und wo?</h1>
        <div className="fields">
          <Marken voll label="Regionen" platzhalter="z. B. Köln, dann Enter" werte={ap.regionen} onChange={v => setAp({ ...ap, regionen: v })} />
          <div className="full"><span className="flabel">Objektarten</span><div className="chips" style={{ marginTop: 6 }}>{(["ETW", "MFH", "EFH/ZFH", "Gewerbe"] as Assetklasse[]).map(a => <label key={a} className="chip"><input type="checkbox" checked={ap.assetklassen.includes(a)} onChange={e => setAp({ ...ap, assetklassen: e.target.checked ? [...ap.assetklassen, a] : ap.assetklassen.filter(x => x !== a) })} /> {a}</label>)}</div></div>
          <Zahl label="Kaufpreis bis" einheit="€" wert={ap.preisMax} onChange={v => setAp({ ...ap, preisMax: v })} hinweis="Leer lassen: es gilt, was finanzierbar ist." />
          <Text label="Name" wert={ap.name} onChange={v => setAp({ ...ap, name: v })} platzhalter={`${ap.strategie}${ap.regionen[0] ? ` ${ap.regionen[0]}` : ""}`} />
        </div>
        <p className="note">Rendite, Faktor und Gewichtung werden passend zur Strategie „{ap.strategie}“ vorbelegt; feinjustieren können Sie danach unter Profil.</p>
        <WizFuss zurueck={() => setSchritt(1)} weiter={anlegen} weiterText="Anlageprofil anlegen" />
      </section>}
    </div>
  );
}
