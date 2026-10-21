import { mandant, speicher } from "@/lib/speicher";
import type { Objekt } from "@highstack/engine";
import type { Objektdatensatz } from "@/lib/typen";
import { neuesObjekt, standardDokumente } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { return Response.json(await (await speicher(req)).objekte(mandant(req))); }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { anlageprofilId?: string; beispiel?: boolean; status?: Objektdatensatz["status"]; objekt?: Partial<Objekt>; expose?: string };
  const s = await speicher(req); const t = mandant(req);
  const p = await s.profil(t);
  const o = neuesObjekt(body.anlageprofilId ?? p.aktivesAnlageprofil, !!body.beispiel, body.status ?? "pruefung");
  if (body.objekt) { o.objekt = { ...o.objekt, ...body.objekt }; o.dokumente = standardDokumente(o.objekt.asset); }
  if (body.expose) o.expose = body.expose.slice(0, 20000);
  await s.speichereObjekt(t, o);
  return Response.json(o, { status: 201 });
}
