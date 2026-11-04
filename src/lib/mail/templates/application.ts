// src/lib/mail/templates/application.ts
import { ApplicationTemplateData, NewApplicationNotificationData } from "../types";
import { getBaseUrl } from "./base-url";
import { escapeHtml } from "./escape-html";

export function applicationSubmittedTemplate(data: ApplicationTemplateData) {
  const { candidateName, companyName, jobTitle, appliedAt, baseUrl: customBaseUrl } = data;
  const baseUrl = getBaseUrl(customBaseUrl);

  const safeCandidateName = escapeHtml(candidateName);
  const safeCompanyName = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeAppliedAt = escapeHtml(appliedAt);
  const safeBaseUrl = escapeHtml(baseUrl);

  return {
    subject: `Application Confirmation: ${jobTitle} at ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; background-color: #ffffff; color: #18181b;">
        <div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #14a800; margin: 0;">VOS Sync</h1>
          <p style="font-size: 12px; color: #71717a; margin: 4px 0 0 0;">Application Confirmation</p>
        </div>

        <h2 style="font-size: 18px; font-weight: 700; color: #09090b; margin-top: 0;">Hello ${safeCandidateName},</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
          Your application for <strong>${safeJobTitle}</strong> at <strong>${safeCompanyName}</strong> has been successfully submitted!
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">💼 Position:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${safeJobTitle}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">🏢 Employer:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeCompanyName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📅 Date Applied:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeAppliedAt}</td>
            </tr>
          </table>
        </div>

        <p style="font-size: 13px; color: #71717a; line-height: 1.5;">
          You can track your application status anytime via your <a href="${safeBaseUrl}/vos-sync/freelancer/applications" style="color: #14a800; font-weight: 600;">VOS Sync Portal</a>.
        </p>

        <div style="border-top: 1px solid #f4f4f5; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #a1a1aa; text-align: center;">
          Sent by VOS Sync Recruitment System &bull; Automatic notification
        </div>
      </div>
    `,
  };
}

export function newApplicationReceivedTemplate(data: NewApplicationNotificationData) {
  const {
    companyName,
    jobTitle,
    candidateName,
    candidateEmail,
    expectedSalary,
    appliedAt,
    baseUrl: customBaseUrl,
  } = data;
  const baseUrl = getBaseUrl(customBaseUrl);

  const safeCompanyName = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeCandidateName = escapeHtml(candidateName);
  const safeCandidateEmail = escapeHtml(candidateEmail);
  const safeAppliedAt = escapeHtml(appliedAt);
  const safeBaseUrl = escapeHtml(baseUrl);

  // Built from Number coercion plus fixed copy, but still run through the
  // escaper so every interpolated value follows the same rule.
  const salaryDisplay = expectedSalary
    ? escapeHtml(`PHP ${Number(expectedSalary).toLocaleString()} / month`)
    : "Not specified";

  return {
    subject: `New Application: ${candidateName} applied for ${jobTitle}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; background-color: #ffffff; color: #18181b;">
        <div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #14a800; margin: 0;">VOS Sync</h1>
          <p style="font-size: 12px; color: #71717a; margin: 4px 0 0 0;">Employer Recruitment Notification</p>
        </div>

        <h2 style="font-size: 18px; font-weight: 700; color: #09090b; margin-top: 0;">New Job Application Received</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
          A candidate has just submitted a new application for your job opening: <strong>${safeJobTitle}</strong> at <strong>${safeCompanyName}</strong>.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">👤 Candidate:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${safeCandidateName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">✉️ Email:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeCandidateEmail}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">💼 Applied Role:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${safeJobTitle}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">💰 Expected Salary:</td>
              <td style="padding: 6px 0; color: #0f172a;">${salaryDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📅 Applied At:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeAppliedAt}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${safeBaseUrl}/vos-sync/client/applicants" style="display: inline-block; background-color: #14a800; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none;">
            Review Application in Portal
          </a>
        </div>

        <div style="border-top: 1px solid #f4f4f5; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #a1a1aa; text-align: center;">
          Sent by VOS Sync Recruitment System &bull; Automatic employer alert
        </div>
      </div>
    `,
  };
}
