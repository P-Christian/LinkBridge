// src/lib/mail/services/notification-mail.ts

import { sendMail } from "../index";
import { escapeHtml } from "../templates/escape-html";

export async function sendNotificationEmail(to: string, subject: string, message: string) {
  return sendMail({
    to,
    subject,
    html: `
      <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #e4e4e7; padding: 24px; border-radius: 12px;">
        <h3 style="color: #18181b;">${escapeHtml(subject)}</h3>
        <p style="color: #3f3f46; font-size: 14px;">${escapeHtml(message)}</p>
      </div>
    `,
  });
}
