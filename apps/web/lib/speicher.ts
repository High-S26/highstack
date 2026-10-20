import { promises as fs } from "node:fs";
import { join } from "node:path";
import { MANDANT_HEADER, NUTZER_HEADER } from "./auth";
import type { Nutzer, Objektdatensatz, Profil } from "./typen";
import { standardProfil } from "./vorgaben";

/** Speicher-Schnittstelle. Jede Operation ist auf einen Mandanten beschränkt. */
export interface Speicher {
  profil(tenant: string): Promise<Profil>;
  speichereProfil(tenant: string, p: Profil): Promise<void>;
  objekte(tenant: string): Promise<Objektdatensatz[]>;
  objekt(tenant: string, id: string): Promise<Objektdatensatz | null>;
  speichereObjekt(tenant: string, o: Objektdatensatz): Promise<void>;
  loescheObjekt(tenant: string, id: string): Promise<void>;
  speichereDatei(tenant: string, objektId: string, id: string, name: string, mime: string, inhalt: Uint8Array): Promise<void>;
  datei(tenant: string, id: string): Promise<{ name: string; mime: string; inhalt: Uint8Array } | null>;
  /** Nutzer sind mandantenübergreifend nach E-Mail gespeichert */
  nutzer(email: string): Promise<Nutzer | null>;
  speichereNutzer(n: Nutzer): Promise<void>;
  nutzerVon(tenant: string): Promise<Nutzer[]>;
  loescheNutzer(email: string): Promise<void>;
}

/** Dateispeicher für Entwicklung und Einzelplatz: .data/store.json und .data/files. */
function dateiSpeicher(verzeichnis = join(process.cwd(), ".data")): Speicher {
  const datei = join(verzeichnis, "store.json");
  type Bestand = { profile: Record<string, Profil>; objekte: Record<string, Record<string, Objektdatensatz>>; dateien: Record<string, { tenant: string; name: string; mime: string }>; nutzer?: Record<string, Nutzer> };
  let kette: Promise<unknown> = Promise.resolve();
  const lies = async (): Promise<Bestand> => { try { return JSON.parse(await fs.readFile(datei, "utf8")); } catch { return { profile: {}, objekte: {}, dateien: {} }; } };
  const schreibe = async (b: Bestand) => { await fs.mkdir(verzeichnis, { recursive: true }); const tmp = datei + ".tmp"; await fs.writeFile(tmp, JSON.stringify(b)); await fs.rename(tmp, datei); };
  const exklusiv = <T>(f: (b: Bestand) => Promise<T> | T, schreiben: boolean) => { const r = kette.then(async () => { const b = await lies(); const x = await f(b); if (schreiben) await schreibe(b); return x; }); kette = r.catch(() => undefined); return r; };
  return {
    profil: t => exklusiv(b => b.profile[t] ?? standardProfil(), false),
    speichereProfil: (t, p) => exklusiv(b => { b.profile[t] = p; }, true),
    objekte: t => exklusiv(b => Object.values(b.objekte[t] ?? {}).sort((a, c) => c.geaendert - a.geaendert), false),
    objekt: (t, id) => exklusiv(b => b.objekte[t]?.[id] ?? null, false),
    speichereObjekt: (t, o) => exklusiv(b => { (b.objekte[t] ??= {})[o.id] = o; }, true),
    loescheObjekt: (t, id) => exklusiv(b => { delete b.objekte[t]?.[id]; }, true),
    async speichereDatei(t, _objektId, id, name, mime, inhalt) {
      await fs.mkdir(join(verzeichnis, "files"), { recursive: true });
      await fs.writeFile(join(verzeichnis, "files", id), inhalt);
      await exklusiv(b => { b.dateien[id] = { tenant: t, name, mime }; }, true);
    },
    nutzer: e => exklusiv(b => b.nutzer?.[e] ?? null, false),
    speichereNutzer: n => exklusiv(b => { (b.nutzer ??= {})[n.email] = n; }, true),
    nutzerVon: t => exklusiv(b => Object.values(b.nutzer ?? {}).filter(n => n.tenant === t).sort((a, c) => a.erstellt - c.erstellt), false),
    loescheNutzer: e => exklusiv(b => { delete b.nutzer?.[e]; }, true),
    async datei(t, id) {
      const meta = await exklusiv(b => b.dateien[id], false);
      if (!meta || meta.tenant !== t) return null;
      return { name: meta.name, mime: meta.mime, inhalt: new Uint8Array(await fs.readFile(join(verzeichnis, "files", id))) };
    },
  };
}

/** Postgres-Speicher. Tabellen werden beim ersten Zugriff angelegt (sql/001_init.sql). */
async function postgresSpeicher(url: string): Promise<Speicher> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, { max: 5 });
  for (const f of (await fs.readdir(join(process.cwd(), "sql"))).filter(x => x.endsWith(".sql")).sort()) await sql.unsafe(await fs.readFile(join(process.cwd(), "sql", f), "utf8"));
  return {
    async profil(t) { const r = await sql`select daten from profil where tenant_id = ${t}`; return (r[0]?.daten as Profil) ?? standardProfil(); },
    async speichereProfil(t, p) { await sql`insert into profil (tenant_id, daten) values (${t}, ${sql.json(p as never)}) on conflict (tenant_id) do update set daten = excluded.daten, geaendert = now()`; },
    async objekte(t) { const r = await sql`select daten from objekte where tenant_id = ${t} order by geaendert desc`; return r.map(x => x.daten as Objektdatensatz); },
    async objekt(t, id) { const r = await sql`select daten from objekte where tenant_id = ${t} and id = ${id}`; return (r[0]?.daten as Objektdatensatz) ?? null; },
    async speichereObjekt(t, o) { await sql`insert into objekte (id, tenant_id, daten) values (${o.id}, ${t}, ${sql.json(o as never)}) on conflict (id) do update set daten = excluded.daten, geaendert = now() where objekte.tenant_id = ${t}`; },
    async loescheObjekt(t, id) { await sql`delete from objekte where tenant_id = ${t} and id = ${id}`; await sql`delete from dateien where tenant_id = ${t} and objekt_id = ${id}`; },
    async speichereDatei(t, objektId, id, name, mime, inhalt) { await sql`insert into dateien (id, tenant_id, objekt_id, name, mime, inhalt) values (${id}, ${t}, ${objektId}, ${name}, ${mime}, ${Buffer.from(inhalt)})`; },
    async nutzer(e) { const r = await sql`select daten from nutzer where email = ${e}`; return (r[0]?.daten as Nutzer) ?? null; },
    async speichereNutzer(n) { await sql`insert into nutzer (email, tenant_id, daten) values (${n.email}, ${n.tenant}, ${sql.json(n as never)}) on conflict (email) do update set tenant_id = excluded.tenant_id, daten = excluded.daten`; },
    async nutzerVon(t) { const r = await sql`select daten from nutzer where tenant_id = ${t} order by erstellt`; return r.map(x => x.daten as Nutzer); },
    async loescheNutzer(e) { await sql`delete from nutzer where email = ${e}`; },
    async datei(t, id) { const r = await sql`select name, mime, inhalt from dateien where tenant_id = ${t} and id = ${id}`; return r[0] ? { name: r[0].name as string, mime: r[0].mime as string, inhalt: new Uint8Array(r[0].inhalt as Buffer) } : null; },
  };
}

let instanz: Promise<Speicher> | null = null;
const geprueft = new Map<string, { ok: boolean; am: number }>();
/** Nutzer wurde entfernt: Sitzung sofort ungültig (Prüfung zwischengespeichert für 60 s) */
export const vergissNutzer = (email: string) => geprueft.delete(email);
/**
 * Speicher. Mit angemeldeter Anfrage wird zusätzlich geprüft, ob der Nutzer noch Zugang hat
 * (die Sitzung selbst ist signiert, ein entzogener Zugang greift so ohne Wartezeit bis zum Ablauf).
 */
export async function speicher(req?: Request): Promise<Speicher> {
  instanz ??= process.env.DATABASE_URL ? postgresSpeicher(process.env.DATABASE_URL) : Promise.resolve(dateiSpeicher());
  const s = await instanz;
  const email = process.env.AUTH_SECRET ? req?.headers.get(NUTZER_HEADER) : null;
  if (email) {
    const c = geprueft.get(email);
    if (!c || Date.now() - c.am > 60000) { const n = await s.nutzer(email); geprueft.set(email, { ok: !!n && n.tenant === req!.headers.get(MANDANT_HEADER), am: Date.now() }); }
    if (!geprueft.get(email)!.ok) throw new Error("Zugang entzogen. Bitte neu anmelden.");
  }
  return s;
}

/**
 * Mandant der Anfrage. Mit Anmeldung setzt die Middleware ihn aus der geprüften Sitzung
 * (eingehende Kopfzeilen dieses Namens werden dort immer überschrieben). Ohne Anmeldung: lokaler Einzelnutzer.
 */
export function mandant(req?: Request): string {
  const t = req?.headers.get(MANDANT_HEADER);
  if (process.env.AUTH_SECRET) { if (!t) throw new Error("Keine Sitzung"); return t; }
  return process.env.HIGHSTACK_TENANT || "lokal";
}
