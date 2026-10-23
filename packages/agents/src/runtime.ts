import { agentenkontext, analyse as rechne, type Analyse, type Analyseeingabe } from "@highstack/engine";
import { experte, QUALITAET } from "./experten";
import type { Block, LlmAntwort, LlmAnfrage, LlmClient, Modelle, Nachricht, Verbrauch, Werkzeugdefinition } from "./llm";
import { SCHEMA_JE_AUSGABE } from "./schemas";
import { WERKZEUGE, type Dokumentquelle, type Werkzeugkontext } from "./tools";

export type Ereignis =
  | { typ: "start"; experte: string }
  | { typ: "schritt"; experte: string; text: string }
  | { typ: "fertig"; experte: string; ergebnis: unknown; schritte: string[]; ausSpeicher?: boolean }
  | { typ: "fehler"; experte: string; meldung: string };

export interface Laufoptionen {
  client: LlmClient; modelle: Modelle; eingabe: Analyseeingabe; analyse?: Analyse; dokumente?: Dokumentquelle;
  /** Zusätzliche Daten für den Experten, z. B. Berichte anderer Experten oder Portfolio */
  zusatz?: Record<string, unknown>;
  signal?: AbortSignal; onEreignis?: (e: Ereignis) => void; maxRunden?: number;
  /** Antwortlänge, z. B. für große Tabellen */
  maxTokens?: number;
  /** Wird hochgezählt: Aufrufe, Tokens, Dauer */
  verbrauch?: Verbrauch;
}

async function rufe(o: Laufoptionen, a: LlmAnfrage): Promise<LlmAntwort> {
  const t0 = Date.now();
  const res = await o.client.erstelle(a, o.signal);
  if (o.verbrauch) { o.verbrauch.aufrufe++; o.verbrauch.inputTokens += res.usage?.input_tokens ?? 0; o.verbrauch.outputTokens += res.usage?.output_tokens ?? 0; o.verbrauch.ms += Date.now() - t0; }
  return res;
}

function kontextNachricht(o: Laufoptionen, a: Analyse) {
  const daten = { ...agentenkontext(o.eingabe, a), unterlagen: o.dokumente?.liste() ?? [], ...(o.zusatz ?? {}) };
  return `Daten zum Objekt und zum Investor (JSON; Prozentwerte als Dezimalzahl, Beträge in Euro):\n${JSON.stringify(daten)}`;
}

/** Führt einen Experten aus: Werkzeug-Schleife, Abgabe über das Werkzeug `abgabe`. */
export async function fuehreAus<T = unknown>(expertId: string, o: Laufoptionen, auftrag?: string): Promise<{ ergebnis: T; schritte: string[] }> {
  const ex = experte(expertId);
  const a = o.analyse ?? rechne(o.eingabe);
  const kontext: Werkzeugkontext = { eingabe: o.eingabe, analyse: a, dokumente: o.dokumente };
  const schema = SCHEMA_JE_AUSGABE[ex.ausgabe];
  if (!schema) throw new Error(`Kein Ausgabeschema für ${ex.ausgabe}`);
  const werkzeuge = ex.werkzeuge.map(w => WERKZEUGE[w]).filter(Boolean);
  const tools: Werkzeugdefinition[] = [...werkzeuge.map(w => ({ name: w!.name, description: w!.description, input_schema: w!.input_schema })), { name: "abgabe", description: "Gibt das fertige Ergebnis ab. Erst aufrufen, wenn alle nötigen Rechnungen erledigt sind.", input_schema: schema }];
  const system = `${ex.anweisung}\n\n${QUALITAET}\n\nKennzahlen, Zielpreise, Szenarien, Sensitivität und Steuern aller Strukturen stehen bereits im Kontext. Rechne sie nicht nach.${werkzeuge.length ? " Nutze Werkzeuge nur für zusätzliche Varianten oder Unterlagen, höchstens drei Aufrufe, und übernimm gerechnete Varianten mit der Annahme in die Kennzahlen." : ""}`;
  const messages: Nachricht[] = [{ role: "user", content: `${auftrag ? auftrag + "\n\n" : ""}${kontextNachricht(o, a)}` }];
  const schritte: string[] = [];
  const schritt = (text: string) => { schritte.push(text); o.onEreignis?.({ typ: "schritt", experte: expertId, text }); };
  o.onEreignis?.({ typ: "start", experte: expertId });
  schritt(werkzeuge.length ? "Sichtet Zahlen und plant die Rechnungen" : "Sichtet die Daten");
  const max = o.maxRunden ?? 5;
  let erzwinge = false;
  try {
    for (let runde = 1; runde <= max; runde++) {
      const letzte = runde === max || erzwinge;
      const res = await rufe(o, { model: ex.modell === "fast" ? o.modelle.fast : o.modelle.expert, max_tokens: o.maxTokens ?? 8000, system, messages, tools, tool_choice: letzte || !werkzeuge.length ? { type: "tool", name: "abgabe" } : { type: "auto" } });
      messages.push({ role: "assistant", content: res.content });
      const aufrufe = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
      const abgabe = aufrufe.find(b => b.name === "abgabe");
      if (abgabe) { schritt("Ergebnis formuliert"); o.onEreignis?.({ typ: "fertig", experte: expertId, ergebnis: abgabe.input, schritte }); return { ergebnis: abgabe.input as T, schritte }; }
      if (!aufrufe.length) { messages.push({ role: "user", content: "Bitte gib dein Ergebnis jetzt über das Werkzeug abgabe ab." }); erzwinge = true; continue; }
      const results: Block[] = [];
      for (const b of aufrufe) {
        const w = WERKZEUGE[b.name];
        try {
          if (!w || !ex.werkzeuge.includes(b.name)) throw new Error(`Werkzeug ${b.name} steht diesem Experten nicht zur Verfügung`);
          const r = await w.ausfuehren((b.input ?? {}) as Record<string, unknown>, kontext);
          schritt(r.zusammenfassung);
          results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(r.ergebnis) });
        } catch (err) {
          results.push({ type: "tool_result", tool_use_id: b.id, content: `Fehler: ${(err as Error).message}`, is_error: true });
        }
      }
      messages.push({ role: "user", content: results });
    }
    throw new Error("Keine Abgabe nach der maximalen Rundenzahl");
  } catch (err) {
    o.onEreignis?.({ typ: "fehler", experte: expertId, meldung: (err as Error).message });
    throw err;
  }
}

/** Rückfrage an einen Experten zu seinem Ergebnis. Antwortet in Text, kann Werkzeuge nutzen. */
export async function rueckfrage(expertId: string, o: Laufoptionen & { bisherigesErgebnis: unknown; verlauf: { rolle: "nutzer" | "experte"; text: string }[]; frage: string }): Promise<string> {
  const ex = experte(expertId);
  const a = o.analyse ?? rechne(o.eingabe);
  const kontext: Werkzeugkontext = { eingabe: o.eingabe, analyse: a, dokumente: o.dokumente };
  const werkzeuge = ex.werkzeuge.map(w => WERKZEUGE[w]).filter(Boolean);
  const tools = werkzeuge.map(w => ({ name: w!.name, description: w!.description, input_schema: w!.input_schema }));
  const system = `${ex.anweisung}\n\n${QUALITAET.replace(/- Abschluss:.*$/m, "")}\n\nDer Investor stellt Rückfragen zu deinem Ergebnis. Antworte als dieser Experte präzise, höchstens 180 Wörter, Aufzählungen erlaubt, ohne Überschriften. Rechne Varianten mit den Werkzeugen, statt zu schätzen.`;
  const messages: Nachricht[] = [
    { role: "user", content: `${kontextNachricht(o, a)}\n\nDein bisheriges Ergebnis:\n${JSON.stringify(o.bisherigesErgebnis)}` },
    { role: "assistant", content: "Verstanden. Ich beantworte Rückfragen zu meinem Ergebnis." },
    ...o.verlauf.slice(-8).map(v => ({ role: v.rolle === "nutzer" ? "user" as const : "assistant" as const, content: v.text })),
    { role: "user", content: o.frage },
  ];
  for (let runde = 1; runde <= 6; runde++) {
    const res = await rufe(o, { model: ex.modell === "fast" ? o.modelle.fast : o.modelle.expert, max_tokens: 2000, system, messages, ...(tools.length ? { tools, tool_choice: { type: "auto" as const } } : {}) });
    messages.push({ role: "assistant", content: res.content });
    const aufrufe = res.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
    if (!aufrufe.length) return res.content.filter((b): b is Extract<Block, { type: "text" }> => b.type === "text").map(b => b.text).join("\n").trim();
    const results: Block[] = [];
    for (const b of aufrufe) {
      try { const r = await WERKZEUGE[b.name]!.ausfuehren((b.input ?? {}) as Record<string, unknown>, kontext); o.onEreignis?.({ typ: "schritt", experte: expertId, text: r.zusammenfassung }); results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(r.ergebnis) }); }
      catch (err) { results.push({ type: "tool_result", tool_use_id: b.id, content: `Fehler: ${(err as Error).message}`, is_error: true }); }
    }
    messages.push({ role: "user", content: results });
  }
  return "Die Rückfrage konnte nicht abgeschlossen werden.";
}

/** Fingerabdruck der Eingaben eines Experten. Gleicher Fingerabdruck = gleiches Ergebnis, kein neuer Lauf nötig. */
export async function eingabeHash(expertId: string, o: Pick<Laufoptionen, "eingabe" | "analyse" | "dokumente" | "zusatz">): Promise<string> {
  const { createHash } = await import("node:crypto");
  const ex = experte(expertId);
  const a = o.analyse ?? rechne(o.eingabe);
  const roh = JSON.stringify({ e: expertId, v: ex.anweisung.length + ":" + ex.werkzeuge.join(","), k: agentenkontext(o.eingabe, a), u: o.dokumente?.liste() ?? [], z: o.zusatz ?? null });
  return createHash("sha256").update(roh).digest("hex").slice(0, 32);
}
