// src/lib/mail/transporter.ts
import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;


export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: {
    user,
    pass,
  },
});

const DEFAULT_SENDER_NAME = "LinkBridge";
const DEFAULT_SENDER_ADDRESS = "vertextechcorpofficial@gmail.com";

const HEADER_INJECTION = /[\r\n]/;

function resolveSender(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value || HEADER_INJECTION.test(value)) return null;
  if (value.includes("<")) return value;
  return `"${DEFAULT_SENDER_NAME}" <${value}>`;
}

// One sender for every mail path: SMTP_FROM -> SMTP_EMAIL -> built-in default.
// Both transports import this so the two can never drift apart again.
export const MAIL_FROM =
  resolveSender(process.env.SMTP_FROM) ??
  resolveSender(process.env.SMTP_EMAIL) ??
  `"${DEFAULT_SENDER_NAME}" <${DEFAULT_SENDER_ADDRESS}>`;
