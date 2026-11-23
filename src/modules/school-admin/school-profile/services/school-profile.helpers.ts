// src/modules/school-admin/school-profile/services/school-profile.helpers.ts
import { SchoolProfileData, UpdateSchoolProfileDTO } from '../types/school-profile.types';
import { VsSchool } from '../../types/school-admin.types';
import { formatAssetUrl } from '@/lib/utils';

export const SCHOOL_CONTACT_MAX_LENGTH = 50;
export const SCHOOL_CONTACT_ERROR =
  'Enter a valid contact number (7-15 digits; +, spaces, parentheses, dots, or hyphens allowed).';

export function sanitizeSchoolContactInput(value: string): string {
  return value.replace(/[^+()\d\s.-]/g, '').slice(0, SCHOOL_CONTACT_MAX_LENGTH);
}

export function isValidSchoolContactNo(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === '') return true;
  if (trimmed.length > SCHOOL_CONTACT_MAX_LENGTH) return false;
  if (!/^\+?[\d()\s.-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export function formatSchoolAddress(data: Partial<SchoolProfileData | VsSchool>): string {
  const parts = [
    data.address_line,
    data.barangay,
    data.city_municipality,
    data.province,
    data.postal_code,
    data.country || 'Philippines'
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'No address provided';
}

export function sanitizeWebsiteUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function extractSocialHandle(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim().replace(/\/$/, '');
  const lastSlashIndex = trimmed.lastIndexOf('/');
  if (lastSlashIndex !== -1) {
    return trimmed.substring(lastSlashIndex + 1);
  }
  return trimmed.replace(/^\//, '');
}

export function getImageUrl(value: string | null | undefined): string {
  return formatAssetUrl(value) || '';
}

export function normalizeProfileFormData(school: Partial<SchoolProfileData | VsSchool>): UpdateSchoolProfileDTO {
  return {
    school_name: school.school_name || '',
    school_type: school.school_type || 'University',
    school_logo_url: school.school_logo_url || '',
    school_cover: school.school_cover || '',
    school_description: school.school_description || '',
    school_mission: school.school_mission || '',
    school_values: school.school_values || '',
    school_email: school.school_email || '',
    school_contact_no: school.school_contact_no || '',
    school_website: school.school_website || '',
    school_facebook: school.school_facebook || '',
    school_linkedin: school.school_linkedin || '',
    address_line: school.address_line || '',
    barangay: school.barangay || '',
    city_municipality: school.city_municipality || '',
    province: school.province || '',
    postal_code: school.postal_code || '',
    country: school.country || 'Philippines',
    is_public: school.is_public ?? false,
  };
}
