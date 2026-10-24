import { bilanz, INDIKATOREN, leseTabelle, MECHANISMEN, rueckblick, type Ereignis, type Prognose } from "@highstack/prognose";
import { istAdmin, keinAdmin, protokolliere } from "@/lib/admin";
import { abrufAlle, ereignisse, lagebild, reihen, rueckblickGespeichert, stand, taeglich, uebernimm, umfeldVergessen, type Reihendatensatz, type Rueckblick } from "@/lib/konjunktur";
import { speicher } from "@/lib/speicher";
import { id as neueId } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Konjunktur: Datenstand, Lage, Prognosen und ihre Bilanz (nur Admins) */
export async function GET(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const daten = await s.global<Reihendatensatz>("konjunktur"); const st = await stand(s);
  const alle = (await s.global<Prognose>("prognose")).sort((a, b) => b.erstellt.localeCompare(a.erstellt) || a.id.localeCompare(b.id));
  const l = await lagebild(s);
  return Response.json({
    indikatoren: INDIKATOREN.map(i => { const d = daten.find(x => x.id === i.id); const letzter = d?.punkte.at(-1) ?? null; return { ...i, anzahl: d?.punkte.length ?? 0, letzter, aktualisiert: d?.aktualisiert ?? null, fehler: st.abrufFehler?.[i.id] ?? null }; }),
    weitere: daten.filter(d => !INDIKATOREN.some(i => i.id === d.id)).map(d => ({ id: d.id, anzahl: d.punkte.length, letzter: d.punkte.at(-1) ?? null })),
    lage: { regime: l.regime, risiko: l.risiko, wirkungen: l.wirkungen, fehlend: l.fehlend },
    mechanismen: MECHANISMEN.map(m => ({ id: m.id, name: m.name, theorie: m.theorie, gewicht: m.gewicht, aktuell: st.gewichte[m.id] ?? m.gewicht })),
    prognosen: alle.slice(0, 300), bilanz: bilanz(alle), stand: st, ereignisse: (await ereignisse(s)).sort((a, b) => a.datum.localeCompare(b.datum)),
    fredSchluessel: !!process.env.FRED_API_KEY, rueckblick: await rueckblickGespeichert(s),
  });
}

type Aktion =
  | { aktion: "import"; id: string; text: string; vorschau?: boolean; nurGueltige?: boolean }
  | { aktion: "werte-loeschen"; id: string; von: string; bis: string }
  | { aktion: "gewichte-uebernehmen" }
  | { aktion: "abruf" }
  | { aktion: "lauf" }
  | { aktion: "ereignis"; ereignis: Omit<Ereignis, "id"> }
  | { aktion: "ereignis-loeschen"; id: string }
  | { aktion: "reihe-loeschen"; id: string }
  | { aktion: "rueckblick"; von: string; bis: string; schrittTage?: number };

export async function POST(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const b = (await req.json().catch(() => ({}))) as Aktion;
  try {
    switch (b.aktion) {
      case "import": {
        if (!/^[a-z0-9-]+$|^kurs:[A-Z0-9.]+$/.test(b.id ?? "")) throw new Error("Unbekannte Reihe. Erlaubt: Indikator-Kennung oder kurs:SYMBOL");
        const ind = INDIKATOREN.find(i => i.id === b.id);
        const { punkte, fehler } = leseTabelle(b.text ?? "", { grenzen: ind?.grenzen ?? (b.id.startsWith("kurs:") ? [0.01, 1_000_000] : undefined) });
        if (b.vorschau) return Response.json({ anzahl: punkte.length, erste: punkte[0] ?? null, letzte: punkte.at(-1) ?? null, fehler: fehler.slice(0, 50), fehlerAnzahl: fehler.length });
        if (fehler.length && !b.nurGueltige) return Response.json({ fehler: `${fehler.length} Zeile(n) fehlerhaft, nichts übernommen. Zuerst die Vorschau prüfen.`, zeilen: fehler.slice(0, 50) }, { status: 400 });
        if (!punkte.length) throw new Error("Keine gültigen Werte erkannt. Je Zeile Datum und Wert, z. B. 2026-09-01;48,7");
        const r = await uebernimm(s, b.id, punkte, ind?.quelle.text ?? "Import"); await protokolliere(s, req, "Konjunkturdaten importiert", b.id, `${punkte.length} Werte${fehler.length ? `, ${fehler.length} abgewiesen` : ""}`);
        return Response.json({ ok: true, anzahl: punkte.length, abgewiesen: fehler.length, gesamt: r.punkte.length });
      }
      case "werte-loeschen": {
        const alt = await s.globalEins<Reihendatensatz>("konjunktur", b.id); if (!alt) throw new Error("Reihe nicht gefunden");
        if (!b.von || !b.bis || b.von > b.bis) throw new Error("Zeitraum von bis angeben");
        const bleibt = alt.punkte.filter(p => p.d < b.von || p.d > b.bis);
        await s.speichereGlobal("konjunktur", b.id, { ...alt, punkte: bleibt, aktualisiert: Date.now() }); umfeldVergessen();
        await protokolliere(s, req, "Konjunkturwerte gelöscht", b.id, `${alt.punkte.length - bleibt.length} Werte ${b.von} bis ${b.bis}`);
        return Response.json({ ok: true, geloescht: alt.punkte.length - bleibt.length });
      }
      case "gewichte-uebernehmen": {
        const rb = await rueckblickGespeichert(s); if (!rb) throw new Error("Noch kein Rückblick gerechnet");
        const st = await stand(s); await s.speichereGlobal("konjunktur-stand", "stand", { ...st, gewichte: rb.gewichte }); umfeldVergessen();
        await protokolliere(s, req, "Gewichte aus Rückblick übernommen", undefined, `${rb.von} bis ${rb.bis}`);
        return Response.json({ ok: true });
      }
      case "abruf": { const r = await abrufAlle(s); await protokolliere(s, req, "Konjunkturdaten abgerufen", undefined, Object.entries(r).map(([k, v]) => `${k}: ${v}`).join("; ").slice(0, 300)); return Response.json(r); }
      case "lauf": return Response.json(await taeglich(s, true));
      case "ereignis": {
        const e = b.ereignis; if (!e?.datum || !/^\d{4}-\d{2}-\d{2}$/.test(e.datum) || !e.titel?.trim()) throw new Error("Datum (JJJJ-MM-TT) und Titel angeben");
        const x: Ereignis = { ...e, id: neueId(), titel: e.titel.trim(), ...(e.symbol ? { symbol: e.symbol.trim().toUpperCase() } : {}) };
        await s.speichereGlobal("ereignis", x.id, x); umfeldVergessen(); await protokolliere(s, req, "Termin angelegt", x.titel, x.datum); return Response.json(x);
      }
      case "ereignis-loeschen": { const e = (await ereignisse(s)).find(x => x.id === b.id); await s.loescheGlobal("ereignis", b.id); umfeldVergessen(); await protokolliere(s, req, "Termin entfernt", e?.titel, e?.datum); return Response.json({ ok: true }); }
      case "reihe-loeschen": await s.loescheGlobal("konjunktur", b.id); umfeldVergessen(); await protokolliere(s, req, "Konjunkturreihe gelöscht", b.id); return Response.json({ ok: true });
      case "rueckblick": {
        if (!b.von || !b.bis || b.von >= b.bis) throw new Error("Zeitraum von < bis angeben");
        if ((b.schrittTage ?? 30) < 7) throw new Error("Schrittweite mindestens 7 Tage");
        const r = rueckblick(await reihen(s), { von: b.von, bis: b.bis, schrittTage: b.schrittTage ?? 30, ereignisse: await ereignisse(s), lernen: true });
        const erg: Rueckblick = { id: "letzter", am: Date.now(), von: b.von, bis: b.bis, schrittTage: b.schrittTage ?? 30, anzahl: r.prognosen.length, bilanz: r.bilanz, gewichte: r.gewichte, beispiele: r.prognosen.filter(p => p.ergebnis).slice(-15).reverse() };
        await s.speichereGlobal("konjunktur-rueckblick", "letzter", erg); await protokolliere(s, req, "Rückblick gerechnet", undefined, `${b.von} bis ${b.bis}: ${r.bilanz.n} geprüft`);
        return Response.json(erg);
      }
      default: throw new Error("Unbekannte Aktion");
    }
  } catch (e) { return Response.json({ fehler: (e as Error).message }, { status: 400 }); }
}
