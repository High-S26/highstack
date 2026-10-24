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
  const p = (await req.json().catch(() => null)) as Profil | null;
  if (!p?.investor || typeof p.investor !== "object" || !Array.isArray(p.anlageprofile) || !p.anlageprofile.length) return Response.json({ fehler: "Profil unvollständig" }, { status: 400 });
  // Zahlen im Profil müssen endlich und nicht negativ sein (Ausnahme: Mindest-Cashflow), Haltedauer 1 bis 60 Jahre
  const zahlenOk = (o: Record<string, unknown>, erlaubtNegativ: string[] = []) => Object.entries(o).every(([k, v]) => typeof v !== "number" || (Number.isFinite(v) && (v >= 0 || erlaubtNegativ.includes(k))));
  if (!zahlenOk(p.investor as unknown as Record<string, unknown>)) return Response.json({ fehler: "Investorenprofil: ungültige oder negative Zahl" }, { status: 400 });
  for (const ap of p.anlageprofile) {
    if (!ap || typeof ap !== "object" || !zahlenOk(ap as unknown as Record<string, unknown>, ["minCashflow"])) return Response.json({ fehler: "Anlageprofil: ungültige oder negative Zahl" }, { status: 400 });
    if (typeof ap.haltedauer === "number") ap.haltedauer = Math.min(60, Math.max(1, Math.round(ap.haltedauer)));
    if (!Array.isArray(ap.regionen)) ap.regionen = []; if (!Array.isArray(ap.assetklassen)) ap.assetklassen = [];
  }
  const s = await speicher(req); const t = mandant(req);
  // Die Löschfrist setzt nur der Server
  const alt = await s.profil(t); if (alt.loeschung) p.loeschung = alt.loeschung; else delete p.loeschung;
  await s.speichereProfil(t, p);
  return Response.json(p);
}
