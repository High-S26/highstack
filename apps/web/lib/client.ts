"use client";
import type { Objektdatensatz, Profil } from "./typen";

async function json<T>(r: Response): Promise<T> { if (r.status === 410 && typeof location !== "undefined") { location.href = "/login?fehler=geloescht"; } if (r.status === 401 && typeof location !== "undefined" && location.pathname !== "/login") { location.href = "/login"; } if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error((e as { fehler?: string }).fehler ?? `Fehler ${r.status}`); } return r.json() as Promise<T>; }
export const api = {
  status: () => fetch("/api/status").then(r => json<{ testmodus: boolean; speicher: string }>(r)),
  profil: () => fetch("/api/profil").then(r => json<Profil>(r)),
  speichereProfil: (p: Profil) => fetch("/api/profil", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) }).then(r => json<Profil>(r)),
  objekte: () => fetch("/api/objekte").then(r => json<Objektdatensatz[]>(r)),
  neuesObjekt: (b: { anlageprofilId?: string; beispiel?: boolean; status?: string; objekt?: Partial<import("@highstack/engine").Objekt>; expose?: string }) => fetch("/api/objekte", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => json<Objektdatensatz>(r)),
  objekt: (id: string) => fetch(`/api/objekte/${id}`).then(r => json<Objektdatensatz>(r)),
  aendereObjekt: (id: string, patch: Partial<Objektdatensatz>) => fetch(`/api/objekte/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }).then(r => json<Objektdatensatz>(r)),
  loescheObjekt: (id: string) => fetch(`/api/objekte/${id}`, { method: "DELETE" }),
  rueckfrage: (id: string, experte: string, frage: string) => fetch(`/api/objekte/${id}/rueckfrage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ experte, frage }) }).then(r => json<{ antwort: string; verlauf: { rolle: string; text: string }[] }>(r)),
  hochladen: (id: string, dateien: File[], schluessel?: string) => { const f = new FormData(); dateien.forEach(d => f.append("dateien", d)); if (schluessel) f.append("schluessel", schluessel); return fetch(`/api/objekte/${id}/dokumente`, { method: "POST", body: f }).then(r => json<{ ergebnis: { datei: string; schluessel: string; titel: string; zeichen: number; sicher: boolean; grundriss?: number[] }[]; dokumente: Objektdatensatz["dokumente"] }>(r)); },
  entferneDatei: (id: string, datei: string) => fetch(`/api/objekte/${id}/dokumente?datei=${encodeURIComponent(datei)}`, { method: "DELETE" }).then(r => json<{ dokumente: Objektdatensatz["dokumente"] }>(r)),
  kurzurteil: (id: string, neu?: boolean) => fetch(`/api/objekte/${id}/kurzurteil`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ neu }) }).then(r => json<{ ergebnis: Kurzurteil; ausSpeicher: boolean; verbrauch: Verbrauchsanzeige }>(r)),
  erfassen: (q: { datei?: File; url?: string; text?: string }) => { const f = new FormData(); if (q.datei) f.append("datei", q.datei); if (q.url) f.append("url", q.url); if (q.text) f.append("text", q.text); return fetch("/api/erfassen", { method: "POST", body: f }).then(r => json<{ felder: Partial<import("@highstack/engine").Objekt>; gefunden: string[]; quelle: "ki" | "muster" | "keine"; text: string; hinweis?: string }>(r)); },
  sichten: (text: string, anlageprofilId: string, suchId?: string) => fetch("/api/sichten", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, anlageprofilId, suchId }) }).then(r => json<{ angelegt: Objektdatensatz[] }>(r)),
  markt: (region: string, asset: string, anlageprofilId: string) => fetch("/api/markt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ region, asset, anlageprofilId }) }).then(r => json<{ region: string; asset: string; am: number; ergebnis: unknown; schritte: string[] }>(r)),
};

export type Kurzurteil = { kernaussage: string; einstufung: string; fragen: { an: string; frage: string }[]; verhandlungsansatz: string; naechster_schritt: string };
export type Verbrauchsanzeige = { aufrufe: number; inputTokens: number; outputTokens: number; ms: number; ausSpeicher?: number };
export const verbrauchText = (v: Verbrauchsanzeige) => v.aufrufe === 0 ? `Kein Modellaufruf${v.ausSpeicher ? ` · ${v.ausSpeicher} aus Speicher` : ""}` : `${v.aufrufe} Modellaufruf${v.aufrufe === 1 ? "" : "e"} · ${(v.inputTokens + v.outputTokens).toLocaleString("de-DE")} Tokens · ${(v.ms / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} s${v.ausSpeicher ? ` · ${v.ausSpeicher} aus Speicher` : ""}`;
export type Stromereignis = { typ: string; experte?: string; text?: string; meldung?: string; ergebnis?: unknown; schritte?: string[]; [k: string]: unknown };
/** Liest einen Server-Sent-Events-Strom aus einer POST-Anfrage. */
export async function strom(url: string, body: unknown, onEreignis: (e: Stromereignis) => void, signal?: AbortSignal) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  if (!r.ok || !r.body) { const e = await r.json().catch(() => ({})); throw new Error((e as { fehler?: string }).fehler ?? `Fehler ${r.status}`); }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let puffer = "";
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    puffer += dec.decode(value, { stream: true });
    let i; while ((i = puffer.indexOf("\n\n")) >= 0) { const block = puffer.slice(0, i); puffer = puffer.slice(i + 2); const zeile = block.split("\n").find(l => l.startsWith("data: ")); if (zeile) onEreignis(JSON.parse(zeile.slice(6))); }
  }
}
