import { EXPERTEN_DEFINITIONEN, QUALITAET } from "./experts.generated";

export type ExpertId = (typeof EXPERTEN_DEFINITIONEN)[number]["id"];
export interface Expertendefinition { id: string; titel: string; rolle: string; beschreibung: string; werkzeuge: readonly string[]; modell: "expert" | "fast"; ausgabe: string; anweisung: string }
export const EXPERTEN: readonly Expertendefinition[] = EXPERTEN_DEFINITIONEN as readonly Expertendefinition[];
export const experte = (id: string) => { const e = EXPERTEN.find(x => x.id === id); if (!e) throw new Error(`Unbekannter Experte: ${id}`); return e; };
export { QUALITAET };
/** Fachexperten, die im Teamlauf immer arbeiten. */
export const TEAM_KERN = ["makler", "verwalter", "bank", "vermoegen", "steuer", "recht"] as const;
