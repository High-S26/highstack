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
