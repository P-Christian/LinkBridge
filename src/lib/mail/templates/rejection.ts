// src/lib/mail/templates/rejection.ts
import { RejectionTemplateData } from "../types";
import { getBaseUrl } from "./base-url";
import { escapeHtml } from "./escape-html";

export function rejectionTemplate(data: RejectionTemplateData) {
  const { candidateName, companyName, jobTitle, notes, baseUrl: customBaseUrl } = data;
  const baseUrl = getBaseUrl(customBaseUrl);

  const safeCandidateName = escapeHtml(candidateName);
  const safeCompanyName = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeNotes = escapeHtml(notes);
  const safeBaseUrl = escapeHtml(baseUrl);

  return {
    subject: `Application Update: ${jobTitle} at ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; background-color: #ffffff; color: #18181b;">
        <div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #14a800; margin: 0;">VOS Sync</h1>
          <p style="font-size: 12px; color: #71717a; margin: 4px 0 0 0;">Application Status Update</p>
        </div>

        <h2 style="font-size: 18px; font-weight: 700; color: #09090b; margin-top: 0;">Hello ${safeCandidateName},</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
          Thank you for taking the time to apply for <strong>${safeJobTitle}</strong> at <strong>${safeCompanyName}</strong>.
        </p>

        <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
          After careful consideration, the hiring team has decided to proceed with other candidates whose qualifications more closely match the current requirements for this position.
        </p>

        ${
          notes
            ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #94a3b8; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <p style="font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 6px 0; text-transform: uppercase;">Employer Feedback / Notes:</p>
          <p style="font-size: 13px; color: #334155; margin: 0; white-space: pre-line;">${safeNotes}</p>
        </div>
        `
            : ""
        }

        <p style="font-size: 13px; color: #71717a; line-height: 1.5;">
          We appreciate your interest in <strong>${safeCompanyName}</strong> and encourage you to apply for future opportunities on <a href="${safeBaseUrl}/vos-sync/freelancer/jobs" style="color: #14a800; font-weight: 600;">VOS Sync</a>.
        </p>

        <div style="border-top: 1px solid #f4f4f5; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #a1a1aa; text-align: center;">
          Sent by VOS Sync Recruitment System &bull; Automatic notification
        </div>
      </div>
    `,
  };
}
