import type { ReactNode } from "react";
/** Rahmen für Rechtstexte. Solange nicht freigegeben, steht ein Entwurfshinweis darüber. */
export function Rechtstext({ titel, stand, children }: { titel: string; stand: string; children: ReactNode }) {
  const frei = process.env.NEXT_PUBLIC_RECHTSTEXTE_FREIGEGEBEN === "1";
  return (
    <article className="view recht">
      {!frei && <div className="testband warnband">Entwurf: Platzhalter in eckigen Klammern ausfüllen und vor der Veröffentlichung rechtlich prüfen lassen. Danach NEXT_PUBLIC_RECHTSTEXTE_FREIGEGEBEN=1 setzen.</div>}
      <h1>{titel}</h1>
      <p className="note">Stand: {stand}</p>
      {children}
    </article>
  );
}
