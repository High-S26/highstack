import { speicher, vergissPruefung } from "@/lib/speicher";
import { istAdmin, keinAdmin, protokolliere, type Verbrauchsmonat } from "@/lib/admin";
import type { PaketId } from "@/lib/quellen";
export const dynamic = "force-dynamic";

/** Konten mit Kennzahlen. Inhalte (Objekte, Unterlagen) sieht der Admin bewusst nicht. */
export async function GET(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const monat = new Date().toISOString().slice(0, 7);
  const [m, v] = await Promise.all([s.mandanten(), s.global<Verbrauchsmonat>("verbrauch")]);
  return Response.json(m.map(x => ({
    tenant: x.tenant, objekte: x.objekte, geaendert: x.geaendert, paket: x.profil?.paket ?? "basis", loeschung: x.profil?.loeschung ?? null, onboarded: !!x.profil?.onboarded,
    nutzer: x.nutzer.map(n => ({ email: n.email, rolle: n.rolle, letzterLogin: n.letzterLogin ?? null, plattformAdmin: !!n.plattformAdmin, gesperrt: !!n.gesperrt })),
    verbrauch: v.find(y => y.tenant === x.tenant && y.monat === monat) ?? null,
  })).sort((a, b) => (b.geaendert ?? 0) - (a.geaendert ?? 0)));
}

type Aktion = { aktion: "paket"; tenant: string; paket: PaketId } | { aktion: "sperren" | "entsperren"; tenant: string } | { aktion: "admin" | "kein-admin"; email: string };
export async function POST(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const a = (await req.json()) as Aktion;
  if (a.aktion === "paket") {
    const p = await s.profil(a.tenant); await s.speichereProfil(a.tenant, { ...p, paket: a.paket }); await protokolliere(s, req, "Paket geändert", a.tenant, a.paket);
  } else if (a.aktion === "sperren" || a.aktion === "entsperren") {
    const nutzer = await s.nutzerVon(a.tenant);
    for (const n of nutzer) { await s.speichereNutzer({ ...n, gesperrt: a.aktion === "sperren" }); vergissPruefung(n.email); }
    await protokolliere(s, req, a.aktion === "sperren" ? "Konto gesperrt" : "Konto entsperrt", a.tenant, `${nutzer.length} Nutzer`);
  } else if (a.aktion === "admin" || a.aktion === "kein-admin") {
    const n = await s.nutzer(a.email); if (!n) return Response.json({ fehler: "Nutzer nicht gefunden" }, { status: 404 });
    await s.speichereNutzer({ ...n, plattformAdmin: a.aktion === "admin" }); await protokolliere(s, req, a.aktion === "admin" ? "Admin-Rolle vergeben" : "Admin-Rolle entzogen", a.email);
  } else return Response.json({ fehler: "Unbekannte Aktion" }, { status: 400 });
  return Response.json({ ok: true });
}
