import { plusTage } from "./indikatoren";
import { prognosen } from "./modell";
import { bewerte, bilanz, gewichteAus, type Bilanz } from "./pruefung";
import type { Ereignis, Prognose, Reihen } from "./types";

/**
 * Rückblick (Walk-forward): An jedem Stichtag nur mit den Daten rechnen, die damals veröffentlicht waren
 * (Verzug je Indikator), Prognosen ablegen und mit dem später Eingetretenen bewerten.
 * Optional lernt das Modell unterwegs: Gewichte werden nur aus bereits fälligen Prognosen nachgeschärft.
 */
export function rueckblick(reihen: Reihen, opts: { von: string; bis: string; schrittTage?: number; ereignisse?: Ereignis[]; lernen?: boolean }): { prognosen: Prognose[]; bilanz: Bilanz; gewichte: Record<string, number> } {
  const schritt = opts.schrittTage ?? 30; const alle: Prognose[] = []; let gewichte: Record<string, number> = {};
  for (let d = opts.von; d <= opts.bis; d = plusTage(d, schritt)) {
    if (opts.lernen) { const reif = alle.map(p => bewerte(p, reihen, d)); gewichte = gewichteAus(bilanz(reif)); }
    alle.push(...prognosen({ stichtag: d, reihen, ereignisse: opts.ereignisse ?? [] }, gewichte, i => `r${d}-${i}`));
  }
  const ende = Object.values(reihen).reduce((m, p) => (p.at(-1)?.d ?? "") > m ? p.at(-1)!.d : m, opts.bis);
  const bewertet = alle.map(p => bewerte(p, reihen, ende));
  const b = bilanz(bewertet);
  return { prognosen: bewertet, bilanz: b, gewichte: gewichteAus(b) };
}
