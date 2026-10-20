import { authAktiv, gueltigeMail, normiere } from "@/lib/auth";
import { gebremst, verschickeLink } from "@/lib/anmeldung";
import { speicher } from "@/lib/speicher";
import { id } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";

/** Anmelde-Link anfordern. Antwort ist immer gleich, damit niemand erfährt, welche Adressen Zugang haben. */
export async function POST(req: Request) {
  if (!authAktiv()) return Response.json({ fehler: "Anmeldung ist nicht eingerichtet (AUTH_SECRET fehlt)." }, { status: 400 });
  const { email: roh } = (await req.json().catch(() => ({}))) as { email?: string };
  const email = normiere(roh ?? "");
  if (!gueltigeMail(email)) return Response.json({ fehler: "Bitte eine gültige E-Mail-Adresse eingeben." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  if (gebremst(`m:${email}`) || gebremst(`i:${ip}`, 20)) return Response.json({ fehler: "Zu viele Versuche. Bitte in 15 Minuten erneut." }, { status: 429 });
  const s = await speicher(req);
  let n = await s.nutzer(email);
  // Erster Zugang: die Adresse aus ADMIN_EMAIL wird Inhaber eines eigenen Mandanten
  if (!n && email === normiere(process.env.ADMIN_EMAIL ?? "")) {
    n = { email, tenant: process.env.ADMIN_TENANT || id(), rolle: "inhaber", erstellt: Date.now() };
    await s.speichereNutzer(n);
  }
  let devLink: string | undefined;
  if (n) { const r = await verschickeLink(req, email, "login"); if (!r.versendet && process.env.NODE_ENV !== "production") devLink = r.link; }
  return Response.json({ ok: true, hinweis: "Wenn diese Adresse Zugang hat, ist ein Link unterwegs.", devLink });
}
