import nodemailer from "nodemailer";

let transport;

function transporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || "") === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
        : undefined,
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text }) {
  const from = process.env.MAIL_FROM || "Duck Race <duckracegame@gmail.com>";
  const smtp = transporter();
  if (!smtp) return { delivered: false };
  await smtp.sendMail({ from, to, subject, text });
  return { delivered: true };
}

export function canPreviewMail() {
  return !process.env.SMTP_HOST && process.env.NODE_ENV !== "production";
}
