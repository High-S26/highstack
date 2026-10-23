import { speicher } from "@/lib/speicher";
import { einstellungen, istAdmin, keinAdmin, protokolliere, type Einstellungen } from "@/lib/admin";
export const dynamic = "force-dynamic";

export async function PUT(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const b = (await req.json()) as Einstellungen; const alt = await einstellungen(s);
  const neu: Einstellungen = { ...alt, ...b, ...(b.ankuendigung ? { ankuendigung: { ...b.ankuendigung, text: b.ankuendigung.text.slice(0, 400), am: Date.now() } } : {}) };
  await s.speichereGlobal("einstellungen", "plattform", neu);
  await protokolliere(s, req, b.ankuendigung ? (b.ankuendigung.aktiv ? "Ankündigung veröffentlicht" : "Ankündigung beendet") : "Einstellungen geändert", undefined, b.ankuendigung?.text?.slice(0, 80));
  return Response.json(neu);
}
