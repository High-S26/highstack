import Link from "next/link";

export const metadata = { title: "Seite nicht gefunden · highstack" };

/** Deutsche 404-Seite mit Weg zurück */
export default function NichtGefunden() {
  return (
    <div className="view"><div className="empty">
      <b>Seite nicht gefunden</b>
      <span>Der Link ist veraltet oder vertippt.</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}><Link className="btn" href="/">Zur Übersicht</Link><Link className="btn ghost" href="/investments">Investments</Link><Link className="btn ghost" href="/trading">Trading</Link></div>
    </div></div>
  );
}
