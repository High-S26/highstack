/** Übersetzt die Skill-Ordner in experts/ in ein TypeScript-Modul, damit App und CLI sie ohne Dateizugriff nutzen. */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "experts");
const qualitaet = readFileSync(join(root, "_qualitaet.md"), "utf8").trim();
const experts = readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory() && existsSync(join(root, d.name, "SKILL.md"))).map(d => {
  const raw = readFileSync(join(root, d.name, "SKILL.md"), "utf8");
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`Frontmatter fehlt in ${d.name}`);
  const meta: Record<string, unknown> = {};
  for (const line of m[1]!.split("\n")) {
    const [k, ...rest] = line.split(":"); const v = rest.join(":").trim();
    meta[k!.trim()] = v.startsWith("[") ? v.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean) : v;
  }
  return { id: String(meta.name), titel: String(meta.titel), rolle: String(meta.rolle), beschreibung: String(meta.beschreibung), werkzeuge: meta.werkzeuge as string[], modell: meta.modell as "expert" | "fast", ausgabe: meta.ausgabe as string, anweisung: m[2]!.trim() };
});
const out = `// Automatisch erzeugt aus packages/agents/experts/*/SKILL.md mit \`npm run experts -w @highstack/agents\`. Nicht von Hand ändern.
export const QUALITAET = ${JSON.stringify(qualitaet)};
export const EXPERTEN_DEFINITIONEN = ${JSON.stringify(experts, null, 2)} as const;
`;
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "experts.generated.ts"), out);
console.log(`${experts.length} Experten übersetzt.`);
