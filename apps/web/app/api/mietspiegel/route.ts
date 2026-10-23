import { speicher } from "@/lib/speicher";
import { leererMietspiegel, type Mietspiegel } from "@/lib/mietspiegel";
import { istAdmin, keinAdmin, protokolliere, werIst as nutzerVon } from "@/lib/admin";
import { id as neueId } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await speicher(req);
  return Response.json({ liste: await s.mietspiegel(), darfPflegen: await istAdmin(req, s) });
}

export async function POST(req: Request) {
  if (!await istAdmin(req, await speicher(req))) return keinAdmin();
  const s = await speicher(req); const b = (await req.json().catch(() => ({}))) as Partial<Mietspiegel>;
  const m: Mietspiegel = { ...leererMietspiegel(neueId(), b.stadt ?? ""), ...b, id: neueId(), status: "entwurf", erfasst: Date.now(), geaendert: Date.now(), erfasstVon: nutzerVon(req) };
  await s.speichereMietspiegel(m); await protokolliere(s, req, "Mietspiegel angelegt", m.stadt);
  return Response.json(m);
}
