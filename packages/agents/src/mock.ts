import type { Block, LlmAnfrage, LlmAntwort, LlmClient } from "./llm";

/**
 * Testmodus ohne API-Key: ruft jedes verfügbare Werkzeug einmal mit plausiblen Eingaben auf
 * und gibt danach ein schemakonformes Beispielergebnis ab. Inhalte sind als Testmodus gekennzeichnet.
 */
export function testClient(): LlmClient {
  let zaehler = 0;
  const id = () => `toolu_test_${++zaehler}`;
  const beispielEingaben: Record<string, unknown[]> = {
    rechne_szenario: [{ eigenkapital: 80000 }, { sollzins: 5 }],
    zielpreis: [{ ziel: "cashflow", wert: 0 }, { ziel: "rendite", wert: 5 }],
    steuer_rechnung: [{ struktur: "privat" }, { struktur: "gmbh" }],
    lies_unterlagen: [{ schluessel: "grundbuch" }],
    rechne_modul: [{ modul: "moebliert" }],
  };
  return {
    async erstelle(a: LlmAnfrage): Promise<LlmAntwort> {
      const tools = (a.tools ?? []).map(t => t.name);
      const erzwungen = a.tool_choice && a.tool_choice.type === "tool";
      const bisher = a.messages.flatMap(m => Array.isArray(m.content) ? m.content : []).filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use").map(b => b.name);
      const offen = tools.filter(t => t !== "abgabe" && beispielEingaben[t] && !bisher.includes(t));
      if (!erzwungen && offen.length) {
        const t = offen[0]!;
        return { stop_reason: "tool_use", content: beispielEingaben[t]!.map(input => ({ type: "tool_use" as const, id: id(), name: t, input })) };
      }
      if (!tools.includes("abgabe")) return { stop_reason: "end_turn", content: [{ type: "text", text: "Testmodus: Antwort auf Ihre Rückfrage, gerechnet mit dem Rechenwerk." }] };
      const schema = (a.tools!.find(t => t.name === "abgabe")!.input_schema as { required?: string[] }).required ?? [];
      let input: unknown;
      if (schema.includes("rollen")) input = { rollen: ["Makler", "WEG-Verwalter", "Vermögensverwalter", "Bankentscheider"].map(r => ({ rolle: r, urteil: "neutral", konfidenz: "mittel", begruendungen: [`Testmodus: Einschätzung ${r}`], warnsignale: [], fragen: [] })), synthese: { urteil: "Watch", zusammenfassung: "Testmodus: Gesamturteil auf Basis der Berichte.", widersprueche: [], naechste_schritte: ["Mit echtem API-Key erneut ausführen"], verhandlung: "Testmodus" } };
      else if (schema.includes("freigabe")) input = { freigabe: true, beanstandungen: [] };
      else if (schema.includes("objekte")) input = { objekte: [] };
      else input = { kernaussage: "Testmodus: Ergebnis ohne echtes Modell.", bewertung: "neutral", kennzahlen: [{ label: "Testwert", wert: "–", hinweis: "Testmodus" }], abschnitte: [{ titel: "Testmodus", punkte: ["Für echte Ergebnisse ANTHROPIC_API_KEY setzen."] }], fragen: [], naechste_schritte: [], grenzen: "Testmodus ohne Aussagekraft." };
      return { stop_reason: "tool_use", content: [{ type: "tool_use", id: id(), name: "abgabe", input }] };
    },
  };
}
