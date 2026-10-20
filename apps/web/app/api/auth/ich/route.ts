import { authAktiv, MANDANT_HEADER, NUTZER_HEADER, ROLLE_HEADER } from "@/lib/auth";
import { speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
/** Wer bin ich? Die Middleware hat die Sitzung bereits geprüft und die Kopfzeilen gesetzt. */
export async function GET(req: Request) {
  if (!authAktiv()) return Response.json({ aktiv: false });
  try { await speicher(req); } catch { return Response.json({ fehler: "Zugang entzogen. Bitte neu anmelden." }, { status: 401 }); }
  return Response.json({ aktiv: true, email: req.headers.get(NUTZER_HEADER), rolle: req.headers.get(ROLLE_HEADER), mandant: req.headers.get(MANDANT_HEADER) });
}
