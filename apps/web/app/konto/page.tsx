"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/App";
import { Paketvergleich } from "@/components/Quellen";
import { Zugang } from "@/components/Zugang";
import { paketName } from "@/lib/quellen";

const datum = (t: number) => new Date(t).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

/** Konto: wer Sie sind, wer Zugang hat, Paket, Ihre Daten. Investment-Einstellungen stehen unter Profil. */
export default function Konto() {
  const { profil, objekte, setzeProfil, frage, meldung } = useApp();
  const [ich, setIch] = useState<{ aktiv: boolean; email?: string; rolle?: string } | null>(null);
  useEffect(() => { fetch("/api/auth/ich").then(r => r.json()).then(setIch).catch(() => undefined); }, []);
  const inhaber = !ich?.aktiv || ich.rolle === "inhaber";
  const loeschung = profil!.loeschung;
  const aktion = async (a: "beantragen" | "abbrechen" | "aufgeben") => {
    const r = await fetch("/api/konto/loeschung", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ aktion: a }) }); const x = await r.json();
    if (!r.ok) { meldung(x.fehler ?? "Hat nicht geklappt"); return; }
    if (a === "aufgeben") { location.href = "/login"; return; }
    setzeProfil({ ...profil!, loeschung: x.loeschung ?? undefined }); meldung(a === "beantragen" ? "Löschung beantragt" : "Löschung abgebrochen");
  };
  const beantragen = async () => {
    if (!await frage({ titel: "Konto löschen?", text: `Alle Daten dieses Kontos werden gelöscht: Profil, ${objekte.length} Objekte mit Unterlagen, Suchaufträge und Zugänge. Sie haben 7 Tage, um es sich anders zu überlegen. Laden Sie vorher Ihre Daten herunter, wenn Sie sie behalten möchten.`, ja: "Löschung beantragen", gefahr: true, eingabe: "LÖSCHEN" })) return;
    aktion("beantragen");
  };
  const aufgeben = async () => { if (await frage({ titel: "Zugang aufgeben?", text: "Sie werden abgemeldet und können sich nicht mehr anmelden. Die Daten des Kontos bleiben für die anderen erhalten.", ja: "Zugang aufgeben", gefahr: true })) aktion("aufgeben"); };
  return (
    <div className="view">
      <h1>Konto</h1>
      <p className="lead">Wer Sie sind, wer Zugang hat, Ihr Paket und Ihre Daten. Investorenprofil und Anlageprofile stellen Sie unter <Link href="/profil">Profil</Link> ein.</p>
      <div className="two">
        <section className="panel">
          <h2>Ihr Konto</h2>
          <dl className="kv">
            <div><dt>Angemeldet als</dt><dd>{ich?.aktiv ? ich.email : "Lokal, ohne Anmeldung"}</dd></div>
            <div><dt>Rolle</dt><dd>{ich?.aktiv ? (ich.rolle === "inhaber" ? "Inhaber" : "Mitglied") : "Inhaber"}</dd></div>
            <div><dt>Paket</dt><dd>{paketName(profil!.paket ?? "basis")}</dd></div>
            <div><dt>Objekte</dt><dd>{objekte.length}</dd></div>
            <div><dt>Suchaufträge</dt><dd>{profil!.suchen?.length ?? 0}</dd></div>
          </dl>
          {ich?.aktiv && <button type="button" className="btn ghost sm" onClick={async () => { await fetch("/api/auth/abmelden", { method: "POST" }); location.href = "/login"; }}>Abmelden</button>}
        </section>
        <section className="panel">
          <h2>Ihre Daten</h2>
          <p className="note">Alles, was zu diesem Konto gespeichert ist, als Datei: Profil, Objekte, Annahmen, Expertenergebnisse und eine Liste der Unterlagen. Damit können Sie Ihre Daten prüfen oder mitnehmen.</p>
          <a className="btn ghost" href="/api/konto/export" download>Daten herunterladen (JSON)</a>
          <p className="note"><Link href="/datenschutz">Datenschutzhinweise</Link> · <Link href="/hinweise">Nutzungshinweise</Link> · <Link href="/impressum">Impressum</Link></p>
        </section>
      </div>
      <Zugang />
      <Paketvergleich />
      <section className="panel gefahrzone">
        <h2>Konto löschen</h2>
        {loeschung ? <>
          <p>Die Löschung wurde am {datum(loeschung.beantragt)} beantragt und wird am <b>{datum(loeschung.ausfuehrung)}</b> ausgeführt. Bis dahin können Sie sie abbrechen.</p>
          <div className="row"><button type="button" className="btn" onClick={() => aktion("abbrechen")} disabled={!inhaber}>Löschung abbrechen</button><a className="btn ghost" href="/api/konto/export" download>Daten vorher herunterladen</a></div>
        </> : inhaber ? <>
          <p className="note">Löscht das Konto mit allen Daten und Zugängen. Nach dem Antrag haben Sie 7 Tage, um es abzubrechen; danach ist es endgültig.</p>
          <div className="row"><button type="button" className="btn danger" onClick={beantragen}>Löschung beantragen</button></div>
        </> : <>
          <p className="note">Nur der Inhaber kann das Konto löschen. Sie können Ihren eigenen Zugang aufgeben.</p>
          <div className="row"><button type="button" className="btn danger" onClick={aufgeben}>Zugang aufgeben</button></div>
        </>}
        {ich?.aktiv && inhaber && !loeschung && <p className="note">Nur Ihren eigenen Zugang aufgeben? <button type="button" className="linkbtn" onClick={aufgeben}>Zugang aufgeben</button> (geht, wenn es einen weiteren Inhaber gibt)</p>}
      </section>
    </div>
  );
}
