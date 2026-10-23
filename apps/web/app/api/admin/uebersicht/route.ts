import { speicher } from "@/lib/speicher";
import { einstellungen, istAdmin, keinAdmin, type Verbrauchsmonat } from "@/lib/admin";
import { authAktiv } from "@/lib/auth";
import type { Marktbericht } from "@/lib/marktwissen";
import type { Anfrage } from "@/lib/anfragen";
import { VERSION } from "@/lib/version";
export const dynamic = "force-dynamic";

/** Kennzahlen und Systemzustand für das Admin-Cockpit */
export async function GET(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const [mandanten, ms, berichte, anfragen, verbrauch, e] = await Promise.all([s.mandanten(), s.mietspiegel(), s.global<Marktbericht>("marktbericht"), s.global<Anfrage>("anfrage"), s.global<Verbrauchsmonat>("verbrauch"), einstellungen(s)]);
  const monat = new Date().toISOString().slice(0, 7); const vm = verbrauch.filter(v => v.monat === monat);
  const tage30 = Date.now() - 30 * 864e5; const jetzt = Date.now();
  const tokens = { input: vm.reduce((a, v) => a + v.inputTokens, 0), output: vm.reduce((a, v) => a + v.outputTokens, 0) };
  return Response.json({
    konten: mandanten.length, nutzer: mandanten.reduce((a, m) => a + m.nutzer.length, 0), objekte: mandanten.reduce((a, m) => a + m.objekte, 0),
    aktiv30: mandanten.filter(m => (m.geaendert ?? 0) > tage30).length,
    loeschantraege: mandanten.filter(m => m.profil?.loeschung).map(m => ({ tenant: m.tenant, ausfuehrung: m.profil!.loeschung!.ausfuehrung })),
    verbrauch: { monat, aufrufe: vm.reduce((a, v) => a + v.aufrufe, 0), ...tokens, kosten: e.preisInputMio != null && e.preisOutputMio != null ? (tokens.input * e.preisInputMio + tokens.output * e.preisOutputMio) / 1e6 : null },
    daten: {
      mietspiegel: { geprueft: ms.filter(m => m.status === "geprueft").length, entwurf: ms.filter(m => m.status === "entwurf").length, ablaufend: ms.filter(m => m.gueltigBis && Date.parse(m.gueltigBis) - jetzt < 90 * 864e5).map(m => ({ id: m.id, stadt: m.stadt, gueltigBis: m.gueltigBis })) },
      marktberichte: { geprueft: berichte.filter(b => b.status === "geprueft").length, entwurf: berichte.filter(b => b.status === "entwurf").length, neuester: berichte.filter(b => b.status === "geprueft").sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""))[0]?.stand ?? null },
      anfragen: anfragen.filter(a => !a.erledigt).length,
    },
    system: { version: VERSION, speicher: process.env.DATABASE_URL ? "Postgres" : "Datei (lokal)", anmeldung: authAktiv(), mail: !!process.env.SMTP_URL, ki: !!process.env.ANTHROPIC_API_KEY, rechtstexte: process.env.NEXT_PUBLIC_RECHTSTEXTE_FREIGEGEBEN === "1" },
    einstellungen: e,
  });
}
