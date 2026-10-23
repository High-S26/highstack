import { speicher } from "@/lib/speicher";
import { leererMietspiegel, type Mietspiegel } from "@/lib/mietspiegel";
import { darfDatenPflegen, nutzerVon } from "@/lib/datenrechte";
import { id as neueId } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await speicher(req);
  return Response.json({ liste: await s.mietspiegel(), darfPflegen: darfDatenPflegen(req) });
}

export async function POST(req: Request) {
  if (!darfDatenPflegen(req)) return Response.json({ fehler: "Nur Datenverantwortliche dürfen Mietspiegel anlegen." }, { status: 403 });
  const s = await speicher(req); const b = (await req.json().catch(() => ({}))) as Partial<Mietspiegel>;
  const m: Mietspiegel = { ...leererMietspiegel(neueId(), b.stadt ?? ""), ...b, id: neueId(), status: "entwurf", erfasst: Date.now(), geaendert: Date.now(), erfasstVon: nutzerVon(req) };
  await s.speichereMietspiegel(m);
  return Response.json(m);
}
