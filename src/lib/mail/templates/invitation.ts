// src/lib/mail/templates/invitation.ts
import { InvitationTemplateData } from "../types";
import { getBaseUrl } from "./base-url";
import { escapeHtml } from "./escape-html";

export function invitationTemplate(data: InvitationTemplateData) {
  const {
    candidateName,
    companyName,
    jobTitle,
    jobDescription,
    jobLocation,
    workArrangement,
    jobType,
    salaryRange,
    message,
    actionUrl,
    baseUrl: customBaseUrl,
  } = data;

  const safeCandidateName = escapeHtml(candidateName);
  const safeCompanyName = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeJobDescription = escapeHtml(jobDescription);
  const safeJobLocation = escapeHtml(jobLocation);
  const safeWorkArrangement = escapeHtml(workArrangement);
  const safeJobType = escapeHtml(jobType ? jobType.replace("_", " ") : null);
  const safeSalaryRange = escapeHtml(salaryRange);
  const safeMessage = escapeHtml(message);

  const rawTargetUrl =
    actionUrl ||
    `${getBaseUrl(customBaseUrl)}/linkbridge/freelancer/applications`;
  const targetUrl = encodeURI(rawTargetUrl);

  const subjectTitle = jobTitle
    ? `Job Opportunity Invitation: ${jobTitle} at ${companyName}`
    : `Job Opportunity Invitation from ${companyName}`;

  return {
    subject: subjectTitle,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; background-color: #ffffff; color: #18181b;">
        <div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #14a800; margin: 0;">LinkBridge</h1>
          <p style="font-size: 12px; color: #71717a; margin: 4px 0 0 0;">Job Invitation</p>
        </div>

        <h2 style="font-size: 18px; font-weight: 700; color: #09090b; margin-top: 0;">Hello ${safeCandidateName || "Candidate"},</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
          Great news! <strong>${safeCompanyName}</strong> has reviewed your profile on <strong>LinkBridge</strong> and extended a direct job opportunity invitation to you.
        </p>

        <!-- Message Box (No 'Message from Company' header) -->
        ${safeMessage
        ? `
        <div style="background-color: #f8fafc; border-left: 4px solid #14a800; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="font-size: 13px; color: #334155; margin: 0; white-space: pre-line;">${safeMessage}</p>
        </div>
        `
        : ""
      }

        <!-- Job Overview Section -->
        <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
          <h3 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">
            📋 Job Overview
          </h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">🏢 Company:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${safeCompanyName}</td>
            </tr>
            ${safeJobTitle
        ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">💼 Position:</td>
              <td style="padding: 6px 0; color: #14a800; font-weight: 700;">${safeJobTitle}</td>
            </tr>
            `
        : ""
      }
            ${safeJobLocation || safeWorkArrangement
        ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📍 Location:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">
                ${safeJobLocation || ""}${safeJobLocation && safeWorkArrangement ? ` (${safeWorkArrangement})` : safeWorkArrangement || ""}
              </td>
            </tr>
            `
        : ""
      }
            ${safeJobType
        ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">⏰ Employment Type:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${safeJobType}</td>
            </tr>
            `
        : ""
      }
            ${safeSalaryRange
        ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">💰 Compensation:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${safeSalaryRange}</td>
            </tr>
            `
        : ""
      }
          </table>

          ${safeJobDescription
        ? `
          <div style="margin-top: 16px; border-top: 1px dashed #e2e8f0; padding-top: 14px;">
            <h4 style="font-size: 12px; font-weight: 700; color: #64748b; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">
              Job Description:
            </h4>
            <div style="font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-line; background-color: #f8fafc; padding: 14px; border-radius: 8px; border: 1px solid #f1f5f9;">
              ${safeJobDescription}
            </div>
          </div>
          `
        : ""
      }
        </div>

        <div style="text-align: center; margin: 24px 0 28px 0;">
          <a href="${targetUrl}" target="_blank" style="display: inline-block; background-color: #14a800; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
            View Invitation &amp; Respond
          </a>
        </div>

        <p style="font-size: 13px; color: #71717a; line-height: 1.5;">
          You can review your active invitations and messages anytime by logging into your <a href="${targetUrl}" style="color: #14a800; font-weight: 600;">LinkBridge Portal</a>.
        </p>

        <div style="border-top: 1px solid #f4f4f5; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #a1a1aa; text-align: center;">
          Sent by LinkBridge Recruitment System &bull; Automatic notification
        </div>
      </div>
    `,
  };
}
