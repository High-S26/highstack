import { pruefeEinstellungen } from "@highstack/trading";
import { mandant, speicher } from "@/lib/speicher";
import { agent, ansicht, brokerFuer, erlaubteBroker, exklusiv, speichere } from "@/lib/trading";
export const dynamic = "force-dynamic";

/** Agent mit Live-Kontostand und Positionen vom Broker */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const a = await agent(s, mandant(req), params.id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  let konto = null, positionen: unknown[] = [], uhr = null, fehler: string | null = null;
  try { const b = await brokerFuer(a); [konto, positionen, uhr] = await Promise.all([b.konto(), b.positionen(), b.uhr()]); } catch (e) { const m = (e as Error).message; fehler = /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|network|abort/i.test(m) ? `Keine Verbindung zu ${a.einstellungen.broker === "manuell" ? "der Kursquelle (Alpaca)" : "Alpaca"}. Kontostand und Kurse erscheinen, sobald die Verbindung steht.` : m; }
  return Response.json({ ...ansicht(a), live: { konto, positionen, uhr, fehler } });
}
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req);
  return exklusiv(params.id, async () => {
    const a = await agent(s, t, params.id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
    const b = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!b || typeof b !== "object") return Response.json({ fehler: "Ungültige Anfrage (kein JSON)." }, { status: 400 });
    if (b.broker && b.broker !== a.einstellungen.broker && a.zustand.aktiv) return Response.json({ fehler: "Broker nur bei angehaltenem Agenten wechseln." }, { status: 409 });
    // Broker darf bleiben, auch wenn er inzwischen gesperrt ist; ein Wechsel nur zu erlaubten
    const erlaubt = [...new Set([...erlaubteBroker(), ...(b.broker && b.broker !== a.einstellungen.broker ? [] : [a.einstellungen.broker])])];
    const { e, fehler } = pruefeEinstellungen(b, { basis: a.einstellungen, erlaubteBroker: erlaubt });
    if (fehler.length) return Response.json({ fehler: fehler.map(f => f.text).join(" "), felder: fehler }, { status: 400 });
    a.einstellungen = e;
    a.zustand.log.unshift({ zeit: new Date().toISOString(), art: "info", text: "Einstellungen geändert" });
    await speichere(s, a); return Response.json(ansicht(a));
  });
}
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const a = await agent(s, mandant(req), params.id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  if (a.zustand.aktiv) return Response.json({ fehler: "Bitte den Agenten zuerst anhalten." }, { status: 409 });
  await s.loescheGlobal("trading", a.id); return Response.json({ ok: true });
}
