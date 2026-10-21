import { authAktiv, NUTZER_HEADER, ROLLE_HEADER, SITZUNG_COOKIE } from "@/lib/auth";
import { LOESCH_FRIST_TAGE } from "@/lib/konto";
import { mandant, speicher, vergissNutzer } from "@/lib/speicher";
export const dynamic = "force-dynamic";

/**
 * Kontolöschung. Inhaber (oder lokal): beantragen mit Frist, bis dahin abbrechen. Mitglied: eigenen Zugang sofort aufgeben.
 * Ausgeführt wird die fällige Löschung beim nächsten Zugriff auf das Konto.
 */
export async function POST(req: Request) {
  const { aktion } = (await req.json().catch(() => ({}))) as { aktion?: "beantragen" | "abbrechen" | "aufgeben" };
  const s = await speicher(req); const t = mandant(req);
  const ich = req.headers.get(NUTZER_HEADER) ?? "lokal"; const inhaber = !authAktiv() || req.headers.get(ROLLE_HEADER) === "inhaber";
  if (aktion === "aufgeben") {
    if (!authAktiv()) return Response.json({ fehler: "Ohne Anmeldung gibt es keinen eigenen Zugang." }, { status: 400 });
    const andereInhaber = (await s.nutzerVon(t)).filter(n => n.rolle === "inhaber" && n.email !== ich);
    if (inhaber && !andereInhaber.length) return Response.json({ fehler: "Sie sind der einzige Inhaber. Beantragen Sie die Löschung des Kontos oder machen Sie vorher jemand anderen zum Inhaber." }, { status: 400 });
    await s.loescheNutzer(ich); vergissNutzer(ich);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": `${SITZUNG_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } });
  }
  if (!inhaber) return Response.json({ fehler: "Nur der Inhaber kann das Konto löschen." }, { status: 403 });
  const p = await s.profil(t);
  if (aktion === "abbrechen") { delete p.loeschung; await s.speichereProfil(t, p); return Response.json({ ok: true, loeschung: null }); }
  if (aktion === "beantragen") {
    p.loeschung = { beantragt: Date.now(), durch: ich, ausfuehrung: Date.now() + LOESCH_FRIST_TAGE * 86400000 };
    await s.speichereProfil(t, p);
    return Response.json({ ok: true, loeschung: p.loeschung });
  }
  return Response.json({ fehler: "Unbekannte Aktion" }, { status: 400 });
}
