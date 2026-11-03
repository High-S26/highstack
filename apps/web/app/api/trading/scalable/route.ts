import { DAX_ISIN, istIsin, ScFehler, type ScOrder } from "@highstack/trading";
import { speicher } from "@/lib/speicher";
import { darfScalable, echtgeldAn, entsperren, freigeben, sc, scalableAn, sperre, verwerfen, vorbereiten } from "@/lib/scalable";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const nein = (fehler: string, status = 400) => Response.json({ fehler }, { status });

/** Stand der Verbindung: eingeschaltet, angemeldet, Sperre, Geld */
export async function GET(req: Request) {
  const s = await speicher(req);
  if (!scalableAn()) return Response.json({ an: false, hinweis: "Scalable ist auf diesem Server nicht eingeschaltet (SCALABLE_CLI=1 in .env)." });
  if (!await darfScalable(req, s)) return Response.json({ an: true, darf: false, hinweis: "Die Scalable-Verbindung gehört dem Betreiber dieses Servers und ist nur für Admins." });
  const c = sc(); const st = await c.status();
  const geld = st.angemeldet ? await c.geld().catch(() => null) : null;
  return Response.json({ an: true, darf: true, echtgeld: echtgeldAn(), ...st, geld, sperre: await sperre(s) });
}

type Anfrage =
  | { aktion: "kurs"; isin: string } | { aktion: "suche"; q: string } | { aktion: "bestand" }
  | { aktion: "derivate"; basis?: string; richtung: "long" | "short"; hebelMin?: number; hebelMax?: number; barriereMin?: number; barriereMax?: number }
  | { aktion: "vorschau"; order: ScOrder; zweck?: string } | { aktion: "freigeben"; id: string; angemessenheit?: boolean }
  | { aktion: "verwerfen"; id: string } | { aktion: "stornieren"; orderId: string } | { aktion: "entsperren" };

const zahlOk = (v: unknown) => v == null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
function pruefeOrder(o: unknown): ScOrder {
  const x = o as Partial<ScOrder>;
  if (!x || typeof x !== "object" || !["kauf", "verkauf"].includes(String(x.seite)) || typeof x.isin !== "string" || !istIsin(x.isin)) throw new ScFehler("invalid_input", "Order unvollständig (Seite, ISIN).");
  if (!["market", "limit", "stop", "stop-limit"].includes(String(x.art))) throw new ScFehler("invalid_input", "Ordertyp ungültig.");
  if (![x.betrag, x.stueck, x.limit, x.stopp].every(zahlOk)) throw new ScFehler("invalid_input", "Beträge müssen Zahlen ≥ 0 sein.");
  if (x.boerse != null && !["gettex", "xetra", "eix"].includes(x.boerse)) throw new ScFehler("invalid_input", "Handelsplatz ungültig.");
  // Obergrenze je Order aus der Umgebung (zusätzlich zu max_order_notional der CLI)
  const max = Number(process.env.SCALABLE_MAX_ORDER ?? "5000");
  if (x.seite === "kauf" && x.betrag != null && x.betrag > max) throw new ScFehler("invalid_input", `Höchstens ${max.toLocaleString("de-DE")} € je Order (SCALABLE_MAX_ORDER).`);
  return { seite: x.seite!, isin: x.isin, betrag: x.betrag ?? null, stueck: x.stueck ?? null, art: x.art!, limit: x.limit ?? null, stopp: x.stopp ?? null, boerse: x.boerse ?? null };
}

export async function POST(req: Request) {
  const s = await speicher(req);
  if (!await darfScalable(req, s)) return nein("Scalable ist hier nicht verfügbar.", 403);
  const b = await req.json().catch(() => null) as Anfrage | null; if (!b || typeof b !== "object") return nein("Ungültige Anfrage");
  const c = sc();
  try {
    switch (b.aktion) {
      case "kurs": return Response.json(await c.kurs(String(b.isin)));
      case "suche": return Response.json({ items: await c.suche(String(b.q ?? "")) });
      case "bestand": return Response.json({ items: await c.bestand(), geld: await c.geld().catch(() => null) });
      case "derivate": {
        if (!["long", "short"].includes(b.richtung)) return nein("Richtung long oder short");
        if (![b.hebelMin, b.hebelMax, b.barriereMin, b.barriereMax].every(zahlOk)) return nein("Ungültige Grenzen");
        return Response.json({ items: await c.derivate({ basis: b.basis && istIsin(b.basis) ? b.basis : DAX_ISIN, richtung: b.richtung, hebelMin: b.hebelMin, hebelMax: b.hebelMax, barriereMin: b.barriereMin, barriereMax: b.barriereMax, anzahl: 15 }) });
      }
      case "vorschau": return Response.json(await vorbereiten(s, pruefeOrder(b.order), typeof b.zweck === "string" ? b.zweck.slice(0, 40) : undefined));
      case "freigeben": if (typeof b.id !== "string") return nein("ID fehlt"); return Response.json(await freigeben(s, b.id, b.angemessenheit === true));
      case "verwerfen": if (typeof b.id !== "string") return nein("ID fehlt"); await verwerfen(s, b.id); return Response.json({ ok: true });
      case "stornieren": return Response.json(await c.stornieren(String(b.orderId)));
      case "entsperren": await entsperren(s); return Response.json({ ok: true });
      default: return nein("Unbekannte Aktion");
    }
  } catch (e) { return nein((e as Error).message, e instanceof ScFehler && e.code === "live_aus" ? 403 : 400); }
}
