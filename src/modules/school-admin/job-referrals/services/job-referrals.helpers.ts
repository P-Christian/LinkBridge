// src/modules/school-admin/job-referrals/services/job-referrals.helpers.ts
import crypto from 'crypto';

export * from '../utils/formatting';

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

