import { abschluss, bucheManuell, kurs as kf, notaus, protokoll, stueck, stueckzahl, VORSCHLAG_GUELTIG, type Broker } from "@highstack/trading";
import { mandant, speicher } from "@/lib/speicher";
import { agent, ansicht, brokerFuer, erlaubteBroker, exklusiv, speichere, taktFuer } from "@/lib/trading";
import { verschluessele } from "@/lib/geheim";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Aktion = { aktion: "start" | "stopp" | "notaus" | "takt" | "tag" | "zuruecksetzen" } | { aktion: "vorschlag"; id: string; ok: boolean; preis?: number; qty?: number } | { aktion: "zugang"; keyId: string; secret: string };
const nein = (fehler: string, status = 400) => Response.json({ fehler }, { status });

/** Steuerung: starten, anhalten, Not-Aus, einzelner Takt, Simulationstag durchspielen, Vorschläge, Zugang */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req);
  const b = await req.json().catch(() => null) as Aktion | null;
  if (!b || typeof b !== "object" || typeof b.aktion !== "string") return nein("Ungültige Anfrage.");
  const a0 = await agent(s, t, params.id); if (!a0) return nein("Nicht gefunden", 404);
  const jetzt = () => new Date().toISOString();
  if (b.aktion === "takt" || b.aktion === "tag") {
    // Ein angehaltener Agent handelt nicht, auch nicht auf Knopfdruck
    if (!a0.zustand.aktiv) return nein("Der Agent ist angehalten. Bitte zuerst starten.", 409);
    if (b.aktion === "tag" && a0.einstellungen.broker !== "simulation") return nein("Durchspielen gibt es nur in der Simulation.");
    try { const r = await taktFuer(s, params.id, b.aktion === "tag" ? 400 : 1); return Response.json({ ergebnis: r, agent: ansicht((await agent(s, t, params.id))!) }); }
    catch (e) { return nein((e as Error).message); }
  }
  return exklusiv(params.id, async () => {
    const a = (await agent(s, t, params.id))!; const z = a.zustand; const e = a.einstellungen;
    let antwort: Record<string, unknown> = {};
    try {
      if (b.aktion === "start") {
        if (!erlaubteBroker().includes(e.broker)) throw new Error(e.broker === "alpaca-live" ? "Handel mit echtem Geld ist auf diesem Server gesperrt." : "Dieser Broker ist noch nicht angebunden.");
        await brokerFuer(a); // wirft mit verständlicher Meldung, wenn z. B. der Zugang fehlt
        z.aktiv = true; if (z.tag?.status === "notaus") z.tag.status = "laeuft";
        protokoll(z, "info", `Agent gestartet (${e.modus === "auto" ? "Automatik" : "Vorschläge"})`, jetzt());
      }
      else if (b.aktion === "stopp") { z.aktiv = false; protokoll(z, "info", "Agent angehalten, Positionen bleiben offen", jetzt()); }
      else if (b.aktion === "notaus") {
        let br: Broker | null = null; let fehler: string | undefined;
        try { br = await brokerFuer(a); } catch (x) { fehler = (x as Error).message; }
        const r = await notaus(z, br, "Not-Aus", fehler); antwort = { meldung: r.text, geschlossen: r.geschlossen };
      }
      else if (b.aktion === "zuruecksetzen") { if (e.broker !== "simulation") throw new Error("Zurücksetzen nur in der Simulation"); a.zustand = { ...z, aktiv: false, tag: null, verlauf: [], gefuehrt: [], vorschlaege: [], abschluesse: [], umfeld: undefined, sim: undefined, simUhr: undefined, log: [{ zeit: jetzt(), art: "info", text: "Simulation zurückgesetzt" }] }; }
      else if (b.aktion === "zugang") {
        const keyId = typeof b.keyId === "string" ? b.keyId.trim() : ""; const secret = typeof b.secret === "string" ? b.secret.trim() : "";
        if (!keyId || !secret) throw new Error("Bitte Key-ID und Secret angeben.");
        a.zugang = { keyId, secret: await verschluessele(secret) }; protokoll(z, "info", "Broker-Zugang hinterlegt", jetzt());
      }
      else if (b.aktion === "vorschlag") {
        const v = z.vorschlaege.find(x => x.id === b.id); if (!v || v.status !== "offen") throw new Error("Vorschlag nicht mehr offen");
        if (!b.ok) { v.status = "abgelehnt"; protokoll(z, "info", `Vorschlag ${v.antrag.symbol} abgelehnt`, jetzt()); }
        else {
          // Gleiche Regeln wie im Takt: nur bei laufendem Handelstag, innerhalb der Grenzen, höchstens die vorgeschlagene Stückzahl
          if (v.art === "einstieg") {
            if (!z.aktiv) throw new Error("Der Agent ist angehalten. Bitte zuerst starten.");
            if (!z.tag || z.tag.status !== "laeuft") { v.status = "verfallen"; throw new Error("Für heute ist Schluss (Tagesziel, Verlustlimit, Handelsende oder Not-Aus). Der Vorschlag ist verfallen."); }
            if (z.tag.trades >= e.maxTradesTag) throw new Error(`Höchstzahl Trades für heute erreicht (${e.maxTradesTag}).`);
            if (z.gefuehrt.length >= e.maxPositionen) throw new Error(`Höchstzahl gleichzeitiger Positionen erreicht (${e.maxPositionen}).`);
          }
          let qty = v.antrag.qty;
          if (b.qty != null) {
            if (typeof b.qty !== "number" || !Number.isFinite(b.qty) || b.qty <= 0) throw new Error("Stückzahl muss größer als 0 sein.");
            if (b.qty > v.antrag.qty + 1e-9) throw new Error(`Höchstens die vorgeschlagene Stückzahl (${stueck(v.antrag.qty)}); sie folgt aus Ihrem Risiko je Trade.`);
            qty = b.qty;
          }
          const br = await brokerFuer(a);
          // Signal noch gültig? Zu alt oder Kurs schon jenseits von Stopp oder Ziel: verfallen lassen statt ausführen
          if (v.art === "einstieg" && v.signal) {
            if ((v.alter ?? 0) > VORSCHLAG_GUELTIG) { v.status = "verfallen"; v.meldung = "veraltet"; throw new Error(`Der Vorschlag ist älter als ${VORSCHLAG_GUELTIG} Minuten und verfallen.`); }
            const akt = (await br.bars([v.signal.symbol]).catch(() => ({} as Record<string, { c: number }[]>)))[v.signal.symbol]?.at(-1)?.c;
            const sg = v.signal;
            if (akt != null && (sg.richtung === "long" ? akt <= sg.stopp || akt >= sg.ziel : akt >= sg.stopp || akt <= sg.ziel)) { v.status = "verfallen"; v.meldung = "Kurs jenseits von Stopp oder Ziel"; throw new Error(`Der Kurs (${kf(akt)}) liegt schon jenseits von Stopp (${kf(sg.stopp)}) oder Ziel (${kf(sg.ziel)}). Der Vorschlag ist verfallen.`); }
            // Stückzahl zum aktuellen Kurs neu rechnen: liegt der Kurs näher am Stopp oder weiter weg, ändert sich das Risiko
            if (akt != null) { const k = await br.konto(); const neu = stueckzahl(e, { ...sg, kurs: akt }, k.equity, k.cash, br.bruchstuecke); if (neu < v.antrag.qty) { v.antrag = { ...v.antrag, qty: neu }; if (neu <= 0) { v.status = "verfallen"; throw new Error("Zum aktuellen Kurs ergibt Ihr Risiko je Trade keine handelbare Stückzahl mehr. Der Vorschlag ist verfallen."); } } }
            qty = Math.min(qty, v.antrag.qty);
          }
          let preis: number | null = null;
          if (br.nurZettel) {
            if (typeof b.preis !== "number" || !Number.isFinite(b.preis) || b.preis <= 0) throw new Error("Bitte den Ausführungskurs aus der App eintragen.");
            const ref = v.signal?.kurs; if (ref && Math.abs(b.preis / ref - 1) > 0.25) throw new Error(`Der Kurs weicht mehr als 25 % vom Signalkurs (${ref.toLocaleString("de-DE")}) ab. Bitte prüfen.`);
            bucheManuell(z, v.antrag.symbol, v.antrag.seite, qty, b.preis); preis = b.preis;
          } else { const r = await br.sende({ ...v.antrag, qty }); if (r.status === "abgelehnt") throw new Error(`Order abgelehnt: ${r.meldung ?? ""}`); preis = r.preis; }
          v.status = "ausgefuehrt"; v.meldung = preis ? `zu ${preis}` : undefined;
          if (v.art === "einstieg" && v.signal) { z.gefuehrt.push({ symbol: v.signal.symbol, richtung: v.signal.richtung, qty, einstieg: preis ?? v.signal.kurs, stopp: v.signal.stopp, ziel: v.signal.ziel, seit: jetzt(), grund: v.signal.grund, staerke: v.signal.staerke, strategie: e.strategie }); if (z.tag) z.tag.trades++; }
          if (v.art === "ausstieg") { const g = z.gefuehrt.find(x => x.symbol === v.antrag.symbol); if (g && preis != null) abschluss(z, g, preis, v.antrag.grund, jetzt()); z.gefuehrt = z.gefuehrt.filter(x => x.symbol !== v.antrag.symbol); }
          protokoll(z, "order", `Bestätigt: ${v.antrag.seite === "kauf" ? "Kauf" : "Verkauf"} ${stueck(qty)} ${v.antrag.symbol}${preis ? ` zu ${kf(preis)}` : ""}`, (await br.uhr().catch(() => null))?.zeit ?? jetzt());
        }
      }
      else throw new Error("Unbekannte Aktion");
    } catch (x) { await speichere(s, a); return nein((x as Error).message); }
    await speichere(s, a); return Response.json({ ...ansicht(a), ...antwort });
  });
}
