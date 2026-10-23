import { speicher } from "@/lib/speicher";
import { istAdmin, keinAdmin, protokolliere, werIst } from "@/lib/admin";
import { pruefeBericht, type Marktbericht } from "@/lib/marktwissen";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const m = await s.globalEins<Marktbericht>("marktbericht", params.id); return m ? Response.json(m) : Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
}
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const alt = await s.globalEins<Marktbericht>("marktbericht", params.id); if (!alt) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const b = (await req.json()) as Partial<Marktbericht>;
  const neu: Marktbericht = { ...alt, ...b, id: alt.id, erfasst: alt.erfasst, geaendert: Date.now() };
  if (b.status === "geprueft" && alt.status !== "geprueft") { const f = pruefeBericht(neu); if (f.length) return Response.json({ fehler: `Noch nicht freigebbar: ${f.slice(0, 4).join(", ")}` }, { status: 400 }); neu.geprueftVon = werIst(req); }
  else if (alt.status === "geprueft" && JSON.stringify(alt.fakten) !== JSON.stringify(neu.fakten) && b.status !== "geprueft") { neu.status = "entwurf"; neu.geprueftVon = undefined; }
  await s.speichereGlobal("marktbericht", neu.id, neu);
  if (neu.status !== alt.status) await protokolliere(s, req, neu.status === "geprueft" ? "Marktbericht freigegeben" : "Marktbericht auf Entwurf", `${neu.herausgeber} ${neu.titel}`);
  return Response.json(neu);
}
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const m = await s.globalEins<Marktbericht>("marktbericht", params.id); await s.loescheGlobal("marktbericht", params.id);
  await protokolliere(s, req, "Marktbericht gelöscht", m ? `${m.herausgeber} ${m.titel}` : params.id);
  return Response.json({ ok: true });
}
