import { SITZUNG_COOKIE } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function POST() {
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json", "set-cookie": `${SITZUNG_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } });
}
