import { speicher } from "./speicher";
import { dauerlauf } from "./trading";

/** Simulation alle 5 Sekunden eine Handelsminute, echte Broker höchstens einmal pro Minute */
export function starteDauerlauf() {
  if (process.env.TRADING_DAUERLAUF === "0" || (globalThis as { hsDauerlauf?: boolean }).hsDauerlauf) return;
  (globalThis as { hsDauerlauf?: boolean }).hsDauerlauf = true;
  let laeuft = false;
  setInterval(async () => { if (laeuft) return; laeuft = true; try { await dauerlauf(await speicher()); } catch { /* nächster Versuch */ } finally { laeuft = false; } }, Number(process.env.TRADING_TAKT_MS ?? 5000));
}
