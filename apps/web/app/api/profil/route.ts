import { SITZUNG_COOKIE } from "@/lib/auth";
import { faelligeLoeschung } from "@/lib/konto";
import { mandant, speicher } from "@/lib/speicher";
import type { Profil } from "@/lib/typen";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const s = await speicher(req); const t = mandant(req);
  if (await faelligeLoeschung(s, t)) return new Response(JSON.stringify({ fehler: "Das Konto wurde wie beantragt gelöscht." }), { status: 410, headers: { "content-type": "application/json", "set-cookie": `${SITZUNG_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } });
  return Response.json(await s.profil(t));
}
export async function PUT(req: Request) {
  const p = (await req.json()) as Profil;
  if (!p?.investor || !Array.isArray(p.anlageprofile) || !p.anlageprofile.length) return Response.json({ fehler: "Profil unvollständig" }, { status: 400 });
  const s = await speicher(req); const t = mandant(req);
  // Die Löschfrist setzt nur der Server
  const alt = await s.profil(t); if (alt.loeschung) p.loeschung = alt.loeschung; else delete p.loeschung;
  await s.speichereProfil(t, p);
  return Response.json(p);
}
