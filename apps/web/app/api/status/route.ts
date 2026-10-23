import { speicher } from "@/lib/speicher";
import { einstellungen, istAdmin } from "@/lib/admin";
export const dynamic = "force-dynamic";
/** Zustand für die Oberfläche: Testmodus, Admin, Ankündigung an alle */
export async function GET(req: Request) {
  let admin = false; let ankuendigung = null;
  try { const s = await speicher(req); admin = await istAdmin(req, s); const e = await einstellungen(s); ankuendigung = e.ankuendigung?.aktiv ? e.ankuendigung : null; } catch { /* ohne Sitzung */ }
  return Response.json({ testmodus: !process.env.ANTHROPIC_API_KEY, speicher: process.env.DATABASE_URL ? "postgres" : "datei", admin, ankuendigung });
}
