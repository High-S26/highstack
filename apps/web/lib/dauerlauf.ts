import { speicher } from "./speicher";
import { taeglich } from "./konjunktur";
import { dauerlauf } from "./trading";

/** Simulation alle 5 Sekunden eine Handelsminute, echte Broker höchstens einmal pro Minute */
export function starteDauerlauf() {
  if (process.env.TRADING_DAUERLAUF === "0" || (globalThis as { hsDauerlauf?: boolean }).hsDauerlauf) return;
  (globalThis as { hsDauerlauf?: boolean }).hsDauerlauf = true;
  let laeuft = false;
  setInterval(async () => { if (laeuft) return; laeuft = true; try { await dauerlauf(await speicher()); } catch { /* nächster Versuch */ } finally { laeuft = false; } }, Number(process.env.TRADING_TAKT_MS ?? 5000));
  // Konjunktur: einmal je Tag fällige Prognosen prüfen und neue ablegen (Abruf frei verfügbarer Reihen alle 12 Stunden, abschaltbar mit KONJUNKTUR_ABRUF=0)
  let letzterAbruf = 0;
  const konjunktur = async () => { try { const s = await speicher(); if (process.env.KONJUNKTUR_ABRUF !== "0" && Date.now() - letzterAbruf > 12 * 3600_000) { letzterAbruf = Date.now(); const { abrufAlle } = await import("./konjunktur"); await abrufAlle(s); } await taeglich(s); } catch { /* nächster Versuch */ } };
  setTimeout(konjunktur, 30_000); setInterval(konjunktur, 3600_000);
}
