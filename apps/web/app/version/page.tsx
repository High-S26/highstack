import { NEUERUNGEN, versionText } from "@/lib/version";
export const metadata = { title: "Neuerungen · highstack" };
export default function Version() {
  return (
    <article className="view recht">
      <h1>Neuerungen</h1>
      <p className="note">{versionText()}</p>
      {NEUERUNGEN.map(n => <section key={n.version}><h2>Version {n.version}: {n.titel}</h2><ul>{n.punkte.map(p => <li key={p}>{p}</li>)}</ul></section>)}
    </article>
  );
}
