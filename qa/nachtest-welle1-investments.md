# Nachtest Bugfix-Welle 1 – Testnutzer Investments

- Datum: 23./24.10.2026
- Geprüfter Stand: e72a4e5 (Produktions-Build, Testmodus, ohne Anmeldung, ohne Anthropic-Schlüssel, ohne Zugang zu externen Seiten), http://localhost:3100
- Zusammenfassung: 4 Befunde nachgeprüft: 3 behoben, 1 behoben laut Code (live nicht prüfbar). 12 neue Befunde (INV-034 bis INV-045): Blocker 0, Hoch 2, Mittel 3, Niedrig 6, Hinweis 1.
- Ablauf: Der Lauf wurde einmal unterbrochen. Nach dem Neustart des Servers durch den Koordinator (gleiche Daten, 24.10.) wurden die offenen Punkte fertig geprüft.

Belege: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-belege/inv2/`
Skripte: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-skripte/inv2/`

Hinweis zur Ausgangslage: Beim Start war die Datenablage leer (keine Objekte, kein Profil, keine Konjunkturdaten). Das Onboarding wurde neu durchlaufen (Anlageprofil „QA-INV Mix Rheinland“). Danach wurde das Objekt `dcgtjjdzmvl0fdvi` „QA-INV 3-Zimmer-Eigentumswohnung Düsseldorf-Bilk“ über `/neu` mit dem PDF-Exposé angelegt.

## Nachprüfung

| ID | Status | Kurzbegründung |
|---|---|---|
| INV-017 | behoben | Der Typ wird jetzt aus dem Inhalt bestimmt. HTML, SVG, HTML als .pdf und Dateien ohne Endung werden mit 415 abgewiesen. Polyglotte Dateien werden mit Typ aus der Signatur und `nosniff` ausgeliefert, kein Skript läuft. |
| INV-029 | behoben | Die Schriften kommen aus `/_next/static/media/*.woff2`. Es gibt keine Anfrage an fremde Hosts, alle Schriftschnitte sind geladen. |
| INV-028 | behoben (laut Code, live nicht prüfbar) | Die Route filtert für Nicht-Admins auf `geprueft` und entfernt `erfasstVon`/`geprueftVon`/`hinweise`. Live nicht prüfbar, weil ohne `AUTH_SECRET` jeder Admin ist (`darfPflegen: true`). |
| INV-014 | behoben | Live wurden 26 Adressen über `/api/erfassen` geprüft: alle internen Ziele werden abgewiesen. In einem isolierten Lauf von `holeSicher` (umgebogenes DNS, lokaler Server) werden Weiterleitungen auf `127.0.0.1`, `localhost`, `::ffff:127.0.0.1`, `169.254.169.254` und `file:` gesperrt. DNS-Rebinding ist wirkungslos, weil die Verbindung an die geprüfte IP gebunden ist. Rest: Das Gesamtzeitlimit greift nicht (INV-036). |

### INV-017 · Gespeichertes XSS über hochgeladene Unterlagen – behoben
- Schritte wie im ersten Lauf: `curl -F "dateien=@qa-inv-xss.png;type=text/html" /api/objekte/<id>/dokumente`, dazu Varianten.
- Ergebnis je Variante (Upload → Auslieferung `GET /api/dateien/<id>`):
  - HTML als `.png` mit `text/html`: **415** „nur PDF oder Bilder (PNG, JPG, WebP); der Inhalt passt zu keinem davon“.
  - SVG mit `<script>` und `onload`: **415**.
  - HTML als `.pdf` mit `application/pdf`: **415**.
  - Datei ohne Endung mit HTML, mit und ohne `text/html`: **415**.
  - `.txt`: **415**.
  - Echte PNG mit angehängtem HTML, gesendet als `text/html`: angenommen und unter „Fotos“ abgelegt. Ausgeliefert mit `content-type: image/png`, `inline`, `x-content-type-options: nosniff` und `cross-origin-resource-policy: same-origin`. Im Browser erscheint sie als Bild 20×20, der Titel bleibt unverändert.
  - Echte JPEG mit angehängtem HTML: wie PNG (`image/jpeg`), kein Skript.
  - `RIFF….WEBP` mit HTML-Rest: angenommen und als `image/webp` ausgeliefert. Im Browser ist das Bild kaputt, ein Skript läuft nicht (siehe INV-035).
  - HTML mit vorangestelltem `%PDF-1.4`, Dateiname `.html`: angenommen und als `application/pdf` mit `nosniff` ausgeliefert. Chromium lädt die Datei herunter und rendert kein HTML.
- Die Auslieferung unbekannter Inhalte, auch bei Altbestand, ist im Code `octet-stream` + `attachment` + `CSP: sandbox` (apps/web/lib/dateityp.ts:16–22). Live gab es keinen Altbestand, weil die Ablage leer war.
- Beleg: xss_qa-inv-poly.png.png, xss_qa-inv-poly.jpg.png, xss_qa-inv-riff.webp.png; curl-Kopfzeilen (siehe Abdeckung).

### INV-029 · Google Fonts extern – behoben
- Schritte: Objektseite laden, alle Anfragen mitschneiden.
- Ergebnis: Sechs Schriftdateien kommen vom eigenen Host (`ibm-plex-sans-latin-400/500/600/700-normal`, `newsreader-latin-opsz-normal/-italic`). Fremde Hosts: keine. `document.fonts`: IBM Plex Sans 400/500/600/700 und Newsreader Variable normal/italic im Status `loaded`. `document.fonts.check` ist für alle drei geprüften Schnitte `true`. Body nutzt „IBM Plex Sans“, Überschriften „Newsreader Variable“. Keine Konsolenfehler wegen Schriften mehr.
- Offen (nicht geprüft): Nur `latin` wird geladen, `latin-ext` nicht. Für deutsche Umlaute reicht `latin`.
- Beleg: u_unterlagen.png (Schriftbild), Skriptausgabe unterlagen_ui.py.

### INV-028 · Mietspiegel-API liefert Entwürfe – behoben (laut Code, live nicht prüfbar)
- `GET /api/mietspiegel`: `admin ? liste : liste.filter(m => m.status === "geprueft").map(oeffentlich)` (apps/web/app/api/mietspiegel/route.ts:7–11). `GET /api/mietspiegel/[id]` gibt Nicht-Admins für Entwürfe 404 zurück und blendet die Pflegefelder aus.
- Live: `GET /api/mietspiegel` → `{"liste":[],"darfPflegen":true}`. Im Testmodus ist jeder Admin, daher ist die Kundensicht nicht live prüfbar.
- Ebenfalls nur im Code geprüft: `ermitteln` nutzt `findeMietspiegel`, das auch Entwürfe berücksichtigt („geprüfte vor Entwürfen“, apps/web/lib/mietspiegel.ts:52–56). Ob Kunden darüber Werte aus Entwürfen bekommen, war nicht mehr prüfbar.

### INV-014 · SSRF über Weiterleitungen – behoben
- Schritte wie im ersten Lauf: `POST /api/erfassen` mit Feld `url` und internen Zielen, dazu Varianten.
- Live (26 Adressen): `localhost`, `127.0.0.1`, `[::1]`, `localtest.me`, `169.254.169.254`, `2130706433`, `0x7f000001`, `0`, `127.1`, `[::ffff:127.0.0.1]`, `[::ffff:7f00:1]`, `[64:ff9b::7f00:1]`, `100.64.0.1`, `localhost.`, `LOCALHOST`, `foo.localhost`, `user@127.0.0.1`, `198.18.0.1` und `224.0.0.1` liefern alle „Diese Adresse ist nicht erreichbar.“, ohne Text. `file:`, `ftp:` und `gopher:` liefern „Nur Links mit http oder https.“. `[2002:7f00:1::]` (6to4) ist nicht gesperrt, die Verbindung scheitert aber („Die Seite war nicht erreichbar.“). Ohne 6to4-Relay ist das kein interner Zugriff.
- Weiterleitungen und DNS-Rebinding (isolierter Lauf der unveränderten `apps/web/lib/sicherHolen.ts` mit tsx; DNS `extern.qa` → 203.0.113.10, die Verbindung wird auf einen lokalen Testserver umgelenkt): Eine öffentliche Seite liefert 200. Die Weiterleitungen 302 → `http://127.0.0.1:3100/api/status`, → `http://localhost:3100/`, → `http://[::ffff:127.0.0.1]:3100/` und → `169.254.169.254` enden mit `Gesperrt` „Diese Adresse ist nicht erreichbar.“. → `file:///etc/passwd` endet mit „Nur Links mit http oder https.“. Relative Weiterleitungen und solche zu anderen öffentlichen Hosts funktionieren. Eine Schleife bricht mit „Zu viele Weiterleitungen.“ ab. `rebind.qa` (erst öffentlich, dann 127.0.0.1) wird genau einmal aufgelöst, die Verbindung geht an die geprüfte IP. Ein Host mit einer öffentlichen und einer internen IP wird gesperrt.
- Unit-Tests (apps/web/test/sicherheit.test.ts) gelesen. Sie decken `istIntern` und direkte lokale Links ab, Weiterleitungen nicht. Diese Lücke schließt der isolierte Lauf oben.
- Beleg: ssrf_live.txt, ssrf_weiterleitung.txt; Skript ssrf/test.ts
- Rest: Das Zeitlimit von 12 s gilt nur je Leerlauf, nicht gesamt (INV-036).

## Regressionen
- **Echte PDF- und Bild-Uploads:** Exposé-PDF (reportlab) über `/neu` mit allen 9 Angaben erkannt (Kaufpreis 289.000 €, 72 m², Düsseldorf, Kaltmiete 850 €, Hausgeld n. u. 120 € aus 310 €, vermietet, Baujahr 1972, Klasse D, Tiefgarage zzgl. 18.000 € mit eigenem Grundbuch). Unter Unterlagen wird es als „Exposé & Inserat“ (sicher) erkannt und als `application/pdf` inline ausgeliefert. Grundriss PNG, JPG und WebP werden als „Grundrisse & Pläne“ erkannt und mit 800×600, 800×600 bzw. 400×300 angezeigt. Die Grundriss-Vorschau unter Ergebnis zeigt das PNG (naturalWidth 800), Klick öffnet den Betrachter mit 800×600. Scan-PDF und beschädigtes PDF landen unter „Weitere Unterlagen“. **Funktioniert.** Belege: d_neu_pdf_2.png, u_ergebnis_grundriss.png, u_grundriss_ansicht.png, u_unterlagen.png. Die PDF-Ansicht im iframe ist in headless Chromium nicht darstellbar (Download); die Kopfzeilen stimmen.
- **Schriften:** siehe INV-029, funktioniert.
- **Admin-Mietspiegel: funktioniert.** Datenbasis › Stadt „QA-INV-Stadt“ › „Von Hand erfassen“ öffnet den Editor. Gültig ab, Quelle und 60 Felder in drei Wohnlage-Reitern per Tastatur eingegeben, „Gespeichert“ erscheint. Ein Wert 100 erzeugt „Feld 0/0/2: Wert außerhalb 2–60 €/m²“ und sperrt die Freigabe. Nach der Korrektur wird „Als geprüft freigeben“ möglich. Der Status „geprüft von lokal“ übersteht das Neuladen. Die Probe (1998, 70 m², Lage offen) ergibt 10,9 €/m², Spanne 9,4 bis 12,4 €; das ist das Mittel der drei Lagen und stimmt mit den Eingaben überein. Die Liste zeigt 60 Felder, geprüft. Ermitteln an einem Objekt in „QA-INV-Stadt“ (Baujahr 2000, 72 m²) übernimmt 10,9 €/m². Mit Wohnlage „gut“ und erneutem Ermitteln ergibt sich 12,4 €/m², mit „einfach“ 9,4 €/m², beides richtig (siehe INV-044). Belege: ms_fehler.png, ms_freigegeben.png, ms_ermitteln.png, ms_wohnlage.png.

## Neu seit dem ersten Lauf

### Admin › Konjunktur & Prognosen
- **Daten einfügen:** 15 Varianten über das Textfeld in eigene Reihen `qa-inv-f01` bis `qa-inv-f15`, danach wieder gelöscht. Richtig gelesen werden `01.10.2026;2,15` → 2,15; `2026-10;2,20` → 1.10.2026; `2026-Q3;2,30` → 1.7.2026; Tabulator; Kopfzeile wird übersprungen; `1.234,5` → 1234,5; `2.15` und `2,15` gemischt. Müll ergibt die verständliche Meldung „Keine Werte erkannt. Je Zeile Datum und Wert, z. B. 2026-09-01;48,7“. Großbuchstaben in der Reihe ergeben „Unbekannte Reihe …“. Falsch gelesen: siehe INV-037.
- **Bundrendite und Immobilienpreise:** `bund10j` mit 201 Monatswerten (2010-01 bis 2026-09) und `immo-preis` mit 66 Quartalswerten über die Oberfläche eingefügt. In der Lage erscheint danach „▼ Wohnimmobilien Bundrendite in 12 Monaten +0,65 %-Pkt.“.
- **Lauf jetzt:** Der erste Lauf meldet „0 geprüft, 4 neu“ (Aktien USA 30/90/365, Schwankung 30), ein sofortiger zweiter „0 geprüft, 0 neu“. Nach dem Bund-Import meldet er wieder „0 geprüft, 0 neu“, eine Prognose für Wohnimmobilien fehlt (INV-040).
- **Termine:** Ohne Datum und Titel ist der Knopf gesperrt, ebenso bei einem Titel nur aus Leerzeichen. „QA-INV Indexaufnahme Test“ mit Symbol `qainv` wird zu `QAINV`. Ein Termin in der Vergangenheit (2020) wird ohne Hinweis angenommen. Entfernen wirkt sofort (INV-042). Der Trading-Termin „QA-TRD Fed-Zinsentscheid“ wurde nicht angefasst.
- **Rückblick:** Vorgabe 01.01.2015 bis heute minus 400 Tage, alle 30 Tage: 131 Prognosen, 125 geprüft, Trefferquote 90 %, Brier 0,144, Skill 0,07, Spanne getroffen 18 %. 2012-01-01 bis 2025-06-30, 30 Tage: 165 / 162 / 93 % / 0,128 / 0,02 / 18 %. Bei von > bis antwortet die API mit 400 „Zeitraum von < bis angeben“. Schritt 1 wird stillschweigend zu 7 (INV-043). Ergebnisse werden nicht gespeichert (INV-039).
- **Nachrechnung Brier und Trefferquote:** „Zuletzt geprüft“ ließ sich nicht füllen. Gespeicherte Prognosen entstehen nur mit dem heutigen Datum, der Rückblick speichert nichts (INV-039). Deshalb wurde der Rückblick 2012-01-01 bis 2025-06-30 mit derselben Ablage nachgestellt (tsx, Paket `@highstack/prognose`) und jede Prognose in Python aus `pHoch`, Ausgangs- und Ergebniswert selbst bewertet: 165 Prognosen, 162 geprüft (alle Wohnimmobilien 365 Tage), Brier 0,1277, Trefferquote 0,9259, Brier der Grundhäufigkeit 0,1305, Skill 0,0212, Spanne getroffen 0,1797. Das stimmt mit der Anzeige überein (0,128; 93 %; 0,02; 18 %). Beleg: nachrechnung_brier.txt. Die Spannenabdeckung von 18 % (Soll 80 %) ist bei den künstlich glatten Testreihen nicht aussagekräftig und wird nicht als Befund gewertet.
- **Jetzt abrufen** (ohne Internet): Nach 0,3 s erscheint „13 Reihen nicht abrufbar, siehe Tabelle“, in der Tabelle steht je Reihe „Fehler: fetch failed“ (INV-041).
- **Mobil 390 px:** Die Seite scrollt nicht waagrecht (scrollWidth 390). Die Datentabelle (533 px) scrollt in ihrem Rahmen. Lesbarkeit: siehe INV-045. Beleg: kj_mobil.png.
- **Texte:** größtenteils verständlich, die Info-Texte zu Brier, Skill und Kalibrierung sind gut. Mängel: INV-041.

### Investments › Objekt › Durchspielen › Marktszenarien
- **Ohne Konjunkturdaten** (Objekt `dcgtjjdzmvl0fdvi`): Kennzeichen „Standardannahmen“, Anschlusszins 5,30 / 4,30 / 3,80 % „Keine Zinsdaten“. Beleg: szen_ohne_bund.txt/.png.
- **Mit Bundrendite, ohne Marktbericht:** Kennzeichen „Annahmen aus aktuellen Marktdaten“. Anschlusszins „Bundrendite 2,68 % plus 0,4 Punkte als Swap-Näherung (3,08 %) plus rund 1 Punkt Bankmarge“ = 4,08 %, konservativ 5,08 %, optimistisch 3,58 %. **Die Swap-Näherung wird angezeigt.** In der Karte „Marktlage“ steht unter Grundlage „Marktausblick 51 % für steigende Preise … (Bundrendite in 12 Monaten +0,65 %-Pkt.). Marktrendite daher um 0,23 Punkte höher (dämpft den Wert).“ **Der Marktausblick erscheint.** In der Kartenübersicht fehlt er, weil dort nur die ersten 4 Grundlagen stehen; er steht nur unter „Grundlage“. Beleg: szen_mit_bund.txt/.png.
- **Nachrechnung** (Python, nachrechnung_marktszenarien.txt): d = 2,68 − 2,03 = 0,65 → Stärke 0,4333 → Beitrag 0,9 · 0,4333 · 1,0 · 1,2 = 0,468 → pHoch = σ(logit 0,62 − 0,468) = 0,50539, genau wie die API. Shift = (0,62 − 0,5054) · 0,02 = 0,00229 → gerundet 0,0023 = 0,23 Punkte ✓. Wertentwicklung bei Bruttorendite 3,3225 % (mit Stellplatzpreis), 15 Jahren und Mietsteigerung 2 %: aus der Rendite (3,3225/3,5525)^(1/15) − 1 = −0,445 %, gesamt 1,02 · 0,99555 − 1 = 1,546 % → Anzeige „1,5 % p. a.“, „−0,4 %“ ✓. Anschlusszinsen ✓.
- **Ein Marktbericht mit Swap-Satz** hat Vorrang vor der Bundrendite (Code). Nicht live geprüft: Marktberichte lassen sich ohne KI-Schlüssel nicht freigeben.
- **Grenzfälle:** ein falsch eingefügter Wert (INV-037) und ein elf Jahre alter Wert (INV-038). Die Bundreihe ist danach wiederhergestellt.
- **Mobil 390 px:** Die Seite scrollt nicht waagrecht.

## Neue Befunde

### INV-034 · Mehrere Dateien hochladen: eine ungültige Datei verwirft stillschweigend die gültigen und hinterlässt verwaiste Dateien
- Schweregrad: Mittel
- Bereich: Objekt › Unterlagen; `POST /api/objekte/[id]/dokumente`
- Schritte: 1. Unterlagen › „Dateien auswählen“. 2. `qa-inv-grundriss.png` und `notiz.txt` zusammen wählen (ebenso per `curl -F dateien=@qa-inv-grundriss.png -F dateien=@notiz.txt`).
- Erwartet: Die PNG wird abgelegt, nur die TXT wird mit Begründung abgewiesen. Alternativ wird nichts gespeichert und die Meldung sagt, dass keine Datei übernommen wurde.
- Tatsächlich: Antwort 415, Meldung nennt nur „notiz.txt: nur PDF oder Bilder …“. Die Zahl der Dateien am Objekt bleibt bei 11, die PNG fehlt also. Sie liegt trotzdem in der Dateiablage (`.data/files/pjcv5zxkmvl0gp10`, keinem Objekt zugeordnet) und wird beim Löschen des Objekts nicht entfernt. Der Nutzer glaubt, der Grundriss sei hochgeladen.
- Beleg: u_upload_png_txt.png; curl-Ausgabe „vorher 11 nachher 11“; verwaiste Datei-ID `pjcv5zxkmvl0gp10`
- Vermutete Ursache: apps/web/app/api/objekte/[id]/dokumente/route.ts. Die Schleife speichert jede Datei sofort (`speichereDatei`) und bricht bei der ersten ungültigen mit `return … 415` ab, bevor `speichereObjekt` läuft.
- Vorschlag: Erst alle Dateien prüfen und dann speichern, oder gültige Dateien übernehmen und abgewiesene im Ergebnis einzeln melden.

### INV-035 · Uneinheitliche Typangaben und kaputte Vorschau bei nur „signaturgültigen“ Bildern
- Schweregrad: Niedrig
- Bereich: Objekt › Unterlagen
- Schritte: 1. Unterlagen öffnen und den Hinweistext lesen. 2. Eine Datei hochladen, die nur die WebP-Signatur trägt (`RIFF….WEBP` + beliebiger Inhalt), oder ein beschädigtes PDF mit `%PDF-`-Kopf.
- Erwartet: Hinweistext und Fehlermeldung nennen dieselben Formate. Dateien, die sich nicht dekodieren lassen, werden abgewiesen oder als „nicht lesbar“ markiert.
- Tatsächlich: Der Hinweis sagt „PDF, PNG, JPG bis 20 MB“, die Fehlermeldung und das Backend nennen bzw. erlauben zusätzlich WebP. Die WebP-Attrappe wird als Foto angenommen und erscheint in der Galerie als kaputtes Bild (naturalWidth 0). `kaputt.pdf` landet ohne Hinweis unter „Weitere Unterlagen“. Das ist kein Sicherheitsproblem, weil die Auslieferung mit `nosniff` erfolgt.
- Beleg: u_upload_png_txt.png (drittes Galeriebild); Skriptausgabe `['/api/dateien/4yc4ey5jmvl0fumq', 0]`
- Vermutete Ursache: apps/web/lib/dateityp.ts (nur Signaturprüfung); Hinweistext in apps/web/components/objekt/Unterlagen.tsx
- Vorschlag: Hinweistext um WebP ergänzen. Bilder optional dekodieren (z. B. Kopfmaße lesen), unlesbare Dateien kennzeichnen.

### INV-036 · Link auslesen: Gesamtzeitlimit greift nicht, langsame Seiten halten die Anfrage beliebig lang
- Schweregrad: Niedrig
- Bereich: Objekt anlegen › Link; `apps/web/lib/sicherHolen.ts`
- Schritte: Isolierter Lauf von `holeSicher` mit `timeoutMs: 3000` gegen eine Seite, die jede Sekunde ein Byte sendet (12 Byte).
- Erwartet: Abbruch nach etwa 3 s (im Betrieb 12 s).
- Tatsächlich: Die Anfrage läuft 12.019 ms und liefert 200. `timeout` ist nur das Leerlauf-Limit des Sockets; solange Bytes tröpfeln, läuft die Anfrage weiter. Je Nutzer und Link bleibt so eine Verbindung im Server offen. `maxDuration` greift bei `next start` nicht.
- Beleg: ssrf_weiterleitung.txt („tropf dauerte ms 12019“)
- Vermutete Ursache: apps/web/lib/sicherHolen.ts:42
- Vorschlag: Zusätzlich einen festen Timer bzw. `AbortSignal.timeout(ende - Date.now())` setzen und die Anfrage beim Ablauf abbrechen.

### INV-037 · Konjunktur-Import übernimmt falsche Werte ohne Warnung; Folge: Anschlusszins 71,40 % in den Marktszenarien
- Schweregrad: Hoch
- Bereich: Admin › Konjunktur & Prognosen › Daten; wirkt bis Investments › Durchspielen › Marktszenarien
- Schritte: 1. Unter „Werte“ einfügen und „Übernehmen“ (eigene Reihen `qa-inv-f…`). 2. Gespeicherte Werte prüfen. 3. In `bund10j` die Zeile `2026-10-01,2,70` einfügen und im Objekt Durchspielen öffnen.
- Erwartet: Jede Zeile wird richtig gelesen oder abgewiesen. Unplausible Werte (Datum, Höhe, Zukunft) erzeugen eine Warnung, und die übernommenen Werte werden angezeigt.
- Tatsächlich:
  - `2026-08-01,2,15` (Komma als Trenner, Dezimalkomma) → **15**; `2026-07-01 2,15` (Leerzeichen) → **15**. Meldung jeweils „1 Werte übernommen“.
  - `01.06.2026<Tab>2,15<Tab>0,05` (Excel mit Spalte Veränderung) → **0,05**, weil die letzte Zahl der Zeile genommen wird. Das Textfeld sagt aber „je Zeile Datum und Wert“.
  - `2026-10-01;2,15` gefolgt von `2026-10-02,2.16`: Die zweite Zeile wird stillschweigend verworfen („1 Werte übernommen“), weil das Trennzeichen nur aus der ersten Zeile bestimmt wird.
  - `2026-13-45;2,5` und `31.02.2026;2,6` werden als Datum übernommen. Die Tabelle zeigt „2,5 (Invalid Date)“.
  - `2030-01-01;9` und `-5000000000` werden ohne Grenze übernommen. „zuletzt“ zeigt den Wert von 2030.
  - Einzelne Werte einer Katalogreihe (z. B. `bund10j`) lassen sich in der Oberfläche nicht löschen; „Löschen“ gibt es nur für Zusatzreihen. Einen falschen Zukunftswert wird man so nicht los.
  - Folge in Investments: Nach `2026-10-01,2,70` in `bund10j` steht dort der Wert 70. Marktszenarien: Anschlusszins **72,40 / 71,40 / 70,90 %**, EK-Rendite −74,9 / −50,9 / −27,6 %, Marktausblick „Bundrendite in 12 Monaten +67,97 %-Pkt.“, ohne jeden Hinweis.
- Beleg: kj_import_muell.png, kj_nach_import.png, Skriptausgabe kj_import.py (gespeicherte Punkte), szen_bund_komma.txt/.png
- Vermutete Ursache: packages/prognose/src/quellen.ts:40 (Trennzeichen nur aus der ersten Zeile), :47 (letzte Zahl der Zeile), :52–58 (`datum` prüft Monat und Tag nicht); apps/web/app/api/admin/konjunktur/route.ts (Import ohne Plausibilität); apps/web/lib/marktszenarien.ts (Bundrendite ungeprüft übernommen)
- Vorschlag: Trennzeichen je Zeile erkennen, bei mehr als einer Zahl die zweite Spalte nehmen oder nachfragen. Datum validieren. Grenzen je Indikator (z. B. Bundrendite −2 bis 15 %), keine Zukunftsdaten. Vor dem Übernehmen eine Vorschau anzeigen. Einzelne Werte löschbar machen.

### INV-038 · Veraltete Bundrendite gilt als „aktuelle Marktdaten“
- Schweregrad: Hoch
- Bereich: Investments › Durchspielen › Marktszenarien
- Schritte: 1. `bund10j` leeren und nur `2015-06;0,80` einfügen (per API, eigene Reihe). 2. Objekt › Durchspielen.
- Erwartet: Ein Wert von 2015 wird nicht als Marktlage verwendet oder deutlich als veraltet markiert (z. B. älter als 3 Monate → Standardannahmen).
- Tatsächlich: Kennzeichen „Annahmen aus aktuellen Marktdaten“, Anschlusszins **2,20 %** (konservativ 3,20 %, optimistisch 1,70 %) mit „Bundrendite 0,80 % … Quelle: Bundesanleihe 10 J., Stand 2015-06-01“. Gegenüber dem aktuellen Wert (4,08 %) ist das fast 2 Punkte zu niedrig und schönt das Ergebnis. Im Betrieb passiert das, sobald der automatische Abruf länger ausfällt.
- Beleg: szen_bund_alt.txt/.png (die Reihe wurde danach wiederhergestellt)
- Vermutete Ursache: apps/web/lib/konjunktur.ts:76 (`punkte.at(-1)` ohne Altersprüfung); apps/web/components/objekt/Prognose.tsx (Kennzeichen „aktuelle Marktdaten“ schon bei bloßem Vorhandensein)
- Vorschlag: Höchstalter je Reihe (Bund monatlich: 60 Tage). Ältere Werte nicht verwenden oder mit „Stand MM/JJJJ, veraltet“ kennzeichnen.

### INV-039 · Rückblick wird nicht gespeichert: Überprüfung, „Zuletzt geprüft“ und Gewichte bleiben leer
- Schweregrad: Mittel
- Bereich: Admin › Konjunktur & Prognosen › Rückblick / Überprüfung
- Schritte: 1. „Rückblick rechnen“ (Vorgabe sowie 2012–2025). 2. Seite neu laden.
- Erwartet: Wie der Text unter „Überprüfung“ verspricht („Schneller geht es mit dem Rückblick unten“), erscheinen danach Brier, Kalibrierung, „Zuletzt geprüft“ und Treffer je Wirkungskette. Die gelernten Gewichte gelten oder lassen sich übernehmen.
- Tatsächlich: Das Ergebnis steht nur im Kasten unter dem Knopf (z. B. 165 Prognosen, Brier 0,128). Nach dem Neuladen: „Noch keine fällige Prognose. Schneller geht es mit dem Rückblick unten …“, Kacheln „4 / 0“, Wirkungsketten alle „0 Fälle“, Gewichte unverändert. Gespeicherte Prognosen: weiterhin 4. Ein Admin kann so nie eine Überprüfung sehen, bevor echte Prognosen fällig werden (frühestens nach 14 Tagen).
- Beleg: kj_rueckblick.png; Skriptausgabe kj_rb.py („gespeicherte Prognosen: 4 bilanz n: 0“, „Zuletzt geprüft vorhanden: 0“)
- Vermutete Ursache: apps/web/app/api/admin/konjunktur/route.ts:54–57 (gibt nur Bilanz und Gewichte zurück, speichert nichts); Text in apps/web/components/admin/Konjunktur.tsx:79
- Vorschlag: Rückblick-Ergebnis getrennt speichern und unter „Überprüfung“ als „Rückblick vom …“ zeigen, Gewichte auf Wunsch übernehmen. Sonst den Text ändern.

### INV-040 · „Lauf jetzt“ erzeugt nach neuen Daten am selben Tag keine Prognosen
- Schweregrad: Mittel
- Bereich: Admin › Konjunktur & Prognosen › Aktuelle Prognosen
- Schritte: 1. „Lauf jetzt“ (es gibt nur S&P 500 und VIX vom Trading-Testnutzer) → „0 geprüft, 4 neu“. 2. Bundrendite und Immobilienpreise einfügen. 3. „Lauf jetzt“.
- Erwartet: Eine Prognose für Wohnimmobilien entsteht, oder die Prognosen des Tages werden neu gerechnet. Zumindest erklärt die Meldung, warum nichts passiert.
- Tatsächlich: „0 geprüft, 0 neu“. Die Lage zeigt „▼ Wohnimmobilien Bundrendite +0,65 %-Pkt.“, unter „Aktuelle Prognosen“ fehlt Wohnimmobilien aber bis zum nächsten Tag. Der Knopf heißt „Lauf jetzt“ und wird auch so erzwungen (`taeglich(s, true)`), die Sperre „heute schon Prognosen“ greift trotzdem.
- Beleg: Skriptausgabe kj_lauf.py; kj_nach_lauf.png
- Vermutete Ursache: apps/web/lib/konjunktur.ts:50 (`!nach.some(p => p.erstellt === tag)`)
- Vorschlag: Beim erzwungenen Lauf fehlende Ziele nachtragen (je Ziel und Horizont prüfen), die Meldung erklären („heute bereits erstellt“).

### INV-041 · Konjunktur: Zahlen- und Datumsformat, Grammatik, technische Fehlermeldung
- Schweregrad: Niedrig
- Bereich: Admin › Konjunktur & Prognosen; Investments › Marktszenarien
- Schritte: Seite und Marktszenarien lesen, Import und „Jetzt abrufen“ ausführen.
- Erwartet: de-DE-Format, verständliche Meldungen.
- Tatsächlich: „Risikolage: … VIX hoch (35.8)“ bzw. „VIX ruhig (15.0)“ mit Dezimalpunkt, an anderer Stelle derselben Seite „VIX 35,8“. Im Kunden-Durchspielen steht „Quelle: Bundesanleihe 10 J., Stand 2026-09-01“ im ISO-Format. Meldung „1 Werte übernommen“. Abruffehler „Fehler: fetch failed“ ohne Erklärung (z. B. „Quelle nicht erreichbar, letzter Erfolg …“). Datum „Invalid Date“ (siehe INV-037).
- Beleg: Seitentext kj_text.py, szen_mit_bund.txt, kj_abruf.png
- Vermutete Ursache: packages/prognose/src/modell.ts:96 (`toFixed(1)`); apps/web/lib/marktszenarien.ts:46 (`Stand ${…stand}`); apps/web/components/admin/Konjunktur.tsx:96
- Vorschlag: `toLocaleString("de-DE")`, Datum als MM/JJJJ, Einzahl/Mehrzahl, sprechende Abruffehler.

### INV-042 · Termine: keine Rückmeldung, Entfernen ohne Rückfrage und ohne Protokoll
- Schweregrad: Niedrig
- Bereich: Admin › Konjunktur & Prognosen › Termine
- Schritte: 1. Termin „QA-INV Indexaufnahme Test“ anlegen. 2. Termin „QA-INV Termin in der Vergangenheit“ (01.01.2020) anlegen. 3. Einen Termin entfernen. 4. Protokoll ansehen.
- Erwartet: Bestätigung beim Anlegen, Hinweis bei einem Datum in der Vergangenheit, Rückfrage oder „Rückgängig“ beim Entfernen, Protokolleintrag wie beim Anlegen.
- Tatsächlich: Keine Meldung beim Anlegen und Entfernen. Ein vergangenes Datum wird ohne Hinweis angenommen. Entfernen löscht sofort, auch Termine anderer Admins (z. B. den Trading-Termin; hier nicht ausgeführt). Im Protokoll stehen nur „Termin angelegt“, kein „Termin entfernt“.
- Beleg: kj_termine.png; Protokollauszug aus kj_termine.py
- Vermutete Ursache: apps/web/app/api/admin/konjunktur/route.ts:52; apps/web/components/admin/Konjunktur.tsx:103
- Vorschlag: `protokolliere` beim Entfernen, `frage()` oder Rückgängig, Meldungen.

### INV-043 · Rückblick: Schrittweite unter 7 wird stillschweigend zu 7
- Schweregrad: Niedrig
- Bereich: Admin › Konjunktur & Prognosen › Rückblick
- Schritte: „alle … Tage“ = 1, Zeitraum 2012-01-01 bis 2025-06-30, „Rückblick rechnen“.
- Erwartet: Das Feld begrenzt sichtbar auf 7, oder die Meldung sagt „Schrittweite auf 7 Tage gesetzt“.
- Tatsächlich: Das Feld zeigt weiter 1, gerechnet wird mit 7 (705 Prognosen ≈ 13,5 Jahre · 52). Kein Hinweis.
- Beleg: Skriptausgabe kj_rb.py
- Vermutete Ursache: apps/web/app/api/admin/konjunktur/route.ts:56 (`Math.max(7, …)`); `min={7}` im Feld wird nicht erzwungen.

### INV-044 · Wohnlage wählen ändert die Vergleichsmiete erst nach erneutem „Ermitteln“
- Schweregrad: Hinweis
- Bereich: Objekt › Markt & Vergleich (mit Mietspiegel)
- Schritte: 1. Objekt in „QA-INV-Stadt“ › Ermitteln → 10,9 €/m². 2. Wohnlage „gut“ wählen.
- Erwartet: Die Vergleichsmiete folgt der Wohnlage sofort (12,4 €/m²), oder ein Hinweis fordert zum erneuten Ermitteln auf.
- Tatsächlich: Es bleibt bei 10,9 €/m² samt „ermittelt“-Vermerk mit der alten Spanne. Erst ein erneutes „Ermitteln“ liefert 12,4 €/m² bzw. 9,4 €/m² bei „einfach“; diese Werte stimmen.
- Beleg: ms_ermitteln.png, ms_wohnlage.png; Skriptausgabe wohnlage2.py
- Vermutete Ursache: apps/web/components/objekt/Teile.tsx:115 (Chip setzt nur `wohnlage`)

### INV-045 · Admin mobil (390 px): aktiver Reiter nicht sichtbar, Investments-Leiste über dem Inhalt, Prognose-Gründe stark umbrochen
- Schweregrad: Niedrig
- Bereich: Admin › Konjunktur & Prognosen, mobil
- Schritte: `/admin?tab=konjunktur` bei 390 px öffnen.
- Erwartet: Der aktive Reiter ist zu sehen. Die Aktionsleiste der Investments-Seiten fehlt im Admin. Tabellen sind gut lesbar.
- Tatsächlich: Die Reiterleiste endet sichtbar bei „Marktberich…“, der aktive Reiter „Konjunktur & Prognosen“ liegt rechts außerhalb und scrollt nicht in den sichtbaren Bereich. Die schwebende Leiste „+ Auftrag anlegen / Prüfung starten“ liegt über dem Admin-Inhalt. In „Aktuelle Prognosen“ steht der Begründungstext in einer etwa 80 px schmalen Spalte (ein bis zwei Wörter je Zeile, sehr lange Zeilen). Kein waagrechtes Scrollen der Seite (scrollWidth 390).
- Beleg: kj_mobil.png, kj_mobil_0.png, kj_mobil_1.png
- Vorschlag: Den aktiven Reiter mit `scrollIntoView` zeigen, die Aktionsleiste im Admin ausblenden, Begründungen mobil unter die Zeile setzen.

## Abdeckung

### Geprüft
- Onboarding neu durchlaufen (Datenablage war leer); Rahmen wie im ersten Lauf (356.920 €, 1.547 €, 6,3 %).
- `/neu` › Exposé hochladen (PDF) mit vollständiger Erkennung, Objekt angelegt.
- INV-017 mit 16 Upload-Varianten per curl, Auslieferungskopfzeilen aller gespeicherten Dateien, Aufruf der Polyglott-Dateien in Chromium.
- Unterlagen-UI: Liste, Galerie, Grundriss-Vorschau und Betrachter, UI-Upload von `.txt` (Meldung erscheint verständlich in der Liste unter dem Upload-Feld) und gemischter Upload → INV-034.
- Schriften und Fremd-Hosts (INV-029).
- INV-014 und INV-028 im Code; Unit-Tests gelesen.
- Ausgangszustand Konjunktur (`GET /api/admin/konjunktur`).
- **Nach dem Neustart:** INV-014 live (26 Adressen) und isoliert (Weiterleitungen, Rebinding, Zeitlimit); Admin-Mietspiegel komplett (anlegen, Tabelle, Prüfregeln, Freigabe, Neuladen, Probe, Ermitteln mit Wohnlage); Konjunktur & Prognosen komplett (Import mit 15 Formaten, Bundrendite und Immobilienpreise, Lauf jetzt dreimal, Termine anlegen/entfernen/Protokoll, Rückblick in 4 Varianten, Jetzt abrufen, Texte, 390 px); Brier, Trefferquote, Skill und Spannenabdeckung in Python nachgerechnet; Marktszenarien ohne Daten, mit Bundrendite, mit falschem und mit veraltetem Wert, Nachrechnung von pHoch, Renditeverschiebung, Wertentwicklung und Anschlusszins; mobil 390 px.

### Nicht geprüft
- Kundensicht mit Anmeldung (INV-028 live, Admin-Sperre der Konjunktur-API für Kunden): `AUTH_SECRET` fehlt, jeder ist Admin.
- „Zuletzt geprüft“ mit echten fälligen Prognosen: lässt sich in der Testumgebung nicht erzeugen (INV-039). Ersatzweise wurde die Rückblick-Bilanz nachgerechnet.
- Vorrang des Swap-Satzes aus einem Marktbericht vor der Bundrendite: Freigabe eines Marktberichts braucht KI-Auslesen; nur im Code geprüft.
- Wirkung der Konjunktur auf Trading: Sache des Trading-Testnutzers.
- Echtes Abrufen von FRED/EZB: kein Internet.

### Hinterlassene Testdaten
- Profil aus dem Onboarding mit Anlageprofil „QA-INV Mix Rheinland“.
- Objekte `dcgtjjdzmvl0fdvi` „QA-INV 3-Zimmer-Eigentumswohnung Düsseldorf-Bilk“ (mit Testdateien: Polyglotte, Grundrisse, kaputtes PDF) und `isn19u9lmvm4g2jp` „QA-INV Wohnung Mietspiegel-Test“ (Wohnlage einfach).
- Mietspiegel „QA-INV-Stadt“ (geprüft, 60 Felder).
- Konjunkturreihen `bund10j` (201 künstliche Monatswerte 2010–2026) und `immo-preis` (66 künstliche Quartalswerte). Sie stammen von mir und speisen die Marktszenarien; vor echtem Betrieb löschen.
- 4 Prognosen vom 24.10. aus „Lauf jetzt“ (beruhen auf den S&P-/VIX-Daten des Trading-Testnutzers).
- Verwaiste Datei `pjcv5zxkmvl0gp10` (INV-034).
- Entfernt: Zusatzreihen `qa-inv-f01` bis `qa-inv-f15` und die Termine „QA-INV …“. Die Daten des Trading-Testnutzers (sp500, vix, Termin „QA-TRD Fed-Zinsentscheid“) blieben unberührt.
