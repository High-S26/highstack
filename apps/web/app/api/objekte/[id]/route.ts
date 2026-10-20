import { mandant, speicher } from "@/lib/speicher";
import type { Objektdatensatz } from "@/lib/typen";
export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };
export async function GET(req: Request, { params }: Ctx) {
  const o = await (await speicher()).objekt(mandant(req), params.id);
  return o ? Response.json(o) : Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
}
/** Teilweise Aktualisierung: nur Nutzerfelder; Expertenergebnisse schreibt der Server. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await speicher(); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const patch = (await req.json()) as Partial<Objektdatensatz>;
  const erlaubt: (keyof Objektdatensatz)[] = ["status", "anlageprofilId", "suchId", "objekt", "szenario", "module", "expose", "dokumente"];
  const neu = { ...o } as Objektdatensatz;
  for (const k of erlaubt) if (k in patch) (neu as unknown as Record<string, unknown>)[k] = patch[k];
  neu.geaendert = Date.now();
  await s.speichereObjekt(t, neu);
  return Response.json(neu);
}
export async function DELETE(req: Request, { params }: Ctx) {
  await (await speicher()).loescheObjekt(mandant(req), params.id);
  return new Response(null, { status: 204 });
}
