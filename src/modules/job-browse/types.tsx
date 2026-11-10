// src/modules/job-browse/types.tsx

export type JobType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERNSHIP' | 'FREELANCE';
export type WorkArrangement = 'Remote' | 'Hybrid' | 'On-site';
export type ExperienceLevel = 'ENTRY' | 'MID' | 'SENIOR' | 'MANAGER' | 'EXECUTIVE';
export type SalaryType = 'Salary Range' | 'Fixed Salary' | 'Hourly Rate';

export interface JobScreeningQuestion {
  question_id: number;
  question_text: string;
}

export interface ScreeningAnswerPayload {
  question_id?: number;
  question_text?: string;
  answer_text: string;
}

export interface PublicJobPosting {
  job_id: number;
  company_id: number;
  company_code?: string | null;
  company_name?: string | null;
  company_logo?: string | null;
  company_cover?: string | null;
  company_email?: string | null;
  company_contact?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_province?: string | null;
  company_facebook?: string | null;
  company_linkedin?: string | null;
  company_instagram?: string | null;
  company_x?: string | null;
  company_youtube?: string | null;
  job_title: string;
  job_category: string;
  job_type: JobType;
  work_arrangement: WorkArrangement;
  job_location: string;
  job_department?: string | null;
  number_of_openings: number;
  job_description: string;
  job_responsibilities?: string | null;
  job_qualifications: string;
  salary_type: SalaryType;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_negotiable: boolean;
  currency: string;
  experience_level?: ExperienceLevel | null;
  education?: string | null;
  status: 'ACTIVE';
  created_at?: string;
  // Relations
  skills?: { id: number; skill_name: string }[];
  benefits?: string[];
  screening_questions?: (JobScreeningQuestion | string)[];
}

export interface CustomFileAttachment {
  file_name: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
}

export interface ApplyFormData {
  job_id: number;
  cover_letter: string;
  expected_salary: string;
  portfolio_url: string;
  screening_answers: ScreeningAnswerPayload[];
  custom_resume?: CustomFileAttachment | null;
  cover_letter_file?: CustomFileAttachment | null;
}

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  FULL_TIME: 'Full-Time',
  PART_TIME: 'Part-Time',
  CONTRACT: 'Contract',
  INTERNSHIP: 'Internship',
  FREELANCE: 'Freelance',
};

export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = {
  ENTRY: 'Entry Level',
  MID: 'Mid Level',
  SENIOR: 'Senior Level',
  MANAGER: 'Manager / Lead',
  EXECUTIVE: 'Executive / Director',
};

export type DatePostedFilter = 'ALL' | '24h' | '7d' | '30d';

export const DATE_POSTED_OPTIONS: { value: DatePostedFilter; label: string }[] = [
  { value: 'ALL', label: 'Anytime' },
  { value: '24h', label: 'Past 24 Hours' },
  { value: '7d', label: 'Past Week (Last 7 Days)' },
  { value: '30d', label: 'Past Month (Last 30 Days)' },
];

