# Nachtest Bugfix-Welle 2 – Testnutzer Investments

- Datum: 24.10.2026
- Geprüfter Stand: 7b30665 (Version 0.14, Produktions-Build, Testmodus, ohne Anmeldung, ohne Anthropic-Schlüssel, ohne Zugang zu externen Seiten), http://localhost:3100, frische Daten
- Zusammenfassung: 17 Befunde nachgeprüft: 11 behoben, 6 teilweise, 0 nicht behoben. 9 neue Befunde (INV-046 bis INV-054): Blocker 1, Hoch 0, Mittel 4, Niedrig 2, Hinweis 2.
- Ablauf: Der Lauf wurde einmal unterbrochen (Limit). Danach lief der Server wieder mit gleichem Stand und gleichen Daten (19 Objekte vorhanden), der Test wurde zu Ende geführt.

Belege: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-belege/inv3/`
Skripte: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-skripte/inv3/`

Ausgangslage: Die Datenablage war frisch. Ich habe das Onboarding neu durchlaufen (EK 80.000 €, Kredit 320.000 €, NW, privat 42 %, Anlageprofil „QA-INV Mix Rheinland“ mit Düsseldorf, Köln, Neuss). Danach habe ich die Objekte `zjhvjjjsmvm66uf1` (PDF-Exposé, 289.000 € + TG-Stellplatz 18.000 €) und `i8gfzpmdmvm67n3s` („QA-INV Hand 2-Zi Köln-Nippes“, von Hand) wie im ersten Lauf angelegt.

## Nachprüfung

| ID | Status | Kurzbegründung |
|---|---|---|
| INV-001 | teilweise | Im Onboarding und im Profil setzt die Risikoneigung jetzt Tilgung und DSCR. Die Rate in der Vorschau ändert sich entsprechend: 1.813 € / 1.547 € / 1.413 €. Rest: Im Profil verspricht „Vorsichtig“ „Energieklasse G/H ausgeschlossen“, das K.O.-Kriterium bleibt aber `false`. |
| INV-002 | teilweise | Negative Werte, `1e6` und Buchstaben werden beim Tippen abgewiesen und mit einem Hinweis markiert. Werte über der Grenze werden aber still auf den letzten gültigen Teil gekürzt: 10 Mrd. werden zu 1 Mrd. (siehe INV-048). |
| INV-003 | teilweise | Die Originaltexte werden jetzt richtig gelesen. Die übliche Exposé-Schreibweise „Erbbaurecht: nein“ / „Sonderumlage: keine“ und Sätze mit Verneinung am Satzende ergeben weiter `true` und damit ein K.O. |
| INV-004 | behoben | Fall 1: kein eigener Stellplatzpreis. Fall 2: keine Stellplatzmiete. Fall 3: 18.000 €. Auch „Kaufpreis 289.000 € zzgl. Stellplatz 18.000 €“ in einer Zeile wird richtig gelesen. |
| INV-005 | behoben | „289.000,- €“, „EUR 289.000“, „€ 289.000,-“, „289.000,00 EUR“, „Preis: 289.000 Euro“ und „Kaufpreis (VB)“ ergeben alle 289.000. |
| INV-006 | behoben | Der Maklerkopf liefert weder Ort noch Titel mehr. Neues Problem durch die Kontakt-Erkennung: INV-046. |
| INV-007 | behoben | Die Kacheln zeigen jetzt „−34 / −34 / −27 / −38 % zum Angebot inkl. Stellplatz“. Mit Python nachgerechnet gegen 307.000 €: −33,9 / −33,6 / −26,9 / −37,8 %. Das Playbook nennt 103.986 € (34 %), das passt. |
| INV-018 | behoben | „Hamburger Straße“/Köln liefert Köln (10,0 €/m², 4.300 €/m²). „Interessenten“/Kassel liefert „Keine Stadt erkannt“. Als Quelle steht „Feste Grobtabelle von highstack (ohne KI)“. Die Spannen sind sauber gerundet. |
| INV-019 | behoben | Küche, laufende Einnahme und Instandhaltung fließen in die Steuer ein. Alle Werte stimmen mit der Nachrechnung in Python überein (siehe unten). |
| INV-020 | behoben | Haltedauer 0, −5 und 100 werden im Profil abgewiesen. Selbst Haltedauer 0, `null` oder `"abc"` per API lässt keine Seite mehr abstürzen. Restpunkte: INV-048 und INV-049. |
| INV-021 | teilweise | Negative Zahlen, eine unbekannte Energieklasse, ein Baujahr in der Zukunft und ein Gebäudeanteil über 1 werden mit 400 und Feldmeldung abgewiesen. Typen werden aber nicht geprüft (z. B. `ort: 12345`, `stellplaetze: "kaputt"`), das Szenario gar nicht. Siehe INV-049. Außerdem blockiert die neue Prüfung das Speichern im Normalbetrieb, siehe INV-047. |
| INV-026 | behoben | Portfolio: „Kaufpreise gesamt 307 T€“, „Eingesetztes Eigenkapital 80 T€“, Zeile „307.000 €“. Investments: Kachel „EK eingesetzt 80 T€“. |
| INV-034 | behoben | PNG und TXT zusammen hochgeladen: Die PNG wird abgelegt, die TXT einzeln gemeldet („notiz.txt: nicht übernommen (…)“), in der API ebenso wie in der Oberfläche. Nur ungültige Dateien ergeben weiter 415. |
| INV-037 | teilweise | Es gibt jetzt eine Vorschau mit Fehlern je Zeile. Mehrdeutiges Komma, ungültige Daten, Zukunft, Exponent und Grenzen werden abgewiesen. Der Folgefall `bund10j` mit „2026-10-01,2,70“ wird abgewiesen. Werte im Zeitraum lassen sich löschen. Rest: „2026-07-01 2,15“ (Leerzeichen) wird in Zusatzreihen weiter zu **15**. „1.085“ und „2.345“ werden in Zusatzreihen still zu 1085 bzw. 2345. |
| INV-038 | behoben | Nur „2015-06;0,80“ ergibt „Standardannahmen“ und Anschlusszins 5,30 / 4,30 / 3,80 %. Der Wert wird nicht mehr verwendet. Rest: INV-052. |
| INV-039 | behoben | Der Rückblick wird gespeichert: „Gespeichert am 24.10.26, 11:17 … 165 Prognosen, geprüft 162, Trefferquote 94 %, Brier 0,121“. Das Ergebnis übersteht das Neuladen, „Überprüfung“ verweist darauf, „Gelernte Gewichte übernehmen“ wirkt und bleibt nach „Lauf jetzt“ bestehen. Schrittweite 1 ergibt jetzt „Schrittweite mindestens 7 Tage“. |
| INV-040 | behoben | Lauf 1: 4 neue Prognosen. Nach dem Import von Bund und Immo: „1 neue Prognosen, 4 waren heute schon da“ (Wohnimmobilien 365 T., 51 %). Ein sofortiger dritter Lauf: „0 neue, 5 waren heute schon da“. |

### INV-001 · Rest
- Schritte: `/profil` › Risikoneigung „Vorsichtig“.
- Ergebnis: `tilgung 0.03`, `minDscr 1.25`. Der Text darunter lautet „…, Energieklasse G/H ausgeschlossen. Tilgung und DSCR können Sie danach frei anpassen.“ `anlageprofile[0].ko.energieGH` bleibt `false`. Ein Objekt der Klasse G wird also nicht ausgeschlossen, obwohl der Text es zusagt.
- Beleg: d_profil_vorsichtig.png; Skript profil_risiko.py
- Vermutete Ursache: apps/web/components/Profilteile.tsx:49 (setzt nur `investor`, nicht `ko.energieGH` im Anlageprofil)

### INV-002 · Rest
- Wörtlich wie im ersten Lauf: Eigenkapital „abc“, „-50000“, „10000000000“, „0“, „1e6“, „80.000“ zeichenweise getippt.
- Ergebnis: „abc“ und „1e6“ zeigen „Bitte eine Zahl eingeben“, „-50000“ zeigt „Erlaubt: 0 bis 1.000.000.000“, die Vorschau bleibt unverändert. Bei „10000000000“ steht während des Tippens der Hinweis. Nach dem Verlassen steht aber still **1.000.000.000** im Feld, ohne Hinweis, und die Vorschau sagt „Kaufpreis bis 892.504.685 €“. Ebenso wird aus „1e6“ nach dem Verlassen **1 €**. Siehe INV-048.
- Beleg: onb_1_ek_negativ.png, onb_1_ek_10mrd.png; Ausgabe onboarding.py

### INV-003 · Rest
- Wörtliche Testtexte: `kein_erbbaurecht` ergibt `erbbaurecht: false, sonderumlage: false`, `unvermietet` ergibt `leer: true`, `stellplatz_kein` ergibt keinen Stellplatz (`gefragt.stellplatz: "nein"`). Behoben.
- Neue Varianten (Ausgabe erfassen_text.txt):
  - „Erbbaurecht: nein“ / „Sonderumlage: keine“ ergibt `erbbaurecht: true`, `sonderumlage: true`. Ursache: Das Fenster nach dem Wort wird am Doppelpunkt abgeschnitten (`split(/[,;:]/)[0]` ergibt `""`). Im Objekt „QA-INV Wohnung Erbbaurecht-nein in Köln“ (`buuoyqbtmvm6scos`) steht deshalb „Durch ein K.O.-Kriterium ausgeschlossen. K.O.-Kriterium: Sonderumlage offen. K.O.-Kriterium: Erbbaurecht“, obwohl der Cashflow +41 € beträgt.
  - „Sonderumlagen sind derzeit nicht geplant.“, „Eine Sonderumlage wurde bislang nicht beschlossen.“ und „Ein Erbbaurecht besteht für dieses Objekt nicht.“ ergeben `true`, weil die Verneinung mehr als 15 Zeichen nach dem Wort steht.
  - Richtig gelesen: „Keine Provision. Erbbaurecht bis 2085“ ergibt `true`, „Sonderumlage von 8.000 € beschlossen“ ergibt `true`, „derzeit nicht vermietet“ ergibt `leer: true`.
- Zusätzlich zeigt der Schritt „Angaben gefunden“ Erbbaurecht und Sonderumlage nicht an. Siehe INV-050.
- Beleg: d_neu_text_erb_nein_2.png, d_neu_text_erb_nein_obj.png
- Vermutete Ursache: apps/web/lib/erfassung.ts:68 (Fenster danach 15 Zeichen, bricht an `:` ab)
- Vorschlag: Bei „Merkmal: nein/keine/ohne“ den Wert nach dem Doppelpunkt lesen; Verneinung im ganzen Teilsatz prüfen; bei K.O.-Merkmalen im Zweifel „unbekannt“.

### INV-019 · Nachrechnung Steuern mit Küche (Python, kueche_nachrechnung.py)
- Objekt `i8gfzpmdmvm67n3s`: 210.000 €, 720 € Miete, 110 € n. u., EK 80.000, privat 42 %, Nebenkosten 12,07 %, AfA 2 % auf 75 %. Die Küche (6.000 €, einmalig, Jahr 0) wird laut Code über 10 Jahre abgeschrieben, also 600 € pro Jahr.

| Größe | ohne Küche (App / Python) | mit Küche (App / Python) | + Stellplatz 80 €/M. und Instandhaltung 600 €/J. (App / Python) |
|---|---|---|---|
| EK-Rendite vor Steuern | 4,2 % / 4,16 % | 3,7 % / 3,69 % | 4,0 % / 4,00 % |
| EK-Rendite nach Steuern | 4,4 % / 4,40 % | 4,1 % / 4,08 % | 4,3 % / 4,26 % |
| Steuern laufend | Erstattung 2.893 € / −2.892,72 € | Erstattung 5.413 € / −5.412,72 € | Erstattung 3.145 € / −3.144,72 € |
| Vermögenszuwachs nach Steuern | 76.160 € / 76.160,10 € | 72.680 € / 72.680,10 € | 75.812 € / 75.812,10 € |
| Cashflow nach Steuern Jahr 1 | −75 € / −75,23 € | −54 € / −54,23 € | −37 € / −36,83 € |
| Zuzahlung gesamt | 3.794 € / 3.794,25 € | 9.794 € / 9.794,25 € | 4.394 € / 4.394,25 € |

Alles stimmt. Offen ist nur die Darstellung, siehe INV-053.

### INV-007 · Nachrechnung Zielpreise (Python, zielpreise_nachrechnung.txt)
- Netto im Monat 850 · 0,98 − 120 = 713 €; Annuität 5,8 %; Nebenkosten 12,07 %.
- Cashflow ± 0: (713 · 12 / 0,058 + 80.000) / 1,1207 = 203.014 €, gegenüber 307.000 € ergibt das −33,9 %, die App zeigt −34 %. 5 % Rendite: 204.000 € (−33,6 %, App −34 %). Faktor 22: 224.400 € (−26,9 %, App −27 %). DSCR 1,10: 191.047 € (−37,8 %, App −38 %).

### INV-021 · Rest
- Wörtlich: `POST /api/objekte` mit `kaufpreis -100000, wohnflaeche 0, miete -500, hausgeldNichtUmlagefaehig -50, baujahr 3000, energieklasse "Z", gebaeudeanteil 5` ergibt **400** mit sechs Feldmeldungen. Behoben.
- Weiterhin angenommen (alle 201): `baujahr: 5`, `wohnflaeche: 0`, `stellplaetze: "kaputt"`, `ort: 12345`, `sonderumlage: "ja"`, ein Leerkörper und ein Körper, der kein JSON ist. Per PATCH: Stellplatz `kaufpreis: "viel"` und `szenario: { eigenkapital: -1e9, sollzins: -5 }` (Ergebnis „Cashflow Jahr 1 415.093.704 €“). Die Folgen stehen in INV-049.
- `baujahr: -5` und `"1990"` ergeben die unpassende Meldung „Baujahr: höchstens 2031.“ (INV-051).
- Beleg: api_grenzwerte.txt

### INV-037 · Rest
- Wörtlich (kj_import.txt): f01 bis f04, f09 und f13 sind richtig. f05 (Müll) und f08 (ungültige Daten) zeigen klare Zeilenmeldungen. f06 ergibt „Mehrdeutig: Komma als Trennzeichen und als Dezimalzeichen …“. Bei f12 wird „Datum liegt in der Zukunft“ abgewiesen und der Knopf heißt „Nur die 1 gültigen übernehmen“. Großbuchstaben ergeben „Unbekannte Reihe“. f15 wird jetzt je Zeile richtig gelesen.
- Weiter falsch: f07 `2026-07-01 2,15` ergibt in Vorschau und Speicher **15** ohne Warnung. Das Datum „2026-07-01 2“ geht als ISO-Datum mit Uhrzeit durch. Bei Katalogreihen mit Grenzen wird der Wert abgewiesen, die Meldung ist aber verwirrend („Wert 70 liegt außerhalb …“, INV-051).
- Neu geprüft: `2026-09-01;1.085` (Wechselkurs, Zusatzreihe) wird zu **1085**, `2026-09-01,2.345` zu **2345**. Der Punkt mit genau drei Nachkommastellen gilt als Tausenderpunkt. Für Reihen mit Grenzen (z. B. `eurusd`, `bund10j`) wird der Wert abgewiesen. Für Zusatzreihen und `kurs:`-Reihen (bis 1 Mio.) wird er still übernommen. Für Katalogreihen nach Daten aus Excel oder FRED ist das relevant.
- `-5000000000` wird in Zusatzreihen ohne Grenze übernommen.
- Beleg: kj_import.txt, kj_import_vorschau_fehler.png
- Vermutete Ursache: packages/prognose/src/quellen.ts:44/51 (Leerzeichen als Trenner nicht vorgesehen, Datumsmuster `(?:[T ].*)?` frisst den Wertanfang), `zahl` (drei Stellen nach Punkt = Tausender)

## Regressionen

- **Onboarding mit allen Risikostufen: funktioniert.** Vorsichtig/Offensiv/Ausgewogen setzen Tilgung 3/1,5/2 % (Rate 1.813/1.413/1.547 €, Cashflow ± 0 ab 7,3/5,7/6,3 %). Eine eigene Tilgung (2,5 %) wird bei erneuter Wahl überschrieben, das kündigt der Text an. Der Rahmen nach Abschluss stimmt wie im ersten Lauf: 356.920 € / 1.547 € / 6,3 % / Faktor 16,0. Beleg: onb_3_vorsichtig.png, onb_3_offensiv.png, onb_3_ausgewogen.png, onb_5_rahmen.png.
- **Objekt per PDF: funktioniert.** Alle 9 Angaben werden erkannt, Ergebnis 20 Pass, Rendite 3,3 %, Faktor 30,1, Cashflow −563 €, Playbook 307.000 € inkl. Stellplatz. Das stimmt mit dem ersten Lauf überein.
- **Objekt per Text (Oberfläche): funktioniert**, auch bei 390 px (scrollWidth 390). Mit „Kein Erbbaurecht …“ gibt es kein K.O. mehr. Beleg: d_neu_text_2.png, m_neu_text_2.png/_3.png.
- **Objekt von Hand: funktioniert**, ein Objekt bei Doppelklick. Neuladen im Assistenten verwirft weiter alles (INV-016, nicht in dieser Welle).
- **Zahlen tippen auf der Objektseite (zeichenweise, mit Strg+A):** Kaufpreis „215.000“, Wohnfläche „58,5“ und Miete „735“ ergeben je PATCH 200 und „Gespeichert“. Die Zwischenstände („2“, „21“ …) speichert der Server ohne Fehler. **Die Serverprüfung blockiert aber das Speichern, sobald die Rücklage eingetragen ist, und hält danach jede weitere Änderung zurück** (INV-047). Werte über der Feldgrenze kürzt die Oberfläche still auf einen Präfix (INV-048).
- **Durchspielen: funktioniert.** Regler, Vorlagen, Strategievorschlag, eigene Positionen, Forecast, Schwellen und Zielpreise, Marktszenarien mit und ohne Bundrendite (4,08 / 5,08 / 3,58 %, Ausblick 51 %), Steuern. Keine Konsolenfehler bei gültigen Daten.
- **Portfolio: funktioniert** (INV-026). Bei „Prüfen“ steht weiter „58.5 m²“ (INV-027, nicht in dieser Welle).
- **Admin:** Alle acht Tabs öffnen ohne Absturz und ohne waagrechtes Scrollen (Desktop und 390 px). Konjunktur-Import mit Vorschau, Werte löschen, Lauf jetzt, Rückblick und Gewichte funktionieren (siehe oben).
- **Mobil 390 px:** Alle 30 geprüften Seiten haben scrollWidth 390. Weiterhin offen: Im Durchspielen verbreitert „Forecast Jahr für Jahr“ nach dem Aufklappen die Seite auf 667 bzw. 816 px (INV-015, nicht in dieser Welle). Die Reiterleiste der Objektseite scrollt bewusst in sich.

## Neue Befunde

### INV-047 · Rücklage eintragen sperrt das Speichern des ganzen Objekts; das Beispielobjekt lässt sich gar nicht mehr ändern
- Schweregrad: Blocker (Datenverlust)
- Bereich: Objekt › Daten › Genauer werden; Beispielobjekt; Concierge-Frage „Wie hoch ist die Rücklage, Ihr Anteil?“; `PATCH /api/objekte/[id]`
- Schritte: 1. Objekt „QA-INV Hand 2-Zi Köln-Nippes“ › Genauer werden › „Rücklage, Ihr Anteil“ = 4.500 €. 2. Danach Kaufpreis 210.000 und Miete 720 eintragen. 3. Seite neu laden. Zweiter Weg: `/neu` › „Beispielobjekt öffnen“ › Kaufpreis 199.000 › neu laden.
- Erwartet: Die Rücklage (ein Eurobetrag, im Beispielobjekt 6.500 €) wird gespeichert, ebenso alle weiteren Änderungen.
- Tatsächlich: Jeder PATCH ab der Rücklage antwortet **400** „Anteil Rücklage: zwischen 0 und 1.“, weil der Server `ruecklageAnteil` als Anteil 0–1 prüft. Das Feld ist aber in € beschriftet und wird so verwendet. Da die Oberfläche bei jeder Änderung das ganze `objekt` sendet, scheitern danach **alle** Änderungen am Objekt. Oben steht nur „Nicht gespeichert“, der Grund fehlt. Die Rechnung auf der Seite läuft mit den neuen Werten weiter, der Nutzer glaubt also, es sei gespeichert. Nach dem Neuladen sind alle Änderungen weg (Kaufpreis wieder 215.000 statt 210.000). Das Beispielobjekt hat von Anfang an `ruecklageAnteil: 6500` und ist damit überhaupt nicht editierbar (Kaufpreis 199.000 → Neuladen → 245.000). Mit KI-Schlüssel dürfte zudem jedes Exposé, in dem der Daten-Analyst eine Rücklage findet, beim Anlegen mit 400 scheitern (nicht live prüfbar).
- Dasselbe Sperrmuster tritt bei weiteren Abweichungen zwischen Oberfläche und Server auf: Baujahr 2040 („höchstens 2031“), Gebäudeanteil 150 %, Wohnfläche 150.000 m², Hausgeld 2.000.000 €. Die Oberfläche lässt diese Werte ohne Hinweis zu, der Server weist sie ab, und alle folgenden Änderungen gehen verloren, bis der Wert korrigiert ist.
- Beleg: d_tippen_ruecklage.png, d_beispiel_nicht_gespeichert.png, d_tippen_grenzen.png; Ausgabe tippen.py (PATCH-Status 400 mit Meldung), beispiel.py
- Vermutete Ursache: apps/web/lib/objektpruefung.ts:11 (`ruecklageAnteil: [0, 1, …]`), vgl. apps/web/components/objekt/Teile.tsx:52 (Feld in €) und packages/engine/src/beispiel.ts:16 (6500); apps/web/app/objekt/[id]/page.tsx:77 (bei Fehler wird `offen` verworfen, der Grund nicht gezeigt)
- Vorschlag: Grenze für `ruecklageAnteil` auf € (z. B. 0 bis 10 Mio.) korrigieren. Dieselbe Grenzbeschreibung für Oberfläche und Server verwenden (Baujahr, Gebäudeanteil, Fläche, Hausgeld). Bei 400 das Feld markieren und die Meldung anzeigen, offene Änderungen nicht verwerfen.

### INV-046 · Titel und Ort: Wörter mit „tel“ (Stellplatz, Hotel, Mittel…) gelten als Kontaktzeile; Titel wird „Wohnfläche: 34 m²“
- Schweregrad: Mittel
- Bereich: Objekt anlegen › Text/PDF auslesen
- Schritte: Text auslesen mit erster Zeile „QA-INV Apartment mit Stellplatz in Köln Sülz“ (INV-004 Fall 1), ebenso „QA-INV 2-Zimmer-Wohnung mit Stellplatz in Neuss“, „QA-INV Apartment im ehemaligen Hotel am Rhein“, „QA-INV Reihenmittelhaus in Neuss-Holzheim“. Für den Ort: „Objektadresse: Mittelstraße 5, 50672 Köln“.
- Erwartet: Die erste Zeile wird Titel, der Ort ist Köln.
- Tatsächlich: Der Titel ist „Wohnfläche: 34 m²“ bzw. „Wohnfläche: 52 m²“, „31 m²“ oder „120 m²“. Beim Ort steht nichts. Auch „QA-INV Wohnung mit Arbeitszimmer und Büro-Ecke in Bonn“ wird verworfen (Titel „Wohnfläche: 58 m²“). Ohne Ort fehlen Regionsabgleich, Mietspiegel und Marktwerte.
- Beleg: erfassen_text.txt (Fälle `inv004_fall1`, `inv004_fall2`, `titel_buero`, `viertel_ort`, `mittelstr_ort`, `titel_*`)
- Vermutete Ursache: apps/web/lib/erfassung.ts:77 (`Tel\.?` ohne Wortgrenze trifft „Stellplatz“, „Hotel“, „mittel“, „Viertel“; „Büro“ zu breit), Z. 115 (Fallback auf die erste Zeile mit „m²“)
- Vorschlag: `\bTel(efon)?\b\.?` mit Wortgrenze; Kontaktzeilen nur bei Kombination mit Telefonnummer/E-Mail/Firmenform verwerfen; Zeilen „Feld: Wert“ nie als Titel.

### INV-048 · Zahlenfelder: Eingabe über der Grenze wird still auf einen Präfix gekürzt (10 Mrd. → 1 Mrd., Haltedauer 61 → 6)
- Schweregrad: Mittel
- Bereich: Querschnitt › Zahlenfelder (Onboarding, Profil, Objekt, Suchauftrag)
- Schritte: 1. `/start` › Eigenkapital „10000000000“ tippen, Tab. 2. `/profil` › Haltedauer „61“ tippen, Tab. 3. Objekt › Kaufpreis „1.500.000.000“ tippen, Tab. 4. Haltedauer-Feld leeren.
- Erwartet: Der Wert wird abgewiesen und der alte bleibt sichtbar mit Hinweis, oder er wird auf die Grenze gesetzt und das wird gesagt.
- Tatsächlich: Gespeichert wird jeweils der letzte gültige Zwischenstand. Eigenkapital **1.000.000.000**, Haltedauer **6 Jahre** (dadurch wird der Verkauf steuerpflichtig, die Ergebnisse ändern sich stark), Kaufpreis **1.500.000 €**. Ebenso „1e6“ → 1 € und laut Code Umkreis „300“ → 30 km. Der Hinweis „Erlaubt: …“ steht nur, solange das Feld den Fokus hat, danach ist er weg. Ein geleertes Haltedauer-Feld wird still zu 10. „Ist-Kaltmiete“ „-700“ lässt den alten Wert stehen, das ist richtig.
- Beleg: Ausgabe onboarding.py, haltedauer.py („Haltedauer getippt '61' … gespeichert=6“), tippen.py („Kaufpreis getippt '1.500.000.000' -> Feld '1.500.000'“)
- Vermutete Ursache: apps/web/components/Felder.tsx:42 (`onChange` übernimmt jeden gültigen Zwischenstand, ein ungültiger Endstand wird verworfen)
- Vorschlag: Ungültigen Endstand beim Verlassen zurückmelden (Feld rot lassen, Wert nicht übernehmen) oder erst beim Verlassen übernehmen.

### INV-049 · Falsche Datentypen über die API legen Investments und Prüfen komplett lahm
- Schweregrad: Mittel
- Bereich: `POST/PATCH /api/objekte`, `PUT /api/profil`; /investments, /pruefen, Objektseite
- Schritte: 1. `POST /api/objekte` mit `{"objekt":{"titel":"QA-INV G12","ort":12345}}` oder `{"objekt":{"titel":"QA-INV G10","stellplaetze":"kaputt"}}`. 2. `/investments`, `/pruefen` oder das Objekt öffnen.
- Erwartet: 400 mit Feldmeldung, wie bei Zahlen.
- Tatsächlich: 201. Danach zeigen `/investments`, `/pruefen` und das Objekt nur „Application error: a client-side exception has occurred“ (`t.ort.toLowerCase is not a function` bzw. `….filter is not a function`), bis das Objekt per API gelöscht wird. Das Muster entspricht dem Blocker INV-020. Weiter ungeprüft: `szenario` per PATCH (`eigenkapital -1e9`, `sollzins -5` ergibt „Cashflow Jahr 1 415.093.704 €“) und `PUT /api/profil` (Haltedauer 0 ergibt eine Simulation über 1 Jahr mit EK-Rendite −30,9 % und `NaN` in den Diagrammen, Konsole: „<polyline> attribute points: Expected number, "NaN,…"“).
- Beleg: d_investments_ort_zahl.png, api_grenzwerte.txt, Konsolenausgabe crashcheck.py und haltedauer_api.py
- Vermutete Ursache: apps/web/lib/objektpruefung.ts (prüft nur Zahlenfelder, keine Typen von `ort`, `titel`, `stellplaetze`, Booleans), apps/web/app/api/objekte/[id]/route.ts (kein Schema für `szenario`), apps/web/app/api/profil/route.ts (keine Prüfung)
- Vorschlag: Schema-Prüfung für Objekt, Szenario und Profil; Fehlergrenze (error boundary) je Listeneintrag.

### INV-050 · Auslesen: Erbbaurecht und Sonderumlage werden erkannt, aber im Schritt „Angaben gefunden“ nicht gezeigt
- Schweregrad: Mittel
- Bereich: Objekt anlegen › Auslesen › Schritt 2 und 3
- Schritte: Text mit „Erbbaurecht: nein / Sonderumlage: keine“ einfügen und auslesen (siehe INV-003).
- Erwartet: Alle erkannten Merkmale stehen in der Liste, vor allem die, die ein K.O. auslösen, damit der Nutzer sie vor dem Anlegen korrigieren kann.
- Tatsächlich: Die Überschrift sagt „7 Angaben gefunden“, gelistet sind nur 5 (Kaufpreis, Fläche, Ort, Miete, Hausgeld). Erbbaurecht und Sonderumlage stehen auch in „Passt das?“ nicht. Erst nach dem Anlegen erscheint „Durch ein K.O.-Kriterium ausgeschlossen“.
- Beleg: d_neu_text_erb_nein_2.png, d_neu_text_erb_nein_obj.png

### INV-051 · Unpassende Meldungen der neuen Prüfungen
- Schweregrad: Niedrig
- Bereich: Objekt-API; Admin › Konjunktur › Import
- Tatsächlich:
  - `baujahr: -5` und `baujahr: "1990"` ergeben „Baujahr: höchstens 2031.“ Die Ursache (negativ bzw. Text) wird nicht genannt.
  - Import `bund10j` „2026-10-01 2,70“ ergibt „Wert 70 liegt außerhalb des plausiblen Bereichs (-2 bis 15)“. „2026-09-01;2.685“ ergibt „Wert 2.685 liegt außerhalb …“, was wie die Eingabe aussieht. Ein Hinweis auf Trenner bzw. Dezimalpunkt fehlt.
  - „1 gültige Werte“, „1 Werte übernommen“, „1 neue Prognosen“ (Einzahl/Mehrzahl).
  - Der Vorschau-Text rundet auf 2 Stellen: „1.0856“ erscheint als „1,09“.
- Beleg: api_grenzwerte.txt, kj_import.txt, kj_lauf_rb.txt
- Vermutete Ursache: apps/web/lib/objektpruefung.ts:23; packages/prognose/src/quellen.ts (Meldungstexte)

### INV-052 · Bundrendite: knappes Höchstalter, und ein veralteter Wert wird als „Keine Zinsdaten“ beschrieben
- Schweregrad: Niedrig
- Bereich: Investments › Durchspielen › Marktszenarien
- Schritte: `bund10j` nur mit „2026-08-01;2,62“ (84 Tage alt) bzw. „2026-07-01;2,56“ füllen, Durchspielen öffnen.
- Erwartet: Ein Monatswert, der in der Regel erst Mitte des Folgemonats erscheint, gilt bis etwa 90 Tage als aktuell. Ein älterer Wert wird als „veraltet, Stand 08/2026“ benannt.
- Tatsächlich: Bereits der Augustwert führt zu „Standardannahmen“ und „Anschlusszins 4,30 % – Keine Zinsdaten: Ihre bisherige Annahme“. Die Grenze liegt bei 75 + 5 Tagen. Kommt der Septemberwert verspätet, springen die Szenarien jeden Monat kurz auf Standardannahmen, und der Text behauptet, es gebe keine Daten.
- Beleg: Ausgabe der Grenzfälle (szen_bund_aug.png, szen_bund_jul.png)
- Vermutete Ursache: packages/prognose/src/indikatoren.ts (`MAX_ALTER.monatlich = 75`), apps/web/lib/marktszenarien.ts:46 (Text)

### INV-053 · Steuern: Abschreibung der Kauf-Positionen wird nicht ausgewiesen
- Schweregrad: Hinweis
- Bereich: Objekt › Steuern & Struktur; Durchspielen › Eigene Positionen
- Tatsächlich: Die Küche (6.000 €) wird richtig über 10 Jahre mit 600 € pro Jahr abgeschrieben. Der Reiter Steuern nennt aber nur „Abschreibung 2,0 % auf den Gebäudeanteil: 3.530 € pro Jahr“. Die Vorlage „Renovierung bei Kauf“ wird ebenso über 10 Jahre abgeschrieben. Steuerlich wären das in vielen Fällen anschaffungsnahe Herstellungskosten (über die Gebäude-AfA), die Annahme ist für den Nutzer nicht sichtbar.
- Beleg: d_steuern_positionen.png
- Vermutete Ursache: packages/engine/src/core.ts (`kaufAfa = kaufAusgabe / 10`)
- Vorschlag: Zeile „Abschreibung Ausstattung beim Kauf: 600 € pro Jahr (10 Jahre)“; Art der Position (Ausstattung oder Renovierung) unterscheiden.

### INV-054 · Kaufpreis „1,25 Mio. €“ wird nicht erkannt
- Schweregrad: Hinweis
- Bereich: Objekt anlegen › Auslesen
- Schritte: Text mit „Kaufpreis: 1,25 Mio. €“ auslesen.
- Tatsächlich: Es wird kein Kaufpreis gefunden. Bei Mehrfamilienhäusern ist die Schreibweise üblich.
- Beleg: erfassen_text.txt, Fall `kp_mio`

## Abdeckung

### Geprüft
- Onboarding komplett mit Grenzwerten und allen Risikostufen; Profil: Risikoneigung, Tilgung manuell, Haltedauer (0, −5, 100, 61, 2,5, 15, leer) in der Oberfläche und per API (0, −3, null, "abc").
- Auslesen per API: 36 Texte (10 aus dem ersten Lauf wörtlich, 3 INV-004-Fälle, 23 neue Varianten) und 5 Titel/Ort-Fälle. In der Oberfläche: PDF, Text (Desktop und 390 px), von Hand.
- Objektseite: Zahlen zeichenweise tippen mit Mitschnitt aller PATCH-Antworten (14 Schritte), Beispielobjekt, Ermitteln (7 Orte per API, 1 in der Oberfläche), Durchspielen mit eigenen Positionen, Steuern, Zielpreise, Marktszenarien (ohne, mit, mit veralteter Bundrendite, Grenzfälle 84 und 115 Tage), Unterlagen (gemischter Upload über API und Oberfläche).
- Rechnungen in Python: Zielpreise (4 Werte), Steuern ohne und mit Küche sowie mit laufenden Positionen (je 6 Größen). Alles stimmt.
- Objekt-API: 15 Grenz- und Typfälle, Absturzprüfung auf 5 Objekten und 2 Listen.
- Portfolio und Investments mit Objekt im Bestand.
- Admin › Konjunktur: Import mit Vorschau (19 Fälle), Werte löschen, Lauf jetzt (4×), Rückblick (inkl. Schrittweite 1), Speichern nach Neuladen, Gewichte übernehmen.
- Querschnitt: 30 Seiten auf Desktop und 390 px (Absturz, waagrechtes Scrollen, Konsole, HTTP ≥ 400). Konsolenfehler nur bei absichtlich ungültigen Daten und bei unbekannten Pfaden (404).

### Nicht geprüft
- Kundensicht mit Anmeldung („Kunden sehen keine Datenbasis“): Ohne `AUTH_SECRET` ist jeder Admin.
- KI-Wege (Daten-Analyst mit Rücklage, Markt-Analyst): kein Schlüssel. Die Wirkung von INV-047 auf KI-Auslesen ist aus dem Code abgeleitet.
- Echter FRED/EZB-Abruf: kein Internet. Ob der Punkt mit drei Nachkommastellen (INV-037 Rest) in echten Abrufdaten vorkommt, ist offen.
- Brier und Trefferquote des neuen Rückblicks habe ich nicht erneut nachgerechnet. Die Methode wurde in Welle 1 bestätigt, die Zahlen weichen durch die neue Altersprüfung leicht ab (94 % / 0,121 statt 93 % / 0,128).

### Unverändert offen, nicht Teil dieser Welle (nur beobachtet)
INV-009 (Suchauftrag „Mein erstes Investment“ nach dem Onboarding), INV-015 (Forecast-Tabelle mobil 667/816 px), INV-016 (Neuladen im Assistenten), INV-027 („58.5 m²“), INV-041 (ISO-Datum „Stand 2026-09-01“).

### Hinterlassene Testdaten
- Profil mit Anlageprofil „QA-INV Mix Rheinland“; automatisch angelegter Suchauftrag „Mein erstes Investment“.
- Objekte „QA-INV 3-Zimmer-Eigentumswohnung Düsseldorf-Bilk“ (Bestand, mit Grundriss-Dateien), „QA-INV Hand 2-Zi Köln-Nippes“ (mit Positionen Küche, Stellplatz, Instandhaltung), „QA-INV Tippen Grenzen“ (Kaufpreis 1,5 Mio. durch INV-048), „QA-INV Schöne Wohnung in Neuss zentral“, „QA-INV Wohnung Erbbaurecht-nein in Köln“, „QA-INV Mobil-Test …“, 7 Ermitteln-Objekte „QA-INV Wohnung …“ sowie das Beispielobjekt.
- Konjunkturreihen `bund10j` (201 künstliche Monatswerte) und `immo-preis` (66 künstliche Quartalswerte), gespeicherter Rückblick 2012–2025 und übernommene Gewichte, 1 Prognose Wohnimmobilien vom 24.10. Vor echtem Betrieb löschen bzw. zurücksetzen.
- Entfernt: Zusatzreihen `qa-inv-f*`, die Objekte mit ungültigen Daten (G5, G6, G10, G11, G12, leere Objekte). Daten des Trading-Testnutzers (S&P 500, VIX, Termin „QA-TRD Fed-Zinsentscheid“, dessen 4 Prognosen) blieben unberührt.
