import { rueckfrage } from "@highstack/agents";
import { laufoptionen } from "@/lib/agenten";
import { mandant, speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { experte: expId, frage } = (await req.json()) as { experte: string; frage: string };
  if (!frage?.trim()) return Response.json({ fehler: "Frage fehlt" }, { status: 400 });
  const s = await speicher(req); const t = mandant(req);
  const o = await s.objekt(t, params.id); const stand = o?.experten[expId];
  if (!o || !stand) return Response.json({ fehler: "Kein Ergebnis dieses Experten vorhanden" }, { status: 404 });
  const p = await s.profil(t);
  const antwort = await rueckfrage(expId, { ...laufoptionen(p, o, req.signal), bisherigesErgebnis: stand.ergebnis, verlauf: stand.verlauf, frage: frage.trim() });
  const frisch = (await s.objekt(t, params.id)) ?? o;
  const ex = frisch.experten[expId]!;
  ex.verlauf = [...ex.verlauf, { rolle: "nutzer" as const, text: frage.trim() }, { rolle: "experte" as const, text: antwort }].slice(-20);
  await s.speichereObjekt(t, frisch);
  return Response.json({ antwort, verlauf: ex.verlauf });
}
