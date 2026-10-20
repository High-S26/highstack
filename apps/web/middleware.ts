import { NextResponse, type NextRequest } from "next/server";
import { MANDANT_HEADER, NUTZER_HEADER, pruefe, ROLLE_HEADER, SITZUNG_COOKIE, type Sitzung } from "./lib/auth";

const OFFEN = ["/login", "/api/auth/anfordern", "/api/auth/bestaetigen", "/api/auth/abmelden"];

/** Jede Anfrage: Sitzung prüfen, Mandant als Kopfzeile setzen. Eingehende Kopfzeilen dieses Namens werden immer entfernt. */
export async function middleware(req: NextRequest) {
  const h = new Headers(req.headers);
  h.delete(MANDANT_HEADER); h.delete(NUTZER_HEADER); h.delete(ROLLE_HEADER);
  if (!process.env.AUTH_SECRET) return NextResponse.next({ request: { headers: h } });
  const pfad = req.nextUrl.pathname;
  if (OFFEN.some(p => pfad === p || pfad.startsWith(p + "/"))) return NextResponse.next({ request: { headers: h } });
  const s = await pruefe<Sitzung>(req.cookies.get(SITZUNG_COOKIE)?.value, "sitzung");
  if (!s) {
    if (pfad.startsWith("/api/")) return NextResponse.json({ fehler: "Bitte anmelden." }, { status: 401 });
    const url = req.nextUrl.clone(); url.pathname = "/login"; url.search = ""; return NextResponse.redirect(url);
  }
  h.set(MANDANT_HEADER, s.t); h.set(NUTZER_HEADER, s.e); h.set(ROLLE_HEADER, s.r);
  return NextResponse.next({ request: { headers: h } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
