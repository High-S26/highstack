# Nachtest Bugfix-Welle 3 – Testnutzer Investments

- Datum: 26.10.2026
- Geprüfter Stand: c1622d9 (Version 0.20.0), eigener Produktions-Build aus `git archive` in einem eigenen Verzeichnis, `next start` auf http://localhost:3417, Testmodus ohne Anmeldung, ohne Anthropic-Schlüssel, ohne Zugang zu externen Seiten, frische Datenablage
- Zusammenfassung: 19 Befunde nachgeprüft: 18 behoben, 1 teilweise (INV-051), 0 nicht behoben. 12 neue Befunde (INV-055 bis INV-066): Blocker 0, Hoch 2, Mittel 4, Niedrig 6, Hinweis 0. Die beiden hohen Befunde: Der Mietpfad überschätzt die Kappungsgrenze nach einer kürzlichen Erhöhung (INV-055), und ein Stellplatzpreis geht beim Auslesen verloren (INV-064). Alle übrigen Mietpfad-Rechnungen (11 Fälle) und Kennzahlen stimmen mit der Nachrechnung in Python überein.

Belege: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-belege/inv4/`
Skripte: `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/qa-skripte/inv4/`

## Teil A – Nachprüfung

| ID | Status | Beleg |
|---|---|---|
| INV-008 | behoben | `/objekt/gibtsnicht`: „Objekt nicht gefunden · Es wurde gelöscht oder der Link ist veraltet. · Zu den Prüfungen“ (Link `/pruefen`), kein endloses „Lädt …“. Konsole: nur die erwartete 404 von `/api/objekte/gibtsnicht`. a008.png |
| INV-011 | behoben | `/irgendwas`: HTTP 404, Titel „Seite nicht gefunden · highstack“, deutscher Text, Links „Zur Übersicht“, Investments, Trading. a011.png |
| INV-015 | behoben | 390 px, alle `<details>` geöffnet: Durchspielen bei drei Objekten scrollWidth 390, ebenso alle 7 Reiter je Objekt. m_objekt_*_spielen.png |
| INV-016 | behoben | Neuladen erhält die Entwürfe: `/neu` (Schritt 3, alle Werte), `/suchen/neu` (Region „Köln-Ehrenfeld“), `/profil/neu` (Name), Onboarding (Schritt „Erwerb“, Eigenkapital 80.000). „Abbrechen“ fragt nach, sobald etwas eingetragen ist („Weiter bearbeiten / Abbrechen“). Neuer Rest: die Datei geht beim Neuladen verloren, siehe INV-060. |
| INV-022 | behoben | Doppelklick „Suchauftrag anlegen“: 1 → 2 Aufträge (genau einer neu). „Anlageprofil anlegen“: 1 → 2 Profile, verschiedene IDs. „Anlegen und Fragen klären“ in `/neu`: ein Objekt. |
| INV-024 | behoben | Eigenkapital tippen und sofort neu laden: 81.000 gespeichert. Wegnavigieren: 80.001. Tab schließen (`page.close(run_before_unload)`): 80.003. |
| INV-027 | behoben | `/pruefen`: „33,5 m²“, „72,4 m²“. a027.png. Rest im Auslese-Schritt („34 m²“), siehe INV-061. |
| INV-033 | behoben | Gestaltung › Möbliertes Wohnen: „Gerechnete Kaltmiete möbliert 12,10 €/m²“. |
| INV-035 | behoben | Unterlagen nennen „PDF, PNG, JPG oder WebP bis 20 MB“. Abgewiesen mit Grund: WebP-Attrappe und beschädigtes JPG („Bild ist beschädigt und lässt sich nicht anzeigen“), beschädigtes PDF („… lässt sich nicht öffnen“). Gemischter Upload: Das gültige Bild wird abgelegt, das kaputte gemeldet. Keine kaputten Galeriebilder. Rest unter `/neu`: INV-065. |
| INV-036 | behoben | Isolierter Lauf von `holeSicher` (aktueller Code) gegen eine Tropf-Seite mit `timeoutMs: 3000`: Abbruch nach 3.003 ms mit „Zeitüberschreitung“ (vorher 12.019 ms). SSRF-Fälle unverändert gesperrt. |
| INV-041 | behoben | „Risikolage: VIX hoch (35,8, Stand 23.10.)“, „VIX 35,8“. Marktszenarien: „Quelle: Bundesanleihe 10 J., Stand 09/2026“. Abruf ohne Netz: „Fehler: Quelle nicht erreichbar (FRED VIXCLS). Die vorhandenen Werte bleiben; später erneut abrufen.“ Meldung „1 Wert übernommen“. |
| INV-042 | behoben | Anlegen: „Termin „QA-INV Termin Zukunft“ angelegt“. Vergangenes Datum: „… Das Datum liegt in der Vergangenheit und wirkt nur auf Rückblicke.“ Entfernen fragt „Termin entfernen? QA-INV Termin Vergangenheit am 1.1.2020“, danach „Termin entfernt“. Im Protokoll steht „Termin entfernt · 2020-01-01“. |
| INV-043 | behoben | Feld „alle … Tage“ = 1 bzw. 3: Hinweis „mindestens 7“ am Feld. „Rückblick rechnen“ meldet „Schrittweite mindestens 7 Tage“ (HTTP 400), es wird nichts gerechnet. |
| INV-044 | behoben | Mietspiegel „QA-INV-Stadt“: Ermitteln ergibt 10,60 (8,30–12,90). „gut“ ergibt sofort 12,10 (11,30–12,90), „einfach“ 9,10 (8,30–9,90), erneut „einfach“ (abwählen) wieder 10,60. Alle Werte stimmen mit der Tabelle. Eine selbst eingetragene Miete (11,5) bleibt beim Wechsel der Wohnlage erhalten. |
| INV-045 | behoben | 390 px: In allen 7 Admin-Reitern ist der aktive Reiter sichtbar, die Aktionsleiste ist ausgeblendet (0 sichtbare Knöpfe), scrollWidth 390. „Aktuelle Prognosen“ zeigt die Begründung über die ganze Breite. m_kj_top.png |
| INV-051 | teilweise | Behoben: Baujahr −5 ergibt „-5 liegt außerhalb von 0 bis 2036“, „1990“ als Text ergibt „keine Zahl“. Import „2026-10-01 2,70“ wird als 2,7 gelesen, „270“ ergibt „„270“ (gelesen als 270) liegt außerhalb …“. Toasts: „1 Wert übernommen“, „0 neue Prognosen, 2 waren heute schon da“. **Offen:** Der Knopf heißt weiter „1 Werte übernehmen“, das Protokoll schreibt „Konjunkturdaten importiert · 1 Werte“. Die Vorschau zeigt „1.0856“ weiter als „1,09“. |
| INV-052 | behoben | Bund nur bis 08/2026 (86 Tage): Die Szenarien nutzen 2,62 % („Stand 08/2026“). Nur bis 07/2026 (117 Tage): „Bundrendite veraltet (Stand 07/2026): Ihre bisherige Annahme.“ Mit 09/2026: 2,68 %, Anschlusszins Basis 4,08 % (2,68 + 0,4 + 1). |
| INV-053 | behoben | Steuern: „Ausgaben beim Kauf (eigene Positionen, z. B. Küche oder Renovierung): 600 € pro Jahr, vereinfacht über 10 Jahre abgeschrieben. Renovierungen in den ersten drei Jahren über 15 % des Gebäudewerts gelten steuerlich meist als anschaffungsnahe Herstellungskosten …“. Gebäude-AfA 3.362 € = 224.140 × 0,75 × 2 % (nachgerechnet). |
| INV-054 | behoben | „Kaufpreis: 1,25 Mio. €“, „1,25 Mio. Euro“ und „2 Mio €“ ergeben 1.250.000 bzw. 2.000.000, auch im MFH-Satz. |

## Teil B – Neue Funktionen

### 1. Foto eines Aushangs (0.18)
- **`/neu` › Exposé oder Foto › aushang.jpg** (Desktop und 390 px, je etwa 5–7 s): Kaufpreis 165.200 €, Wohnfläche 33,5 m² (im Auslese-Schritt als „34 m²“ angezeigt, INV-061), Kaltmiete 422 €, vermietet, Ort „Düsseldorf-Mitte“, Titel „Charmante Dachgeschosswohnung in Düsseldorf-Mitte“. Außenfläche: Dachterrasse 15,6 m², Süd, nicht in der Wohnfläche, Anrechnung ¼, `anbieterAnrechnung: 0.5` (41,3 = 33,5 + 15,6/2). Alle erwarteten Werte stimmen.
- Am Objekt: „Dachterrasse 15,6 m² (Süd): angerechnet 3,9 m² (zu 25 %), gerechnet mit 37,4 m². Der Anbieter setzt sie zur Hälfte an (41,3 m²). …“ Mietpotenzial: 11,28 €/m² auf 37,4 m², Vergleichsmiete 404 € (10,80 × 37,4), Ist +4 %. Das ist richtig.
- Das Foto wird beim Anlegen unter „Exposé & Inserat“ abgelegt, außer nach einem Neuladen (INV-060).
- „Verkauf provisionsfrei von Privat“ wird ignoriert (INV-062).
- **Unterlagen:** Das Foto landet unter „Exposé & Inserat“ (API: `sicher: true`, 890 Zeichen Text), die Landschaft unter „Fotos (bitte prüfen)“, das Grundriss-Bild ohne Text unter „Grundrisse & Pläne“.
- **Foto ohne Anzeige:** Landschaft und Grundriss ohne Text ergeben „Nichts gefunden“ und „Das Foto war schwer lesbar …“, kein Absturz. Titelvorschlag „ETW“, siehe INV-065.
- **HEIC-Attrappe:** `/neu` antwortet mit 415 „… iPhone-Fotos im HEIC-Format vorher als JPG teilen.“ Unter Unterlagen fehlt der iPhone-Hinweis (INV-065). HTML als `.jpg` und SVG mit Skript werden in beiden Wegen abgewiesen.
- **Ohne KI-Schlüssel:** `quelle: "muster"` bzw. „Typische Angaben im Text erkannt.“ Kein Fehler, kein Hinweis auf eine fehlende KI außer dem Testmodus-Banner.

### 2. Außenfläche und Mietpfad (0.19)
Testobjekte: 60 m², Kaufpreis 200.000 €, Hausgeld n. u. 90 €, Vergleichsmiete 10 €/m², Ist-Miete 480 €, Eigenkapital 80.000 €, 3,8 % / 2 %, Haltedauer 15 Jahre, Stichtag 10/2026. Die Fälle habe ich mit einem eigenen Python-Modell (`mp_nachrechnung.py`, `irr_check.py`) gerechnet, ohne den App-Code zu übernehmen. Dates, Beträge und Cashflow Jahr 1/2/3/5/10 stimmen in allen Fällen genau.

| Fall | App (Playbook) | Nachrechnung / Recht |
|---|---|---|
| A Düsseldorf, Datum unbekannt | 01/2028 480 → 552 (Kappung), 01/2031 → 635, 01/2034 → 693 (Vergleichsmiete); Cashflow −316 / −265 / −249 / −192 / −105 € | gleich. Sperrfrist 15 Monate, Kappung 15 % auf die Miete 36 Monate davor. Hinweis „Datum unbekannt …“ vorhanden. Kappungsbasis siehe INV-055 |
| B letzte Erhöhung 01/2024 | 01/2027 (3. Monat nach Übergang) 480 → 552, 01/2030 → 635 | gleich, rechtlich korrekt (Basis 01/2024 = 480) |
| C letzte Erhöhung 06/2025 | wie B: 01/2027 → 552 | **falsch**: Basis 01/2024 ist die Miete vor der Erhöhung 06/2025, siehe INV-055 |
| D über Vergleichsmiete (700 €) | kein Potenzial, Hinweis „17 % über der Vergleichsmiete …“, erste Erhöhung 02/2036 (erst wenn Vergleichsmiete aufgeholt hat) | gleich. Zeile „sobald Vergleichsmiete erreicht“ siehe INV-057 |
| E leer | Neuvermietung 10/2026 zu 10,00 €/m² (zulässig bis 11,00), § 558 ab 04/2028 → 618 | gleich |
| F Mieterwechsel im Jahr 3 | 10/2028 Leerstand (ein Monat), 11/2028 Neuvermietung 625 € (Vergleichsmiete 10,42 €/m²), Sperrfrist neu ab Vertragsbeginn: 05/2030 → 644; Cashflow Jahr 3 −229 € | gleich |
| G Index (Inflation 2 %) | 10/2027 → 490, jährlich; Hinweis „keine Erhöhung nach § 558“ + Mietrecht II | gleich |
| H Staffel 3 % | 10/2027 → 494, jährlich +3 %; Hinweis „Bei Mietpreisbremse muss jede Stufe für sich zulässig sein“ | gleich |
| I Kassel, „gelten nicht (20 %)“ | 01/2028 480 → 576 (20 %), Neuvermietung „frei · keine Mietpreisbremse“ | gleich |
| K Kassel, „nach Ort bestimmen“ | vorsichtig 15 % und Bremse, Hinweis „nicht hinterlegt … bei der Gemeinde prüfen“ | richtig, aber Hinweis doppelt (INV-058) |
| L leer, Ziel 13 €/m² (Düsseldorf) | auf 11,00 €/m² (660 €) begrenzt, Hinweis mit Ausnahmen (Neubau ab 10/2014, Modernisierung, Vormiete) | gleich |
| M/N Terrasse 16 m² zu ¼ / ½ | 64,0 m² / 68,0 m², Vergleichsmiete 640 / 680 €, Neuvermietung 704 / 748 € | gleich (60 + 4 bzw. 60 + 8) |
| O Mieterwechsel bei Miete über Vergleichsmiete | 700 → 625 € bei Neuvermietung | **Abweichung**: Die Vormiete darf bleiben, siehe INV-056 |

- **Durchspielen › Mietentwicklung:** „nach Mietrecht“ ist Standard, der Regler heißt dann „Vergleichsmiete p. a.“. Fall A: Ø Cashflow −115 €/Monat, Zuzahlung 20.705 € (netto), EK-Rendite 2,9 %. Bei „pauschal“: −218 €, 39.262 €, 1,9 %. Beides habe ich nachgerechnet (−115 / 2,92 % und −218 / 1,89 %). Das Playbook vermerkt „Im Durchspielen ist gerade „pauschal“ eingestellt …“.
- **Objektdaten:** Bereiche „Außenfläche“ (Art, Größe, in Wohnfläche, Anrechnung ¼/½, Ausrichtung, gerechnete Fläche) und „Mietvertrag“ (Art, letzte Erhöhung als Monatsfeld mit `max` = heute, Staffel, Mieterwechsel). Regulierung „nach Ort bestimmen / gelten (15 %, Bremse) / gelten nicht (20 %)“, Ziel bei Neuvermietung. Bei leeren Objekten ist der Mietvertrag ausgeblendet. Das ist richtig.
- **Concierge:** Fragt „Wann wurde die Miete zuletzt erhöht?“ mit fünf Antworten. „Vor 15 Monaten bis 3 Jahren“ setzt 2025-04 (siehe INV-055), „Staffelmiete“ eine Staffel ohne Satz (INV-063).
- **Auslesen:** „03/2024“, Index, Staffel 2,5 %, Balkon zzgl. 8 m² West, Wintergarten ½ und Terrasse mit Gesamtfläche werden richtig erkannt. Fehlerhafte Fälle siehe INV-059.

### 3. Regressionen
- **Anlegen:** PDF-Exposé (reportlab: Kaufpreis 289.000 €, 72,4 m², Hausgeld 310/120 €, Baujahr 1965, Balkon 6 m², Stellplatz 18.000 €, Miete 780 €, letzte Erhöhung 03/2024) wird ausgelesen und abgelegt. Stellplatzpreis siehe INV-064. Von Hand, Text, Foto: angelegt. Doppelklick: ein Objekt.
- **Rechnen von Hand** (Ehrenfeld, Python): Nebenkosten 34.882 € (12,07 %), Gesamtinvestition 323.882 €, Darlehen 243.882 €, Rate 1.179 €, Bruttorendite 3,24 %, Faktor 30,9, Nettomietrendite 2,39 % (mit 2 % Mietausfall), Cashflow −534 €. Alle stimmen. Hausgeld je m² 1,66 €. Aushang: Bruttorendite 3,07 % → „3,1 %“, Faktor 32,6. Beide stimmen.
- **Unterlagen-Sicherheit:** Auslieferung `content-type: image/jpeg`, `x-content-type-options: nosniff`. HTML/SVG abgewiesen, `/api/dateien/..%2F..%2Fstore.json` gibt 404. Link-Abruf auf 127.0.0.1, 169.254.169.254, `[::1]` und `file://` gesperrt.
- **Admin › Konjunktur-Import:** 201 Bund-Monatswerte und 66 Immo-Quartale mit Vorschau übernommen. Die Fälle Leerzeichen, Punkt mit drei Stellen, „2,7,0“ und „270“ werden richtig gelesen oder mit Grund abgewiesen. Werte löschen, Lauf jetzt und Rückblick (2012–2025, 162 geprüft) laufen. Abruf ohne Netz meldet sich verständlich.
- **Mobil 390 px:** 48 Seiten ohne waagrechtes Scrollen, auch mit allen geöffneten Aufklappern: alle Hauptseiten, 3 Objekte × 7 Reiter, 7 Admin-Reiter, Mietspiegel-Editor, 404-Seiten. Der Foto-Upload unter `/neu` funktioniert auch mobil.

## Neue Befunde

### INV-055 · Mietpfad: Kappungsgrenze rechnet mit der heutigen Miete, auch wenn die letzte Erhöhung keine drei Jahre zurückliegt
- Schweregrad: Hoch
- Bereich: Objekt › Ergebnis › Playbook „Mietpotenzial nach Mietrecht“; Durchspielen (Mietentwicklung „nach Mietrecht“); Concierge-Frage „Wann wurde die Miete zuletzt erhöht?“
- Schritte: 1. Objekt Düsseldorf, 60 m², Ist-Miete 480 €, Vergleichsmiete 10 €/m², Mietvertrag „normal“, letzte Mieterhöhung 06/2025 (16 Monate her). 2. Ergebnis › Mietpotenzial lesen. 3. Gleiches Objekt im Concierge mit „Vor 15 Monaten bis 3 Jahren“ beantworten.
- Erwartet: Die Kappungsgrenze (§ 558 Abs. 3 BGB) bezieht sich auf die Miete drei Jahre vor dem Wirksamwerden der Erhöhung. Lag die letzte Erhöhung innerhalb dieser drei Jahre, ist die Ausgangsmiete niedriger als die heutige und unbekannt. Die App muss das berücksichtigen (z. B. Vormiete erfragen) oder es zumindest deutlich als Annahme ausweisen, statt eine volle 15-%-Erhöhung zum frühestmöglichen Termin einzurechnen.
- Tatsächlich: Der Mietpfad zeigt „01/2027 · Erhöhung bis zur Kappungsgrenze (15 % in drei Jahren) · 480 € → 552 €“. Er ist identisch mit dem Fall „letzte Erhöhung 01/2024“. War die Erhöhung im Juni 2025 selbst 15 % (417,39 € → 480 €), ist bis 05/2028 rechtlich keine weitere Erhöhung möglich. Die App rechnet damit 17 Monate lang 72 € mehr Miete ein, zusammen 1.224 €. Der Cashflow in Jahr 1 erscheint mit −263 statt −316 € pro Monat. Der Concierge setzt bei „Vor 15 Monaten bis 3 Jahren“ das Datum auf 2025-04 und erzeugt genau diesen Pfad (01/2027 → 552 €). Bei „Datum unbekannt“ heißt es „vorsichtig gerechnet, als sei die Miete gerade erhöht worden“. Für die Kappungsgrenze gilt dann aber ebenfalls die heutige Miete als Basis, gerechnet wird also nicht vorsichtig.
- Beleg: mp_C.png, mp_B.png (gleicher Pfad), concierge_Vor 1.png; Ausgabe mp_ui.py, concierge_mv.py; Nachrechnung mp_nachrechnung.py
- Vermutete Ursache: packages/engine/src/mietrecht.ts:108–109 (`mieteVor` liefert vor dem Kauf immer `start`), :103 (Datum der letzten Erhöhung verschiebt nur die Sperrfrist)
- Vorschlag: Bei einer letzten Erhöhung innerhalb von 36 Monaten nach der Miete davor fragen (Feld „Miete vor der letzten Erhöhung“). Ohne diese Angabe vorsichtig rechnen: bis 36 Monate nach der letzten Erhöhung keine Kappungserhöhung, oder Hinweis am Schritt.

### INV-056 · Mieterwechsel senkt eine Miete über der Vergleichsmiete auf die Vergleichsmiete, obwohl die Vormiete bleiben darf
- Schweregrad: Mittel
- Bereich: Objekt › Daten › Mietvertrag „Mieterwechsel angenommen im Jahr“; Playbook Mietpotenzial
- Schritte: Objekt Düsseldorf, 60 m², Ist-Miete 700 € (Vergleichsmiete 600 €), Mieterwechsel im Jahr 3, „Ziel bei Neuvermietung“ leer.
- Erwartet: Bei einem Wechsel darf die Vormiete bleiben (§ 556e BGB), so steht es auch in der Kachel („Bei Neuvermietung höchstens 700 € · Vergleichsmiete + 10 % oder Vormiete“) und im Hinweis („Bei einem Mieterwechsel darf die Vormiete bleiben“). Das Modell sollte die Vormiete übernehmen oder den Abschlag ausdrücklich als Annahme nennen.
- Tatsächlich: „11/2028 · Neuvermietung unter der bisherigen Miete (Ziel 10,42 €/m²) · 700 € → 625 €“. „Mehr Miete über die Haltedauer −335 €“, Eigenkapitalrendite mit/ohne Anpassung 3,4 % / 3,5 %, Cashflow Jahr 3 −229 € statt −161 € (nachgerechnet mit Vormiete). Der Wert „leer: ortsübliche Vergleichsmiete“ im Feld „Ziel bei Neuvermietung“ wirkt hier als Mietsenkung, ohne dass das am Objekt erklärt wird.
- Beleg: mp_O.png; Ausgabe mp_ui.py (Fall O), mp_nachrechnung.py (O / O_vormiete)
- Vermutete Ursache: packages/engine/src/mietrecht.ts:94 und :96 (`ziel` = Vergleichsmiete, `min(ziel, …)` schneidet die Vormiete ab)
- Vorschlag: Ohne eigenes Ziel bei Neuvermietung `max(Vergleichsmiete, Vormiete)` als Ziel ansetzen, gedeckelt durch die Bremse.

### INV-057 · Zielpreis „sobald die Vergleichsmiete erreicht ist“ erscheint auch bei Mieten über der Vergleichsmiete
- Schweregrad: Niedrig
- Bereich: Playbook › Mietpotenzial nach Mietrecht
- Schritte: Objekt mit Ist-Miete über der Vergleichsmiete öffnen (Fall D: 700 € bei 600 €; Aushang: 422 € bei 404 €; leer mit Ziel 13 €/m²: 660 €).
- Erwartet: Die Zeile entfällt, wenn die Miete schon auf oder über der Vergleichsmiete liegt.
- Tatsächlich: „… sobald die Vergleichsmiete erreicht ist (10/2026) 163.322 € −18 %“ steht unter „Kaufpreis für Cashflow ± 0 mit heutiger Miete 181.414 € −9 %“. Der Leser versteht das so, als würde das Erreichen der Vergleichsmiete den tragbaren Preis senken. Gerechnet wird dabei mit der niedrigeren Vergleichsmiete.
- Beleg: mp_D.png, mp_L.png, aushang_ergebnis.png
- Vermutete Ursache: apps/web/components/objekt/Mietpfad.tsx:81; packages/engine/src/analyse.ts:83

### INV-058 · Hinweis „Regulierung nicht hinterlegt“ steht zweimal untereinander
- Schweregrad: Niedrig
- Bereich: Playbook › Mietpotenzial (Ort ohne hinterlegte Verordnung, z. B. Kassel, Auswahl „nach Ort bestimmen“)
- Tatsächlich: „Ob am Ort Mietpreisbremse und abgesenkte Kappungsgrenze gelten, ist nicht hinterlegt: …“ steht zuerst in der Hinweisliste und direkt darunter noch einmal in der Fußnote.
- Beleg: mp_K.png
- Vermutete Ursache: packages/engine/src/mietrecht.ts:145 und apps/web/components/objekt/Mietpfad.tsx:85

### INV-059 · Auslesen: Datum der letzten Mieterhöhung falsch oder gar nicht erkannt, Garten mit falscher Anbieter-Anrechnung
- Schweregrad: Mittel
- Bereich: Objekt anlegen › Text, Exposé, Foto (Mustererkennung)
- Schritte: `/api/erfassen` mit einem Grundtext und je einer Zeile aufrufen (erf_mv.py).
- Erwartet: Monat und Jahr werden richtig übernommen. Wo nur das Jahr bekannt ist, wird vorsichtig gerechnet (Dezember statt Januar) oder die Angabe als unsicher markiert.
- Tatsächlich:
  - „Letzte Mieterhöhung: März 2024.“ ergibt `2024-01` (Januar statt März). Die nächste Erhöhung wird so zwei Monate zu früh angesetzt.
  - „Letzte Mieterhöhung 2023.“ ergibt `2023-01`. Das ist die früheste mögliche Annahme, also nicht vorsichtig.
  - „Letzte Mieterhöhung zum 01.03.2024.“ (die übliche Schreibweise) wird nicht erkannt.
  - „Die Miete wurde zuletzt im Juni 2025 erhöht.“ wird nicht erkannt.
  - „Wohnfläche 60 m², Gartenanteil 120 m² zur Sondernutzung.“ ergibt `anbieterAnrechnung: 0.5`. Die App würde also „Der Anbieter setzt sie zur Hälfte an“ melden, obwohl nirgends eine Gesamtfläche genannt ist. Die 120 m² des Gartens werden als „Gesamtfläche“ gedeutet.
  - Richtig gelesen: „03/2024“, Index, Staffel 2,5 %, Balkon „zzgl. 8 m², West“, Terrasse mit Gesamtfläche, Wintergarten (½), „1,25 Mio. €“.
  - Weder Mietvertrag noch Außenfläche erscheinen im Schritt „Angaben gefunden“ oder in „Passt das?“. Ein Lesefehler fällt erst am Objekt auf.
- Beleg: Ausgabe erf_mv.py
- Vermutete Ursache: apps/web/lib/erfassung.ts:176–177 (Monatsnamen und TT.MM.JJJJ fehlen, Jahr ohne Monat ergibt Januar); :160–163 (Gesamtflächen-Abgleich auch für `garten`)

### INV-060 · Neuladen im Schritt „Passt das?“: Das Exposé oder Foto wird still nicht abgelegt
- Schweregrad: Mittel
- Bereich: Objekt anlegen › Exposé oder Foto
- Schritte: 1. `/neu` › Exposé oder Foto › aushang.jpg › Auslesen › Weiter zum Prüfen. 2. Seite neu laden (der Entwurf bleibt dank der Welle-3-Änderung erhalten). 3. Objekt anlegen.
- Erwartet: Die Datei wird abgelegt, oder der Assistent sagt nach dem Neuladen, dass die Datei erneut gewählt werden muss.
- Tatsächlich: Werte und Ausletext bleiben erhalten, die Datei ist aber weg. Das Objekt hat unter „Exposé & Inserat“ keine Unterlage, ohne jeden Hinweis. Die Startkarte verspricht „Wird ausgelesen und als Unterlage abgelegt“. Ohne Neuladen wird das Foto richtig unter „Exposé & Inserat“ abgelegt.
- Beleg: Objekt „QA-INV Aushang (Reload vor Anlegen)“ (`7ktptjpmmvp00lu4`) ohne Datei, Objekt „QA-INV Aushang Dachterrasse D-Mitte“ (`cjm6hvycmvp019ia`) mit `aushang.jpg`; Skripte neu_foto2.py, neu_foto3.py
- Vermutete Ursache: apps/web/app/neu/page.tsx:42 (`datei` nur im Zustand, nicht im Entwurf) und :91
- Vorschlag: Nach dem Wiederherstellen einen Hinweis „Datei bitte erneut wählen, sonst wird sie nicht abgelegt“ samt Auswahlknopf zeigen.

### INV-061 · Auslesen-Schritt: Wohnfläche gerundet, Überschrift bleibt „Wird ausgelesen …“, Außenfläche und Vermietung fehlen
- Schweregrad: Niedrig
- Bereich: Objekt anlegen › Schritt 2 „Auslesen“
- Schritte: aushang.jpg auslesen.
- Erwartet: „Wohnfläche 33,5 m²“; nach dem Lesen eine Überschrift wie „Angaben gefunden“; Dachterrasse und „vermietet“ in der Liste.
- Tatsächlich: „✓ Wohnfläche 34 m²“ (in „Passt das?“ steht dann 33,5). Die Überschrift lautet weiter „Wird ausgelesen …“, obwohl das Ergebnis schon darunter steht. Die erkannte Dachterrasse (15,6 m², Süd) und „vermietet“ stehen nicht in der Liste.
- Beleg: neu_aushang_1.png
- Vermutete Ursache: apps/web/app/neu/page.tsx (Ergebnisliste Schritt 2)

### INV-062 · „Provisionsfrei von Privat“ wird ignoriert: Erwerbsnebenkosten enthalten immer 3,57 % Makler
- Schweregrad: Mittel
- Bereich: Objekt anlegen (Foto, Text, PDF); Kalkulation
- Schritte: Aushang mit „Verkauf provisionsfrei von Privat“ anlegen, Ergebnis ansehen.
- Erwartet: Die Maklerprovision entfällt für dieses Objekt, oder sie lässt sich am Objekt auf 0 setzen.
- Tatsächlich: Die Erkennung liest „provisionsfrei“ nicht. Auch am Objekt gibt es kein Feld dafür, die Provision kommt nur aus dem Investorenprofil (3,57 %). Beim Aushang (165.200 €) werden 5.898 € Erwerbsnebenkosten zu viel angesetzt. Eigenkapitalbedarf, Darlehen, Cashflow und Zielpreise sind entsprechend zu ungünstig. Umgehen lässt sich das nur über das Profil, und das wirkt auf alle Objekte.
- Beleg: Objekt `cjm6hvycmvp019ia`; packages/engine/src/core.ts:41 (`nebenkostenSatz = grunderwerbsteuer + notar + makler`), Suche nach „provision“ in apps/web/lib/erfassung.ts ohne Treffer
- Vorschlag: Feld „Maklerprovision“ am Objekt (Vorgabe aus dem Profil), Erkennung „provisionsfrei“, „ohne Makler“, „von Privat“.

### INV-063 · Concierge „Staffelmiete“ setzt eine Staffel ohne Satz: Miete bleibt über die ganze Haltedauer eingefroren
- Schweregrad: Niedrig
- Bereich: Concierge › „Wann wurde die Miete zuletzt erhöht?“ › Staffelmiete
- Schritte: Objekt mit Ist-Miete und Vergleichsmiete, im Concierge „Staffelmiete“ wählen, Übernehmen.
- Erwartet: Eine Folgefrage nach der Staffel (Prozent oder Betrag), oder ein Hinweis, dass ohne Satz keine Steigerung gerechnet wird.
- Tatsächlich: `mietvertrag: {art: "staffel", staffelProzent: null}`. Der Mietpfad hat keinen Schritt, „Mehr Miete über die Haltedauer 0 €“, Eigenkapitalrendite 1,2 % / 1,2 %. Als Hinweis steht nur „Staffelmiete: Erhöhungen nur laut Staffel“. Dass der Satz fehlt, sagt die App nicht. Auch Staffeln in Euro („jährlich + 15 € pro Monat“) erkennt das Auslesen ohne Satz.
- Beleg: concierge_Staff.png; Ausgabe concierge_mv.py, erf_mv.py (Fall staffel_eur)
- Vermutete Ursache: apps/web/lib/concierge.ts:42–44; packages/engine/src/mietrecht.ts:129

### INV-064 · „Tiefgaragenstellplatz: 18.000 €“ wird als „im Kaufpreis“ gelesen, der Preis geht verloren
- Schweregrad: Hoch
- Bereich: Objekt anlegen › Exposé/Text › Stellplatz; Kalkulation
- Schritte: 1. PDF-Exposé (mit reportlab erzeugt, `daten/expose_w3.pdf`) mit eigener Zeile „Tiefgaragenstellplatz: 18.000 €“ unter „Kaufpreis: 289.000 €“ hochladen. 2. „Passt das?“ ansehen und anlegen.
- Erwartet: Stellplatz mit eigenem Preis 18.000 €, gesamt 307.000 €.
- Tatsächlich: `{"art":"tiefgarage","preis":"inklusive","kaufpreis":null}`. In „Passt das?“ ist „Preis: Im Kaufpreis“ vorausgewählt. Gerechnet wird mit 289.000 €, Erwerbsnebenkosten, Darlehen und Rate fallen um 18.000 € (+ 2.173 € Nebenkosten) zu niedrig aus. Dieselbe Angabe in einem Satz mit „Kaufpreis“ („Kaufpreis 289.000 €, TG-Stellplatz 18.000 €“) oder mit „zzgl.“ wird richtig gelesen. Die Zeile „Stellplatz: 18.000 €“ ist in Exposés üblich. Anders als in INV-004 geht hier ein Betrag verloren, statt dass ein fremder übernommen wird.
- Beleg: Objekt „QA-INV 3-Zimmer-Eigentumswohnung in Köln-Ehrenfeld“ (`x32mztdxmvp0bg70`); Ausgabe in neu_foto3.py und curl-Varianten (siehe Abdeckung)
- Vermutete Ursache: apps/web/lib/erfassung.ts:195 (Preis nur, wenn im Satz „zzgl./Kaufpreis/Preis/separat/optional/erworben“ steht); :199 (sonst „inklusive“)
- Vorschlag: Ein eigener Betrag zwischen 3.000 und 150.000 € direkt am Stellplatzwort (gleiche Zeile, Doppelpunkt) zählt als eigener Preis. Im Zweifel `preis: "unbekannt"` und im Concierge nachfragen, statt „inklusive“ anzunehmen.

### INV-065 · Exposé oder Foto: Formatangaben uneinheitlich, falsches Versprechen bei beschädigtem PDF, HEIC-Hinweis nur unter /neu
- Schweregrad: Niedrig
- Bereich: Objekt anlegen › Exposé oder Foto; Objekt › Unterlagen
- Tatsächlich:
  - Unter `/neu` steht „PDF oder Foto (JPG, PNG) bis 20 MB“, angenommen wird auch WebP (Unterlagen nennen WebP richtig).
  - Bei einem beschädigten PDF (`kaputt.pdf`) sagt der Auslese-Schritt „das PDF wird trotzdem als Unterlage abgelegt“. Beim Anlegen weist der Upload es aber mit 415 ab („PDF ist beschädigt …“), und die Seite meldet nichts. Das Objekt „QA-INV Kaputtes PDF“ hat keine Unterlage. Mit einem beschädigten JPG verhält es sich genauso.
  - HEIC unter Unterlagen: „IMG_0001.heic: nicht übernommen (nur PDF oder Bilder (PNG, JPG, WebP); der Inhalt passt zu keinem davon)“. Der iPhone-Hinweis „vorher als JPG teilen“ aus `/neu` fehlt hier, obwohl das Problem dasselbe ist.
  - Ein Foto ohne Anzeige (Landschaft) ergibt „Nichts gefunden“ und „Das Foto war schwer lesbar …“, dazu den Titelvorschlag „ETW“. Besser wäre „Auf dem Foto ist keine Anzeige zu erkennen“ und ein leerer Titel. Unter der Überschrift steht weiter „Einen Moment.“ (siehe INV-061).
- Beleg: neu_Kaputtes_2.png, neu_Landscha_2.png, unterlagen_upload.png; Netzwerk: `POST /api/objekte/l7ih94m4mvp0cyja/dokumente` 415, Konsole „Failed to load resource: 415“
- Vermutete Ursache: apps/web/app/neu/page.tsx:91 (`catch {}` beim Upload), :110 (Text); apps/web/app/api/erfassen/route.ts:24 (Hinweistext); apps/web/app/api/objekte/[id]/dokumente/route.ts (HEIC-Erkennung fehlt)

### INV-066 · Neue Felder: Grenzwerte werden still verworfen oder gar nicht geprüft; Übergangsmonat nicht einstellbar
- Schweregrad: Niedrig
- Bereich: Objekt-API (Mietvertrag, Szenario), Mietpfad
- Schritte: PATCH auf `QA-INV Grenzwerte Mietpfad` (`wg20rq6amvp0ok9u`).
- Tatsächlich:
  - `mietvertrag.letzteErhoehung: "2030-01"` (Zukunft) wird ohne Hinweis gespeichert. Die Oberfläche begrenzt das Feld per `max`, die Schnittstelle nicht.
  - `staffelProzent: 0.5` und `mieterwechselJahr: 0` werden ohne Hinweis zu `null`. Andere ungültige Felder melden ihren Grund („Neuvermietung je m²: -3 liegt außerhalb …“).
  - `szenario.stichtag: "abc"` wird gespeichert, danach zeigt das Playbook „erreicht NaN/NaN“ und bei jedem Schritt „NaN/NaN“. `"2026-13"` verschiebt alle Termine um drei Monate (04/2028 statt 01/2028).
  - In der Oberfläche lässt sich der Übergangsmonat nicht einstellen. Alle Fristen zählen ab dem aktuellen Monat, das Playbook verschiebt sich also jeden Monat. Der Übergang liegt meist zwei bis vier Monate nach der Prüfung.
- Beleg: Ausgabe der Grenzwertprüfung (Abdeckung), Seite `/objekt/wg20rq6amvp0ok9u?tab=ergebnis`
- Vermutete Ursache: apps/web/lib/objektpruefung.ts:51–55, :69–72 (Strings im Szenario ungeprüft); packages/engine/src/analyse.ts:44
- Vorschlag: `stichtag` als JJJJ-MM prüfen und als Feld „Übergang (Besitz, Nutzen, Lasten)“ anbieten; verworfene Werte melden.

## Abdeckung

### Geprüft
- **Teil A:** alle 19 Befunde, jeweils mit dem ursprünglichen Ablauf, in der Oberfläche (Desktop 1366 px und 390 px) und, wo nötig, per API.
- **Onboarding:** komplett mit Neuladen in Schritt 2. Profil: Sofort-Neuladen, Wegnavigieren, Tab schließen.
- **Assistenten:** Suchauftrag und Anlageprofil mit Neuladen, Doppelklick und Abbrechen. `/neu`: Foto, PDF, beschädigtes PDF, Foto ohne Anzeige, Neuladen in Schritt 3, Doppelklick, Abbrechen.
- **Auslesen per API:** 9 Dateien (Aushang, Landschaft, Grundriss ohne Text, HEIC-Attrappe, beschädigtes JPG/PDF, WebP-Attrappe, HTML als JPG, SVG) und 18 Textvarianten zu Mietvertrag, Außenfläche und „Mio.“. Dazu 3 Stellplatz-Varianten:
  - „Kaufpreis: 289.000 €. Tiefgaragenstellplatz: 18.000 €“ → inklusive, ohne Preis
  - „Kaufpreis 289.000 €, TG-Stellplatz 18.000 €“ → separat, 18.000
  - „… zzgl. Stellplatz 18.000 €“ → separat, 18.000
- **Unterlagen:** 9 Dateien per API, gemischter Upload, Upload in der Oberfläche (Aushang, HEIC, Landschaft), Auslieferungs-Kopfzeilen, Pfad-Traversal.
- **Mietpfad:** 14 Objekte (Fälle A bis O), unabhängig in Python nachgerechnet. Durchspielen mit Umschalten „pauschal / nach Mietrecht“ und 15-Jahres-Rechnung (Ø Cashflow, Zuzahlung, IRR). Concierge mit zwei Antworten. Daten-Reiter mit allen neuen Feldern.
- **Grenzwerte der neuen Felder** (PATCH, 11 Objektfälle, 3 Szenariofälle):
  - Außenfläche: `qm` −5 → „Außenfläche: ungültig“; `anrechnung` 2 → auf 0,5 begrenzt; Art „pool“ → ungültig.
  - Mietvertrag: `letzteErhoehung` „2030-01“ → angenommen; „abc“ → Meldung „Monat als JJJJ-MM“; `staffelProzent` 0,5 → still null; `mieterwechselJahr` 0 → still null; Art „miete“ → Meldung.
  - `mietregulierung` „ja“ → Meldung; `neuvermietungQm` −3 und „zehn“ → Meldung.
  - Szenario: `stichtag` „abc“ und „2026-13“ sowie `mietentwicklung` „xyz“ → ungeprüft gespeichert.
- **Markt:** Ermitteln (Grobtabelle Düsseldorf, Mietspiegel QA-INV-Stadt), Wohnlage. Marktszenarien mit drei Ständen der Bundrendite.
- **Steuern:** Abschreibung mit Küche. Gestaltung: Möbliert.
- **Admin › Konjunktur:** Import mit Vorschau (6 Fälle), Lauf jetzt (2×), Abruf ohne Netz, Termine anlegen und entfernen, Rückblick mit Schrittweite 1, 3 und 30, Protokoll.
- **Querschnitt:** 48 Seiten bei 390 px. Konsole und Netzwerk: Fehler nur bei absichtlich ungültigen Anfragen (404 unbekannte Objekte/Pfade, 415 beschädigtes PDF beim Anlegen, siehe INV-065, 400 bei Schrittweite 1). Hinweis „keine Anlageberatung“ im Fuß jeder Seite.
- **Ohne KI-Schlüssel:** Testmodus-Banner. Auslesen fällt auf die Mustererkennung zurück, Concierge und Rechnungen laufen, kein Absturz.

### Nicht geprüft
- **Kundensicht mit Anmeldung** („Kunden sehen keine Datenbasis“): Ohne `AUTH_SECRET` ist jeder Admin.
- **KI-Auslesen von Fotos** (Datenanalyst mit Bild): kein Schlüssel.
- **Echter FRED/EZB-Abruf:** kein Netz.
- **Ob die Liste der regulierten Orte** (NRW-Mieterschutzverordnung, Städte) vollständig und aktuell ist: ohne Internet nicht gegen die Verordnung abgeglichen.
- **Tastaturbedienung der neuen Felder:** nur stichprobenartig (Monatsfeld, Auswahlfelder per Klick). Kein eigener Befund.

## Hinterlassene Testdaten
Server: eigener Build unter `/tmp/claude-0/-home-claude/a63e209a-47ca-5889-84a9-ed4a4c2b741b/scratchpad/w3inv/app` (Datenablage `apps/web/.data` dort), Port 3417. Der Server ist am Ende beendet. Das Repo und die Server anderer Testnutzer sind unberührt.
- **Profil:** Anlageprofile „QA-INV Mix Rheinland“ und „QA-INV Cashflow Ruhr W3“, Suchaufträge „QA-INV MFH Köln W3“ und „Mein erstes Investment“ (automatisch, INV-009).
- **Objekte (23, alle mit Präfix „QA-INV“):**
  - Aushang Dachterrasse D-Mitte (aushang.jpg zweimal, landschaft.jpg)
  - Aushang (Reload vor Anlegen), ohne Datei
  - 3-Zimmer-Eigentumswohnung in Köln-Ehrenfeld (PDF, Unterlagen-Uploads)
  - Kaputtes PDF, Landschaftsfoto
  - MP A bis O (14 Mietpfad-Fälle; B mit Position „QA-INV Küche“, M mit Modul Möbliert)
  - Concierge2 Staffelmiete, Concierge2 Vor 15 Monaten bis 3 Jahren
  - Wohnlage-Test, Grenzwerte Mietpfad (mit ungültigem Stichtag „abc“ im Szenario)
- **Mietspiegel:** „QA-INV-Stadt“ (Entwurf, 60 Felder).
- **Konjunktur:**
  - Reihen `bund10j` (201 künstliche Monatswerte bis 09/2026), `immo-preis` (66 Quartale), `vix` (35,8 am 23.10.2026), Zusatzreihe `qa-inv-w3` (1 Wert)
  - 2 Prognosen vom 26.10.
  - Gespeicherter Rückblick 2012–2025
  - Termin „QA-INV Termin Zukunft“ (10.12.2026)
