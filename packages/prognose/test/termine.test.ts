import { describe, expect, it } from "vitest";
import { leseTermine, ordneTermin } from "../src";

const TEXT = `MONTAG, 26. Oktober
TERMINE UNTERNEHMEN
07:00 DE/Deutsche Börse AG, Ergebnis 3Q
22:05 US/NXP Semiconductors NV, Ergebnis 3Q
TERMINE KONJUNKTUR
10:00 DE/Ifo-Geschäftsklimaindex Oktober
PROGNOSE: 88,0
zuvor: 87,7
DIENSTAG, 27. Oktober
15:00 US/Index des Verbrauchervertrauens Oktober
- US/Visa Inc, Ergebnis 4Q, 22:05 Uhr
MITTWOCH, 28. Oktober
13:30 US/Arbeitsmarktbericht Oktober
19:00 US/Fed, Zinsentscheid
Donnerstag, 29.10.2026
13:30 USA: Verbraucherpreise September
Apple Inc., Q4-Zahlen, 22:30 Uhr
Microsoft Corp, Ergebnis 1Q
Freitag, 30. Oktober
D: Hauptversammlung Siemens Healthineers`;

describe("Wirtschaftskalender lesen", () => {
  const { termine } = leseTermine(TEXT, { jahr: 2026, quelle: "n-tv.de" });
  it("liest Tage, Uhrzeiten, Länder, Prognose und Vorwert", () => {
    const ifo = termine.find(t => /Ifo/.test(t.titel))!;
    expect(ifo).toMatchObject({ datum: "2026-10-26", zeit: "10:00", land: "DE", art: "konjunktur", prognose: "88,0", vorwert: "87,7", wichtig: false, quelle: "n-tv.de" });
    expect(termine.find(t => /Visa/.test(t.titel))).toMatchObject({ datum: "2026-10-27", zeit: "22:05", art: "zahlen", symbol: "V", wichtig: true });
    expect(termine.find(t => /Arbeitsmarktbericht/.test(t.titel))).toMatchObject({ zeit: "13:30", land: "US", art: "arbeitsmarkt", wichtig: true });
    expect(termine.find(t => /Zinsentscheid/.test(t.titel))).toMatchObject({ zeit: "19:00", art: "zinsentscheid", wichtig: true });
    expect(termine.find(t => /Verbraucherpreise/.test(t.titel))).toMatchObject({ datum: "2026-10-29", land: "US", art: "inflation", wichtig: true });
    expect(termine.find(t => /Apple/.test(t.titel))).toMatchObject({ datum: "2026-10-29", zeit: "22:30", symbol: "AAPL", art: "zahlen" });
    expect(termine.find(t => /Microsoft/.test(t.titel))).toMatchObject({ symbol: "MSFT", art: "zahlen" });
    expect(termine.find(t => /Hauptversammlung/.test(t.titel))).toMatchObject({ datum: "2026-10-30", land: "DE", art: "hauptversammlung" });
    expect(termine.some(t => /TERMINE/.test(t.titel))).toBe(false);
  });
  it("ordnet Termine ein", () => {
    expect(ordneTermin("EZB, Zinsentscheid", "EU")).toMatchObject({ art: "zinsentscheid", wichtig: true });
    expect(ordneTermin("Erstanträge auf Arbeitslosenhilfe (Woche)", "US")).toMatchObject({ art: "arbeitsmarkt", wichtig: false });
    expect(ordneTermin("Einzelhandelsumsatz September", "US")).toMatchObject({ art: "konjunktur", wichtig: true });
  });
});

describe("Formate aus der Praxis (Wochenvorschau als Druck, Artikel mit Tabelle)", () => {
  const LISTE = `26.10.26, 14:04 Wochenvorschau: Termine bis 1. November 2026 - n-tv.de
Die wichtigsten Ereignisse der Wirtschaft, Börse und Konjunktur.
Montag, 26. Oktober 2026
07:00 AM/EZB-Direktor Elderson, Keynote bei COP17-Konferenz
15:00 EU/Prognoseübersicht von Dow Jones Newswires zu Wachstum,
Inflation (jeweils für Eurozone), Renditen 10-jährige Bundesanleihen, Euribor
AT/Börsenfeiertag: Österreich
Dienstag, 27. Oktober 2026
07:00 DE/DWS Group GmbH & Co KGaA, Ergebnis 3Q
(10:00 Analystenkonferenz)
08:00 GB/Reckitt Benckiser Group plc, Trading Update 30
https://www.n-tv.de/wirtschaft/termine/Termine-bis-1-November-2026-id31452064.html 1/14
12:30 US/Boeing Co, Ergebnis 3Q
15:30 US/Rohöllagerbestandsdaten (Woche) der staatlichen
Energy Information Administration (EIA)
Mittwoch, 28. Oktober 2026
02:00 NZ/Reserve Bank of New Zealand, Ergebnis der Sitzung des geldpolitischen Rats
19:00 US/Fed, Ergebnis der FOMC-Sitzung
21:05 US/Alphabet Inc (Google-Holding), Ergebnis 3Q
Donnerstag, 29. Oktober 2026
13:30 US/Persönliche Ausgaben und Einkommen September
10:00 EU/EZB, Ergebnisse der Umfrage unter geldpolitischen Analysten
08:00 DE/Erwerbstätigkeit 3Q
Sonntag, 1. November 2026
US/Ende der Sommerzeit
Anzeige Anzeige Anzeige`;
  const { termine } = leseTermine(LISTE, { jahr: 2026 });
  const finde = (r: RegExp) => termine.find(t => r.test(t.titel));
  it("Terminliste: Fortsetzungszeilen, Druckzeilen, Ländercodes, Einordnung", () => {
    expect(termine.some(t => /n-tv\.de|Wochenvorschau|Anzeige|^\(10:00/.test(t.titel))).toBe(false);
    expect(finde(/Prognoseübersicht/)!.titel).toMatch(/Euribor$/);
    expect(finde(/Inflation \(jeweils/)).toBe(finde(/Prognoseübersicht/)); // keine eigene Inflationsmeldung
    expect(finde(/DWS/)!.titel).toMatch(/Analystenkonferenz\)$/);
    expect(finde(/Reckitt/)!.titel).toMatch(/Trading Update 3Q$/);
    expect(finde(/Boeing/)).toMatchObject({ art: "zahlen", symbol: "BA" });
    expect(finde(/Rohöl/)!.titel).toMatch(/\(EIA\)$/);
    expect(finde(/Elderson/)).toMatchObject({ land: "AM", art: "rede" });
    expect(finde(/Börsenfeiertag/)).toMatchObject({ land: "AT", art: "feiertag" });
    expect(finde(/New Zealand/)).toMatchObject({ land: "NZ", art: "zinsentscheid", wichtig: false });
    expect(finde(/FOMC/)).toMatchObject({ art: "zinsentscheid", wichtig: true, zeit: "19:00" });
    expect(finde(/Alphabet/)).toMatchObject({ symbol: "GOOGL", zeit: "21:05" });
    expect(finde(/Persönliche Ausgaben/)).toMatchObject({ art: "inflation", wichtig: true });
    expect(finde(/Umfrage/)).toMatchObject({ art: "sonstiges" });
    expect(finde(/Erwerbstätigkeit/)).toMatchObject({ art: "arbeitsmarkt" });
    expect(finde(/Sommerzeit/)!.titel).toBe("Ende der Sommerzeit");
  });
  const ARTIKEL = `Die Fed entscheidet am 28. Oktober 2026 über ihren Leitzins, während Microsoft,
am 23. Oktober stand der Index bei 7.623,68 Punkten.
Datum Ereignis
27.-28. Oktober FOMC-Sitzung der Federal Reserve
28. Oktober, 19 Uhr MEZ Fed-Zinsentscheid
28. Oktober, nach
Börsenschluss Quartalszahlen Microsoft und Alphabet
29. Oktober Quartalszahlen Amazon
29. Oktober, 8:30 Uhr ET PCE-Inflationsdaten und BIP für das dritte Quartal
Bitcoin-Optionsverfall bei Deribit (rund elf Milliarden
30. Oktober, acht Uhr UTC
Dollar)
Quelle: Federal Reserve, Reuters, Deribit, Unternehmensangaben
die erste Anhebung seit Juli 2023.`;
  it("Artikel-Tabelle: Zeitzonen, Zahlwörter, nach Börsenschluss, mehrere Firmen, umbrochene Zeile", () => {
    const { termine: a } = leseTermine(ARTIKEL, { jahr: 2026 });
    const f = (r: RegExp) => a.filter(t => r.test(t.titel));
    expect(f(/FOMC-Sitzung/)[0]).toMatchObject({ art: "sonstiges", wichtig: false });
    expect(f(/Fed-Zinsentscheid/)[0]).toMatchObject({ datum: "2026-10-28", zeit: "19:00", art: "zinsentscheid", wichtig: true, land: "US" });
    expect(f(/Microsoft/)[0]).toMatchObject({ symbol: "MSFT", zeitpunkt: "nachboerslich" });
    expect(f(/Alphabet/)[0]).toMatchObject({ symbol: "GOOGL", zeitpunkt: "nachboerslich" });
    expect(f(/Amazon/)[0]).toMatchObject({ datum: "2026-10-29", symbol: "AMZN" });
    expect(f(/PCE/)[0]).toMatchObject({ zeit: "13:30", art: "inflation", wichtig: true }); // 8:30 ET in der Woche mit verschobener Zeitumstellung
    expect(f(/Bitcoin/)[0]).toMatchObject({ datum: "2026-10-30", zeit: "09:00", art: "verfall" }); // 8 Uhr UTC = 9 Uhr MEZ
    expect(f(/Bitcoin/)[0]!.titel).toMatch(/Dollar\)$/);
    expect(a.some(t => /Anhebung|Punkten/.test(t.titel))).toBe(false);
  });
});
