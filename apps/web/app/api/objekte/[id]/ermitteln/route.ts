import { ausUmgebung, fuehreAus, type Marktwerte } from "@highstack/agents";
import type { Objekt } from "@highstack/engine";
import { mandant, speicher } from "@/lib/speicher";
import { orientierung } from "@/lib/marktwerte";
import { abfrage, findeMietspiegel } from "@/lib/mietspiegel";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Vergleichswerte für ein Objekt ermitteln: mit API-Key per Markt-Analyst, sonst grobe Orientierung. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const s = await speicher(req); const t = mandant(req);
  const gespeichert = await s.objekt(t, params.id); if (!gespeichert) return Response.json({ fehler: "Nicht gefunden" }, { status: 404 });
  // Noch nicht gespeicherte Eingaben (z. B. gerade gewählte Wohnlage) mitnehmen, nur beschreibende Felder
  const b = (await req.json().catch(() => ({}))) as Partial<Objekt>;
  const erlaubt = ["ort", "titel", "asset", "baujahr", "wohnflaeche", "wohnlage", "energieklasse"] as const;
  const o = { ...gespeichert, objekt: { ...gespeichert.objekt, ...Object.fromEntries(erlaubt.filter(k => k in b).map(k => [k, b[k]])) } };
  if (!o.objekt.ort?.trim() && !o.objekt.titel?.trim()) return Response.json({ fehler: "Bitte zuerst Ort oder Stadtteil eintragen." }, { status: 400 });
  const { client, modelle, testmodus } = ausUmgebung();
  // Zuerst die Datenbasis: Mietspiegel der Stadt, wenn er ein passendes Feld hat
  const ms = findeMietspiegel(await s.mietspiegel(), o.objekt.ort ?? "", o.objekt.titel ?? "");
  const t1 = ms ? abfrage(ms, { baujahr: o.objekt.baujahr, flaeche: o.objekt.wohnflaeche, lage: o.objekt.wohnlage ?? null }) : null;
  const ausMietspiegel = (r: Marktwerte & { quelle: string }) => {
    if (!ms || !t1) return r;
    const stand = ms.gueltigAb ? new Date(ms.gueltigAb).toLocaleDateString("de-DE", { month: "2-digit", year: "numeric" }) : "ohne Datum";
    const q = `Mietspiegel ${ms.stadt} (${ms.art}, gültig ab ${stand})${ms.status === "entwurf" ? ", Entwurf ungeprüft" : ""}`;
    return { ...r, marktmieteQm: { wert: t1.mittel, von: t1.von, bis: t1.bis }, quellen: { marktmieteQm: q }, grundlage: `Vergleichsmiete aus dem ${q}${t1.beschreibung ? `, Feld ${t1.beschreibung}` : ""}${t1.offen.length ? `; offen: ${t1.offen.join(", ")} (Spanne entsprechend breiter)` : ""}. ${r.grundlage}`, mietspiegel: { id: ms.id, stadt: ms.stadt, status: ms.status, url: ms.quelleUrl, offen: t1.offen } };
  };
  if (testmodus) return Response.json(ausMietspiegel({ ...orientierung(o.objekt), quelle: "orientierung" }));
  try {
    const p = await s.profil(t); const ap = p.anlageprofile.find(a => a.id === o.anlageprofilId) ?? p.anlageprofile[0]!;
    const r = await fuehreAus<Marktwerte>("marktwerte", { client, modelle, eingabe: { investor: p.investor, anlageprofil: ap, objekt: o.objekt }, signal: req.signal, maxRunden: 2 },
      `Schätze die Vergleichswerte für dieses Objekt: ${o.objekt.titel}, ${o.objekt.ort}, ${o.objekt.asset}, ${o.objekt.wohnflaeche ?? "?"} m², Baujahr ${o.objekt.baujahr ?? "?"}, Energieklasse ${o.objekt.energieklasse ?? "?"}.`);
    return Response.json(ausMietspiegel({ ...r.ergebnis, quelle: "ki" }));
  } catch { return Response.json(ausMietspiegel({ ...orientierung(o.objekt), quelle: "orientierung" })); }
}
