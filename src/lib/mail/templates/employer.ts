// src/lib/mail/templates/employer.ts
import { getBaseUrl } from "./base-url";
import { escapeHtml, safeHttpUrl } from "./escape-html";

export interface EmployerMailParams {
  companyName: string;
  recipientName?: string;
  loginUrl?: string;
  rejectionReason?: string;
  supportEmail?: string;
  baseUrl?: string;
}

const PLATFORM_NAME = process.env.NEXT_PUBLIC_APP_NAME || "LinkBridge";


// 1. Upon Account Creation and OTP Verified (To Employer)

export function employerAccountCreationTemplate({ companyName, recipientName }: EmployerMailParams) {
  const subject = `Welcome to ${PLATFORM_NAME} — Account Created`;
  const greeting = recipientName ? escapeHtml(`Hello ${recipientName},`) : "Hello,";
  const safeCompanyName = escapeHtml(companyName);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { text-align: center; border-b: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
          .brand { font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
          .title { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 10px; }
          .content { font-size: 14px; line-height: 1.6; color: #334155; }
          .badge-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
          .badge-title { font-weight: 700; color: #1e40af; font-size: 14px; margin-bottom: 4px; }
          .badge-desc { font-size: 13px; color: #1e3a8a; }
          .footer { margin-top: 32px; border-t: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">🎉 Welcome to ${PLATFORM_NAME}</div>
            <div class="title">Employer Account Created</div>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>Welcome to <strong>${PLATFORM_NAME}</strong>! Your employer account for <strong>${safeCompanyName}</strong> has been successfully created and your email address is verified.</p>
            
            <div class="badge-box">
              <div class="badge-title">📋 Next Steps: Verification Required</div>
              <div class="badge-desc">Please complete your company profile and submit your documents for verification.</div>
            </div>

            <p>Completing your organization profile and uploading valid identification will allow our compliance team to verify your account, granting full access to post job openings and connect with top candidates.</p>
            <p>If you have any questions, feel free to contact our support team.</p>
            <p>Best regards,<br><strong>The ${PLATFORM_NAME} Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${PLATFORM_NAME}. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
}

/**
 * 2. Upon Submission (To Employer)
 * Subject: We received your Employer Registration — [Company Name]
 * Body: Confirms receipt and informs them that account is under manual verification (typically takes 8–24 hours).
 */
export function employerVerificationTemplate({ companyName, recipientName }: EmployerMailParams) {
  const subject = `We received your Employer Registration — ${companyName}`;
  const greeting = recipientName ? escapeHtml(`Hello ${recipientName},`) : "Hello,";
  const safeCompanyName = escapeHtml(companyName);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { text-align: center; border-b: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
          .brand { font-size: 22px; font-weight: 800; color: #2563eb; letter-spacing: -0.5px; }
          .title { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 10px; }
          .content { font-size: 14px; line-height: 1.6; color: #334155; }
          .badge-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center; }
          .badge-title { font-weight: 700; color: #1e40af; font-size: 14px; margin-bottom: 4px; }
          .badge-desc { font-size: 13px; color: #1e3a8a; }
          .footer { margin-top: 32px; border-t: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">${PLATFORM_NAME}</div>
            <div class="title">Employer Registration Received</div>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>Thank you for registering <strong>${safeCompanyName}</strong> on ${PLATFORM_NAME}. We have successfully received your employer application details and documentation.</p>
            
            <div class="badge-box">
              <div class="badge-title">⏳ Application Under Verification</div>
              <div class="badge-desc">Your business profile is currently undergoing manual verification by our compliance team. Verification typically takes <strong>8–24 hours</strong>.</div>
            </div>

            <p>Once your organization profile is verified, you will receive an approval email and instant access to post open job positions, browse qualified candidates, and schedule interviews.</p>
            <p>If you have any urgent inquiries in the meantime, feel free to reply directly to this email.</p>
            <p>Best regards,<br><strong>The ${PLATFORM_NAME} Verification Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${PLATFORM_NAME}. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
}

/**
 * 3. Upon Admin Approval (To Employer)
 * Subject: Account Approved: Welcome to [Platform Name]!
 * Body: Business profile verified, CTA link to log in and create first job post.
 */
export function employerApprovalTemplate({ companyName, recipientName, loginUrl, baseUrl }: EmployerMailParams) {
  const subject = `Account Approved: Welcome to ${PLATFORM_NAME}!`;
  const greeting = recipientName ? escapeHtml(`Hello ${recipientName},`) : "Hello,";
  const safeCompanyName = escapeHtml(companyName);
  // loginUrl is supplied by whoever triggers the approval; only an absolute
  // http(s) URL may become an anchor, otherwise fall back to the portal login.
  const targetLogin =
    safeHttpUrl(loginUrl) || escapeHtml(`${getBaseUrl(baseUrl)}/login`);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { text-align: center; border-b: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
          .brand { font-size: 22px; font-weight: 800; color: #16a34a; letter-spacing: -0.5px; }
          .title { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 10px; }
          .content { font-size: 14px; line-height: 1.6; color: #334155; }
          .success-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .cta-wrapper { text-align: center; margin: 28px 0; }
          .cta-btn { background-color: #16a34a; color: #ffffff !important; padding: 12px 28px; font-size: 14px; font-weight: 700; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 2px 6px rgba(22,163,74,0.3); }
          .footer { margin-top: 32px; border-t: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">🎉 ${PLATFORM_NAME}</div>
            <div class="title">Employer Account Approved</div>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>Great news! Your employer profile for <strong>${safeCompanyName}</strong> has been officially verified and approved by our governance team.</p>

            <div class="success-box">
              <strong>What's unlocked for your account:</strong>
              <ul style="margin-top: 8px; padding-left: 20px;">
                <li>Publish unlimited job posts and vacancy listings.</li>
                <li>Browse candidates and review matching applicant profiles.</li>
                <li>Schedule interviews and communicate directly with applicants.</li>
              </ul>
            </div>

            <div class="cta-wrapper">
              <a href="${targetLogin}" class="cta-btn">Log In & Post Your First Job</a>
            </div>

            <p>Thank you for choosing ${PLATFORM_NAME} as your hiring portal. We wish you great success in finding top talent!</p>
            <p>Warm regards,<br><strong>The ${PLATFORM_NAME} Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${PLATFORM_NAME}. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
}

/**
 * 4. Upon Admin Rejection (To Employer)
 * Subject: Update regarding your Employer Account Application — [Company Name]
 * Body: Politeness notification stating registration was not approved, dynamic rejection reason, support info.
 */
export function employerRejectionTemplate({ companyName, recipientName, rejectionReason, supportEmail }: EmployerMailParams) {
  const subject = `Update regarding your Employer Account Application — ${companyName}`;
  const greeting = recipientName ? escapeHtml(`Hello ${recipientName},`) : "Hello,";
  const safeCompanyName = escapeHtml(companyName);
  const reasonText = escapeHtml(
    rejectionReason || "The submitted business documents or information did not meet our verification criteria."
  );
  const contactSupport = escapeHtml(
    supportEmail || process.env.SUPPORT_EMAIL || "support@vos-sync.com"
  );

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f6f9; color: #1e293b; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { text-align: center; border-b: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
          .brand { font-size: 22px; font-weight: 800; color: #dc2626; letter-spacing: -0.5px; }
          .title { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 10px; }
          .content { font-size: 14px; line-height: 1.6; color: #334155; }
          .reason-box { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .reason-title { font-weight: 700; color: #991b1b; font-size: 13px; text-transform: uppercase; margin-bottom: 6px; }
          .reason-body { font-size: 14px; color: #7f1d1d; white-space: pre-line; font-weight: 500; }
          .footer { margin-top: 32px; border-t: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="brand">${PLATFORM_NAME}</div>
            <div class="title">Employer Application Update</div>
          </div>
          <div class="content">
            <p>${greeting}</p>
            <p>Thank you for your interest in joining ${PLATFORM_NAME}. We are writing to update you regarding your employer application for <strong>${safeCompanyName}</strong>.</p>
            <p>After reviewing your application details and submitted documents, we regret to inform you that your registration could not be approved at this time.</p>

            <div class="reason-box">
              <div class="reason-title">Reviewer Feedback / Action Items:</div>
              <div class="reason-body">${reasonText}</div>
            </div>

            <p>If you believe this decision was made in error or if you would like to submit updated credentials for appeal, please contact our support team at <a href="mailto:${contactSupport}" style="color: #2563eb; font-weight: 600;">${contactSupport}</a>.</p>
            <p>Sincerely,<br><strong>The ${PLATFORM_NAME} Verification Team</strong></p>
          </div>
          <div class="footer">
            &copy; ${new Date().getFullYear()} ${PLATFORM_NAME}. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  return { subject, html };
}
