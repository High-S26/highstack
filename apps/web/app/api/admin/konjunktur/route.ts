import { ausUmgebung, fuehreAus, neuerVerbrauch } from "@highstack/agents";
import { BEISPIEL_ANLAGEPROFIL, BEISPIEL_INVESTOR } from "@highstack/engine";
import { leseTermine, ordneTermin, type Termin, bilanz, INDIKATOREN, leseTabelle, MECHANISMEN, rueckblick, type Ereignis, type Prognose } from "@highstack/prognose";
import { bucheVerbrauch, istAdmin, keinAdmin, protokolliere } from "@/lib/admin";
import { abrufAlle, ereignisse, gespeicherteEreignisse, lagebild, reihen, rueckblickGespeichert, stand, taeglich, uebernimm, umfeldVergessen, type Reihendatensatz, type Rueckblick } from "@/lib/konjunktur";
import { speicher } from "@/lib/speicher";
import { id as neueId, LEERES_OBJEKT } from "@/lib/vorgaben";
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
  | { aktion: "termine-import"; text?: string; termine?: unknown[]; jahr?: number; quelle?: string; vorschau?: boolean; ki?: boolean }
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
        const jahr = Number.isInteger(b.jahr) && b.jahr! >= 2000 && b.jahr! <= 2100 ? b.jahr : undefined;
        const quelle = typeof b.quelle === "string" ? b.quelle.trim().slice(0, 80) : undefined;
        let termine: Termin[]; let ohneTag = 0; let ki = 0;
        if (Array.isArray(b.termine)) termine = b.termine.map(pruefeTermin).filter((x): x is Termin => !!x); // aus der Vorschau übernommen
        else {
          if (typeof b.text !== "string" || !b.text.trim()) throw new Error("Bitte den Text der Terminliste einfügen oder eine Datei wählen.");
          const r = leseTermine(b.text.slice(0, 200_000), { jahr, quelle: quelle || undefined }); termine = r.termine; ohneTag = r.ohneTag;
          // Fließtext (Artikel): mit KI-Schlüssel liest der Experte „Termine lesen“ zusätzlich; nur Termine, die die Muster nicht schon haben
          const { client, modelle, testmodus } = ausUmgebung();
          if (!testmodus && b.ki !== false && ohneTag > 3) {
            const verbrauch = neuerVerbrauch();
            const k = await fuehreAus<{ termine?: Termin[] }>("terminleser", { verbrauch, client, modelle, eingabe: { investor: BEISPIEL_INVESTOR, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: { ...LEERES_OBJEKT, titel: "Wirtschaftskalender" } }, signal: req.signal, maxRunden: 1, maxTokens: 8000 },
              `Heute ist ${new Date().toISOString().slice(0, 10)}. Übertrage die Termine aus diesem Text:\n"""${b.text.slice(0, 60_000)}"""`).catch(() => null);
            await bucheVerbrauch(s, "plattform", "terminleser", verbrauch);
            for (const x of (k?.ergebnis?.termine ?? []).map(pruefeTermin)) {
              if (!x) continue; const o = ordneTermin(x.titel, x.land); const t: Termin = { ...x, ...o, ...(quelle ? { quelle } : {}) }; if (!t.unternehmen) delete t.unternehmen;
              if (!termine.some(v => v.datum === t.datum && ((t.symbol && v.symbol === t.symbol) || (v.art === t.art && v.art !== "sonstiges" && (v.zeit ?? "") === (t.zeit ?? "")) || v.titel.toLowerCase() === t.titel.toLowerCase()))) { termine.push(t); ki++; }
            }
          }
        }
        // Doppelte: gleicher Tag und gleicher Titel, oder gleicher Tag und gleiches Börsenkürzel bei Quartalszahlen
        // (zwei Quellen, z. B. Terminliste und Artikel). Hat der neue Termin eine genauere Zeit, wird der alte ergänzt.
        const vorhanden = await ereignisse(s);
        const gleich = (a: { datum: string; zeit?: string; titel: string; symbol?: string; art: string }, x: typeof a) => a.datum === x.datum && ((a.titel.toLowerCase() === x.titel.toLowerCase() && (a.zeit ?? "") === (x.zeit ?? "")) || (!!a.symbol && a.symbol === x.symbol && a.art === "zahlen" && x.art === "zahlen")
          // gleicher Notenbank- oder Datentermin aus zwei Quellen (z. B. „Fed, Ergebnis der FOMC-Sitzung“ und „Fed-Zinsentscheid“)
          || (!!a.zeit && a.zeit === x.zeit && a.art === x.art && ["zinsentscheid", "inflation", "arbeitsmarkt"].includes(a.art) && (a as { land?: string }).land === (x as { land?: string }).land));
        const neu: typeof termine = []; const ergaenzt: Ereignis[] = [];
        for (const t of termine) {
          const alt = vorhanden.find(v => gleich(v, t)) ?? ergaenzt.find(v => gleich(v, t));
          if (!alt) { if (!neu.some(n => gleich(n, t))) neu.push(t); continue; }
          if (!alt.zeit && (t.zeit || (t.zeitpunkt && !alt.zeitpunkt))) { Object.assign(alt, t.zeit ? { zeit: t.zeit } : { zeitpunkt: t.zeitpunkt }); if (!ergaenzt.includes(alt)) ergaenzt.push(alt); }
        }
        if (b.vorschau) return Response.json({ termine: termine.sort((a, c) => `${a.datum}${a.zeit ?? "99"}`.localeCompare(`${c.datum}${c.zeit ?? "99"}`)), neu: neu.length, doppelt: termine.length - neu.length, ergaenzt: ergaenzt.length, ohneTag, ki });
        for (const t of neu) { const x: Ereignis = { ...t, id: neueId() }; await s.speichereGlobal("ereignis", x.id, x); }
        for (const x of ergaenzt) await s.speichereGlobal("ereignis", x.id, x);
        umfeldVergessen(); await protokolliere(s, req, "Termine importiert", quelle || "Kalender", `${neu.length} neu, ${termine.length - neu.length} schon vorhanden, ${ergaenzt.length} ergänzt`);
        return Response.json({ neu: neu.length, doppelt: termine.length - neu.length, ergaenzt: ergaenzt.length });
      }
      case "termine-alte-loeschen": {
        const grenze = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10); const alt = (await gespeicherteEreignisse(s)).filter(e => e.datum < grenze);
        for (const e of alt) await s.loescheGlobal("ereignis", e.id); umfeldVergessen(); await protokolliere(s, req, "Alte Termine entfernt", undefined, `${alt.length} vor ${grenze}`);
        return Response.json({ geloescht: alt.length });
      }
      case "ereignis-loeschen": { if (String(b.id).startsWith("gk-")) throw new Error("Termine aus dem Grundkalender stehen fest und lassen sich nicht entfernen."); const e = (await ereignisse(s)).find(x => x.id === b.id); await s.loescheGlobal("ereignis", b.id); umfeldVergessen(); await protokolliere(s, req, "Termin entfernt", e?.titel, e?.datum); return Response.json({ ok: true }); }
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

/** Termin aus Vorschau oder KI prüfen: nur bekannte Felder, gültiges Datum und Uhrzeit */
function pruefeTermin(x: unknown): Termin | null {
  if (!x || typeof x !== "object") return null; const r = x as Record<string, unknown>;
  const datum = typeof r.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.datum) ? r.datum : null; const titel = typeof r.titel === "string" ? r.titel.trim().slice(0, 200) : "";
  if (!datum || titel.length < 3) return null;
  const arten: Termin["art"][] = ["zinsentscheid", "inflation", "arbeitsmarkt", "konjunktur", "zahlen", "hauptversammlung", "index-aufnahme", "lockup-ende", "ipo", "feiertag", "verfall", "rede", "sonstiges"];
  const art = arten.includes(r.art as Termin["art"]) ? r.art as Termin["art"] : ordneTermin(titel, typeof r.land === "string" ? r.land : undefined).art;
  const t: Termin = { datum, titel, art, wichtig: r.wichtig === true };
  if (typeof r.zeit === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.zeit)) t.zeit = r.zeit;
  if (r.zeitpunkt === "vorboerslich" || r.zeitpunkt === "nachboerslich") t.zeitpunkt = r.zeitpunkt;
  if (typeof r.land === "string" && /^[A-Z]{2}$/.test(r.land)) t.land = r.land;
  if (typeof r.symbol === "string" && /^[A-Z]{1,5}(\.[A-Z])?$/.test(r.symbol)) t.symbol = r.symbol;
  for (const k of ["prognose", "vorwert", "unternehmen", "quelle"] as const) if (typeof r[k] === "string" && r[k]) t[k] = (r[k] as string).slice(0, 80);
  return t;
}
