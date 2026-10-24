import { alpacaNachrichten, cikListe, finraShort, kontextlage, secInsider, type Insidergeschaeft, type Kontextlage, type Nachricht } from "@highstack/trading";
import { entschluessele } from "./geheim";
import type { Agentdatensatz } from "./trading";

/**
 * Kontext je Agent (Nachrichten, Insider, Short-Anteil), höchstens alle 15 Minuten neu geholt.
 * Fehlt eine Quelle (kein Alpaca-Zugang, kein SEC_USER_AGENT, Netz gesperrt), bleibt sie leer und wird genannt.
 */
export interface Kontextstand { zeit: number; lage: Record<string, Kontextlage>; nachrichten: Nachricht[]; insider: Insidergeschaeft[]; quellen: Record<string, string> }
const ablage = ((globalThis as { hsKontext?: Map<string, Kontextstand> }).hsKontext ??= new Map());
const ciks = ((globalThis as { hsCik?: { zeit: number; liste: Record<string, string> | null } }).hsCik ??= { zeit: 0, liste: null });

const vorWerktag = (d: Date) => { const x = new Date(d); do x.setUTCDate(x.getUTCDate() - 1); while ([0, 6].includes(x.getUTCDay())); return x.toISOString().slice(0, 10); };

export async function kontextFuer(a: Agentdatensatz, holen: typeof fetch = fetch, jetzt = new Date()): Promise<Kontextstand> {
  const alt = ablage.get(a.id); if (alt && jetzt.getTime() - alt.zeit < 15 * 60_000) return alt;
  const symbole = a.einstellungen.symbole; const quellen: Record<string, string> = {};
  let nachrichten: Nachricht[] = []; let insider: Insidergeschaeft[] = []; let short: Record<string, number> = {};
  const keyId = a.zugang?.keyId ?? process.env.ALPACA_KEY_ID; const secret = a.zugang ? await entschluessele(a.zugang.secret).catch(() => undefined) : process.env.ALPACA_SECRET;
  if (keyId && secret) {
    try { nachrichten = await alpacaNachrichten({ keyId, secret }, symbole, new Date(jetzt.getTime() - 48 * 3600_000).toISOString(), holen); quellen.nachrichten = `${nachrichten.length} Meldungen`; }
    catch (e) { quellen.nachrichten = `nicht erreichbar (${(e as Error).message})`; }
  } else quellen.nachrichten = "ohne Alpaca-Zugang nicht verfügbar";
  const agent = process.env.SEC_USER_AGENT;
  if (agent) {
    try {
      if (!ciks.liste || jetzt.getTime() - ciks.zeit > 86_400_000) { ciks.liste = await cikListe(holen, agent); ciks.zeit = jetzt.getTime(); }
      const seit = new Date(jetzt.getTime() - 35 * 86_400_000).toISOString().slice(0, 10);
      for (const s of symbole) { const cik = ciks.liste[s]; if (cik) insider.push(...await secInsider(s, cik, seit, holen, agent)); }
      quellen.insider = `${insider.length} Geschäfte in 35 Tagen`;
    } catch (e) { quellen.insider = `nicht erreichbar (${(e as Error).message})`; insider = []; }
  } else quellen.insider = "SEC_USER_AGENT fehlt (Name und E-Mail, verlangt von der SEC)";
  try { short = await finraShort(vorWerktag(jetzt), symbole, holen); quellen.short = `Stand ${vorWerktag(jetzt)}`; }
  catch (e) { quellen.short = `nicht erreichbar (${(e as Error).message})`; }
  const lage = Object.fromEntries(symbole.map(s => [s, kontextlage(s, nachrichten, insider, short[s] ?? null, jetzt)]));
  const stand = { zeit: jetzt.getTime(), lage, nachrichten: nachrichten.slice(0, 30), insider: insider.slice(0, 50), quellen };
  ablage.set(a.id, stand); return stand;
}
