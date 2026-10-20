/** Teamlauf im Terminal: npm run team (Beispielobjekt; ohne API-Key im Testmodus). */
import { BEISPIEL_ANLAGEPROFIL, BEISPIEL_INVESTOR, BEISPIEL_OBJEKT } from "@highstack/engine";
import { ausUmgebung, kurzurteil, neuerVerbrauch, teamlauf } from "./index";

const { client, modelle, testmodus } = ausUmgebung();
console.log(`highstack Teamlauf${testmodus ? " (Testmodus, kein API-Key)" : ""} · ${BEISPIEL_OBJEKT.titel}`);
const t0 = Date.now();
const eingabe = { investor: BEISPIEL_INVESTOR, anlageprofil: BEISPIEL_ANLAGEPROFIL, objekt: BEISPIEL_OBJEKT, module: { moebliert: {} } };
const v1 = neuerVerbrauch();
const k = await kurzurteil({ client, modelle, eingabe, verbrauch: v1 });
console.log(`Kurzurteil: ${k.ergebnis.einstufung} · ${k.ergebnis.kernaussage} (${v1.aufrufe} Aufruf)\n`);
const r = await teamlauf({
  client, modelle, erzwingen: true, gleichzeitig: Number(process.env.HIGHSTACK_TEAM_CONCURRENCY ?? 3),
  eingabe,
  onEreignis: e => { if (e.typ === "schritt") console.log(`  [${e.experte}] ${e.text}`); if (e.typ === "fehler") console.log(`  [${e.experte}] Fehler: ${e.meldung}`); },
});
console.log(`\nUrteil: ${r.komitee?.ergebnis.synthese.urteil ?? "–"} · ${r.komitee?.ergebnis.synthese.zusammenfassung ?? ""}`);
console.log(`Compliance: ${r.compliance ? (r.compliance.freigabe ? "freigegeben" : `${r.compliance.beanstandungen.length} Beanstandungen`) + ` (${r.compliance.quelle})` : "–"} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(`Verbrauch Teamlauf: ${r.verbrauch.aufrufe} Aufrufe · ${r.verbrauch.inputTokens.toLocaleString("de-DE")} Input-Tokens · ${r.verbrauch.outputTokens.toLocaleString("de-DE")} Output-Tokens`);
