import { bilanz, schliesse, type Journaleintrag } from "@highstack/trading";
import { istAdmin } from "@/lib/admin";
import { JOURNAL } from "@/lib/scalable";
import { speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";

/** Journal der eigenen Trades (nur Admin, wie die Scalable-Verbindung) */
export async function GET(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return Response.json({ eintraege: [], bilanz: bilanz([]) });
  const l = (await s.global<Journaleintrag>(JOURNAL)).sort((a, b) => b.am - a.am);
  return Response.json({ eintraege: l.slice(0, 200), bilanz: bilanz(l) });
}
/** Von Hand schließen (z. B. in der App verkauft oder Stopp ausgelöst) oder löschen */
export async function POST(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return Response.json({ fehler: "Nicht verfügbar" }, { status: 403 });
  const b = await req.json().catch(() => null) as { aktion?: string; id?: string; kurs?: number; grund?: string; eintrag?: Partial<Journaleintrag> & { stueck?: number; isin?: string; name?: string } } | null;
  // Neue Position von Hand (Order in einer beliebigen Broker-App ausgeführt)
  if (b?.aktion === "neu" && b.eintrag) {
    const x = b.eintrag; const zahl = (v: unknown, lo: number, hi: number) => typeof v === "number" && v >= lo && v <= hi;
    if (!["long", "short"].includes(String(x.richtung)) || !zahl(x.einstieg?.kurs, 0.0001, 1e7) || !zahl(x.stueck, 0.0001, 1e9) || !zahl(x.stoppProdukt, 0, 1) || !zahl(x.zielProdukt, 0, 20) || !zahl(x.produkt?.hebel, 1, 500)) return Response.json({ fehler: "Angaben unvollständig (Kurs, Stück, Hebel)" }, { status: 400 });
    const e: Journaleintrag = {
      id: `j${Date.now().toString(36)}`, am: Date.now(), basis: String(x.basis ?? "DAX").slice(0, 30), richtung: x.richtung!, quelle: x.quelle === "modell" ? "modell" : "eigene", idee: typeof x.idee === "string" ? x.idee.slice(0, 300) : null,
      produkt: { isin: String(x.produkt?.isin ?? "").slice(0, 20), name: x.produkt?.name ? String(x.produkt.name).slice(0, 80) : null, art: x.produkt?.art === "etf" ? "etf" : x.produkt?.art === "aktie" ? "aktie" : "ko", hebel: x.produkt!.hebel },
      einsatz: Math.round(x.einstieg!.kurs! * x.stueck! * 100) / 100, einstieg: { kurs: x.einstieg!.kurs!, stueck: x.stueck!, orderId: null, am: Date.now() },
      stoppProdukt: x.stoppProdukt!, zielProdukt: x.zielProdukt!, status: "offen", modell: null,
    };
    await s.speichereGlobal(JOURNAL, e.id, e); return Response.json(e);
  }
  const e = b?.id ? await s.globalEins<Journaleintrag>(JOURNAL, b.id) : null; if (!e) return Response.json({ fehler: "Eintrag nicht gefunden" }, { status: 404 });
  if (b!.aktion === "schliessen") {
    if (!(typeof b!.kurs === "number" && b!.kurs > 0)) return Response.json({ fehler: "Verkaufskurs angeben" }, { status: 400 });
    const neu = schliesse(e, b!.kurs, String(b!.grund ?? "von Hand").slice(0, 60)); await s.speichereGlobal(JOURNAL, e.id, neu); return Response.json(neu);
  }
  if (b!.aktion === "loeschen") { await s.loescheGlobal(JOURNAL, e.id); return Response.json({ ok: true }); }
  return Response.json({ fehler: "Unbekannte Aktion" }, { status: 400 });
}
