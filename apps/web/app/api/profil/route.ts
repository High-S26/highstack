import { mandant, speicher } from "@/lib/speicher";
import type { Profil } from "@/lib/typen";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { return Response.json(await (await speicher(req)).profil(mandant(req))); }
export async function PUT(req: Request) {
  const p = (await req.json()) as Profil;
  if (!p?.investor || !Array.isArray(p.anlageprofile) || !p.anlageprofile.length) return Response.json({ fehler: "Profil unvollständig" }, { status: 400 });
  await (await speicher(req)).speichereProfil(mandant(req), p);
  return Response.json(p);
}
