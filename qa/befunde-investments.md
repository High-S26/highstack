# Befunde Testnutzer Investments

- Datum: 23.10.2026
- Geprüfter Stand: 8f13f38 (Produktions-Build, Testmodus, ohne Anmeldung, ohne Anthropic-Schlüssel), http://localhost:3100
- Zusammenfassung: 33 Befunde – Blocker 2, Hoch 6, Mittel 13, Niedrig 9, Hinweis 3

Belege liegen unter `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-belege/inv/`, Skripte unter `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-skripte/inv/`.

### INV-001 · Risikoneigung ändert am Rahmen und an den Rechnungen nichts
- Schweregrad: Mittel
- Bereich: Onboarding › Finanzierung und Risiko; Profil › Investorenprofil
- Schritte: 1. `/start` › Einrichten › Schritt 3. 2. Nacheinander „Vorsichtig“, „Offensiv“, „Ausgewogen“ wählen. 3. Live-Vorschau „Ihr Rahmen“ beobachten.
- Erwartet: Die Karten versprechen Wirkung („Lieber mehr Eigenkapital und schneller tilgen“, „Hebel nutzen, Zuzahlung … ok“). Rahmen, Tilgung, Ziel-Cashflow oder DSCR-Grenze sollten sich ändern, oder der Text sagt ehrlich, wofür die Angabe genutzt wird.
- Tatsächlich: Vorschau bleibt bei allen drei Stufen identisch (356.920 € / 1.547 € / 6,3 %). Im Code wirkt `risiko` nur auf das K.O.-Kriterium Energieklasse G/H (nur bei „vorsichtig“, und nur einmalig beim Anlegen des Anlageprofils) und wird als Text an die Experten gereicht.
- Beleg: onb_3.png; Ausgabe onboarding.py („Risiko Vorsichtig/Offensiv/Ausgewogen“ jeweils gleich)
- Vermutete Ursache: apps/web/lib/vorgaben.ts:48–50 (`nachStrategie` nutzt `risiko` nur für `ko.energieGH`); packages/engine/src/core.ts nutzt `risiko` nicht.
- Vorschlag: Risikoneigung auf Tilgung/min. DSCR/min. Cashflow abbilden oder die Kartentexte auf das reduzieren, was tatsächlich passiert.

### INV-002 · Zahlenfelder nehmen negative, absurde und wissenschaftliche Werte ohne Hinweis an
- Schweregrad: Mittel
- Bereich: Querschnitt › Zahlenfelder (Onboarding, Profil, Objekt)
- Schritte: 1. `/start` › Einrichten › Schritt 1. 2. Eigenkapital nacheinander „-50000“, „10000000000“, „1e6“ eingeben.
- Erwartet: Negatives Eigenkapital wird abgelehnt oder markiert; unplausible Größen (10 Mrd. €) werden zumindest gewarnt; „1e6“ gilt nicht als Zahl.
- Tatsächlich: Kein Fehlerhinweis. −50.000 € Eigenkapital ergibt „Kaufpreis bis 160.614 €“; 10 Mrd. € ergibt „Kaufpreis bis 8.923.199.786 €“ und „Cashflow ± 0 ab 0,0 % Rendite“; „1e6“ wird still als 1.000.000 € übernommen. Nur Buchstaben („abc“) werden mit „Bitte eine Zahl eingeben“ abgefangen.
- Beleg: onb_1_ek_negativ.png, onb_1_ek_10mrd.png
- Vermutete Ursache: apps/web/components/Felder.tsx:12–17 (`leseZahl` akzeptiert alles, was `Number()` versteht); `min`/`max` werden an kaum einem Feld gesetzt (z. B. apps/web/app/start/page.tsx:63–65, components/Profilteile.tsx:34–58).
- Vorschlag: `min={0}` für Beträge, Plausibilitätsgrenzen, Exponentschreibweise ablehnen.

### INV-003 · Auslesen kehrt Verneinungen um: „Kein Erbbaurecht“ wird zum K.O., „unvermietet“ zu „vermietet“, „kein Stellplatz“ zu einem Stellplatz
- Schweregrad: Hoch
- Bereich: Objekt anlegen › Text/PDF/Link auslesen (Mustererkennung ohne KI)
- Schritte: 1. `/neu` › „Text einfügen“ (oder `POST /api/erfassen` mit Feld `text`). 2. Text mit „Kein Erbbaurecht. Eine Sonderumlage ist nicht geplant.“ auslesen. 3. Ebenso Text mit „Die Wohnung ist unvermietet.“ und Text mit „Ein Stellplatz ist nicht vorhanden.“
- Erwartet: Erbbaurecht = nein, Sonderumlage = nein, Vermietung = leer, kein Stellplatz.
- Tatsächlich: `erbbaurecht: true`, `sonderumlage: true` (beide als „gefunden“ markiert). Mit den Standard-K.O.-Kriterien des Anlageprofils wird das Objekt sofort „Pass“ mit „K.O.-Kriterium: Erbbaurecht“ und „Sonderumlage offen“. „unvermietet“ ergibt `leer: false`. „Ein Stellplatz ist nicht vorhanden.“ ergibt einen Außenstellplatz „inklusive“.
- Beleg: Ausgabe erfassen_text.py, Fälle `kein_erbbaurecht`, `unvermietet`, `stellplatz_kein`
- Vermutete Ursache: apps/web/lib/erfassung.ts:76–78 (`/Erbbaurecht/i`, `/Sonderumlage/i`, `/vermietet/i` ohne Verneinungsprüfung); erfassung.ts:89–90 prüft „kein …“ nur in einem 12-Zeichen-Fenster *vor* dem ersten Treffer, nicht „nicht vorhanden“ danach.
- Vorschlag: Verneinungen („kein“, „nicht“, „ohne“, „un-“) im Satz prüfen; bei K.O.-Merkmalen im Zweifel „unbekannt“ statt „ja“ setzen.

### INV-004 · Stellplatz bekommt beim Auslesen fremde Beträge: Kaufpreis der Wohnung als Stellplatzpreis, Hausgeld als Stellplatzmiete
- Schweregrad: Hoch
- Bereich: Objekt anlegen › Auslesen › Stellplatz; Rechnung
- Schritte: 1. Text auslesen: „QA-INV Apartment mit Stellplatz in Köln Sülz / Kaufpreis: 129.000 € / Wohnfläche: 34 m² / Kaltmiete: 520 €“. 2. Zweiter Text: „… Stellplatz: Außenstellplatz inklusive. Hausgeld monatlich 260 €, davon nicht umlagefähig 95 €.“ 3. Dritter Text: Titel „Wohnung mit Tiefgarage …“, später „Tiefgaragenstellplatz zzgl. 18.000 €“.
- Erwartet: Fall 1 kein separater Stellplatzpreis; Fall 2 keine Stellplatzmiete; Fall 3 Stellplatzpreis 18.000 €.
- Tatsächlich: Fall 1: Stellplatz „separat“ mit `kaufpreis: 129000` (der Wohnungspreis) und `erwerben: true` – der Gesamtpreis verdoppelt sich auf 258.000 €. Fall 2: Stellplatz „fremd vermietet“ mit `miete: 260` (das Hausgeld) – die Miete steigt um 260 €/Monat, Rendite und Cashflow sind zu gut. Fall 3: Preis 18.000 € geht verloren (`kaufpreis: null`), weil der erste Treffer „Tiefgarage“ im Titel steht und dort der Wohnungspreis (240.000 €, > 150.000) gefunden und verworfen wird.
- Beleg: Ausgabe erfassen_text.py (letzte zwei Zeilen, Fall `stellplatz_hausgeld`)
- Vermutete Ursache: apps/web/lib/erfassung.ts:88–97 (`stellplatzAusText`: erster Treffer im ganzen Text, erster Betrag in 160 Zeichen; Miete-Muster `monatlich … €` greift auch beim Hausgeld).
- Vorschlag: Betrag nur aus demselben Satz/derselben Zeile wie das Stellplatzwort nehmen; Beträge, die schon als Kaufpreis/Hausgeld erkannt sind, ausschließen.

### INV-005 · Übliche Kaufpreis-Schreibweisen werden nicht erkannt („289.000,- €“, „EUR 289.000“)
- Schweregrad: Mittel
- Bereich: Objekt anlegen › Auslesen
- Schritte: 1. Text mit „Kaufpreis: 289.000,- €“ auslesen. 2. Text mit „Kaufpreis: EUR 289.000“ auslesen.
- Erwartet: Kaufpreis 289.000 €.
- Tatsächlich: Kaufpreis fehlt in beiden Fällen (`gefunden` ohne `kaufpreis`). Beim Hausgeld funktioniert dieselbe Schreibweise („€ 210,-“), beim Kaufpreis nicht.
- Beleg: Ausgabe erfassen_text.py, Fälle `kp_komma_strich`, `kp_eur_davor`
- Vermutete Ursache: apps/web/lib/erfassung.ts:67 (Währung muss direkt nach der Zahl stehen; „,-“ und vorangestellte Währung fehlen). `betragNach` (Z. 47) kann beides bereits.
- Vorschlag: Kaufpreis ebenfalls über `betragNach` lesen.

### INV-006 · Ort und Titel kommen aus der Makleradresse statt aus dem Objekt
- Schweregrad: Mittel
- Bereich: Objekt anlegen › Auslesen
- Schritte: Text auslesen, der mit dem Briefkopf des Maklers beginnt („Immobilien Muster GmbH, Königsallee 1, 40212 Düsseldorf“), danach „QA-INV Wohnung in 50667 Köln Altstadt …“.
- Erwartet: Ort Köln, Titel „QA-INV Wohnung in 50667 Köln Altstadt“.
- Tatsächlich: Ort „Düsseldorf“, Titel „Immobilien Muster GmbH, Königsallee 1, 40212 Düsseldorf“. Damit stimmen Region-Abgleich, Mietspiegel und Grunderwerbsteuer-Kontext nicht.
- Beleg: Ausgabe erfassen_text.py, Fall `makler_zuerst`
- Vermutete Ursache: apps/web/lib/erfassung.ts:80 (erste PLZ im Text), Z. 84 (erste Zeile mit 13–119 Zeichen wird Titel).

### INV-007 · Zielpreise: „… zum Angebot“ rechnet gegen den Preis ohne Stellplatz, Playbook gegen den Preis mit Stellplatz
- Schweregrad: Hoch
- Bereich: Objekt › Durchspielen › Schwellen & Zielpreise; Playbook
- Schritte: 1. Objekt aus `qa-inv-expose.pdf` anlegen (289.000 € + TG-Stellplatz 18.000 € separat, mitkaufen). 2. Reiter Ergebnis › Playbook lesen. 3. Reiter Durchspielen › „Schwellen & Zielpreise“ lesen.
- Erwartet: Beide Stellen vergleichen den Zielpreis mit demselben Angebot (307.000 € inkl. Stellplatz, so rechnet `zielpreis` auch).
- Tatsächlich: Playbook: „Cashflow ± 0 bis 203.014 € … müsste der Preis um 103.986 € (34 %) sinken“. Zielpreis-Kachel: „Kaufpreis für Cashflow ± 0 203.014 € · −30 % zum Angebot“. Nachgerechnet: 203.014 / 289.000 − 1 = −29,8 % (falsche Basis), 203.014 / 307.000 − 1 = −33,9 % (richtig). Ebenso „Faktor 22: 224.400 € −22 %“ (richtig: −26,9 %), „DSCR 1,10: 191.047 € −34 %“ (richtig: −37,8 %).
- Beleg: d_tab_spielen.png, d_obj_pdf_ergebnis.png; Ausgabe teil.py
- Vermutete Ursache: apps/web/components/objekt/Teile.tsx:261 (`v / o.objekt.kaufpreis - 1`; Zielpreise kommen aus `mitStellplaetzen(o)`, packages/engine/src/analyse.ts:28).
- Vorschlag: gegen `mitStellplaetzen(o.objekt).kaufpreis` vergleichen und „inkl. Stellplatz“ dazuschreiben.

### INV-008 · Unbekannte Objekt-ID: Seite bleibt dauerhaft bei „Lädt …“
- Schweregrad: Mittel
- Bereich: Objektseite, Navigation
- Schritte: `/objekt/gibtsnicht` aufrufen (z. B. alter Link nach dem Löschen).
- Erwartet: Wie bei Suchaufträgen eine Seite „Objekt nicht gefunden“ mit Link zurück zu den Prüfungen.
- Tatsächlich: Nur „Lädt …“ ohne Ende und ein kurzer Toast „Objekt nicht gefunden.“, der nach 3,5 s verschwindet. Danach sieht der Nutzer eine leere Seite mit Ladehinweis. HTTP 404 auf `/api/objekte/gibtsnicht`.
- Beleg: d_objekt_gibtsnicht.png; Konsole „Failed to load resource: 404“
- Vermutete Ursache: apps/web/app/objekt/[id]/page.tsx:30 (catch setzt nur `meldung`), Z. 66 (`if (!o …) return „Lädt …“`).

### INV-009 · Ungebetener Suchauftrag „Mein erstes Investment“ ohne Region nach dem Onboarding
- Schweregrad: Mittel
- Bereich: Onboarding › Suchaufträge, Investments-Übersicht
- Schritte: 1. Frisches Konto, `/start` aufrufen (vor dem Onboarding). 2. Onboarding durchlaufen, Anlageprofil „QA-INV Mix Rheinland“ mit Regionen Düsseldorf, Köln, Neuss. 3. `/suchen` und `/investments` öffnen.
- Erwartet: Kein Suchauftrag, bis der Nutzer einen anlegt – oder einer, der Name und Regionen des Onboardings übernimmt.
- Tatsächlich: Es existiert bereits ein Suchauftrag „Mein erstes Investment“ (Name des alten Standardprofils), „ETW, alle Regionen“, Status „Aktiv“. Die Übersicht zeigt „1 aktiv · 0 Treffer“, obwohl der Nutzer nie einen Auftrag angelegt hat. Der Schritt „Suchauftrag einrichten“ der Ersten Schritte bleibt trotzdem offen.
- Beleg: d_suchen.png, d_investments.png; `GET /api/profil` → `suchen[0].name = "Mein erstes Investment"`, `region: ""`
- Vermutete Ursache: apps/web/components/App.tsx:55–60 – die Migration „Bestehende Daten ohne Suchaufträge“ läuft auch für neue, noch nicht eingerichtete Profile und wird vor dem Onboarding gespeichert.
- Vorschlag: Migration nur für `onboarded`-Profile; sonst Suchauftrag aus dem Onboarding-Profil erzeugen.

### INV-010 · Kaufpreis je m² und Hausgeld je m² werden nirgends angezeigt
- Schweregrad: Hinweis
- Bereich: Objekt › Ergebnis › Alle Kennzahlen
- Schritte: Objekt mit Fläche, Kaufpreis und Hausgeld öffnen, „Alle Kennzahlen“ aufklappen.
- Erwartet: Investoren vergleichen Objekte zuerst über €/m² Kaufpreis und Hausgeld €/m² (hier 4.264 €/m² inkl. Stellplatz bzw. 4.014 €/m² ohne; Hausgeld 4,31 €/m², n. u. 1,67 €/m²).
- Tatsächlich: `preisQm` wird gerechnet, aber nur indirekt über „Preis vs. Markt“ gezeigt (und nur, wenn ein Vergleichspreis vorliegt). Hausgeld je m² gibt es gar nicht.
- Beleg: d_tab_ergebnis.png
- Vermutete Ursache: apps/web/components/objekt/Teile.tsx:131–140 (`zeilen` ohne €/m²-Werte).

### INV-011 · Seite 404 ist englisch und ohne Weg zurück
- Schweregrad: Niedrig
- Bereich: Navigation
- Schritte: `/irgendwas` aufrufen.
- Erwartet: Deutsche Fehlerseite mit Link zu Start/Investments.
- Tatsächlich: „404 | This page could not be found.“ (Next.js-Standard), Seitentitel „404: This page could not be found.“
- Beleg: d_irgendwas.png
- Vorschlag: `app/not-found.tsx` anlegen.

### INV-012 · Falscher Hinweis bei Nicht-PDF oder beschädigtem PDF: „vermutlich ein Scan“
- Schweregrad: Niedrig
- Bereich: Objekt anlegen › Exposé hochladen
- Schritte: `POST /api/erfassen` mit `notiz.txt` bzw. beschädigtem `kaputt.pdf` (im Dialog ist `accept` nur ein Filter, per Drag & Drop geht jede Datei).
- Erwartet: „Die Datei ist kein lesbares PDF.“
- Tatsächlich: HTTP 200, „Im PDF war kein Text lesbar (vermutlich ein Scan). … das PDF wird trotzdem als Unterlage abgelegt.“ Für ein echtes Bild-PDF (`qa-inv-scan.pdf`) ist der Text passend.
- Beleg: Ausgabe des curl-Aufrufs gegen /api/erfassen
- Vermutete Ursache: apps/web/app/api/erfassen/route.ts:20–23 (kein Typ-/Signaturcheck), apps/web/app/neu/page.tsx:105 (`onDrop` ohne Typprüfung).

### INV-013 · Concierge fragt nie nach Ort/Lage; ohne Ort gilt die Region trotzdem als „passend“
- Schweregrad: Mittel
- Bereich: Objekt anlegen › Fragen lassen (Concierge); Passung
- Schritte: 1. `/neu` › „Fragen lassen“ › „Los geht’s“. 2. Alle Fragen beantworten (Preis 199.000, 55 m², vermietet, 640 €, Hausgeld 240 €, kein Stellplatz, Baujahr 1995, Klasse C, Rest „Weiß ich nicht“). 3. Concierge meldet „Alles Wichtige ist da.“ 4. Passung ansehen.
- Erwartet: Der Ort wird abgefragt (er ist im Assistenten „Von Hand“ Pflichtangabe und steuert Mietspiegel, Marktwerte und Regionsabgleich). Ohne Ort ist „Suche“ unbekannt, nicht erfüllt.
- Tatsächlich: Keine Frage nach dem Ort. Objekt heißt nur „ETW“, `ort: ""`. Passung „Suche 100“ (Region als erfüllt gewertet), obwohl das Anlageprofil nur Düsseldorf, Köln, Neuss enthält.
- Beleg: d_conc_fertig.png; `GET /api/objekte/djac6pv7mvkyxgl8` → `"titel": "ETW", "ort": ""`
- Vermutete Ursache: apps/web/lib/concierge.ts:31ff. (kein Eintrag für `ort`); packages/engine/src/core.ts:134 (`!o.ort` ⇒ `regionOk = true`); apps/web/lib/match.ts:12.

### INV-014 · Link-Auslesen folgt Weiterleitungen ohne erneute Adressprüfung (SSRF-Lücke)
- Schweregrad: Hoch (Sicherheit; live nicht nachweisbar, da der Server in der Testumgebung keine externen Namen auflöst – sonst Blocker)
- Bereich: Objekt anlegen › Link zum Inserat; `POST /api/erfassen` (Feld `url`)
- Schritte: 1. Direkte interne Ziele prüfen: `http://localhost:3100/…`, `http://127.0.0.1:3100/`, `http://[::1]:3100/`, `http://localtest.me:3100/` → alle korrekt abgewiesen („Diese Adresse ist nicht erreichbar.“). 2. Externe Adresse, die per 30x auf eine interne Adresse weiterleitet (z. B. `https://httpbin.org/redirect-to?url=http://169.254.169.254/…`).
- Erwartet: Jede Weiterleitung wird wie die Ausgangsadresse geprüft (oder `redirect: "manual"`).
- Tatsächlich: Code prüft nur die erste Adresse und ruft dann `fetch(url, { redirect: "follow" })` auf. Das Ziel der Weiterleitung wird nicht geprüft; dessen Text landet als Exposé-Text beim Nutzer (Schritt „Auslesen“) bzw. beim Daten-Analysten. Zusätzlich fehlen in der Sperrliste u. a. `100.64.0.0/10` und IPv4-gemappte IPv6-Adressen (`::ffff:127.0.0.1`) aus DNS-Antworten. DNS-Rebinding zwischen `lookup` und `fetch` ist ebenfalls möglich.
- Beleg: curl-Aufrufe gegen /api/erfassen (Schritt 1); Code
- Vermutete Ursache: apps/web/lib/erfassung.ts:14–21
- Vorschlag: `redirect: "manual"` und jede Location erneut prüfen; Verbindung auf die geprüfte IP festnageln.

### INV-015 · Mobil (390 px): „Forecast Jahr für Jahr“ verbreitert die ganze Seite
- Schweregrad: Mittel
- Bereich: Objekt › Durchspielen, mobil
- Schritte: 1. Bei 390 px Breite ein Objekt öffnen, Reiter Durchspielen. 2. „Forecast Jahr für Jahr“ aufklappen.
- Erwartet: Tabelle scrollt in ihrem Rahmen (`.tbl{overflow-x:auto}`), Seite bleibt 390 px breit.
- Tatsächlich: `document.documentElement.scrollWidth` springt von 390 auf 702 px. Diagramm, Positionen und Knöpfe werden rechts abgeschnitten, die Seite lässt sich waagrecht verschieben.
- Beleg: m_spielen_forecast.png; Messung scrollWidth 702 > clientWidth 390
- Vermutete Ursache: apps/web/components/objekt/Teile.tsx:241 (`<details>` mit `.tbl` innerhalb des Grid-Panels ohne `min-width:0`); apps/web/app/globals.css:214 greift nur, wenn der Elternteil schrumpfen darf.

### INV-016 · Neuladen im Assistenten „Neues Objekt“ verwirft alle Eingaben ohne Rückfrage
- Schweregrad: Niedrig
- Bereich: Objekt anlegen › Von Hand (gilt ebenso für Onboarding und Suchauftrag-Assistent)
- Schritte: 1. `/neu` › Von Hand › Weiter. 2. Titel „QA-INV Reload-Test“, Kaufpreis 250.000 eintragen. 3. Seite neu laden.
- Erwartet: Entwurf bleibt erhalten (z. B. `sessionStorage`) oder der Browser fragt nach (`beforeunload`).
- Tatsächlich: Zurück auf Schritt 1 „Womit möchten Sie starten?“, alle Eingaben weg, keine Rückfrage. Der „Abbrechen“-Knopf fragt dagegen nach.
- Beleg: Ausgabe hand.py („nach Reload: Neues Objekt | Womit möchten Sie starten?“, keine Dialoge)
- Vermutete Ursache: apps/web/app/neu/page.tsx:37–43 (Zustand nur in `useState`).

### INV-017 · Gespeichertes XSS über hochgeladene Unterlagen (HTML als „.png“)
- Schweregrad: Blocker
- Bereich: Objekt › Unterlagen; `GET /api/dateien/[id]`
- Schritte: 1. Datei `qa-inv-xss.png` mit HTML-Inhalt (`<script>document.title="XSS-"+document.domain</script>`) erzeugen. 2. Hochladen mit Content-Type `text/html`: `curl -F "dateien=@qa-inv-xss.png;type=text/html" /api/objekte/<id>/dokumente` (im Browser genügt eine Datei mit Endung .png und manipuliertem Typ, z. B. per Drag & Drop/Skript). 3. Die Datei über den Link in der Unterlagenliste oder direkt `/api/dateien/<dateiId>` öffnen.
- Erwartet: Nur echte PDF/Bilder werden angenommen (Signatur prüfen); ausgeliefert wird mit festem, sicherem Content-Type, `X-Content-Type-Options: nosniff`, bei Unklarheit `attachment`.
- Tatsächlich: Upload wird angenommen (Prüfung nur auf die Endung `.png`), als „Fotos“ eingeordnet und mit `mime: text/html` gespeichert. Auslieferung: `content-type: text/html`, `content-disposition: inline`. Das Skript läuft auf dem App-Ursprung: Seitentitel wird zu „XSS-localhost“. Damit kann eine präparierte Datei (z. B. ein „Exposé-Foto“ von einem Makler, oder später geteilte Objekte) im Namen des Nutzers alle APIs aufrufen (Export, Löschung, Admin).
- Beleg: xss_datei.png; Antwortkopf `content-type: text/html` / `inline`; Datei-ID `coh1a813mvkz1ow1` (wieder entfernt)
- Vermutete Ursache: apps/web/app/api/objekte/[id]/dokumente/route.ts:38–43 (`istBild` prüft Name, `mime = f.type` vom Client); apps/web/app/api/dateien/[id]/route.ts:6 (liefert gespeicherten MIME-Typ ungeprüft inline aus).
- Vorschlag: Dateisignatur prüfen, MIME aus der Signatur ableiten, Allowlist beim Ausliefern, `nosniff`, `Content-Security-Policy: sandbox` für Dateiauslieferung.

### INV-018 · „Ermitteln“ ohne KI: falsche Stadt durch Teilwort-Treffer, Quelle als „Modellwissen“ ausgegeben
- Schweregrad: Hoch
- Bereich: Objekt › Daten › Markt & Vergleich › Ermitteln (Testmodus/KI-Ausfall)
- Schritte: 1. Objekt mit Ort „Köln“ und Titel „QA-INV Wohnung Hamburger Straße“ › Ermitteln. 2. Ort „Kassel“, Titel „QA-INV Für Interessenten: Wohnung“ › Ermitteln. (Per `POST /api/objekte/<id>/ermitteln` mit diesen Feldern nachvollzogen.)
- Erwartet: Köln-Werte (10,0 €/m², 4.300 €/m²) bzw. „Keine Stadt erkannt“ für Kassel.
- Tatsächlich: Fall 1 liefert „Grobe Orientierung für Hamburg“ (9,8 €/m², 5.200 €/m²), weil „hamburg“ in „Hamburger“ steckt und vor „köln“ in der Liste steht. Fall 2 liefert „Essen“ (7,2 €/m², 2.200 €/m²) wegen „Inter*essen*ten“. Die Werte landen in Vergleichsmiete/Vergleichspreis/Bodenrichtwert und damit in Preis vs. Markt, Mietpotenzial und Score. Außerdem steht als Quelle „Modellwissen, Stand etwa 2025“, obwohl es eine feste Tabelle im Code ist (kein Modell beteiligt) – der Nutzer hält das für eine KI-Schätzung. Nebenbei: Spannen kommen als `6.1000000000000005` aus der API.
- Beleg: d_markt_ermittelt.png; curl-Ausgabe (Hamburg/Essen)
- Vermutete Ursache: apps/web/lib/marktwerte.ts:9–14, 20–21 (`text.includes(n)` über Ort *und* Titel, erste Fundstelle gewinnt), Z. 31 (`stand`).
- Vorschlag: Nur Ort, auf Wortgrenzen und längsten Treffer prüfen; Quelle ehrlich „Grobe Tabelle highstack, ohne KI“ nennen.

### INV-019 · Steuern ignorieren eigene Positionen (Küche beim Kauf, Zusatzmieten, Instandhaltung)
- Schweregrad: Hoch
- Bereich: Objekt › Durchspielen › Eigene Positionen; Steuern & Struktur
- Schritte: 1. Objekt „QA-INV Hand 2-Zi Köln-Nippes“ (210.000 €, 720 € Miete, 110 € n. u. Hausgeld, EK 80.000, privat 42 %). 2. Durchspielen › Position „Küche“ (6.000 €, einmalig, Jahr 0). 3. Eigenkapitalrendite vor Steuern und Reiter Steuern vergleichen.
- Erwartet: Nachgerechnet (sim.py): vor Steuern 4,16 % → 3,69 % mit Küche; nach Steuern 4,40 % → 3,92 %, Vermögenszuwachs nach Steuern 76.160 € → 70.160 €.
- Tatsächlich: Vor Steuern zeigt die App korrekt 3,7 %. Nach Steuern bleibt sie bei 4,4 % und 76.160 € – die 6.000 € fehlen. Laufende Positionen (z. B. „Stellplatz“ +80 €/Monat Einnahme, „Instandhaltung Sondereigentum“ 600 €/Jahr) fließen zwar in den Cashflow, aber weder als steuerpflichtige Einnahme noch als Werbungskosten in die Steuer. Auch „Zuzahlung gesamt“ (3.794 €) enthält die Küche nicht.
- Beleg: d_position_kueche.png; Ausgabe kueche.py („OHNE/MIT“ jeweils Steuern 4,4 % / 76.160 €) und sim.py
- Vermutete Ursache: packages/engine/src/core.ts:232 (`einkuenfte = miete − kosten − zins − afa`, ohne `positionen`), Z. 238 (`flowsP = [-sim.ekEinsatz, …]` ohne `sim.beimKauf`), ebenso Z. 241 für die GmbH.

### INV-020 · Haltedauer 0 im Anlageprofil legt den ganzen Bereich Investments lahm
- Schweregrad: Blocker
- Bereich: Profil › Anlageprofil › Haltedauer; Investments, Prüfungen, Objektseite
- Schritte: 1. `/profil` › „Haltedauer, Gewichtung, K.O.-Kriterien“ › Haltedauer „0“ eintragen (wird ohne Hinweis gespeichert). 2. `/investments`, `/pruefen` oder ein Objekt öffnen.
- Erwartet: Eingabe wird abgelehnt (min. 1 Jahr) oder auf 1 begrenzt; die App bleibt bedienbar.
- Tatsächlich: Alle drei Seiten zeigen nur „Application error: a client-side exception has occurred“. Konsole: `TypeError: Cannot read properties of undefined (reading 'wert')`. Der Zustand ist gespeichert und bleibt nach Neuladen bestehen; ein Nutzer erkennt die Ursache nicht. (Im Durchspielen-Regler ist die Haltedauer auf 1–60 begrenzt, im Profil nicht.) Nach dem Test wieder auf 15 gesetzt.
- Beleg: d_haltedauer_0_investments.png, d_haltedauer_0_objekt_ti7dteobmvkyyi1x.png; Konsolenfehler oben
- Vermutete Ursache: apps/web/components/Profilteile.tsx:88 (`set({ haltedauer: v ?? 10 })` ohne min); packages/engine/src/core.ts:184–187 (`simuliere` greift bei 0 Jahren auf `jahre[-1]` zu).
- Vorschlag: min=1/max=60 im Profil und Absicherung in `simuliere`; Fehlergrenze (error boundary) je Seite.

### INV-021 · API speichert unsinnige Objektdaten ungeprüft; Bewertung wird trotzdem „Watch 64“
- Schweregrad: Mittel
- Bereich: `POST/PATCH /api/objekte`; Objektseite
- Schritte: `POST /api/objekte` mit `kaufpreis: -100000, wohnflaeche: 0, miete: -500, hausgeldNichtUmlagefaehig: -50, baujahr: 3000, energieklasse: "Z", gebaeudeanteil: 5` (Titel „QA-INV Grenzwerte“), dann Objekt öffnen.
- Erwartet: HTTP 400 mit Feldfehlern (Schema-Prüfung auf dem Server), mindestens keine Einstufung.
- Tatsächlich: HTTP 201. Die Seite zeigt „64/100 · Watch – Passt teilweise“, „Abschreibung 3,0 % … −16.811 € pro Jahr“, „Steuern laufend: Erstattung 38.350 €“, Nettovermögen am Ende −125 T€. Die Oberfläche selbst verhindert negative Werte ebenfalls nicht (siehe INV-002).
- Beleg: d_tab_ergebnis.png/d_tab_steuern.png des Objekts `ywed3auhmvkz7id5` (vor dem Aufräumen), Ausgabe tabs.py
- Vermutete Ursache: apps/web/app/api/objekte/route.ts und apps/web/app/api/objekte/[id]/route.ts (keine Validierung); packages/engine/src/core.ts:109 (`ENERGIE_SCORE[...] ?? 50` für unbekannte Klassen).

### INV-022 · Doppelklick auf „Suchauftrag anlegen“ / „Anlageprofil anlegen“ legt doppelt an
- Schweregrad: Mittel
- Bereich: Suchaufträge › Neuer Suchauftrag
- Schritte: 1. `/suchen/neu` › Mehrfamilienhaus › Region „Köln-Ehrenfeld“ › Name „QA-INV MFH Köln“. 2. Doppelklick auf „Suchauftrag anlegen“.
- Erwartet: Ein Suchauftrag (Knopf sperrt nach dem ersten Klick, wie bei „Objekt anlegen“).
- Tatsächlich: Zwei identische Aufträge „QA-INV MFH Köln“ in `/api/profil` und in der Liste. Gleiches Verhalten unter `/profil/neu`: Doppelklick auf „Anlageprofil anlegen“ ergibt zwei Profile „QA-INV Cashflow Ruhr“ (Anzahl 1 → 3). Beide Profile tragen dieselbe `id` (der Entwurf bekommt seine ID beim Öffnen des Assistenten); „Ausgewähltes löschen“ entfernt danach beide auf einmal.
- Beleg: d_suchen_liste.png; Ausgabe suchen.py („nach Anlegen: [('QA-INV MFH Köln', …), ('QA-INV MFH Köln', …), …]“)
- Vermutete Ursache: apps/web/app/suchen/neu/page.tsx:25–28 und apps/web/app/profil/neu/page.tsx:19–22 (`anlegen` ohne Sperre; jeder Klick erzeugt neue `id()`).

### INV-023 · Umkreis außerhalb der Grenze wird gemeldet, aber trotzdem gespeichert
- Schweregrad: Niedrig
- Bereich: Suchaufträge › Neuer Suchauftrag › Wo
- Schritte: Umkreis „300“ eintragen, „Weiter“, anlegen.
- Erwartet: „Weiter“ gesperrt oder Wert auf 200 begrenzt.
- Tatsächlich: Hinweis „Erlaubt: 0 bis 200“ erscheint, „Weiter“ bleibt aktiv, Zusammenfassung zeigt „(+300 km)“, gespeichert wird `umkreisKm: 300`; im Auftrag steht dann dauerhaft der rote Hinweis neben „Kleinanzeigen · 300 km“.
- Beleg: d_suche_umkreis300.png, d_suche_detail.png
- Vermutete Ursache: apps/web/components/Felder.tsx:24 (min/max nur Anzeige), apps/web/app/suchen/neu/page.tsx:43–46.

### INV-024 · Profiländerung geht verloren, wenn man innerhalb von 0,6 s neu lädt oder den Tab schließt
- Schweregrad: Niedrig
- Bereich: Profil (alle Felder, die über `setzeProfil` speichern: Profil, Suchaufträge, Strategien)
- Schritte: `/profil` › Eigenkapital „81.000“ eintippen › sofort neu laden.
- Erwartet: Wert bleibt (wie bei Objekten, die beim `pagehide` noch gesendet werden).
- Tatsächlich: Nach dem Neuladen steht wieder 80.000 €, `/api/profil` ebenfalls 80.000. Kein Hinweis „ungespeichert“.
- Beleg: Ausgabe profil.py („EK nach Sofort-Reload: 80000“)
- Vermutete Ursache: apps/web/components/App.tsx:79–82 (600-ms-Verzögerung ohne Absenden bei `pagehide`; anders als Objektseite apps/web/app/objekt/[id]/page.tsx:47–50).

### INV-025 · Strategie im Profil umstellen lässt Ziele (Rendite, Faktor, Gewichte) unverändert
- Schweregrad: Hinweis
- Bereich: Profil › Anlageprofil › Strategie
- Schritte: Anlageprofil „QA-INV Mix Rheinland“ › Strategie von „Mix“ auf „Cashflow“ stellen.
- Erwartet: Wie im Assistenten (Cashflow: 6 % / Faktor 17 / Gewicht Rendite 40) – oder ein Angebot „Ziele an Strategie anpassen?“.
- Tatsächlich: Nur das Etikett ändert sich; Mindestrendite bleibt 5,0 %, Faktor 22, Gewichte gleich. Ergebnis und Einstufung bleiben identisch, obwohl der Nutzer glaubt, auf Cashflow umgestellt zu haben.
- Beleg: Ausgabe profil2.py („Strategie->Cashflow: Cashflow 0.05 22 0“)
- Vermutete Ursache: apps/web/components/Profilteile.tsx:74 (setzt nur `strategie`), vgl. apps/web/lib/vorgaben.ts:48.

### INV-026 · Portfolio: „Kaufpreise gesamt“ ohne mitgekaufte Stellplätze, „Eigenkapital im Bestand“ ist nicht das eingesetzte Eigenkapital
- Schweregrad: Mittel
- Bereich: Portfolio; Investments-Übersicht (Kachel „EK im Bestand“); Objektlisten
- Schritte: 1. Objekt aus `qa-inv-expose.pdf` (289.000 € + TG-Stellplatz 18.000 €, EK 80.000 €) auf Status „Bestand“ setzen. 2. `/portfolio` und `/investments` öffnen.
- Erwartet: Kaufpreise gesamt 307.000 € (wie „Angebotspreis inkl. Stellplatz“ auf der Objektseite). Eigenkapital: 80.000 € eingesetzt; wenn der Substanzwert gemeint ist, dann so benennen.
- Tatsächlich: „Kaufpreise gesamt 289 T€“ (Stellplatz fehlt), Objektzeile „289.000 €“. „Eigenkapital im Bestand 43 T€“ – das ist Kaufpreis minus Darlehen (307.000 − 264.055 = 42.945 €), also nach Abzug der Nebenkosten, nicht das eingesetzte Eigenkapital von 80.000 €. Ein Investor liest daraus, er habe 43 T€ gebunden.
- Beleg: d_portfolio.png, d_investments_bestand.png
- Vermutete Ursache: apps/web/app/portfolio/page.tsx:48 (`o.objekt.kaufpreis` statt `mitStellplaetzen`; `nettovermoegenStart` als „Eigenkapital“); apps/web/app/investments/page.tsx (Kachel „EK im Bestand“); apps/web/components/Objektliste.tsx:27.

### INV-027 · Zahlenformat: Wohnfläche mit Dezimalpunkt („58.5 m²“)
- Schweregrad: Niedrig
- Bereich: Prüfen, Portfolio, Suchauftrag-Treffer (Objektliste)
- Schritte: Objekt mit 58,5 m² anlegen, `/pruefen` öffnen.
- Erwartet: „58,5 m²“.
- Tatsächlich: „Köln-Nippes, 210.000 €, 58.5 m², …“
- Beleg: d_pruefen.png
- Vermutete Ursache: apps/web/components/Objektliste.tsx:27 (`${o.objekt.wohnflaeche} m²` ohne `toLocaleString("de-DE")`).

### INV-028 · Mietspiegel-API liefert Entwürfe und Pflegedaten an jeden Nutzer
- Schweregrad: Mittel
- Bereich: Admin › Datenbasis; `GET /api/mietspiegel`, `GET /api/mietspiegel/[id]`
- Schritte: 1. Admin › Datenbasis › Stadt „QA-INV-Stadt“ › „Von Hand erfassen“ (Status Entwurf). 2. `GET /api/mietspiegel` aufrufen.
- Erwartet: Kunden (Nicht-Admins) bekommen nur geprüfte Mietspiegel und nur die für „Ermitteln“ nötigen Felder; Entwürfe, Hinweise, `erfasstVon` bleiben im Admin.
- Tatsächlich: Die Liste enthält den Entwurf mit allen Feldern (`status: "entwurf"`, `erfasstVon: "lokal"`, Hinweise, Rohwerte). Die Route prüft `istAdmin` nur für `darfPflegen`, filtert aber nicht; die Filterung `admin || status === "geprueft"` passiert erst im Browser (apps/web/components/objekt/Teile.tsx:98). Mit aktiver Anmeldung sieht damit jeder Kunde über die API die ungeprüfte Datenbasis samt E-Mail des Erfassers. (In der Testumgebung ist jeder Admin; deshalb anhand des Codes belegt.)
- Beleg: d_admin_mietspiegel_neu.png; `GET /api/mietspiegel` → `[('QA-INV-Stadt', 'entwurf', 'lokal')]`
- Vermutete Ursache: apps/web/app/api/mietspiegel/route.ts:7–10, apps/web/app/api/mietspiegel/[id]/route.ts:8–12.
- Vorschlag: Für Nicht-Admins serverseitig auf `geprueft` filtern und Felder reduzieren.

### INV-029 · Google Fonts werden extern geladen; die Datenschutzhinweise sagen „keine Weitergabe an Dritte“
- Schweregrad: Mittel
- Bereich: Querschnitt (Layout), Datenschutz
- Schritte: Beliebige Seite laden, Netzwerk beobachten.
- Erwartet: Schriften selbst ausliefern (`next/font` oder lokale Dateien) oder Google Fonts in den Datenschutzhinweisen nennen und rechtfertigen.
- Tatsächlich: Jede Seite lädt `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans…&family=Newsreader…` (in der Testumgebung blockiert: Konsolenfehler `net::ERR_TUNNEL_CONNECTION_FAILED` auf jeder Seite). Damit geht die IP jedes Besuchers an Google. `/datenschutz` erwähnt weder Google noch Schriften und verspricht „keine Weitergabe an Dritte“ (vgl. LG München I, 3 O 17493/20).
- Beleg: Konsolenausgabe aller Seiten (crawl.py)
- Vermutete Ursache: apps/web/app/layout.tsx:13–16.

### INV-030 · Paketgrenze „Basis: 1 Suchauftrag“ wird nicht durchgesetzt; doppelte Zeile in der Paketkarte
- Schweregrad: Niedrig
- Bereich: Konto › Pakete; Suchaufträge
- Schritte: Paket „Basis“ (Standard), mehrere Suchaufträge anlegen, `/konto` öffnen.
- Erwartet: Entweder Grenze greift beim Anlegen („Im Paket Basis 1 Suchauftrag“) oder die Karte verspricht keine Grenze.
- Tatsächlich: 3 Suchaufträge im Paket Basis ohne Hinweis („Suchaufträge 3“). In der Basis-Karte steht „Inserate und Exposés einfügen“ zweimal.
- Beleg: d_konto.png

### INV-031 · Entwickler-Anweisungen in der Kundenoberfläche
- Schweregrad: Hinweis
- Bereich: Testband (alle Seiten), Konto › Zugang
- Tatsächlich: „Für echte Einschätzungen ANTHROPIC_API_KEY in .env eintragen.“ (jede Seite) und „in der .env AUTH_SECRET … und ADMIN_EMAIL … setzen und die App neu starten“ (Konto). Für Kunden unverständlich; gehört in den Admin-Bereich (dort steht es unter System bereits).
- Beleg: d_investments.png, d_konto.png
- Vermutete Ursache: apps/web/components/App.tsx:113; apps/web/app/konto/page.tsx.

### INV-032 · Link auslesen: nach dem Fehlschlag steht weiter „Einen Moment.“
- Schweregrad: Niedrig
- Bereich: Objekt anlegen › Link zum Inserat
- Schritte: `/neu` › Link zum Inserat › `https://www.immobilienscout24.de/expose/123` › Auslesen (Seite nicht erreichbar).
- Erwartet: Klare Fehlermeldung mit nächstem Schritt (Text einfügen / PDF hochladen) statt Ladehinweis.
- Tatsächlich: Überschrift „Nichts gefunden“, darunter weiterhin „Einen Moment.“, darunter die Liste „nicht gefunden, gleich ergänzen“ und erst ganz unten „Diese Adresse ist nicht erreichbar.“ (ohne den Tipp „Text kopieren oder PDF hochladen“, den es für 4xx-Antworten gibt).
- Beleg: d_neu_link.png
- Vermutete Ursache: apps/web/app/neu/page.tsx:118 (Lead fällt auf „Einen Moment.“ zurück, wenn `expose` leer ist); apps/web/lib/erfassung.ts:17.

### INV-033 · €/m²-Kennzahlen in Gestaltung auf ganze Euro gerundet
- Schweregrad: Niedrig
- Bereich: Objekt › Gestaltung (z. B. Möbliertes Wohnen)
- Schritte: Modul „Möbliertes Wohnen“ aktivieren.
- Erwartet: Mieten je m² mit zwei Nachkommastellen.
- Tatsächlich: „Gerechnete Kaltmiete möbliert 12 €/m²“, während der Hinweis direkt darunter „höchstens 12,10 €/m² bei Mietpreisbremse“ nennt – wirkt widersprüchlich.
- Beleg: d_gestaltung_moebliert.png
- Vermutete Ursache: apps/web/lib/format.ts:12 (`kennzahl` „€/m²“ → `num(wert, 0)`).

## Abdeckung

### Geprüft (mit und ohne Befund)
- **Start und Navigation:** `/` vor dem Onboarding (leitet auf `/start` um) und danach (Startauswahl Investments/Trading, Begrüßung nach Tageszeit, Zähler), Wechsel `/investments` ↔ `/trading` über den Bereichsschalter, Browser-Zurück/Vor (korrekt), Hauptmenü inkl. Admin-Eintrag, Escape schließt Menü, aktiver Menüpunkt. Alle Routen aus `apps/web/app` aufgerufen; unbekannte Pfade → INV-008, INV-011. `/suchen/<unbekannt>` zeigt eine saubere Fehlerseite.
- **Onboarding `/start`:** alle fünf Schritte, Live-Vorschau mit Grenzwerten (Buchstaben, negativ, 0, 10 Mrd., `1e6`) → INV-001, INV-002; Regionen als Marken (Enter, Komma), Name; Rahmen-Seite und Modus Begleitet/Selbst. Rahmen in Python nachgerechnet (Kaufpreis bis 356.920 €, Rate 1.546,67 €, Cashflow ± 0 ab 6,27 %, Faktor 15,96, Beleihungsauslauf 99,6 %, Zuzahlung 312 €): stimmt.
- **Profil `/profil`, `/profil/neu`:** Bundesland-Wechsel wirkt (BY: 366.737 €) und übersteht Neuladen; schnelles Neuladen → INV-024; Strategie umstellen → INV-025; neues Anlageprofil per Assistent, Doppelklick → INV-022; Löschen mit Rückfrage; Haltedauer 0 → INV-020 (danach auf 15 zurückgesetzt).
- **Suchaufträge:** anlegen (Assistent Was/Wo/Wie, Umkreis-Grenze → INV-023, Doppelklick → INV-022), Detail bearbeiten (Region, Pausieren) mit Speicherung, Markt-Briefing im Testmodus, Löschen mit Rückfrage und „Rückgängig“ (funktioniert), Übersicht. Automatisch angelegter Auftrag → INV-009. „Sichten und ranken“ ist ohne KI-Schlüssel gesperrt und erklärt das verständlich.
- **Objekt anlegen `/neu`:** alle fünf Wege. PDF-Exposé (reportlab, 2 Seiten: Kaufpreis, Fläche, Kaltmiete, Hausgeld gesamt/n. u., Baujahr, Energieklasse, Lage mit PLZ, TG-Stellplatz zzgl. 18.000 € als Teileigentum) – alle 9 Angaben korrekt erkannt. Bild-PDF (Scan), beschädigtes PDF, `.txt`, > 20 MB (413, sauber) → INV-012. Text einfügen (UI + 12 Varianten per API) → INV-003 bis INV-006. Link (Validierung, unerreichbar, interne Adressen) → INV-014, INV-032. Von Hand inkl. Doppelklick (nur ein Objekt, gut) und Neuladen → INV-016. Concierge komplett durchgespielt → INV-013.
- **Objektseite:** alle Reiter (Ergebnis, Durchspielen, Gestaltung, Steuern & Struktur, Unterlagen, Experten), Status-Wechsel auf Bestand, Daten ein-/ausblenden, Concierge an/aus, Stellplatz-Block, Unterlagen (Grundriss-PNG hochladen → als Grundriss erkannt und links als Vorschau gezeigt; Entfernen mit Rückfrage), Markt „Ermitteln“ inkl. Rückgängig → INV-018, Playbook, Netzdiagramm/Passung, Durchspielen (Regler, Vorlagen, Strategievorschlag, eigene Positionen, Forecast, Sensitivität, Prognose mit Marktszenarien und „Übernehmen“, Bandbreite, externe Faktoren, Stresstest, Schwellen & Zielpreise → INV-007), Gestaltung (Möbliertes Wohnen aktiviert → INV-033), Steuern → INV-019, Löschen mit Rückfrage (Fokus auf „Abbrechen“, Escape bricht ab), „Rückgängig“ und endgültiges Löschen (funktioniert). Grenzwerte per API → INV-021. Unterlagen-Upload als Angriffsweg → INV-017.
- **Rechnungen nachgerechnet (nachrechnen.py, sim.py):** Objekt aus dem PDF (289.000 € + 18.000 € Stellplatz, 72 m², 850 €, n. u. Hausgeld 120 €, NW): Erwerbsnebenkosten 37.054,90 € (12,07 %: GrESt 19.955 €, Notar 6.140 €, Makler 10.959,90 €), Gesamtinvestition 344.054,90 €, Darlehen 264.054,90 €, Rate 1.276,27 €, Bruttomietrendite 3,32 % (ohne Stellplatzpreis 3,53 %), Faktor 30,1, Nettomietrendite 2,49 %, Cashflow −563,27 €/Monat, DSCR 0,56, Hausgeld 4,31 €/m² (n. u. 1,67 €/m²), Forecast Jahr 1–15 inkl. Anschlussfinanzierung, IRR vor Steuern 2,63 %, AfA 5.160,82 €/Jahr, Steuererstattung 25.721 €, IRR nach Steuern 3,97 %, Zielpreise (Cashflow ± 0 203.014 €, 5 % Rendite 204.000 €), Schwellen (Miete 1.425 €, Sollzins 1,24 %, EK 196.538 €), Ergebniszerlegung (136 T€ / 56 T€). Alles stimmt mit der App überein – Abweichungen nur bei INV-007, INV-019, INV-026. Hand-Objekt (210.000 €, 720 €, 110 €) und Concierge-Objekt (199.000 €, 640 €, 96 €) ebenfalls nachgerechnet: stimmt.
- **Prüfen, Portfolio, Experten:** Liste mit Sortierungen, Portfolio-Kennzahlen → INV-026, INV-027; Experten-Seite mit Objektauswahl und Schaltern (Makler aus/an, gespeichert, zurückgesetzt).
- **Ohne KI-Schlüssel:** Kurzurteil, Einzelexperte, Teamlauf (7 bzw. 8 Rollen, Komitee, Compliance-Regelprüfung), Markt-Briefing, Strategievorschlag: alle laufen ohne Absturz und kennzeichnen Platzhalter als „Testmodus“. Auffällig, aber nicht als Fehler gewertet: Platzhalter tragen eine echt wirkende Einstufung („Watch“) auch bei einem rechnerischen „Pass“, und die Admin-Übersicht zählt die Platzhalter als 20 „KI-Aufrufe“. Ermitteln ohne KI → INV-018. Sichten ist gesperrt mit verständlichem Text.
- **Admin:** alle sechs Tabs; Ankündigung „QA-INV Testankündigung“ veröffentlicht, im Band geprüft, „Ausblenden“ hält nach Neuladen, danach **beendet** (`/api/status` → `ankuendigung: null`); Protokoll zeichnet beides auf. Mietspiegel-Entwurf „QA-INV-Stadt“ angelegt und wieder gelöscht → INV-028. Konten zeigen keine Kundendaten (nur Kennzahlen). Auth-Kopfzeilen werden in der Middleware entfernt (kein Header-Spoofing). Alle `/api/admin/*`-Routen prüfen `istAdmin`.
- **Konto:** Datenexport (JSON) heruntergeladen und gelesen; Pakete → INV-030.
- **Querschnitt:** 390 px für alle Seiten, Objektreiter, Admin, Assistenten (nur Forecast-Tabelle bricht aus → INV-015; Reiterleiste scrollt bewusst in sich); Tastatur (Tab-Reihenfolge, sichtbarer Fokusrahmen, Dialog-Fokusfalle, Escape); Konsole/Netzwerk bei jedem Aufruf (nur 404 bei unbekannten IDs und die Google-Fonts-Fehler → INV-029); Zahlenformat de-DE (sonst durchgehend korrekt); leere Zustände (Prüfen, Portfolio, Treffer); Doppelklick; Neuladen; Hinweis „keine Anlageberatung“ steht in jeder Fußzeile, im Onboarding und unter `/hinweise`. Pfad-Traversal auf `/api/dateien` ohne Erfolg. Dateiablage serialisiert Schreibzugriffe (kein Lost Update im Dateispeicher).

### Nicht geprüft
- **Echte KI-Ergebnisse** (Daten-Analyst, Experten, Markt-Analyst, Sichten mehrerer Inserate): kein Anthropic-Schlüssel in der Umgebung.
- **Link-Auslesen öffentlicher Portale und die Weiterleitungs-SSRF (INV-014) live:** Der Server löst keine externen Namen auf; nur Code-Befund.
- **Wohnlage-Auswahl und Mietspiegel-Abfrage:** braucht einen Mietspiegel mit Tabellenwerten; ein leerer Entwurf wurde nur angelegt und wieder gelöscht, das PDF-Auslesen von Mietspiegeln/Marktberichten braucht KI.
- **Kundensicht bei aktiver Anmeldung** (Nicht-Admin, Magic Link, Mandantentrennung): `AUTH_SECRET` ist nicht gesetzt, jeder ist Admin; INV-028 daher aus dem Code belegt.
- **Konto löschen, Paketwechsel, Konten-Tab-Änderungen:** bewusst nicht ausgelöst, um den gemeinsamen Mandanten und den Trading-Testnutzer nicht zu stören.
- **Dunkles Farbschema, Screenreader-Ausgabe, iOS-Safari-Eigenheiten:** nur Chromium headless.

### Hinterlassene Testdaten
Objekte „QA-INV Hand 2-Zi Köln-Nippes“ und zweimal „QA-INV 3-Zimmer-Eigentumswohnung Düsseldorf-Bilk“ (eines im Bestand), Suchauftrag „QA-INV MFH Köln“ (pausiert), Anlageprofil „QA-INV Mix Rheinland“ (aus dem Onboarding), Nachfrage-Einträge „Mietspiegel Köln/Kassel“ (Kassel als erledigt markiert). Unbenanntes Concierge-Objekt „ETW“, XSS-Probedatei, Grenzwert-Objekt, doppelte Aufträge/Profile und der Mietspiegel-Entwurf wurden entfernt; Ankündigung ist beendet.
