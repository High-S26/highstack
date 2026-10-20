import { teamlauf } from "@highstack/agents";
import { ereignisstrom, laufoptionen } from "@/lib/agenten";
import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** Teamlauf als Ereignisstrom; Ergebnisse werden am Objekt gespeichert. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const p = await s.profil(t);
  return ereignisstrom(async (senden, signal) => {
    const opts = laufoptionen(p, o, signal);
    senden({ typ: "team_start", testmodus: opts.testmodus });
    const r = await teamlauf({ ...opts, gleichzeitig: Number(process.env.HIGHSTACK_TEAM_CONCURRENCY ?? 3), onEreignis: senden });
    const frisch = (await s.objekt(t, params.id)) ?? o;
    for (const [id, b] of Object.entries(r.berichte)) if ("ergebnis" in b) frisch.experten[id] = { ergebnis: b.ergebnis, schritte: b.schritte, am: Date.now(), verlauf: [] };
    if (r.komitee) frisch.experten.komitee = { ergebnis: r.komitee.ergebnis, schritte: r.komitee.schritte, am: Date.now(), verlauf: [] };
    frisch.compliance = r.compliance ?? undefined; frisch.geaendert = Date.now();
    await s.speichereObjekt(t, frisch);
    senden({ typ: "team_fertig", komitee: r.komitee?.ergebnis ?? null, compliance: r.compliance });
  }, req);
}
