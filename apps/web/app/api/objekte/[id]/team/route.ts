import { neuerVerbrauch, teamlauf, teamlaufNoetig } from "@highstack/agents";
import { ereignisstrom, laufoptionen } from "@/lib/agenten";
import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

/** Teamlauf als Ereignisstrom. Bei Pass ohne Gestaltung/Unterlagen nur mit erzwingen; unveränderte Experten kommen aus dem Speicher. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await req.json().catch(() => ({}))) as { erzwingen?: boolean; neu?: boolean };
  const s = await speicher(); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const p = await s.profil(t);
  return ereignisstrom(async (senden, signal) => {
    const opts = laufoptionen(p, o, signal); const verbrauch = neuerVerbrauch(); const t0 = Date.now();
    if (!body.erzwingen) { const g = teamlaufNoetig(opts); if (!g.noetig) { senden({ typ: "team_uebersprungen", grund: g.grund }); return; } }
    senden({ typ: "team_start", testmodus: opts.testmodus });
    const r = await teamlauf({ ...opts, verbrauch, erzwingen: true, vorhanden: body.neu ? undefined : o.experten, gleichzeitig: Number(process.env.HIGHSTACK_TEAM_CONCURRENCY ?? 3), onEreignis: senden });
    const frisch = (await s.objekt(t, params.id)) ?? o;
    for (const [id, b] of Object.entries(r.berichte)) if ("ergebnis" in b && !b.ausSpeicher) frisch.experten[id] = { ergebnis: b.ergebnis, schritte: b.schritte, am: Date.now(), verlauf: [], hash: b.hash };
    if (r.komitee && !r.komitee.ausSpeicher) frisch.experten.komitee = { ergebnis: r.komitee.ergebnis, schritte: r.komitee.schritte, am: Date.now(), verlauf: [], hash: r.komitee.hash };
    frisch.compliance = r.compliance ?? undefined; frisch.geaendert = Date.now();
    await s.speichereObjekt(t, frisch);
    senden({ typ: "verbrauch", ...verbrauch, ms: Date.now() - t0, ausSpeicher: Object.values(r.berichte).filter(b => "ausSpeicher" in b && b.ausSpeicher).length + (r.komitee?.ausSpeicher ? 1 : 0) });
    senden({ typ: "team_fertig", komitee: r.komitee?.ergebnis ?? null, compliance: r.compliance });
  }, req);
}
