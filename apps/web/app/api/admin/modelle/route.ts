import { EXPERTEN, fuehreAus, neuerVerbrauch, ollamaModelle, pruefeSchema, SCHEMA_JE_AUSGABE } from "@highstack/agents";
import { BEISPIEL_ANLAGEPROFIL, BEISPIEL_INVESTOR, BEISPIEL_OBJEKT } from "@highstack/engine";
import { istAdmin, keinAdmin, protokolliere } from "@/lib/admin";
import { laufoptionen, marktwissenFuer } from "@/lib/agenten";
import { festerClient, modellwahl, rueckfaelle, speichereModellwahl, STANDARD_WAHL, type Modellwahl } from "@/lib/modelle";
import { mandant, speicher } from "@/lib/speicher";
import { LEERES_OBJEKT } from "@/lib/vorgaben";
export const dynamic = "force-dynamic";
export const maxDuration = 600;

/** Experten, die sich am Objekt vergleichen lassen; Terminleser mit einem festen Beispieltext */
const VERGLEICHBAR = ["kurzurteil", "makler", "bank", "verwalter", "steuer", "vermoegen", "recht", "terminleser"] as const;
const BEISPIELTEXT = `Wochenvorschau
Montag, 9. November 2026
10:00 Deutschland: ifo-Geschäftsklima November
14:30 USA: Empire-State-Index
Dienstag, 10. November
08:00 Deutschland: Verbraucherpreise Oktober (endgültig)
11:00 Eurozone: ZEW-Konjunkturerwartungen
nach Börsenschluss: Quartalszahlen Cisco
Mittwoch, 11. November
14:30 USA: Verbraucherpreise Oktober
20:00 USA: Fed-Protokoll
Donnerstag, 12. November
07:00 Quartalszahlen Siemens, Allianz
14:30 USA: Erstanträge Arbeitslosenhilfe
Freitag, 13. November
14:30 USA: Einzelhandelsumsatz Oktober`;
const ERWARTET_TERMINE = 13;

export async function GET(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const w = await modellwahl(s);
  let lokal: { ok: boolean; modelle: Awaited<ReturnType<typeof ollamaModelle>>; fehler?: string };
  try { lokal = { ok: true, modelle: await ollamaModelle(w.ollamaUrl) }; } catch (e) { lokal = { ok: false, modelle: [], fehler: (e as Error).message }; }
  const objekte = (await s.objekte(mandant(req))).slice(0, 30).map(o => ({ id: o.id, titel: o.objekt.titel }));
  return Response.json({
    wahl: w, lokal, claude: !!process.env.ANTHROPIC_API_KEY, rueckfaelle: rueckfaelle.slice(0, 10),
    experten: EXPERTEN.map(e => ({ id: e.id, titel: e.titel, klasse: e.modell, ausgabe: e.ausgabe, vergleichbar: (VERGLEICHBAR as readonly string[]).includes(e.id) })),
    objekte, vergleiche: (await s.global<Record<string, unknown>>("modellvergleich")).sort((a, b) => Number(b.am) - Number(a.am)).slice(0, 40),
  });
}

const zielOk = (z: unknown) => typeof z === "string" && (z === "claude" || /^ollama:[\w.:/-]{1,80}$/.test(z));

export async function POST(req: Request) {
  const s = await speicher(req); if (!await istAdmin(req, s)) return keinAdmin();
  const b = await req.json().catch(() => null) as { aktion?: string; wahl?: Partial<Modellwahl>; experte?: string; ziel?: string; objektId?: string } | null;
  if (b?.aktion === "speichern" && b.wahl) {
    const x = b.wahl; const w: Modellwahl = { ...STANDARD_WAHL, ...(await modellwahl(s)) };
    if (typeof x.ollamaUrl === "string") { if (!/^https?:\/\/[\w.-]+(:\d+)?\/?$/.test(x.ollamaUrl)) return Response.json({ fehler: "Ollama-Adresse ungültig (z. B. http://127.0.0.1:11434)" }, { status: 400 }); w.ollamaUrl = x.ollamaUrl; }
    if (typeof x.kontext === "number") w.kontext = Math.max(2048, Math.min(131072, Math.round(x.kontext)));
    if (typeof x.denken === "boolean") w.denken = x.denken;
    if (typeof x.rueckfallClaude === "boolean") w.rueckfallClaude = x.rueckfallClaude;
    if (zielOk(x.standardFast)) w.standardFast = x.standardFast!; if (zielOk(x.standardExpert)) w.standardExpert = x.standardExpert!;
    if (x.jeExperte && typeof x.jeExperte === "object") w.jeExperte = Object.fromEntries(Object.entries(x.jeExperte).filter(([k, v]) => EXPERTEN.some(e => e.id === k) && zielOk(v)));
    await speichereModellwahl(s, w); await protokolliere(s, req, "KI-Modelle geändert");
    return Response.json({ wahl: w });
  }
  if (b?.aktion === "vergleich") {
    if (!b.experte || !(VERGLEICHBAR as readonly string[]).includes(b.experte) || !zielOk(b.ziel)) return Response.json({ fehler: "Experte oder Modell ungültig" }, { status: 400 });
    const w = await modellwahl(s); const ex = EXPERTEN.find(e => e.id === b.experte)!;
    let fc; try { fc = festerClient(b.ziel === "claude" && ex.modell === "fast" ? "claude-fast" : b.ziel!, w); } catch (e) { return Response.json({ fehler: (e as Error).message }, { status: 400 }); }
    const modelle = { expert: fc.model, fast: fc.model }; const verbrauch = neuerVerbrauch(); const t0 = Date.now();
    let ergebnis: unknown = null, fehler: string | null = null, objektTitel = "Beispielobjekt";
    try {
      if (b.experte === "terminleser") {
        objektTitel = "Beispiel-Wochenvorschau";
        ergebnis = (await fuehreAus("terminleser", { client: fc.client, modelle, verbrauch, eingabe: { investor: BEISPIEL_INVESTOR, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: { ...LEERES_OBJEKT, titel: "Wirtschaftskalender" } }, signal: req.signal, maxRunden: 1, maxTokens: 8000 }, `Heute ist 2026-11-08. Übertrage die Termine aus diesem Text:\n"""${BEISPIELTEXT}"""`)).ergebnis;
      } else {
        const t = mandant(req); const o = b.objektId ? await s.objekt(t, b.objektId) : null;
        if (o) {
          objektTitel = o.objekt.titel;
          const lo = laufoptionen(await s.profil(t), o, req.signal, await marktwissenFuer(s, o));
          ergebnis = (await fuehreAus(b.experte, { ...lo, client: fc.client, modelle, verbrauch })).ergebnis;
        } else ergebnis = (await fuehreAus(b.experte, { client: fc.client, modelle, verbrauch, eingabe: { investor: BEISPIEL_INVESTOR, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: BEISPIEL_OBJEKT }, signal: req.signal })).ergebnis;
      }
    } catch (e) { fehler = (e as Error).message; }
    const schemaFehler = ergebnis ? pruefeSchema(ergebnis, SCHEMA_JE_AUSGABE[ex.ausgabe]) : [];
    const termine = b.experte === "terminleser" && ergebnis ? ((ergebnis as { termine?: unknown[] }).termine?.length ?? 0) : null;
    const eintrag = {
      id: `v${Date.now().toString(36)}`, am: Date.now(), experte: b.experte, ziel: b.ziel, modell: fc.model, objekt: objektTitel,
      ms: Date.now() - t0, aufrufe: verbrauch.aufrufe, inputTokens: verbrauch.inputTokens, outputTokens: verbrauch.outputTokens,
      fehler, schemaFehler: schemaFehler.slice(0, 12), ok: !fehler && schemaFehler.length === 0,
      ...(termine != null ? { termine, termineErwartet: ERWARTET_TERMINE } : {}), ergebnis,
    };
    await s.speichereGlobal("modellvergleich", eintrag.id, eintrag);
    return Response.json(eintrag);
  }
  return Response.json({ fehler: "Unbekannte Aktion" }, { status: 400 });
}
