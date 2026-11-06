// src/lib/mail/templates/hiring.ts
import { HiringTemplateData } from "../types";
import { getBaseUrl } from "./base-url";
import { escapeHtml } from "./escape-html";

export function hiringTemplate(data: HiringTemplateData) {
  const { candidateName, companyName, jobTitle, notes, baseUrl: customBaseUrl } = data;
  const baseUrl = getBaseUrl(customBaseUrl);

  const safeCandidateName = escapeHtml(candidateName);
  const safeCompanyName = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeNotes = escapeHtml(notes);
  const safeBaseUrl = escapeHtml(baseUrl);

  return {
    subject: `Offer Letter / Position Offer: ${jobTitle} at ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; background-color: #ffffff; color: #18181b;">
        <div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #14a800; margin: 0;">LinkBridge</h1>
          <p style="font-size: 12px; color: #71717a; margin: 4px 0 0 0;">Job Offer Notification</p>
        </div>

        <h2 style="font-size: 18px; font-weight: 700; color: #14a800; margin-top: 0;">Congratulations ${safeCandidateName}! 🎉</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
          We are thrilled to inform you that <strong>${safeCompanyName}</strong> has extended an offer to hire you for the position of <strong>${safeJobTitle}</strong>!
        </p>

        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <p style="font-size: 14px; font-weight: 700; color: #166534; margin: 0 0 8px 0;">Status: HIRED / OFFER EXTENDED</p>
          <p style="font-size: 13px; color: #15803d; margin: 0; line-height: 1.5;">
            The hiring team at <strong>${safeCompanyName}</strong> will reach out to you shortly with next steps and offer details.
          </p>
        </div>

        ${
          notes
            ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #14a800; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <p style="font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 6px 0; text-transform: uppercase;">Note from Employer:</p>
          <p style="font-size: 13px; color: #334155; margin: 0; white-space: pre-line;">${safeNotes}</p>
        </div>
        `
            : ""
        }

        <p style="font-size: 13px; color: #71717a; line-height: 1.5;">
          Log into your <a href="${safeBaseUrl}/linkbridge/freelancer/applications" style="color: #14a800; font-weight: 600;">LinkBridge Portal</a> to view your active offer status.
        </p>

        <div style="border-top: 1px solid #f4f4f5; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #a1a1aa; text-align: center;">
          Sent by LinkBridge Recruitment System &bull; Automatic notification
        </div>
      </div>
    `,
  };
}
