import { mandant, speicher } from "@/lib/speicher";
import type { Objekt } from "@highstack/engine";
import type { Objektdatensatz } from "@/lib/typen";
import { neuesObjekt, standardDokumente } from "@/lib/vorgaben";
import { bereinige } from "@/lib/objektpruefung";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { return Response.json(await (await speicher(req)).objekte(mandant(req))); }
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { anlageprofilId?: string; beispiel?: boolean; status?: Objektdatensatz["status"]; objekt?: Partial<Objekt>; expose?: string };
  const s = await speicher(req); const t = mandant(req);
  const p = await s.profil(t);
  const o = neuesObjekt(body.anlageprofilId ?? p.aktivesAnlageprofil, !!body.beispiel, body.status ?? "pruefung");
  let verworfen: string[] = [];
  if (body.objekt && typeof body.objekt === "object") { const b = bereinige(body.objekt as Record<string, unknown>); verworfen = b.verworfen; o.objekt = { ...o.objekt, ...b.objekt }; o.dokumente = standardDokumente(o.objekt.asset); }
  if (body.expose) o.expose = body.expose.slice(0, 20000);
  await s.speichereObjekt(t, o);
  return Response.json(verworfen.length ? { ...o, hinweise: verworfen } : o, { status: 201 });
}
