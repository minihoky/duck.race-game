import nodemailer from "nodemailer";
import { siteName } from "./i18n.js";

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
  const smtp = transporter();
  if (!smtp) return { delivered: false };
  const from = process.env.MAIL_FROM || `${siteName()} <${process.env.SMTP_USER || "no-reply@localhost"}>`;
  await smtp.sendMail({ from, to, subject, text });
  return { delivered: true };
}

export function canPreviewMail() {
  return !process.env.SMTP_HOST && process.env.NODE_ENV !== "production";
}
