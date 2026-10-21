import { Rechtstext } from "@/components/Rechtstext";
export const metadata = { title: "Impressum · highstack" };
export default function Impressum() {
  return (
    <Rechtstext titel="Impressum" stand="Oktober 2026">
      <h2>Angaben nach § 5 Digitale-Dienste-Gesetz</h2>
      <p>[Firma, Rechtsform]<br />[Straße Hausnummer]<br />[PLZ] [Ort]<br />Deutschland</p>
      <p>Vertreten durch: [Geschäftsführung]</p>
      <h2>Kontakt</h2>
      <p>E-Mail: [kontakt@highstack.si]<br />Telefon: [Telefonnummer]</p>
      <h2>Register und Steuern</h2>
      <p>Registergericht: [Amtsgericht] · Registernummer: [HRB …]<br />Umsatzsteuer-ID nach § 27a UStG: [DE…]</p>
      <h2>Verantwortlich für den Inhalt</h2>
      <p>[Name], Anschrift wie oben</p>
      <h2>Hinweis zur Tätigkeit</h2>
      <p>highstack ist ein Informationsdienst. Wir erbringen keine Anlage-, Finanzierungs-, Steuer- oder Rechtsberatung und vermitteln keine Immobilien, Darlehen oder Finanzanlagen. Mehr dazu in den <a href="/hinweise">Nutzungshinweisen</a>.</p>
      <h2>Streitbeilegung</h2>
      <p>Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
    </Rechtstext>
  );
}
