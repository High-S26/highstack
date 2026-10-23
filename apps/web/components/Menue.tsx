"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const MENUE: [string, string, string, string][] = [
  ["/", "Start", "Investments oder Trading", "M3 9.5 10 3.5l7 6V17h-4.5v-4.5h-5V17H3z"],
  ["/investments", "Investments", "Übersicht und nächste Schritte", "M3.5 9 10 3.5 16.5 9M5 8v9h10V8M8.5 17v-4h3v4"],
  ["/suchen", "Suchaufträge", "Was und wo Sie suchen, Treffer", "M8.5 3.5a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12.5 12.5 17 17"],
  ["/pruefen", "Prüfungen", "Objekte in Prüfung", "M5.5 3.5h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2M7 10l2.2 2.2L13.5 8"],
  ["/portfolio", "Portfolio", "Bestand und Vermögen", "M4.5 7h11a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7M7.5 7V4.5h5V7"],
  ["/trading", "Trading", "Agenten, Positionen, Protokoll", "M3 14.5 7.5 10l3 3L17 6.5M12.5 6.5H17V11"],
  ["/experten", "Experten", "Team, Rollen, an und aus", "M7 4.4a2.6 2.6 0 1 0 0 5.2a2.6 2.6 0 1 0 0-5.2M13.5 5.3a2.2 2.2 0 1 0 0 4.4a2.2 2.2 0 1 0 0-4.4M2.5 16.5c.4-2.8 2.2-4.2 4.5-4.2s4.1 1.4 4.5 4.2M12 12.4c2.6-.3 4.9.9 5.5 4.1"],
  ["/profil", "Profil", "Kapital, Anlageprofile, Rahmen", "M10 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6M4 17c.5-3 3-4.8 6-4.8s5.5 1.8 6 4.8"],
  ["/konto", "Konto", "Zugang, Paket, Export", "M10 2.5l6 2.5v4.5c0 3.8-2.6 6.6-6 8-3.4-1.4-6-4.2-6-8V5z"],
];
export const aktivPfad = (pfad: string, href: string) => href === "/" ? pfad === "/" : href === "/investments" ? pfad === "/investments" : pfad === href || pfad.startsWith(href + "/") || (href === "/pruefen" && pfad.startsWith("/objekt"));

/** Menü: alles außer den beiden Haupteinstiegen. Escape, Klick daneben oder Seitenwechsel schließt. */
const ADMIN: [string, string, string, string] = ["/admin", "Admin", "Datenbasis, Konten, Betrieb", "M10 2.5l6 2.5v4.5c0 3.8-2.6 6.6-6 8-3.4-1.4-6-4.2-6-8V5zM7.5 10l1.8 1.8L13 8"];
export function Menue({ admin = false }: { admin?: boolean }) {
  const [offen, setOffen] = useState(false); const pfad = usePathname(); const ref = useRef<HTMLDivElement>(null); const knopf = useRef<HTMLButtonElement>(null);
  useEffect(() => setOffen(false), [pfad]);
  useEffect(() => {
    if (!offen) return;
    const zu = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent) { if (e.key === "Escape") { setOffen(false); knopf.current?.focus(); } } else if (!ref.current?.contains(e.target as Node)) setOffen(false); };
    document.addEventListener("mousedown", zu); document.addEventListener("keydown", zu);
    ref.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => { document.removeEventListener("mousedown", zu); document.removeEventListener("keydown", zu); };
  }, [offen]);
  const aktuell = [...MENUE, ADMIN].find(([h]) => aktivPfad(pfad, h));
  return (
    <div className="menue" ref={ref}>
      <button ref={knopf} type="button" className="menue-b" aria-expanded={offen} aria-controls="hauptmenue" onClick={() => setOffen(o => !o)}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{offen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />}</svg>
        <span>{aktuell && aktuell[0] !== "/" ? aktuell[1] : "Menü"}</span>
      </button>
      {offen && <nav id="hauptmenue" className="menue-p" aria-label="Hauptmenü">
        {[...MENUE, ...(admin ? [ADMIN] : [])].map(([href, l, s, d]) => <Link key={href} href={href} aria-current={aktivPfad(pfad, href) ? "page" : undefined}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d={d} /></svg><span><b>{l}</b><small>{s}</small></span></Link>)}
      </nav>}
    </div>
  );
}
