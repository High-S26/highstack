"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useApp } from "@/components/App";
import { useEntwurf } from "@/lib/entwurf";
import { Auswahl, Haken, Text, Zahl } from "@/components/Felder";
import { STANDARD_HINTERGRUND } from "@/components/Quellen";
import { ASSETS, URLAUBSREGIONEN } from "@/components/Suchen";
import type { Suchauftrag, Suchklasse } from "@/lib/typen";
import { id } from "@/lib/vorgaben";
import { useAbbrechen, WizFuss, WizKopf } from "@/components/Assistent";

const KLASSE: Record<Suchklasse, string> = { ETW: "Eigentumswohnung", MFH: "Mehrfamilienhaus", "EFH/ZFH": "Ein- oder Zweifamilienhaus", Gewerbe: "Gewerbe", "Grundstück": "Grundstück", Ferienimmobilie: "Ferienimmobilie" };

/** Suchauftrag in drei Schritten: was, wo, wie. */
export default function NeuerSuchauftrag() {
  const { profil, setzeProfil, anlageprofil, meldung } = useApp(); const router = useRouter();
  const [schritt, setSchritt] = useState<1 | 2 | 3>(1);
  const ap0 = anlageprofil();
  const [asset, setAsset] = useState<Suchklasse>((ap0.assetklassen[0] as Suchklasse) ?? "ETW");
  const [region, setRegion] = useState(ap0.regionen[0] ?? ""); const [umkreis, setUmkreis] = useState<number | null>(15);
  const [apId, setApId] = useState(ap0.id); const [hinter, setHinter] = useState(false); const [name, setName] = useState("");
  const paket = profil!.paket ?? "basis";
  const vorschlag = [asset === "Ferienimmobilie" ? "Ferienimmobilie" : asset, region].filter(Boolean).join(" ");
  useEntwurf("suche", { schritt, asset, region, umkreis, apId, hinter, name }, d => { setSchritt(d.schritt); setAsset(d.asset); setRegion(d.region); setUmkreis(d.umkreis); if (profil!.anlageprofile.some(a => a.id === d.apId)) setApId(d.apId); setHinter(d.hinter); setName(d.name); });
  const abbrechen = useAbbrechen("/suchen", schritt > 1 || !!name.trim(), "Der Suchauftrag wird nicht angelegt.");
  // Doppelklick legt nicht doppelt an
  const angelegt = useRef(false);
  const anlegen = () => {
    if (angelegt.current) return; angelegt.current = true;
    const s: Suchauftrag = { id: id(), name: name.trim() || vorschlag || "Neue Suche", anlageprofilId: apId, region: region.trim(), asset, aktiv: true, erstellt: Date.now(), hintergrund: { ...STANDARD_HINTERGRUND, aktiv: hinter && paket !== "basis", umkreisKm: umkreis } };
    setzeProfil({ ...profil!, suchen: [s, ...(profil!.suchen ?? [])] }); meldung(`Suchauftrag „${s.name}“ angelegt`); router.push(`/suchen/${s.id}`);
  };
  const regionen = asset === "Ferienimmobilie" ? URLAUBSREGIONEN : [{ gruppe: "Aus Ihren Anlageprofilen", regionen: [...new Set(profil!.anlageprofile.flatMap(a => a.regionen))] }].filter(g => g.regionen.length);
  return (
    <div className="view wiz">
      <WizKopf schritte={["Was", "Wo", "Wie"]} aktuell={schritt} gehe={n => setSchritt(n as 1 | 2 | 3)} abbrechen={abbrechen} />
      {schritt === 1 && <section className="wiz-body">
        <h1>Was suchen Sie?</h1>
        <div className="wiz-wahl" role="radiogroup" aria-label="Objektart">{ASSETS.map(a => (
          <button key={a} type="button" role="radio" aria-checked={asset === a} className="wiz-karte" onClick={() => setAsset(a)} onDoubleClick={() => { setAsset(a); setSchritt(2); }}><b>{KLASSE[a]}</b><span>{a === "Ferienimmobilie" ? "Inseln, Küste, Berge; gerechnet mit Kurzzeitvermietung" : a === "Grundstück" ? "Bauland und Entwicklung, mit Residualwert" : a === "MFH" ? "Mehrere Einheiten, Mieterliste, Aufteilungspotenzial" : a === "Gewerbe" ? "Büro, Laden, Praxis; auch für Umnutzung" : a === "ETW" ? "Einzelne Wohnung in einer Eigentümergemeinschaft" : "Selbstnutzung oder Vermietung als Haus"}</span></button>))}</div>
        <WizFuss weiter={() => setSchritt(2)} />
      </section>}
      {schritt === 2 && <section className="wiz-body">
        <h1>Wo?</h1>
        <div className="fields">
          <Text voll label="Region" wert={region} onChange={setRegion} platzhalter="Stadt, Stadtteil oder Region" />
          <Zahl label="Umkreis um die Region" einheit="km" wert={umkreis} onChange={setUmkreis} min={0} max={200} />
        </div>
        {regionen.map(g => <div key={g.gruppe} className="regg"><span className="note">{g.gruppe}</span><div className="chips">{g.regionen.map(r => <button key={r} type="button" className="chip" aria-pressed={region === r} onClick={() => setRegion(r)}>{r}</button>)}</div></div>)}
        <WizFuss zurueck={() => setSchritt(1)} weiter={() => setSchritt(3)} hinweis={!region.trim() ? "Ohne Region sucht der Auftrag überall." : undefined} />
      </section>}
      {schritt === 3 && <section className="wiz-body">
        <h1>Wie?</h1>
        <div className="fields">
          <Text voll label="Name" wert={name} onChange={setName} platzhalter={vorschlag || "Neue Suche"} />
          <Auswahl voll label="Anlageprofil" wert={apId} optionen={profil!.anlageprofile.map(a => [a.id, a.name] as [string, string])} onChange={setApId} />
          <Haken label="Im Hintergrund suchen" wert={hinter && paket !== "basis"} onChange={v => paket !== "basis" && setHinter(v)} />
        </div>
        {paket === "basis" && <div className="upsell"><b>Im Paket Basis fügen Sie Inserate selbst ein.</b><span>Ab „Lokal“ sucht der Auftrag im Hintergrund.</span><Link className="btn sm" href="/konto#pakete">Pakete ansehen</Link></div>}
        <div className="wiz-zusammen"><b>{name.trim() || vorschlag || "Neue Suche"}</b><span>{KLASSE[asset]}{region ? ` in ${region}` : ", überall"}{umkreis && region ? ` (+${umkreis} km)` : ""} · gemessen an „{anlageprofil(apId).name}“</span></div>
        <WizFuss zurueck={() => setSchritt(2)} weiter={anlegen} weiterText="Suchauftrag anlegen" />
      </section>}
    </div>
  );
}
