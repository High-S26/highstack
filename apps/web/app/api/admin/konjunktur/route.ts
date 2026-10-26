import { leseTermine, bilanz, INDIKATOREN, leseTabelle, MECHANISMEN, rueckblick, type Ereignis, type Prognose } from "@highstack/prognose";
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
  | { aktion: "termine-import"; text: string; jahr?: number; quelle?: string; vorschau?: boolean }
  | { aktion: "termine-alte-loeschen" }
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
        const r = await uebernimm(s, b.id, punkte, ind?.quelle.text ?? "Import"); await protokolliere(s, req, "Konjunkturdaten importiert", b.id, `${punkte.length} ${punkte.length === 1 ? "Wert" : "Werte"}${fehler.length ? `, ${fehler.length} abgewiesen` : ""}`);
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
        if (x.zeit != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.zeit)) delete x.zeit;
        await s.speichereGlobal("ereignis", x.id, x); umfeldVergessen(); await protokolliere(s, req, "Termin angelegt", x.titel, x.datum); return Response.json(x);
      }
      case "termine-import": {
        // Wirtschaftskalender aus eingefügtem Text: Vorschau, dann übernehmen; gleiche Termine (Datum, Uhrzeit, Titel) nicht doppelt
        if (typeof b.text !== "string" || !b.text.trim()) throw new Error("Bitte den Text der Terminliste einfügen.");
        const jahr = Number.isInteger(b.jahr) && b.jahr! >= 2000 && b.jahr! <= 2100 ? b.jahr : undefined;
        const quelle = typeof b.quelle === "string" ? b.quelle.trim().slice(0, 80) : undefined;
        const { termine, ohneTag } = leseTermine(b.text.slice(0, 200_000), { jahr, quelle: quelle || undefined });
        const vorhanden = await ereignisse(s); const schluessel = (e: { datum: string; zeit?: string; titel: string }) => `${e.datum}|${e.zeit ?? ""}|${e.titel.toLowerCase()}`;
        const bekannt = new Set(vorhanden.map(schluessel)); const neu = termine.filter(t => !bekannt.has(schluessel(t)));
        if (b.vorschau) return Response.json({ termine, neu: neu.length, doppelt: termine.length - neu.length, ohneTag });
        for (const t of neu) { const x: Ereignis = { ...t, id: neueId() }; await s.speichereGlobal("ereignis", x.id, x); }
        umfeldVergessen(); await protokolliere(s, req, "Termine importiert", quelle || "Kalender", `${neu.length} neu, ${termine.length - neu.length} schon vorhanden`);
        return Response.json({ neu: neu.length, doppelt: termine.length - neu.length });
      }
      case "termine-alte-loeschen": {
        const grenze = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10); const alt = (await ereignisse(s)).filter(e => e.datum < grenze);
        for (const e of alt) await s.loescheGlobal("ereignis", e.id); umfeldVergessen(); await protokolliere(s, req, "Alte Termine entfernt", undefined, `${alt.length} vor ${grenze}`);
        return Response.json({ geloescht: alt.length });
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
