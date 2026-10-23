import { bucheManuell, notaus, protokoll } from "@highstack/trading";
import { mandant, speicher } from "@/lib/speicher";
import { agent, ansicht, brokerFuer, exklusiv, speichere, taktFuer } from "@/lib/trading";
import { verschluessele } from "@/lib/geheim";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Aktion = { aktion: "start" | "stopp" | "notaus" | "takt" | "tag" | "zuruecksetzen" } | { aktion: "vorschlag"; id: string; ok: boolean; preis?: number; qty?: number } | { aktion: "zugang"; keyId: string; secret: string };

/** Steuerung: starten, anhalten, Not-Aus, einzelner Takt, Simulationstag durchspielen, Vorschläge, Zugang */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req); const b = (await req.json()) as Aktion;
  if (!await agent(s, t, params.id)) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const jetzt = () => new Date().toISOString();
  if (b.aktion === "takt" || b.aktion === "tag") {
    const a0 = await agent(s, t, params.id);
    const r = await taktFuer(s, params.id, b.aktion === "tag" && a0!.einstellungen.broker === "simulation" ? 400 : 1);
    return Response.json({ ergebnis: r, agent: ansicht((await agent(s, t, params.id))!) });
  }
  return exklusiv(params.id, async () => {
    const a = (await agent(s, t, params.id))!; const z = a.zustand;
    try {
      if (b.aktion === "start") { z.aktiv = true; if (z.tag?.status === "notaus") z.tag.status = "laeuft"; protokoll(z, "info", `Agent gestartet (${a.einstellungen.modus === "auto" ? "Automatik" : "Vorschläge"})`, jetzt()); }
      else if (b.aktion === "stopp") { z.aktiv = false; protokoll(z, "info", "Agent angehalten, Positionen bleiben offen", jetzt()); }
      else if (b.aktion === "notaus") { await notaus(z, await brokerFuer(a)); }
      else if (b.aktion === "zuruecksetzen") { if (a.einstellungen.broker !== "simulation") throw new Error("Zurücksetzen nur in der Simulation"); a.zustand = { ...z, aktiv: false, tag: null, verlauf: [], gefuehrt: [], vorschlaege: [], sim: undefined, simUhr: undefined, log: [{ zeit: jetzt(), art: "info", text: "Simulation zurückgesetzt" }] }; }
      else if (b.aktion === "zugang") { a.zugang = { keyId: b.keyId.trim(), secret: await verschluessele(b.secret.trim()) }; protokoll(z, "info", "Broker-Zugang hinterlegt", jetzt()); }
      else if (b.aktion === "vorschlag") {
        const v = z.vorschlaege.find(x => x.id === b.id); if (!v || v.status !== "offen") throw new Error("Vorschlag nicht mehr offen");
        if (!b.ok) { v.status = "abgelehnt"; protokoll(z, "info", `Vorschlag ${v.antrag.symbol} abgelehnt`, jetzt()); }
        else {
          const br = await brokerFuer(a);
          let preis: number | null = null; const qty = b.qty && b.qty > 0 ? b.qty : v.antrag.qty;
          if (br.nurZettel) { if (!b.preis) throw new Error("Bitte den Ausführungskurs aus der App eintragen."); bucheManuell(z, v.antrag.symbol, v.antrag.seite, qty, b.preis); preis = b.preis; }
          else { const r = await br.sende({ ...v.antrag, qty }); if (r.status === "abgelehnt") throw new Error(`Order abgelehnt: ${r.meldung ?? ""}`); preis = r.preis; }
          v.status = "ausgefuehrt"; v.meldung = preis ? `zu ${preis}` : undefined;
          if (v.art === "einstieg" && v.signal) { z.gefuehrt.push({ symbol: v.signal.symbol, richtung: v.signal.richtung, qty, einstieg: preis ?? v.signal.kurs, stopp: v.signal.stopp, ziel: v.signal.ziel, seit: jetzt(), grund: v.signal.grund }); if (z.tag) z.tag.trades++; }
          if (v.art === "ausstieg") z.gefuehrt = z.gefuehrt.filter(g => g.symbol !== v.antrag.symbol);
          protokoll(z, "order", `Bestätigt: ${v.antrag.seite === "kauf" ? "Kauf" : "Verkauf"} ${qty} ${v.antrag.symbol}${preis ? ` zu ${preis}` : ""}`, jetzt());
        }
      }
    } catch (e) { return Response.json({ fehler: (e as Error).message }, { status: 400 }); }
    await speichere(s, a); return Response.json(ansicht(a));
  });
}
