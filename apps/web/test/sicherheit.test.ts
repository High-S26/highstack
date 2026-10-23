import { describe, expect, it } from "vitest";
import { dateiKopf, typAusInhalt } from "../lib/dateityp";
import { istIntern } from "../lib/sicherHolen";
import { textAusUrl } from "../lib/erfassung";

describe("Unterlagen: Typ aus dem Inhalt", () => {
  const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
  it("HTML mit Bild-Endung wird nicht als Bild erkannt und nur als Download ausgeliefert", () => {
    expect(typAusInhalt(html)).toBeNull();
    const k = dateiKopf(html, "foto.png");
    expect(k["content-type"]).toBe("application/octet-stream");
    expect(k["content-disposition"]).toMatch(/^attachment/);
    expect(k["content-security-policy"]).toContain("sandbox");
    expect(k["x-content-type-options"]).toBe("nosniff");
  });
  it("echte PDF und PNG werden erkannt und angezeigt", () => {
    expect(typAusInhalt(new TextEncoder().encode("%PDF-1.7\n"))).toBe("application/pdf");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    expect(dateiKopf(png, "g.png")).toMatchObject({ "content-type": "image/png", "x-content-type-options": "nosniff" });
  });
});

describe("Link-Auslesen: keine internen Ziele", () => {
  it("erkennt private, lokale, CGNAT- und gemappte Adressen", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1"]) expect(istIntern(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "93.184.216.34", "2606:4700::1111"]) expect(istIntern(ip), ip).toBe(false);
  });
  it("weist lokale Links ab", async () => {
    for (const u of ["http://localhost:3000/", "http://127.0.0.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "file:///etc/passwd"]) expect((await textAusUrl(u)).hinweis, u).toBeTruthy();
  });
});
