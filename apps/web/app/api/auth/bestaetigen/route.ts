import { pruefe, signiere, SITZUNG_COOKIE, SITZUNG_TAGE, type Linktoken, type Sitzung } from "@/lib/auth";
import { basisUrl, einmalig } from "@/lib/anmeldung";
import { speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";

/** Link aus der Mail: prüfen, Sitzung setzen, zur App. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const ziel = (p: string) => Response.redirect(`${basisUrl(req)}${p}`, 303);
  const d = await pruefe<Linktoken>(token, "login");
  if (!d || !einmalig(d.n)) return ziel("/login?fehler=link");
  const s = await speicher(req); const n = await s.nutzer(d.e);
  if (!n) return ziel("/login?fehler=zugang");
  await s.speichereNutzer({ ...n, letzterLogin: Date.now() });
  const sitzung = await signiere({ e: n.email, t: n.tenant, r: n.rolle, exp: Date.now() + SITZUNG_TAGE * 86400000, k: "sitzung" } satisfies Sitzung);
  const sicher = basisUrl(req).startsWith("https://") ? "; Secure" : "";
  return new Response(null, { status: 303, headers: { location: `${basisUrl(req)}/`, "set-cookie": `${SITZUNG_COOKIE}=${sitzung}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SITZUNG_TAGE * 86400}${sicher}` } });
}
