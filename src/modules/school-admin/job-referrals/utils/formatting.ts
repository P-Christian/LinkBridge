// src/modules/school-admin/job-referrals/utils/formatting.ts

import { escapeHtml } from '@/lib/mail/templates/escape-html';

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) {
    return `${user.charAt(0)}***@${domain}`;
  }
  return `${user.slice(0, 2)}***${user.charAt(user.length - 1)}@${domain}`;
}

export function formatSalary(min?: number | null, max?: number | null, currency: string = 'PHP'): string {
  if (!min && !max) return 'Competitive';
  const fmt = (val: number) =>
    new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: currency || 'PHP',
      maximumFractionDigits: 0,
    }).format(val);

  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  if (max) return `Up to ${fmt(max)}`;
  return 'Competitive';
}

export function getExpirationDate(days: number = 30): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function markdownToHtml(md: string): string {
  if (!md) return '';
  // Escape before the substitutions: the only tags that reach the email body are
  // the ones this function itself emits.
  return escapeHtml(md)
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Bullet points
    .replace(/^\s*[-*]\s+(.*)$/gm, '<li style="margin-bottom: 4px;">$1</li>')
    // Linebreaks
    .replace(/\n\n+/g, '</p><p style="margin: 0 0 12px; line-height: 1.6; color: #334155;">')
    .replace(/\n/g, '<br/>');
}
