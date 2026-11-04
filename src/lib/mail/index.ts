// src/lib/mail/index.ts

import { transporter, MAIL_FROM } from "./transporter";
import { MailPayload } from "./types";

export async function sendMail(payload: MailPayload) {
  const hostConfigured = !!process.env.SMTP_HOST;

  console.log(`[MAIL] Sending "${payload.subject}" to ${payload.to}`);

  if (!hostConfigured) {
    console.warn("[MAIL WARNING] SMTP Host is not configured in environment variables.");
    return;
  }

  try {
    await transporter.sendMail({
      from: MAIL_FROM,
      ...payload,
    });
    console.log(`[MAIL] Successfully sent to ${payload.to}`);
  } catch (err) {
    console.error(`[MAIL ERROR] Failed to send email to ${payload.to}:`, err);
  }
}

export * from "./types";
export * from "./transporter";
export * from "./preference-check";
export * from "./services/auth-mail";
export * from "./services/job-mail";
export * from "./services/notification-mail";
export * from "./services/employer-mail";
export * from "./templates/base-url";
export * from "./templates/escape-html";
