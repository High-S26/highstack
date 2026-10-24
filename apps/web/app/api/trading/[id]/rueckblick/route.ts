import { risikolage } from "@highstack/prognose";
import { alpacaHistorie, kuenstlicheHistorie, rueckblickTrading, STRATEGIEN, werktage, type AgentEinstellungen, type Historie, type StrategieTyp } from "@highstack/trading";
import { ereignisse, reihen } from "@/lib/konjunktur";
import { entschluessele } from "@/lib/geheim";
import { mandant, speicher } from "@/lib/speicher";
import { agent, exklusiv, speichere } from "@/lib/trading";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rückblick: den Agenten mit seinen Einstellungen auf historischen Kursen handeln lassen (Alpaca-Daten)
 * oder auf künstlichen Kursen (ohne Datenzugang). Optional Varianten: andere Strategien, ohne Marktumfeld.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req);
  const a = await agent(s, t, params.id); if (!a) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  const b = await req.json().catch(() => null) as { von?: string; bis?: string; quelle?: "alpaca" | "simulation"; varianten?: boolean } | null;
  if (!b?.von || !b.bis || !/^\d{4}-\d{2}-\d{2}$/.test(b.von) || !/^\d{4}-\d{2}-\d{2}$/.test(b.bis) || b.von > b.bis) return Response.json({ fehler: "Zeitraum von und bis angeben (JJJJ-MM-TT)." }, { status: 400 });
  const tage = werktage(b.von, b.bis).length;
  if (tage > 130) return Response.json({ fehler: "Höchstens etwa ein halbes Jahr (130 Handelstage) je Rückblick." }, { status: 400 });
  if (b.bis >= new Date().toISOString().slice(0, 10)) return Response.json({ fehler: "Der Zeitraum muss vor heute enden." }, { status: 400 });
  const e = a.einstellungen; const referenz = STRATEGIEN[e.strategie].braucht === "markt" ? (e.werte.referenz ?? "SPY") : null;
  const symbole = [...new Set([...e.symbole, "SPY", ...(referenz ? [referenz] : [])])];
  let h: Historie;
  try {
    if (b.quelle === "alpaca") {
      const keyId = a.zugang?.keyId ?? process.env.ALPACA_KEY_ID; const secret = a.zugang ? await entschluessele(a.zugang.secret) : process.env.ALPACA_SECRET;
      if (!keyId || !secret) throw new Error("Für echte Kurse bitte einen Alpaca-Zugang beim Agenten hinterlegen (kostenloses Konto genügt).");
      h = await alpacaHistorie({ keyId, secret }, symbole, b.von, b.bis);
      if (!h.tage.length) throw new Error("Für den Zeitraum kamen keine vollständigen Handelstage zurück.");
    } else h = kuenstlicheHistorie(symbole, b.von, b.bis);
  } catch (x) { return Response.json({ fehler: (x as Error).message }, { status: 400 }); }
  // Marktumfeld je Tag aus den Konjunkturdaten, so wie es damals bekannt war
  const r = await reihen(s); const ev = await ereignisse(s);
  const umfeld = (d: string) => { const l = risikolage({ stichtag: d, reihen: r, ereignisse: ev }); return { faktor: l.faktor, text: l.gruende.join("; ") }; };
  const lauf = (x: AgentEinstellungen) => rueckblickTrading(x, h, { benchmark: "SPY", umfeld: x.marktlage === false ? undefined : umfeld });
  const ergebnis = await lauf(e);
  let varianten: { name: string; kennzahlen: Awaited<ReturnType<typeof lauf>>["kennzahlen"] }[] | undefined;
  if (b.varianten) {
    varianten = [];
    for (const k of Object.keys(STRATEGIEN) as StrategieTyp[]) if (k !== e.strategie) varianten.push({ name: `Strategie ${STRATEGIEN[k].name}`, kennzahlen: (await lauf({ ...e, strategie: k })).kennzahlen });
    varianten.push({ name: e.marktlage === false ? "mit Marktumfeld" : "ohne Marktumfeld", kennzahlen: (await lauf({ ...e, marktlage: e.marktlage === false })).kennzahlen });
    varianten.push({ name: e.richtung === "long" ? "Long und Short" : "nur Long", kennzahlen: (await lauf({ ...e, richtung: e.richtung === "long" ? "long-short" : "long" })).kennzahlen });
  }
  const gespeichert = { ...ergebnis, varianten, am: Date.now(), einstellungen: { strategie: e.strategie, symbole: e.symbole, richtung: e.richtung } };
  await exklusiv(a.id, async () => { const x = await agent(s, t, a.id); if (x) { x.rueckblick = gespeichert; await speichere(s, x); } });
  return Response.json(gespeichert);
}
