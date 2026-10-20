/** Versand der Anmelde-Links. Ohne SMTP_URL wird der Link nur ins Server-Log geschrieben (lokal). */
export async function sendeLink(an: string, link: string, art: "login" | "einladung", von?: string) {
  const betreff = art === "login" ? "Ihr Anmelde-Link für highstack" : "Einladung zu highstack";
  const text = art === "login"
    ? `Hallo,\n\nmit diesem Link melden Sie sich bei highstack an. Er gilt 20 Minuten und nur einmal:\n\n${link}\n\nWenn Sie das nicht angefordert haben, ignorieren Sie diese Mail.\n`
    : `Hallo,\n\n${von ?? "Jemand"} hat Sie zu highstack eingeladen, dem privaten Family Office für Immobilien-Investments.\n\nMit diesem Link melden Sie sich an. Er gilt 20 Minuten; danach fordern Sie auf der Anmeldeseite einfach einen neuen an:\n\n${link}\n`;
  if (!process.env.SMTP_URL) { console.log(`[highstack] ${betreff} für ${an}: ${link}`); return { versendet: false }; }
  const { createTransport } = await import("nodemailer");
  await createTransport(process.env.SMTP_URL).sendMail({ from: process.env.MAIL_FROM || "highstack <no-reply@highstack.si>", to: an, subject: betreff, text });
  return { versendet: true };
}
