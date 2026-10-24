import { mandant, speicher } from "@/lib/speicher";
import type { Objektdatensatz } from "@/lib/typen";
import { normalisiere, pruefeObjekt } from "@/lib/objektpruefung";
export const dynamic = "force-dynamic";
type Ctx = { params: { id: string } };
export async function GET(req: Request, { params }: Ctx) {
  const o = await (await speicher(req)).objekt(mandant(req), params.id);
  return o ? Response.json(o) : Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
}
/** Teilweise Aktualisierung: nur Nutzerfelder; Expertenergebnisse schreibt der Server. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await speicher(req); const t = mandant(req);
  const o = await s.objekt(t, params.id); if (!o) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const patch = (await req.json().catch(() => null)) as Partial<Objektdatensatz> | null;
  if (!patch || typeof patch !== "object") return Response.json({ fehler: "Ungültige Anfrage" }, { status: 400 });
  if (patch.objekt) { const f = pruefeObjekt(patch.objekt); if (f.length) return Response.json({ fehler: f.join(" "), felder: f }, { status: 400 }); patch.objekt = normalisiere(patch.objekt) as Objektdatensatz["objekt"]; }
  const erlaubt: (keyof Objektdatensatz)[] = ["status", "anlageprofilId", "suchId", "besucht", "objekt", "szenario", "module", "expose", "dokumente"];
  const neu = { ...o } as Objektdatensatz;
  for (const k of erlaubt) if (k in patch) (neu as unknown as Record<string, unknown>)[k] = patch[k];
  neu.geaendert = Date.now();
  await s.speichereObjekt(t, neu);
  return Response.json(neu);
}
export async function DELETE(req: Request, { params }: Ctx) {
  await (await speicher(req)).loescheObjekt(mandant(req), params.id);
  return new Response(null, { status: 204 });
}
