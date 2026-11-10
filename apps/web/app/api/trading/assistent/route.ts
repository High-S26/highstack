import { DAX_ISIN, ideeEinordnung, optionen, type Ziel } from "@highstack/trading";
import { daxStand, kerzen } from "@/lib/dax";
import { darfScalable, sc } from "@/lib/scalable";
import { speicher } from "@/lib/speicher";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Assistent: Optionen 1–3 mit Wahrscheinlichkeiten aus der Historie (?ziel=tagestrade|rally&betrag=250&richtung=long|short|modell&zielRendite=0.075&horizont=5) */
export async function GET(req: Request) {
  const s = await speicher(req); const q = new URL(req.url).searchParams;
  const ziel = (q.get("ziel") === "rally" ? "rally" : "tagestrade") as Ziel;
  const betrag = Math.max(10, Math.min(1e6, Number(q.get("betrag")) || 250));
  const zielRendite = Math.max(0.005, Math.min(1, Number(q.get("zielRendite")) || 0.075));
  const horizont = Math.max(1, Math.min(60, Math.round(Number(q.get("horizont")) || 5)));
  try {
    const k = (await kerzen(s, "dax"))?.kerzen ?? []; if (k.length < 300) return Response.json({ fehler: "Zu wenige DAX-Kurse. Unter „DAX heute“ → Datenstand neu laden oder CSV hochladen." }, { status: 400 });
    let dax = k.at(-1)!.c, quelle = `Schluss ${k.at(-1)!.d}`;
    if (await darfScalable(req, s)) { try { const x = await sc().kurs(DAX_ISIN); if (x.mid && !x.veraltet && Math.abs(x.mid / dax - 1) < 0.15) { dax = x.mid; quelle = "live (Scalable)"; } } catch { /* Schlusskurs */ } }
    const st = await daxStand(s).catch(() => null);
    const sig = st?.signal ?? null;
    const wunsch = q.get("richtung");
    const richtung: "long" | "short" | null = wunsch === "long" || wunsch === "short" ? wunsch : sig && sig.richtung !== "keine" ? sig.richtung : null;
    if (!richtung) return Response.json({ dax, quelle, richtung: null, signal: sig, optionen: [], hinweis: "Das Modell sieht heute keine Richtung mit belegtem Vorteil. Wählen Sie selbst „steigt“ oder „fällt“, oder lassen Sie den Tag aus." });
    const opts = optionen({ kerzen: k.filter(x => x.d < (st?.datum ?? "9999")), dax, richtung, betrag, ziel, zielRendite, horizontTage: horizont, gebuehrJeOrder: Number(q.get("gebuehr") ?? 0.99) });
    return Response.json({ dax, quelle, richtung, signal: sig, einordnung: ideeEinordnung(richtung, sig, st?.rueckblick ?? null), optionen: opts, termine: sig?.termine ?? [] });
  } catch (e) { return Response.json({ fehler: (e as Error).message }, { status: 500 }); }
}
