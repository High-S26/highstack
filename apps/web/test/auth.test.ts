import { describe, expect, it } from "vitest";
import { pruefe, signiere, type Linktoken, type Sitzung } from "../lib/auth";

const S = "test-geheimnis-mit-genug-laenge";
describe("Anmeldung", () => {
  it("signiert und prüft eine Sitzung", async () => {
    const t = await signiere({ e: "a@b.de", t: "m1", r: "inhaber", exp: Date.now() + 60000, k: "sitzung" } satisfies Sitzung, S);
    expect((await pruefe<Sitzung>(t, "sitzung", S))?.t).toBe("m1");
  });
  it("lehnt veränderte, abgelaufene und falsche Tokenarten ab", async () => {
    const t = await signiere({ e: "a@b.de", t: "m1", r: "mitglied", exp: Date.now() + 60000, k: "sitzung" }, S);
    const [teil, sig] = t.split(".");
    const fremd = Buffer.from(JSON.stringify({ e: "a@b.de", t: "anderer", r: "inhaber", exp: Date.now() + 60000, k: "sitzung" })).toString("base64url");
    expect(await pruefe(`${fremd}.${sig}`, "sitzung", S)).toBeNull();
    expect(await pruefe(t, "sitzung", "anderes-geheimnis")).toBeNull();
    expect(await pruefe(t, "login", S)).toBeNull();
    const alt = await signiere({ e: "a@b.de", exp: Date.now() - 1, k: "login", n: "x" } satisfies Linktoken, S);
    expect(await pruefe(alt, "login", S)).toBeNull();
    expect(teil).toBeTruthy();
  });
});
