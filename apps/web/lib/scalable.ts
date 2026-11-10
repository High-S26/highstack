import { execFile } from "node:child_process";
import { scalable, schliesse, ScFehler, type Journaleintrag, type ScAusfuehrer, type ScOrder, type ScVorschau } from "@highstack/trading";
import { istAdmin } from "./admin";
import type { Speicher } from "./speicher";

/**
 * Scalable Capital über die offizielle Scalable CLI auf dem Rechner, auf dem highstack läuft.
 * Die CLI-Sitzung gehört dem, der sich im Terminal mit `sc login` angemeldet hat. Darum:
 * - nur mit SCALABLE_CLI=1 eingeschaltet,
 * - nur für Plattform-Admins (lokal ohne Anmeldung: der Nutzer selbst), nie für andere Konten,
 * - Ausführen (Phase 2) nur mit TRADING_LIVE=1, immer erst nach Freigabe durch einen Klick,
 * - nach einem Fehler mit unklarem Ausgang keine neue Order, bis der Nutzer die Umsätze geprüft hat.
 */
export const scalableAn = () => process.env.SCALABLE_CLI === "1";
export const echtgeldAn = () => process.env.TRADING_LIVE === "1";
export async function darfScalable(req: Request, s: Speicher) { return scalableAn() && await istAdmin(req, s); }

const ausfuehrer: ScAusfuehrer = args => new Promise(resolve => {
  execFile(process.env.SC_BIN || "sc", args, { timeout: 60_000, maxBuffer: 10 * 1024 * 1024, env: process.env }, (err, stdout) => {
    const code = err ? ((err as NodeJS.ErrnoException).code === "ENOENT" ? 127 : typeof (err as { code?: unknown }).code === "number" ? (err as { code: number }).code : 1) : 0;
    resolve({ stdout: String(stdout ?? ""), code });
  });
});
export const sc = () => scalable(ausfuehrer);

/** Was die Order im Journal bewirkt: neuer Eintrag beim Einstieg, Stopp oder Schließen eines bestehenden */
export interface Orderkontext {
  neu?: Pick<Journaleintrag, "basis" | "richtung" | "quelle" | "idee" | "einsatz" | "stoppProdukt" | "zielProdukt" | "modell"> & { art: Journaleintrag["produkt"]["art"]; hebel: number };
  journalId?: string; rolle?: "stopp" | "schliessen";
}
type Gespeichert = ScVorschau & { id: string; zweck?: string; kontext?: Orderkontext };
export const JOURNAL = "trading-journal";
const ART = "scalable-vorschau";
export interface Sperre { id: "sperre"; seit: number; grund: string }

export async function sperre(s: Speicher) { return s.globalEins<Sperre>("scalable", "sperre"); }
/** Phase 1: Vorschau holen und serverseitig merken (die Freigabe kommt mit der ID, nicht mit den Order-Daten) */
export async function vorbereiten(s: Speicher, o: ScOrder, zweck?: string, kontext?: Orderkontext) {
  const sp = await sperre(s); if (sp) throw new ScFehler("gesperrt", `Neue Orders sind gesperrt: ${sp.grund} Bitte in der Scalable-App die Umsätze prüfen und danach hier „geprüft“ bestätigen.`);
  const v = await sc().vorschau(o); const id = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // alte Vorschauen aufräumen
  for (const alt of await s.global<Gespeichert>(ART)) if (alt.gueltigBis < Date.now()) await s.loescheGlobal(ART, alt.id);
  await s.speichereGlobal(ART, id, { ...v, id, zweck, kontext });
  return { ...v, id, zweck, kontext };
}
/** Phase 2: nur nach Freigabe; jede Vorschau nur einmal */
export async function freigeben(s: Speicher, id: string, angemessenheitBestaetigt: boolean) {
  if (!echtgeldAn()) throw new ScFehler("live_aus", "Ausführen mit echtem Geld ist auf diesem Server aus (TRADING_LIVE=1 in .env). Vorschau und Kurse funktionieren trotzdem.");
  const sp = await sperre(s); if (sp) throw new ScFehler("gesperrt", `Neue Orders sind gesperrt: ${sp.grund}`);
  const v = await s.globalEins<Gespeichert>(ART, id); if (!v) throw new ScFehler("confirmation_not_found", "Vorschau nicht gefunden oder schon verwendet. Bitte neu vorbereiten.");
  await s.loescheGlobal(ART, id);
  try {
    const r = await sc().ausfuehren(v, { angemessenheitBestaetigt });
    const journal = await insJournal(s, v, r.orderId).catch(() => null);
    return { ...r, order: v.order, zweck: v.zweck, journal };
  }
  catch (e) {
    if (e instanceof ScFehler && e.ausgangUnbekannt) await s.speichereGlobal("scalable", "sperre", { id: "sperre", seit: Date.now(), grund: `Bei „${v.order.seite === "kauf" ? "Kauf" : "Verkauf"} ${v.order.isin}“ ist unklar, ob die Order angekommen ist.` } satisfies Sperre);
    throw e;
  }
}
export const verwerfen = (s: Speicher, id: string) => s.loescheGlobal(ART, id);
export const entsperren = (s: Speicher) => s.loescheGlobal("scalable", "sperre");

/** Journal nach einer freigegebenen Order fortschreiben (Kurs aus der Vorschau: Brief beim Kauf, Geld beim Verkauf) */
async function insJournal(s: Speicher, v: Gespeichert, orderId: string | null): Promise<Journaleintrag | null> {
  const k = v.kontext; if (!k) return null;
  if (k.neu && v.order.seite === "kauf") {
    const n = k.neu; const e: Journaleintrag = {
      id: `j${Date.now().toString(36)}`, am: Date.now(), basis: n.basis, richtung: n.richtung, quelle: n.quelle, idee: n.idee ?? null,
      produkt: { isin: v.order.isin, name: v.name, art: n.art, hebel: n.hebel }, einsatz: v.volumen ?? n.einsatz,
      einstieg: { kurs: v.kurs.ask ?? v.kurs.mid, stueck: v.stueck, orderId, am: Date.now() },
      stoppProdukt: n.stoppProdukt, zielProdukt: n.zielProdukt, modell: n.modell ?? null, status: "offen",
    };
    await s.speichereGlobal(JOURNAL, e.id, e); return e;
  }
  if (!k.journalId) return null;
  const e = await s.globalEins<Journaleintrag>(JOURNAL, k.journalId); if (!e) return null;
  const neu = k.rolle === "stopp" && v.order.stopp ? { ...e, stopp: { kurs: v.order.stopp, orderId } }
    : k.rolle === "schliessen" ? schliesse(e, v.kurs.bid ?? v.kurs.mid, v.zweck ?? "Verkauf", orderId) : e;
  await s.speichereGlobal(JOURNAL, e.id, neu); return neu;
}
