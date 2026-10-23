import { speicher } from "@/lib/speicher";
import { istAdmin, keinAdmin, type Protokolleintrag } from "@/lib/admin";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  return Response.json((await s.global<Protokolleintrag>("protokoll")).sort((a, b) => b.am - a.am).slice(0, 300));
}
