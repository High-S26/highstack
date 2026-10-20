import { authAktiv, gueltigeMail, normiere, NUTZER_HEADER, ROLLE_HEADER } from "@/lib/auth";
import { gebremst, verschickeLink } from "@/lib/anmeldung";
import { mandant, speicher, vergissNutzer } from "@/lib/speicher";
export const dynamic = "force-dynamic";

const nurInhaber = (req: Request) => req.headers.get(ROLLE_HEADER) === "inhaber";

/** Mitglieder des eigenen Mandanten */
export async function GET(req: Request) {
  if (!authAktiv()) return Response.json({ aktiv: false, nutzer: [] });
  const s = await speicher(req);
  return Response.json({ aktiv: true, ich: req.headers.get(NUTZER_HEADER), nutzer: (await s.nutzerVon(mandant(req))).map(n => ({ email: n.email, rolle: n.rolle, name: n.name, erstellt: n.erstellt, letzterLogin: n.letzterLogin })) });
}
/** Einladen: nur Inhaber; die Person bekommt einen Anmelde-Link */
export async function POST(req: Request) {
  if (!authAktiv() || !nurInhaber(req)) return Response.json({ fehler: "Nur der Inhaber kann einladen." }, { status: 403 });
  const { email: roh, rolle } = (await req.json().catch(() => ({}))) as { email?: string; rolle?: "inhaber" | "mitglied" };
  const email = normiere(roh ?? "");
  if (!gueltigeMail(email)) return Response.json({ fehler: "Bitte eine gültige E-Mail-Adresse eingeben." }, { status: 400 });
  if (gebremst(`einl:${req.headers.get(NUTZER_HEADER)}`, 20, 60)) return Response.json({ fehler: "Zu viele Einladungen in kurzer Zeit." }, { status: 429 });
  const s = await speicher(req); const t = mandant(req);
  const vorhanden = await s.nutzer(email);
  if (vorhanden && vorhanden.tenant !== t) return Response.json({ fehler: "Diese Adresse gehört bereits zu einem anderen Konto." }, { status: 409 });
  await s.speichereNutzer({ ...(vorhanden ?? { erstellt: Date.now() }), email, tenant: t, rolle: rolle === "inhaber" ? "inhaber" : "mitglied", eingeladenVon: req.headers.get(NUTZER_HEADER) ?? undefined });
  const r = await verschickeLink(req, email, "einladung", req.headers.get(NUTZER_HEADER) ?? undefined);
  return Response.json({ ok: true, versendet: r.versendet, devLink: !r.versendet && process.env.NODE_ENV !== "production" ? r.link : undefined });
}
/** Zugang entziehen: nur Inhaber, nicht sich selbst */
export async function DELETE(req: Request) {
  if (!authAktiv() || !nurInhaber(req)) return Response.json({ fehler: "Nur der Inhaber kann Zugänge entfernen." }, { status: 403 });
  const email = normiere(new URL(req.url).searchParams.get("email") ?? "");
  if (email === req.headers.get(NUTZER_HEADER)) return Response.json({ fehler: "Den eigenen Zugang können Sie nicht entfernen." }, { status: 400 });
  const s = await speicher(req); const n = await s.nutzer(email);
  if (!n || n.tenant !== mandant(req)) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  await s.loescheNutzer(email); vergissNutzer(email);
  return Response.json({ ok: true });
}
