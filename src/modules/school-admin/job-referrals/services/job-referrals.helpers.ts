// src/modules/school-admin/job-referrals/services/job-referrals.helpers.ts
import crypto from 'crypto';

import { escapeHtml, safeHttpUrl } from '@/lib/mail/templates/escape-html';

export * from '../utils/formatting';
import { markdownToHtml } from '../utils/formatting';

export function hashString(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function generateReferralToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export interface RecommendationPdfParams {
  schoolName?: string;
  studentName: string;
  jobTitle: string;
  companyName: string;
  letterContent: string;
  date?: string;
}

export function generateRecommendationPdfBuffer(params: RecommendationPdfParams): Buffer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { jsPDF } = require('jspdf');
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // Header band
  doc.setFillColor(79, 70, 229); // #4f46e5
  doc.rect(margin, 15, contentWidth, 2, 'F');

  // Institution title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  const schoolTitle = params.schoolName || 'Academic & Career Advancement Office';
  doc.text(schoolTitle.toUpperCase(), margin, 24);

  // Subheader
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('OFFICIAL INSTITUTIONAL ENDORSEMENT & RECOMMENDATION', margin, 29);

  const formattedDate =
    params.date ||
    new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  const dateStr = `Date: ${formattedDate}`;
  doc.text(dateStr, pageWidth - margin - doc.getTextWidth(dateStr), 29);

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 33, pageWidth - margin, 33);

  // Info Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 37, contentWidth, 22, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 37, contentWidth, 22, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('Recommended Candidate:', margin + 4, 43);
  doc.setFont('helvetica', 'normal');
  doc.text(params.studentName, margin + 49, 43);

  doc.setFont('helvetica', 'bold');
  doc.text('Target Position:', margin + 4, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(params.jobTitle, margin + 49, 49);

  doc.setFont('helvetica', 'bold');
  doc.text('Target Organization:', margin + 4, 55);
  doc.setFont('helvetica', 'normal');
  doc.text(params.companyName, margin + 49, 55);

  // Letter Body
  let cursorY = 67;
  const cleanBody = params.letterContent
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#+\s+/g, '');

  const paragraphs = cleanBody.split(/\n\s*\n/);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const lines = doc.splitTextToSize(trimmed, contentWidth);
    const neededHeight = lines.length * 4.8;

    if (cursorY + neededHeight > pageHeight - 40) {
      doc.addPage();
      cursorY = 20;
    }

    doc.text(lines, margin, cursorY);
    cursorY += neededHeight + 4;
  }

  // Signature Block
  if (cursorY > pageHeight - 38) {
    doc.addPage();
    cursorY = 20;
  } else {
    cursorY = Math.max(cursorY + 6, pageHeight - 46);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text('Office of Career Development & Academic Endorsement', margin, cursorY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(params.schoolName || 'Partner Academic Institution', margin, cursorY + 4.5);
  doc.text('Verified via LinkBridge Industry-Academia Placement Portal', margin, cursorY + 8.5);

  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'This document serves as an authentic institutional recommendation. Certified electronic issuance.',
    margin,
    pageHeight - 8
  );

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

export interface ReferralInviteEmailParams {
  schoolName: string;
  studentName: string;
  studentEmail: string;
  jobTitle: string;
  companyName: string;
  referralUrl: string;
  referralLetter?: string | null;
  expiresInDays: number;
}

export function buildReferralInviteEmail(params: ReferralInviteEmailParams): {
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
} {
  const { schoolName, studentName, jobTitle, companyName, referralUrl, referralLetter, expiresInDays } = params;
  const firstName = studentName.split(' ').filter(Boolean)[0] || studentName;

  let pdfBuffer: Buffer | null = null;
  if (referralLetter) {
    try {
      pdfBuffer = generateRecommendationPdfBuffer({
        schoolName,
        studentName,
        jobTitle,
        companyName,
        letterContent: referralLetter,
      });
    } catch (pdfErr) {
      console.warn('[job-referrals] Failed to generate PDF recommendation:', pdfErr);
    }
  }

  const claimHref = safeHttpUrl(referralUrl) ?? '#';

  const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #6366f1; margin: 0; font-size: 24px; font-weight: 800;">LinkBridge</h1>
                <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Official Academic & Career Referral</p>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h2 style="color: #0f172a; margin: 0 0 10px; font-size: 18px;">Congratulations, ${escapeHtml(firstName)}!</h2>
                <p style="color: #334155; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>${escapeHtml(schoolName)}</strong> has officially endorsed and referred your verified freelancer profile for an active opportunity:
                </p>
                <div style="margin-top: 14px; padding: 14px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1;">
                  <p style="margin: 0; font-weight: bold; font-size: 16px; color: #1e293b;">${escapeHtml(jobTitle)}</p>
                  <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">${escapeHtml(companyName)}</p>
                </div>
              </div>

              ${referralLetter ? `
                <div style="margin-bottom: 20px; padding: 18px 20px; background: #faf5ff; border: 1px solid #e9d5ff; border-left: 4px solid #9333ea; border-radius: 8px;">
                  <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <p style="margin: 0; font-weight: 700; font-size: 13px; color: #7e22ce; text-transform: uppercase; letter-spacing: 0.5px;">
                      🎓 Official Institutional Recommendation
                    </p>
                  </div>
                  <div style="font-size: 13.5px; color: #334155; line-height: 1.65;">
                    <p style="margin: 0 0 12px; line-height: 1.6; color: #334155;">
                      ${markdownToHtml(referralLetter)}
                    </p>
                  </div>
                </div>

                ${pdfBuffer ? `
                  <div style="margin-bottom: 24px; padding: 12px 16px; background: #f1f5f9; border: 1px dashed #94a3b8; border-radius: 8px; font-size: 13px; color: #334155;">
                    📎 <strong>Official PDF Attached:</strong> An official letterhead copy of your recommendation letter is attached to this email. You can download and attach it when applying for the job.
                  </div>
                ` : ''}
              ` : ''}

              <div style="text-align: center; margin: 32px 0;">
                <a href="${claimHref}" style="background-color: #4f46e5; color: #ffffff; padding: 14px 36px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);">
                  View Opportunity & Claim Referral
                </a>
              </div>

              <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

              <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.5;">
                This endorsement was officially issued by ${escapeHtml(schoolName)} on LinkBridge.<br/>
                This referral link is unique to you and valid for ${expiresInDays} days.<br/>
                <span style="color: #4f46e5; word-break: break-all; margin-top: 6px; display: inline-block;">${escapeHtml(referralUrl)}</span>
              </p>
            </div>
          `;

  const subject = `🎓 Official Job Referral: ${jobTitle} at ${companyName}`;

  if (pdfBuffer) {
    const cleanSafeName = studentName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      subject,
      html,
      attachments: [
        {
          filename: `Recommendation_Letter_${cleanSafeName}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };
  }

  return { subject, html };
}

