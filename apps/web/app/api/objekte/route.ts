import { mandant, speicher } from "@/lib/speicher";
import type { Objektdatensatz } from "@/lib/typen";
import { neuesObjekt } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { return Response.json(await (await speicher()).objekte(mandant(req))); }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { anlageprofilId?: string; beispiel?: boolean; status?: Objektdatensatz["status"] };
  const s = await speicher(); const t = mandant(req);
  const p = await s.profil(t);
  const o = neuesObjekt(body.anlageprofilId ?? p.aktivesAnlageprofil, !!body.beispiel, body.status ?? "pruefung");
  await s.speichereObjekt(t, o);
  return Response.json(o, { status: 201 });
}
