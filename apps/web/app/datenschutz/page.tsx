import { Rechtstext } from "@/components/Rechtstext";
export const metadata = { title: "Datenschutz · highstack" };
export default function Datenschutz() {
  return (
    <Rechtstext titel="Datenschutzhinweise" stand="Oktober 2026">
      <p className="lead">Kurz gesagt: Wir verarbeiten nur, was für den Dienst nötig ist. Kein Tracking, keine Werbung, keine Weitergabe an Dritte zu deren Zwecken. Sie können Ihre Daten jederzeit herunterladen und Ihr Konto löschen.</p>
      <h2>1. Verantwortlicher</h2>
      <p>[Firma, Anschrift wie im <a href="/impressum">Impressum</a>], E-Mail: [datenschutz@highstack.si]. [Falls bestellt: Datenschutzbeauftragter, Kontakt]</p>
      <h2>2. Welche Daten wir verarbeiten</h2>
      <ul>
        <li><b>Konto:</b> E-Mail-Adresse, Rolle, Zeitpunkt der letzten Anmeldung.</li>
        <li><b>Ihre Eingaben:</b> Investoren- und Anlageprofil (z. B. Eigenkapital, Kreditrahmen, Steuersatz), Suchaufträge, Objekte, Annahmen, Strategien.</li>
        <li><b>Unterlagen:</b> hochgeladene Dateien wie Exposés, Protokolle oder Kaufvertragsentwürfe und der daraus gelesene Text. Sie können personenbezogene Daten Dritter enthalten (z. B. Mieter, Eigentümer); laden Sie nur hoch, was Sie dafür nutzen dürfen.</li>
        <li><b>Technisch:</b> Server-Protokolle (IP-Adresse, Zeitpunkt, aufgerufene Adresse) für Betrieb und Sicherheit.</li>
      </ul>
      <h2>3. Zwecke und Rechtsgrundlagen</h2>
      <ul>
        <li>Bereitstellung des Dienstes und Ihrer Auswertungen: Art. 6 Abs. 1 lit. b DSGVO (Vertrag).</li>
        <li>Anmeldung per E-Mail-Link und Sicherheit: Art. 6 Abs. 1 lit. b und f DSGVO.</li>
        <li>Server-Protokolle: Art. 6 Abs. 1 lit. f DSGVO (Betrieb, Missbrauchsabwehr), Löschung nach [14] Tagen.</li>
      </ul>
      <h2>4. Künstliche Intelligenz</h2>
      <p>Für Kurzurteil, Experten, das Auslesen von Exposés und Markt-Briefings senden wir die dafür nötigen Daten (Objektdaten, gerechnete Kennzahlen, Auszüge aus Unterlagen) an die Anthropic API (Anthropic, PBC, USA) als Auftragsverarbeiter. Die Daten werden dort nach dessen Bedingungen nicht zum Training von Modellen verwendet. Grundlage der Übermittlung in die USA: [EU-Standardvertragsklauseln bzw. Angemessenheitsbeschluss, prüfen]. Ergebnisse der KI sind als solche gekennzeichnet. Alle Zahlen rechnet das Rechenwerk von highstack selbst.</p>
      <h2>5. Empfänger und Dienstleister</h2>
      <ul>
        <li>Hosting: [Hetzner Online GmbH, Gunzenhausen, Rechenzentrum in Deutschland], Auftragsverarbeitung nach Art. 28 DSGVO.</li>
        <li>E-Mail-Versand der Anmelde-Links: [Anbieter, Sitz].</li>
        <li>KI: Anthropic, siehe Ziffer 4.</li>
      </ul>
      <h2>6. Cookies und lokale Speicherung</h2>
      <p>Wir setzen nur ein technisch notwendiges Cookie für die Anmeldung (Sitzung, 30 Tage). Im Browser merken wir uns die gewählte Darstellung (hell/dunkel). Beides ist nach § 25 Abs. 2 TDDDG ohne Einwilligung zulässig. Keine Analyse- oder Werbe-Cookies.</p>
      <h2>7. Speicherdauer</h2>
      <p>Ihre Daten bleiben gespeichert, solange Ihr Konto besteht. Beantragen Sie die Löschung unter <a href="/konto">Konto</a>, löschen wir alle Daten nach einer Frist von 7 Tagen, in der Sie den Antrag abbrechen können. Sicherungskopien werden nach spätestens [14] Tagen überschrieben. Gesetzliche Aufbewahrungspflichten (z. B. für Rechnungen) bleiben unberührt.</p>
      <h2>8. Ihre Rechte</h2>
      <p>Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO). Auskunft und Übertragbarkeit bedienen Sie selbst mit „Daten herunterladen“ unter <a href="/konto">Konto</a>. Sie können sich bei einer Aufsichtsbehörde beschweren, etwa bei der Landesbeauftragten für Datenschutz und Informationsfreiheit Nordrhein-Westfalen.</p>
      <h2>9. Sicherheit</h2>
      <p>Verbindungen sind verschlüsselt (HTTPS). Jedes Konto sieht nur seine eigenen Daten. Anmelde-Links gelten 20 Minuten und nur einmal.</p>
    </Rechtstext>
  );
}
