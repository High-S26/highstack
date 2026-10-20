import { ausUmgebung, type Dokumentquelle, type Ereignis } from "@highstack/agents";
import { analyse, type Analyseeingabe } from "@highstack/engine";
import type { Objektdatensatz, Profil } from "./typen";

export function eingabeFuer(p: Profil, o: Objektdatensatz): Analyseeingabe {
  const ap = p.anlageprofile.find(a => a.id === o.anlageprofilId) ?? p.anlageprofile[0]!;
  return { investor: p.investor, anlageprofil: ap, objekt: o.objekt, szenario: o.szenario, module: o.module };
}
export function dokumentquelle(o: Objektdatensatz): Dokumentquelle {
  return {
    liste: () => o.dokumente.map(d => ({ schluessel: d.schluessel, titel: d.titel, status: d.text ? (d.status === "offen" ? "erhalten" : d.status) : d.status })),
    lies: async key => { const d = o.dokumente.find(x => x.schluessel === key && x.text); return d ? { titel: d.titel, text: d.text!, befund: d.befund } : null; },
  };
}
export function laufoptionen(p: Profil, o: Objektdatensatz, signal?: AbortSignal) {
  const { client, modelle, testmodus } = ausUmgebung();
  const eingabe = eingabeFuer(p, o);
  return { client, modelle, testmodus, eingabe, analyse: analyse(eingabe), dokumente: dokumentquelle(o), signal };
}

/** Server-Sent Events aus einer asynchronen Arbeit. */
export function ereignisstrom(arbeit: (senden: (e: Ereignis | { typ: string; [k: string]: unknown }) => void, signal: AbortSignal) => Promise<void>, req: Request) {
  const enc = new TextEncoder();
  const ctl = new AbortController();
  req.signal.addEventListener("abort", () => ctl.abort());
  const stream = new ReadableStream({
    async start(c) {
      const senden = (e: unknown) => { try { c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); } catch { /* Verbindung zu */ } };
      try { await arbeit(senden, ctl.signal); }
      catch (err) { senden({ typ: "abbruch", meldung: (err as Error).message }); }
      finally { try { c.close(); } catch { /* bereits zu */ } }
    },
    cancel() { ctl.abort(); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
