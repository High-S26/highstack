"use client";
import { analyse, type Analyse, type Anlageprofil } from "@highstack/engine";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/client";
import type { Objektdatensatz, Profil } from "@/lib/typen";
import { neueSuche } from "@/lib/vorgaben";

interface AppZustand {
  profil: Profil | null;
  objekte: Objektdatensatz[];
  testmodus: boolean;
  setzeProfil: (p: Profil) => void;
  ladeObjekte: () => Promise<void>;
  setzeObjekt: (o: Objektdatensatz) => void;
  entferneObjekt: (id: string) => void;
  anlageprofil: (id?: string) => Anlageprofil;
  analyseVon: (o: Objektdatensatz) => Analyse;
  meldung: (t: string) => void;
  /** Entfernt sofort aus der Ansicht; gelöscht wird erst, wenn „Rückgängig“ nicht gedrückt wurde. */
  loesche: (ids: string[], text: string, danach?: () => void) => void;
  /** Meldung mit Aktion, z. B. Rückgängig */
  meldungMitAktion: (t: string, aktion: string, tun: () => void, ablauf?: () => void) => void;
}
const Ctx = createContext<AppZustand | null>(null);
export const useApp = () => { const c = useContext(Ctx); if (!c) throw new Error("useApp außerhalb von App"); return c; };

const NAV = [
  ["/", "Übersicht", "M3 9.5 10 3.5l7 6V17h-4.5v-4.5h-5V17H3z"],
  ["/suchen", "Suchen", "M8.5 3.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12.5 12.5 17 17"],
  ["/pruefen", "Prüfen", "M5.5 3.5h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2M7 10l2.2 2.2L13.5 8"],
  ["/portfolio", "Portfolio", "M4.5 7h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7M7.5 7V4.5h5V7"],
  ["/experten", "Experten", "M7 4.4a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 1 0 0-5.2M13.5 5.3a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4M2.5 16.5c.4-2.8 2.2-4.2 4.5-4.2s4.1 1.4 4.5 4.2M12 12.4c2.6-.3 4.9.9 5.5 4.1"],
  ["/profil", "Profil", "M10 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6M4 17c.5-3 3-4.8 6-4.8s5.5 1.8 6 4.8"],
] as const;

export function App({ children }: { children: ReactNode }) {
  const [profil, setProfil] = useState<Profil | null>(null);
  const [objekte, setObjekte] = useState<Objektdatensatz[]>([]);
  const [testmodus, setTestmodus] = useState(false);
  const [toast, setToast] = useState<{ text: string; aktion?: string; tun?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(); const ablaufRef = useRef<(() => void) | null>(null);
  const objekteRef = useRef<Objektdatensatz[]>([]);
  const pfad = usePathname(); const router = useRouter();
  const speicherTimer = useRef<ReturnType<typeof setTimeout>>();

  const [ich, setIch] = useState<{ aktiv: boolean; email?: string; rolle?: string } | null>(null);
  const login = pfad === "/login";
  useEffect(() => { if (!login) fetch("/api/auth/ich").then(r => r.status === 401 ? (location.href = "/login", null) : r.json()).then(d => d && setIch(d)).catch(() => undefined); }, [login]);
  const abmelden = async () => { await fetch("/api/auth/abmelden", { method: "POST" }); location.href = "/login"; };
  useEffect(() => { if (login) return; Promise.all([api.profil(), api.objekte(), api.status()]).then(([p, o, s]) => {
    // Bestehende Daten ohne Suchaufträge: je Anlageprofil einen anlegen und Kandidaten zuordnen.
    if (!p.suchen) {
      p.suchen = p.anlageprofile.map(ap => ({ ...neueSuche({ ...p, aktivesAnlageprofil: ap.id }), name: ap.name }));
      for (const x of o) if (x.status === "kandidat" && !x.suchId) { const su = p.suchen.find(q => q.anlageprofilId === x.anlageprofilId); if (su) { x.suchId = su.id; api.aendereObjekt(x.id, { suchId: su.id }); } }
      api.speichereProfil(p);
    }
    setProfil(p); setObjekte(o); setTestmodus(s.testmodus);
  }).catch(e => setToast({ text: e.message })); }, [login]);
  objekteRef.current = objekte;
  useEffect(() => { if (profil && !profil.onboarded && pfad !== "/start") router.replace("/start"); }, [profil, pfad, router]);
  const schliesseToast = useCallback(() => { clearTimeout(toastTimer.current); const f = ablaufRef.current; ablaufRef.current = null; f?.(); setToast(null); }, []);
  const meldung = useCallback((t: string) => { schliesseToast(); setToast({ text: t }); toastTimer.current = setTimeout(() => setToast(null), 3500); }, [schliesseToast]);
  const meldungMitAktion = useCallback((t: string, aktion: string, tun: () => void, ablauf?: () => void) => {
    schliesseToast(); ablaufRef.current = ablauf ?? null;
    setToast({ text: t, aktion, tun: () => { clearTimeout(toastTimer.current); ablaufRef.current = null; tun(); setToast(null); } });
    toastTimer.current = setTimeout(schliesseToast, 6000);
  }, [schliesseToast]);
  // Ausstehende Löschungen beim Schließen des Tabs noch abschicken
  useEffect(() => { const f = () => { const a = ablaufRef.current; ablaufRef.current = null; a?.(); }; window.addEventListener("pagehide", f); return () => window.removeEventListener("pagehide", f); }, []);

  const setzeProfil = useCallback((p: Profil) => {
    setProfil(p); clearTimeout(speicherTimer.current);
    speicherTimer.current = setTimeout(() => api.speichereProfil(p).catch(() => meldung("Profil konnte nicht gespeichert werden.")), 600);
  }, [meldung]);
  const ladeObjekte = useCallback(async () => setObjekte(await api.objekte()), []);
  const setzeObjekt = useCallback((o: Objektdatensatz) => setObjekte(l => { const i = l.findIndex(x => x.id === o.id); return i < 0 ? [o, ...l] : l.map(x => x.id === o.id ? o : x); }), []);
  const entferneObjekt = useCallback((id: string) => setObjekte(l => l.filter(x => x.id !== id)), []);
  const loesche = useCallback((ids: string[], text: string, danach?: () => void) => {
    const weg = objekteRef.current.filter(x => ids.includes(x.id));
    setObjekte(l => l.filter(x => !ids.includes(x.id))); danach?.();
    meldungMitAktion(text, "Rückgängig", () => setObjekte(l => [...weg, ...l.filter(x => !ids.includes(x.id))]), () => { for (const i of ids) fetch(`/api/objekte/${i}`, { method: "DELETE", keepalive: true }); });
  }, [meldungMitAktion]);
  const anlageprofil = useCallback((id?: string) => { const l = profil!.anlageprofile; return l.find(a => a.id === (id ?? profil!.aktivesAnlageprofil)) ?? l[0]!; }, [profil]);
  const analyseVon = useCallback((o: Objektdatensatz) => analyse({ investor: profil!.investor, anlageprofil: anlageprofil(o.anlageprofilId), objekt: o.objekt, szenario: o.szenario, module: o.module }), [profil, anlageprofil]);

  const wert = useMemo<AppZustand>(() => ({ profil, objekte, testmodus, setzeProfil, ladeObjekte, setzeObjekt, entferneObjekt, anlageprofil, analyseVon, meldung, loesche, meldungMitAktion }), [profil, objekte, testmodus, setzeProfil, ladeObjekte, setzeObjekt, entferneObjekt, anlageprofil, analyseVon, meldung, loesche, meldungMitAktion]);
  const aktiv = (href: string) => href === "/" ? pfad === "/" : pfad.startsWith(href) || (href === "/pruefen" && pfad.startsWith("/objekt"));

  if (login) return <>{children}</>;
  return (
    <Ctx.Provider value={wert}>
      <div className="wrap">
        <div className="appbar">
          <Link href="/" className="brand" aria-label="highstack, zur Übersicht">high<span>stack</span></Link>
          {profil?.onboarded && <nav className="nav" aria-label="Hauptnavigation">
            {NAV.map(([href, label, d]) => <Link key={href} href={href} className="navb" aria-current={aktiv(href) ? "page" : undefined}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={d} /></svg>{label}</Link>)}
          </nav>}
          <div className="who">{ich?.aktiv ? <><span title={ich.rolle === "inhaber" ? "Inhaber" : "Mitglied"}>{ich.email}</span><button type="button" className="btn ghost sm" onClick={abmelden}>Abmelden</button></> : <span>{testmodus ? "Testmodus" : "Lokal"}</span>}</div>
        </div>
        {testmodus && <div className="testband"><b>Testmodus.</b> Alle Berechnungen laufen, die Experten liefern Platzhalter. Für echte Einschätzungen ANTHROPIC_API_KEY in .env eintragen.</div>}
        {profil ? children : <p className="note">Lädt …</p>}
        <footer>highstack.si dient ausschließlich der Information und fundierten Aufklärung. Die Berechnungen beruhen auf Ihren Annahmen und vereinfachten Modellen. Sie ersetzen keine Anlage-, Finanzierungs-, Steuer- oder Rechtsberatung im Einzelfall.</footer>
      </div>
      {toast && <div className="toast" role="status"><span>{toast.text}</span>{toast.aktion && <button type="button" onClick={toast.tun}>{toast.aktion}</button>}</div>}
    </Ctx.Provider>
  );
}
