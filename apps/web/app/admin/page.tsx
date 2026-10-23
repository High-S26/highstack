"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/App";
import { Datenbasis } from "@/components/admin/Datenbasis";
import { Konjunktur } from "@/components/admin/Konjunktur";
import { Marktberichte } from "@/components/admin/Marktberichte";
import { Zahl } from "@/components/Felder";
import type { Einstellungen, Protokolleintrag } from "@/lib/admin";
import { PAKETE, type PaketId } from "@/lib/quellen";

const TABS = [["uebersicht", "Übersicht"], ["konten", "Konten"], ["daten", "Datenbasis"], ["berichte", "Marktberichte"], ["konjunktur", "Konjunktur & Prognosen"], ["mitteilung", "Mitteilung & Preise"], ["protokoll", "Protokoll"]] as const;
type Tab = (typeof TABS)[number][0];
const datum = (t: number | null | undefined) => t ? new Date(t).toLocaleDateString("de-DE") : "–";
const tsd = (n: number) => n.toLocaleString("de-DE");

/** Admin-Bereich: nur für Plattform-Admins. Kunden sehen davon nichts, sie bekommen das Ergebnis. */
export default function AdminSeite() { return <Suspense fallback={<p className="note">Lädt …</p>}><Admin /></Suspense>; }
function Admin() {
  const { admin } = useApp(); const q = useSearchParams(); const router = useRouter();
  const tab = (TABS.find(([k]) => k === q.get("tab"))?.[0] ?? "uebersicht") as Tab;
  if (!admin) return <div className="view"><h1>Admin</h1><p className="note">Dieser Bereich ist nur für Plattform-Admins.</p></div>;
  return (
    <div className="view">
      <div className="start-kopf"><h1>Admin</h1><p className="lead">Datenbasis, Konten und Betrieb. Nutzer sehen hiervon nur das Ergebnis.</p></div>
      <nav className="tabs" role="tablist" aria-label="Admin">{TABS.map(([k, l]) => <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => router.replace(`/admin?tab=${k}`)}>{l}</button>)}</nav>
      {tab === "uebersicht" && <Uebersicht />}
      {tab === "konten" && <Konten />}
      {tab === "daten" && <Datenbasis />}
      {tab === "berichte" && <Marktberichte />}
      {tab === "konjunktur" && <Konjunktur />}
      {tab === "mitteilung" && <Mitteilung />}
      {tab === "protokoll" && <Protokoll />}
    </div>
  );
}

type Ue = { konten: number; nutzer: number; objekte: number; aktiv30: number; loeschantraege: { tenant: string; ausfuehrung: number }[]; verbrauch: { monat: string; aufrufe: number; input: number; output: number; kosten: number | null }; daten: { mietspiegel: { geprueft: number; entwurf: number; ablaufend: { id: string; stadt: string; gueltigBis: string }[] }; marktberichte: { geprueft: number; entwurf: number; neuester: string | null }; anfragen: number }; system: Record<string, string | boolean> };
function Uebersicht() {
  const [d, setD] = useState<Ue | null>(null);
  useEffect(() => { fetch("/api/admin/uebersicht").then(r => r.json()).then(setD); }, []);
  if (!d) return <p className="note">Lädt …</p>;
  const aufgaben: [string, string][] = [
    ...d.daten.mietspiegel.ablaufend.map(m => [`Mietspiegel ${m.stadt} läuft am ${new Date(m.gueltigBis).toLocaleDateString("de-DE")} ab: Nachfolger erfassen`, `/admin/mietspiegel/${m.id}`] as [string, string]),
    ...(d.daten.mietspiegel.entwurf ? [[`${d.daten.mietspiegel.entwurf} Mietspiegel-Entwurf prüfen und freigeben`, "/admin?tab=daten"] as [string, string]] : []),
    ...(d.daten.marktberichte.entwurf ? [[`${d.daten.marktberichte.entwurf} Marktbericht-Entwurf prüfen`, "/admin?tab=berichte"] as [string, string]] : []),
    ...(d.daten.anfragen ? [[`${d.daten.anfragen} offene Nachfrage nach fehlenden Daten`, "/admin?tab=daten"] as [string, string]] : []),
    ...d.loeschantraege.map(l => [`Löschantrag Konto ${l.tenant}: Ausführung ${datum(l.ausfuehrung)}`, "/admin?tab=konten"] as [string, string]),
    ...(!d.daten.marktberichte.geprueft ? [["Noch kein Marktbericht freigegeben: Marktszenarien laufen mit Standardannahmen", "/admin?tab=berichte"] as [string, string]] : []),
  ];
  const sys = d.system;
  return (
    <>
      <div className="tiles">{([["Konten", tsd(d.konten)], ["aktiv (30 Tage)", tsd(d.aktiv30)], ["Nutzer", tsd(d.nutzer)], ["Objekte", tsd(d.objekte)], [`KI-Aufrufe ${d.verbrauch.monat}`, tsd(d.verbrauch.aufrufe)], [d.verbrauch.kosten == null ? "KI-Kosten (Preise fehlen)" : "KI-Kosten (geschätzt)", d.verbrauch.kosten == null ? "–" : `${d.verbrauch.kosten.toLocaleString("de-DE", { maximumFractionDigits: 2 })} $`]] as const).map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>
      <div className="two">
        <section className="panel"><h2>Zu tun</h2>
          {aufgaben.length ? <div className="todo">{aufgaben.map(([t, h]) => <div key={t}><span>{t}</span><Link className="btn ghost sm" href={h}>Öffnen</Link></div>)}</div> : <p className="note">Nichts offen.</p>}
        </section>
        <section className="panel"><h2>Datenbasis</h2>
          <div className="todo">
            <div><span>Mietspiegel</span><b>{d.daten.mietspiegel.geprueft} freigegeben · {d.daten.mietspiegel.entwurf} Entwurf</b></div>
            <div><span>Marktberichte</span><b>{d.daten.marktberichte.geprueft} freigegeben{d.daten.marktberichte.neuester ? ` · neuester ${d.daten.marktberichte.neuester}` : ""}</b></div>
            <div><span>Nachfrage offen</span><b>{d.daten.anfragen}</b></div>
          </div>
        </section>
      </div>
      <section className="panel"><h2>System</h2>
        <div className="sys">{([["Version", String(sys.version)], ["Speicher", String(sys.speicher)], ["Anmeldung", sys.anmeldung ? "an" : "aus (lokal)"], ["Mailversand", sys.mail ? "eingerichtet" : "fehlt (SMTP_URL)"], ["KI", sys.ki ? "aktiv" : "Testmodus (ANTHROPIC_API_KEY)"], ["Rechtstexte", sys.rechtstexte ? "freigegeben" : "Entwurf"]] as const).map(([l, v]) => <div key={l} className={/fehlt|Testmodus|Entwurf|aus/.test(v) ? "warn" : "ok"}><span>{l}</span><b>{v}</b></div>)}</div>
      </section>
    </>
  );
}

type Konto = { tenant: string; objekte: number; geaendert: number | null; paket: PaketId; loeschung: { ausfuehrung: number } | null; onboarded: boolean; nutzer: { email: string; rolle: string; letzterLogin: number | null; plattformAdmin: boolean; gesperrt: boolean }[]; verbrauch: { aufrufe: number; inputTokens: number; outputTokens: number } | null };
function Konten() {
  const { frage, meldung } = useApp(); const [l, setL] = useState<Konto[] | null>(null); const [filter, setFilter] = useState("");
  const lade = useCallback(() => fetch("/api/admin/konten").then(r => r.json()).then(setL), []);
  useEffect(() => { lade(); }, [lade]);
  const aktion = async (b: object, text: string) => { const r = await fetch("/api/admin/konten", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); const d = await r.json(); if (!r.ok) meldung(d.fehler); else { meldung(text); lade(); } };
  if (!l) return <p className="note">Lädt …</p>;
  const f = filter.trim().toLowerCase(); const liste = l.filter(k => !f || k.tenant.includes(f) || k.nutzer.some(n => n.email.includes(f)));
  return (
    <section className="panel">
      <div className="ph"><h2>Konten</h2><input type="search" className="filter" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Konto oder E-Mail" aria-label="Filtern" style={{ maxWidth: 260 }} /></div>
      <p className="note">Kennzahlen und Zugänge. Objekte und Unterlagen der Kunden sind hier bewusst nicht einsehbar.</p>
      <div className="tbl"><table><thead><tr><th>Konto</th><th>Nutzer</th><th className="num">Objekte</th><th>zuletzt</th><th className="num">KI diesen Monat</th><th>Paket</th><th /></tr></thead><tbody>
        {liste.map(k => { const gesperrt = k.nutzer.length > 0 && k.nutzer.every(n => n.gesperrt); return (
          <tr key={k.tenant}>
            <td><b>{k.tenant}</b>{k.loeschung && <span className="tag warnt"> Löschung {datum(k.loeschung.ausfuehrung)}</span>}{gesperrt && <span className="tag warnt"> gesperrt</span>}</td>
            <td>{k.nutzer.length ? k.nutzer.map(n => <div key={n.email} className="kn"><span>{n.email}</span><span className="note">{n.rolle}{n.plattformAdmin ? " · Admin" : ""}{n.letzterLogin ? ` · ${datum(n.letzterLogin)}` : ""}</span>
              <button type="button" className="linkbtn" onClick={async () => { if (await frage({ titel: n.plattformAdmin ? "Admin-Rolle entziehen?" : "Zum Plattform-Admin machen?", text: n.plattformAdmin ? `${n.email} verliert den Zugang zum Admin-Bereich.` : `${n.email} kann Datenbasis, Marktberichte und Konten verwalten.`, ja: n.plattformAdmin ? "Entziehen" : "Admin machen", gefahr: !n.plattformAdmin })) aktion({ aktion: n.plattformAdmin ? "kein-admin" : "admin", email: n.email }, "Rolle geändert"); }}>{n.plattformAdmin ? "Admin entziehen" : "zum Admin"}</button></div>) : <span className="note">ohne Anmeldung</span>}</td>
            <td className="num">{k.objekte}</td><td>{datum(k.geaendert)}</td><td className="num">{k.verbrauch ? `${tsd(k.verbrauch.aufrufe)} Aufrufe` : "–"}</td>
            <td><select value={k.paket} onChange={e => aktion({ aktion: "paket", tenant: k.tenant, paket: e.target.value }, "Paket geändert")} aria-label={`Paket ${k.tenant}`}>{PAKETE.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></td>
            <td>{k.nutzer.length > 0 && <button type="button" className={`btn sm ${gesperrt ? "ghost" : "danger"}`} onClick={async () => { if (gesperrt || await frage({ titel: `Konto ${k.tenant} sperren?`, text: "Alle Nutzer dieses Kontos verlieren sofort den Zugang. Daten bleiben erhalten.", ja: "Sperren", gefahr: true })) aktion({ aktion: gesperrt ? "entsperren" : "sperren", tenant: k.tenant }, gesperrt ? "Konto entsperrt" : "Konto gesperrt"); }}>{gesperrt ? "Entsperren" : "Sperren"}</button>}</td>
          </tr>); })}
      </tbody></table></div>
    </section>
  );
}

function Mitteilung() {
  const { meldung } = useApp(); const [e, setE] = useState<Einstellungen | null>(null); const [text, setText] = useState(""); const [art, setArt] = useState<"info" | "warn">("info");
  useEffect(() => { fetch("/api/admin/uebersicht").then(r => r.json()).then(d => { setE(d.einstellungen); setText(d.einstellungen.ankuendigung?.text ?? ""); setArt(d.einstellungen.ankuendigung?.art ?? "info"); }); }, []);
  const speichere = async (b: Einstellungen, t: string) => { const r = await fetch("/api/admin/einstellungen", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); setE(await r.json()); meldung(t); };
  if (!e) return <p className="note">Lädt …</p>;
  const aktiv = !!e.ankuendigung?.aktiv;
  return (
    <div className="two">
      <section className="panel">
        <div className="ph"><h2>Mitteilung an alle Nutzer</h2><span className={`badge ${aktiv ? "b-on" : "b-plan"}`}>{aktiv ? "sichtbar" : "aus"}</span></div>
        <p className="note">Erscheint als Band oben in der App, bis der Nutzer es ausblendet. Für Wartung, neue Funktionen oder neue Marktdaten.</p>
        <div className="fld"><label htmlFor="an-t">Text</label><textarea id="an-t" maxLength={400} value={text} onChange={x => setText(x.target.value)} placeholder="z. B. Neu: Marktlage mit dem Colliers City Survey Q3 2026" /></div>
        <div className="chips">{(["info", "warn"] as const).map(a => <button key={a} type="button" className="chip" aria-pressed={art === a} onClick={() => setArt(a)}>{a === "info" ? "Hinweis" : "Wichtig"}</button>)}</div>
        <div className="row"><button type="button" className="btn" disabled={!text.trim()} onClick={() => speichere({ ankuendigung: { text, art, aktiv: true, am: Date.now() } }, "Mitteilung veröffentlicht")}>Veröffentlichen</button>
          {aktiv && <button type="button" className="btn ghost" onClick={() => speichere({ ankuendigung: { ...e.ankuendigung!, aktiv: false } }, "Mitteilung beendet")}>Beenden</button>}</div>
      </section>
      <section className="panel">
        <h2>KI-Preise für die Kostenschätzung</h2>
        <p className="note">Aktuelle Preise je Million Tokens laut Anbieter eintragen. Ohne Werte zeigt die Übersicht nur Aufrufe.</p>
        <div className="fields">
          <Zahl label="Eingabe" einheit="$ / Mio." wert={e.preisInputMio ?? null} onChange={v => setE({ ...e, preisInputMio: v ?? undefined })} />
          <Zahl label="Ausgabe" einheit="$ / Mio." wert={e.preisOutputMio ?? null} onChange={v => setE({ ...e, preisOutputMio: v ?? undefined })} />
        </div>
        <button type="button" className="btn ghost" onClick={() => speichere({ preisInputMio: e.preisInputMio, preisOutputMio: e.preisOutputMio }, "Preise gespeichert")}>Speichern</button>
      </section>
    </div>
  );
}

function Protokoll() {
  const [l, setL] = useState<Protokolleintrag[] | null>(null);
  useEffect(() => { fetch("/api/admin/protokoll").then(r => r.json()).then(setL); }, []);
  if (!l) return <p className="note">Lädt …</p>;
  return (
    <section className="panel"><div className="ph"><h2>Protokoll</h2><span className="tag">letzte {l.length} Änderungen</span></div>
      {l.length ? <div className="tbl"><table><thead><tr><th>Wann</th><th>Wer</th><th>Was</th><th>Betrifft</th></tr></thead><tbody>
        {l.map(e => <tr key={e.id}><td>{new Date(e.am).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</td><td>{e.wer}</td><td>{e.was}{e.details && <span className="note"> · {e.details}</span>}</td><td>{e.ziel ?? "–"}</td></tr>)}
      </tbody></table></div> : <div className="empty">Noch keine Einträge.</div>}
    </section>
  );
}
