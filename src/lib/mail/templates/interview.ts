// src/lib/mail/templates/interview.ts
import { InterviewTemplateData } from "../types";
import { createGoogleCalendarUrl } from "../calendar/google-calendar";
import { getBaseUrl } from "./base-url";
import { escapeHtml, safeHttpUrl } from "./escape-html";

/**
 * meeting_link is employer-supplied free text, so it is only ever emitted as an
 * anchor when it parses as an absolute http(s) URL. Anything else (relative
 * text, `javascript:`, garbage) is rendered as escaped plain text. The returned
 * string is an intentional markup fragment and is inserted unescaped.
 */
function renderMeetingLink(meetingLink?: string | null): string {
  const href = safeHttpUrl(meetingLink);
  if (href) {
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Join Meeting</a>`;
  }
  return escapeHtml(meetingLink);
}

export function interviewScheduledTemplate(data: InterviewTemplateData) {
  const {
    candidateName,
    companyName,
    jobTitle,
    scheduledAt,
    timezone = "Asia/Manila",
    durationMinutes = 60,
    interviewFormat,
    meetingLink,
    meetingLocation,
    candidateNotes,
    baseUrl: customBaseUrl,
  } = data;
  const baseUrl = getBaseUrl(customBaseUrl);

  // Every value below originates from a principal (employer or candidate).
  const safeCandidateName = escapeHtml(candidateName);
  const safeCompanyName = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeInterviewFormat = escapeHtml(interviewFormat);
  const safeTimezone = escapeHtml(timezone);
  const safeDurationMinutes = escapeHtml(durationMinutes);
  const safeMeetingLocation = escapeHtml(meetingLocation);
  const safeCandidateNotes = escapeHtml(candidateNotes);
  const safeBaseUrl = escapeHtml(baseUrl);

  const formattedDate = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const calendarUrl = createGoogleCalendarUrl({
    title: `Interview: ${jobTitle} at ${companyName}`,
    description: `Interview for ${jobTitle} with ${companyName}.${candidateNotes ? `\n\nNotes: ${candidateNotes}` : ""}`,
    location: meetingLink || meetingLocation || "Online",
    start,
    end,
  });

  return {
    subject: `Interview Scheduled: ${jobTitle} at ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; background-color: #ffffff; color: #18181b;">
        <div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #14a800; margin: 0;">LinkBridge</h1>
          <p style="font-size: 12px; color: #71717a; margin: 4px 0 0 0;">Interview Invitation</p>
        </div>

        <h2 style="font-size: 18px; font-weight: 700; color: #09090b; margin-top: 0;">Hello ${safeCandidateName},</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
          Great news! <strong>${safeCompanyName}</strong> has scheduled an interview with you for the position of <strong>${safeJobTitle}</strong>.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">📅 Date & Time:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">⏱️ Duration:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeDurationMinutes} minutes</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">🌐 Timezone:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeTimezone}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📌 Format:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${safeInterviewFormat}</td>
            </tr>
            ${meetingLink
        ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">🔗 Meeting Link:</td>
              <td style="padding: 6px 0;">${renderMeetingLink(meetingLink)}</td>
            </tr>
            `
        : ""
      }
            ${meetingLocation
        ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📍 Location:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeMeetingLocation}</td>
            </tr>
            `
        : ""
      }
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0 28px 0;">
          <a href="${calendarUrl}" target="_blank" style="display: inline-block; background-color: #14a800; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
            📅 Add to Google Calendar
          </a>
        </div>

        ${candidateNotes
        ? `
        <div style="background-color: #f1f5f9; border-left: 4px solid #14a800; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <p style="font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 6px 0; text-transform: uppercase;">Message from Employer:</p>
          <p style="font-size: 13px; color: #334155; margin: 0; white-space: pre-line;">${safeCandidateNotes}</p>
        </div>
        `
        : ""
      }

        <p style="font-size: 13px; color: #71717a; line-height: 1.5;">
          You can review your active applications and upcoming interview schedules anytime by logging into your <a href="${safeBaseUrl}/vos-sync/freelancer/applications" style="color: #14a800; font-weight: 600;">LinkBridge Portal</a>.
        </p>

        <div style="border-top: 1px solid #f4f4f5; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #a1a1aa; text-align: center;">
          Sent by LinkBridge Recruitment System &bull; Automatic notification
        </div>
      </div>
    `,
  };
}

export function interviewRescheduledTemplate(data: InterviewTemplateData) {
  const {
    candidateName,
    companyName,
    jobTitle,
    scheduledAt,
    timezone = "Asia/Manila",
    durationMinutes = 60,
    interviewFormat,
    meetingLink,
    meetingLocation,
    candidateNotes,
    baseUrl: customBaseUrl,
  } = data;
  const baseUrl = getBaseUrl(customBaseUrl);

  // Every value below originates from a principal (employer or candidate).
  const safeCandidateName = escapeHtml(candidateName);
  const safeCompanyName = escapeHtml(companyName);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeInterviewFormat = escapeHtml(interviewFormat);
  const safeTimezone = escapeHtml(timezone);
  const safeDurationMinutes = escapeHtml(durationMinutes);
  const safeMeetingLocation = escapeHtml(meetingLocation);
  const safeCandidateNotes = escapeHtml(candidateNotes);
  const safeBaseUrl = escapeHtml(baseUrl);

  const formattedDate = new Date(scheduledAt).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const calendarUrl = createGoogleCalendarUrl({
    title: `Rescheduled Interview: ${jobTitle} at ${companyName}`,
    description: `Rescheduled interview for ${jobTitle} with ${companyName}.${candidateNotes ? `\n\nNotes: ${candidateNotes}` : ""}`,
    location: meetingLink || meetingLocation || "Online",
    start,
    end,
  });

  return {
    subject: `Interview Rescheduled: ${jobTitle} at ${companyName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e4e4e7; border-radius: 16px; padding: 32px; background-color: #ffffff; color: #18181b;">
        <div style="border-bottom: 1px solid #f4f4f5; padding-bottom: 20px; margin-bottom: 24px;">
          <h1 style="font-size: 20px; font-weight: 800; color: #14a800; margin: 0;">LinkBridge</h1>
          <p style="font-size: 12px; color: #71717a; margin: 4px 0 0 0;">Interview Rescheduled</p>
        </div>

        <h2 style="font-size: 18px; font-weight: 700; color: #09090b; margin-top: 0;">Hello ${safeCandidateName},</h2>
        
        <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
          Your scheduled interview with <strong>${safeCompanyName}</strong> for the position of <strong>${safeJobTitle}</strong> has been rescheduled to a new time.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 24px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 140px;">📅 New Date & Time:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${formattedDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">⏱️ Duration:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeDurationMinutes} minutes</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">🌐 Timezone:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeTimezone}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📌 Format:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${safeInterviewFormat}</td>
            </tr>
            ${meetingLink
        ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">🔗 Meeting Link:</td>
              <td style="padding: 6px 0;">${renderMeetingLink(meetingLink)}</td>
            </tr>
            `
        : ""
      }
            ${meetingLocation
        ? `
            <tr>
              <td style="padding: 6px 0; color: #64748b; font-weight: 600;">📍 Location:</td>
              <td style="padding: 6px 0; color: #0f172a;">${safeMeetingLocation}</td>
            </tr>
            `
        : ""
      }
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0 28px 0;">
          <a href="${calendarUrl}" target="_blank" style="display: inline-block; background-color: #14a800; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 12px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);">
            📅 Add to Google Calendar
          </a>
        </div>

        ${candidateNotes
        ? `
        <div style="background-color: #f1f5f9; border-left: 4px solid #14a800; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
          <p style="font-size: 12px; font-weight: 700; color: #475569; margin: 0 0 6px 0; text-transform: uppercase;">Message from Employer:</p>
          <p style="font-size: 13px; color: #334155; margin: 0; white-space: pre-line;">${safeCandidateNotes}</p>
        </div>
        `
        : ""
      }

        <p style="font-size: 13px; color: #71717a; line-height: 1.5;">
          You can review your active applications and upcoming interview schedules anytime by logging into your <a href="${safeBaseUrl}/vos-sync/freelancer/applications" style="color: #14a800; font-weight: 600;">LinkBridge Portal</a>.
        </p>

        <div style="border-top: 1px solid #f4f4f5; margin-top: 32px; padding-top: 16px; font-size: 11px; color: #a1a1aa; text-align: center;">
          Sent by LinkBridge Recruitment System &bull; Automatic notification
        </div>
      </div>
    `,
  };
}
