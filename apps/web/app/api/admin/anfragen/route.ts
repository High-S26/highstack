import { speicher } from "@/lib/speicher";
import { istAdmin, keinAdmin, protokolliere } from "@/lib/admin";
import type { Anfrage } from "@/lib/anfragen";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  return Response.json((await s.global<Anfrage>("anfrage")).sort((a, b) => Number(!!a.erledigt) - Number(!!b.erledigt) || b.konten.length - a.konten.length || b.anzahl - a.anzahl));
}
/** Als erledigt markieren oder wieder öffnen */
export async function PUT(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const { id, erledigt } = (await req.json()) as { id: string; erledigt: boolean };
  const a = await s.globalEins<Anfrage>("anfrage", id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  await s.speichereGlobal("anfrage", id, { ...a, erledigt: erledigt ? Date.now() : undefined }); await protokolliere(s, req, erledigt ? "Anfrage erledigt" : "Anfrage geöffnet", a.ziel);
  return Response.json({ ok: true });
}
