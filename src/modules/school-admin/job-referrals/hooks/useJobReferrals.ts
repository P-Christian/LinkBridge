/* eslint-disable react-hooks/set-state-in-effect */
// src/modules/school-admin/job-referrals/hooks/useJobReferrals.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  VsJobPosting,
  VerifiedStudentCandidate,
  VsJobReferral,
  CreatedReferralResult,
  CreatedShareLinkResult,
  CreateReferralsPayload,
  GenerateLetterResponse,
  LetterTone,
  BlockedStudent,
} from '../types/job-referrals.types';
import { toast } from 'sonner';

export interface UseJobReferralsReturn {
  // Data state
  jobs: VsJobPosting[];
  students: VerifiedStudentCandidate[];
  referrals: VsJobReferral[];
  schoolName: string;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // Modal / Referral Wizard State
  activeJob: VsJobPosting | null;
  selectedStudentIds: number[];
  isWizardOpen: boolean;
  isHistoryOpen: boolean;
  isSuccessModalOpen: boolean;
  createdResults: CreatedReferralResult[];
  referredStudentIds: number[];
  blockedStudents: BlockedStudent[];
  clearBlockedStudents: () => void;

  // Wizard Navigation & Actions
  openReferralWizard: (job: VsJobPosting) => void;
  closeReferralWizard: () => void;
  toggleStudentSelection: (studentId: number) => void;
  selectAllStudents: () => void;
  clearStudentSelection: () => void;
  setIsHistoryOpen: (open: boolean) => void;
  setIsSuccessModalOpen: (open: boolean) => void;

  // AI Letter Studio
  isGeneratingLetter: boolean;
  generatedLetter: string;
  letterTone: LetterTone;
  setLetterTone: (tone: LetterTone) => void;
  setGeneratedLetter: (letter: string) => void;
  generateAILetter: (tone?: LetterTone) => Promise<void>;

  // Submission
  isSubmittingReferrals: boolean;
  submitReferrals: () => Promise<void>;
  resendReferral: (referralId: number) => Promise<void>;

  // Shareable referral link
  activeShareJob: VsJobPosting | null;
  isShareLinkOpen: boolean;
  isCreatingShareLink: boolean;
  createdShareLink: CreatedShareLinkResult | null;
  openShareLinkDialog: (job: VsJobPosting) => void;
  closeShareLinkDialog: () => void;
  createShareLink: (expiresInDays: number) => Promise<void>;
  closeShareLinkSuccess: () => void;
  revokeShareLink: (referralId: number) => Promise<void>;
}

export function useJobReferrals(): UseJobReferralsReturn {
  const [jobs, setJobs] = useState<VsJobPosting[]>([]);
  const [students, setStudents] = useState<VerifiedStudentCandidate[]>([]);
  const [referrals, setReferrals] = useState<VsJobReferral[]>([]);
  const [schoolName, setSchoolName] = useState<string>('Your Institution');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Wizard state
  const [activeJob, setActiveJob] = useState<VsJobPosting | null>(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState<boolean>(false);
  const [createdResults, setCreatedResults] = useState<CreatedReferralResult[]>([]);
  const [blockedStudents, setBlockedStudents] = useState<BlockedStudent[]>([]);

  const referredStudentIds = useMemo(
    () =>
      referrals
        .filter(
          (r) =>
            activeJob &&
            Number(r.job_id) === activeJob.job_id &&
            r.student_id &&
            ['CREATED', 'SENT', 'OPENED', 'CLAIMED'].includes(String(r.status).toUpperCase())
        )
        .map((r) => Number(r.student_id)),
    [referrals, activeJob]
  );

  // AI studio state
  const [isGeneratingLetter, setIsGeneratingLetter] = useState<boolean>(false);
  const [generatedLetter, setGeneratedLetter] = useState<string>('');
  const [letterTone, setLetterTone] = useState<LetterTone>('professional');
  const [isSubmittingReferrals, setIsSubmittingReferrals] = useState<boolean>(false);

  // Shareable referral link state
  const [activeShareJob, setActiveShareJob] = useState<VsJobPosting | null>(null);
  const [isShareLinkOpen, setIsShareLinkOpen] = useState<boolean>(false);
  const [isCreatingShareLink, setIsCreatingShareLink] = useState<boolean>(false);
  const [createdShareLink, setCreatedShareLink] = useState<CreatedShareLinkResult | null>(null);

  const fetchModuleData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/school-admin/job-referrals');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load school job referrals');
      }
      const data = await res.json();

      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setStudents(Array.isArray(data.students) ? data.students : []);
      setReferrals(Array.isArray(data.referrals) ? data.referrals : []);
      if (data.school?.school_name) setSchoolName(data.school.school_name);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load job referrals';
      setError(msg);
      setJobs([]);
      setStudents([]);
      setReferrals([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModuleData();
  }, [fetchModuleData]);

  const openReferralWizard = useCallback((job: VsJobPosting) => {
    setActiveJob(job);
    setSelectedStudentIds([]);
    setGeneratedLetter('');
    setBlockedStudents([]);
    setIsWizardOpen(true);
  }, []);

  const closeReferralWizard = useCallback(() => {
    setIsWizardOpen(false);
    setActiveJob(null);
    setSelectedStudentIds([]);
    setGeneratedLetter('');
    setBlockedStudents([]);
  }, []);

  const clearBlockedStudents = useCallback(() => {
    setBlockedStudents([]);
  }, []);

  const toggleStudentSelection = useCallback((studentId: number) => {
    setBlockedStudents([]);
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  }, []);

  const selectAllStudents = useCallback(() => {
    setBlockedStudents([]);
    if (!activeJob) {
      setSelectedStudentIds(students.map((s) => s.student_id));
      return;
    }
    const eligible = students.filter(
      (s) =>
        !s.applied_job_ids?.includes(activeJob.job_id) && !referredStudentIds.includes(s.student_id)
    );
    setSelectedStudentIds(eligible.map((s) => s.student_id));
  }, [students, activeJob, referredStudentIds]);

  const clearStudentSelection = useCallback(() => {
    setBlockedStudents([]);
    setSelectedStudentIds([]);
  }, []);

  const generateAILetter = useCallback(
    async (tone: LetterTone = letterTone) => {
      if (!activeJob) {
        toast.error('Please select a target job posting.');
        return;
      }
      if (selectedStudentIds.length === 0) {
        toast.error('Select at least one verified student to endorse.');
        return;
      }

      setIsGeneratingLetter(true);
      try {
        const selectedCandidates = students.filter((s) => selectedStudentIds.includes(s.student_id));

        const payload = {
          job: {
            job_id: activeJob.job_id,
            job_title: activeJob.job_title,
            company_name: activeJob.company_name,
            job_description: activeJob.job_description,
            job_qualifications: activeJob.job_qualifications,
            job_type: activeJob.job_type,
            work_arrangement: activeJob.work_arrangement,
          },
          students: selectedCandidates.map((s) => ({
            student_id: s.student_id,
            registered_user_id: s.registered_user_id,
            full_name: `${s.first_name} ${s.last_name}`,
            email: s.email,
            course_name: s.course_name,
            gpa: s.gpa,
            headline: s.profile_headline || undefined,
            summary: s.professional_summary || undefined,
            skills: s.skills,
            work_experiences: s.work_experiences.map((w) => ({
              job_title: w.job_title,
              company_name: w.company_name,
              description: w.job_description,
            })),
          })),
          tone,
          schoolName,
        };

        const res = await fetch('/api/school-admin/job-referrals/ai-generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error('AI Generation failed');
        }

        const data: GenerateLetterResponse = await res.json();
        setGeneratedLetter(data.letter);
        toast.success('AI Recommendation Letter generated!');
      } catch (err) {
        console.warn('AI generator fallback to client formatting:', err);
        // Direct client-side generation fallback
        const selectedCandidates = students.filter((s) => selectedStudentIds.includes(s.student_id));
        if (selectedCandidates.length === 1) {
          const cand = selectedCandidates[0];
          setGeneratedLetter(
            `Dear Hiring Team at ${activeJob.company_name || 'the Organization'},\n\n` +
            `On behalf of **${schoolName}**, I take great pleasure in officially endorsing **${cand.first_name} ${cand.last_name}** for the **${activeJob.job_title}** position.\n\n` +
            `${cand.first_name} is enrolled in ${cand.course_name || 'our academic program'}${cand.gpa ? ` with an outstanding GPA of ${cand.gpa}` : ''}. ` +
            `Through dedicated project work, ${cand.first_name} has demonstrated proven mastery in ${cand.skills.join(', ') || 'essential technical domains'}, aligning directly with your key qualifications.\n\n` +
            `We have verified their credentials and work ethic, and strongly recommend them for an interview.\n\n` +
            `Sincerely,\n**Academic & Industry Placement Office**\n*${schoolName}*`
          );
        } else {
          setGeneratedLetter(
            `Dear Hiring Team at ${activeJob.company_name || 'the Organization'},\n\n` +
            `On behalf of **${schoolName}**, I am pleased to present a hand-selected cohort of **${selectedCandidates.length} high-performing candidates** for your **${activeJob.job_title}** opening.\n\n` +
            `Each candidate has demonstrated excellence in academic preparation and hands-on skill execution:\n\n` +
            selectedCandidates.map((s) => `* **${s.first_name} ${s.last_name}** (${s.course_name || 'Candidate'}): Specializing in ${s.skills.slice(0, 3).join(', ')}.`).join('\n') +
            `\n\nWe encourage your team to review their verified portfolios and schedule interviews.\n\n` +
            `Sincerely,\n**Academic & Industry Placement Office**\n*${schoolName}*`
          );
        }
        toast.success('Recommendation letter drafted!');
      } finally {
        setIsGeneratingLetter(false);
      }
    },
    [activeJob, selectedStudentIds, students, letterTone, schoolName]
  );

  const submitReferrals = useCallback(async () => {
    if (!activeJob) return;
    if (selectedStudentIds.length === 0) {
      toast.error('Please select students to refer.');
      return;
    }

    setIsSubmittingReferrals(true);
    try {
      const payload: CreateReferralsPayload = {
        job_id: activeJob.job_id,
        student_ids: selectedStudentIds,
        referral_letter: generatedLetter,
        expires_in_days: 30,
      };

      const res = await fetch('/api/school-admin/job-referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson: { error?: string; blocked?: BlockedStudent[] } = await res.json().catch(() => ({}));
        if (res.status === 409 && Array.isArray(errJson.blocked) && errJson.blocked.length > 0) {
          setBlockedStudents(errJson.blocked);
          toast.error(errJson.error || 'Some students cannot be referred.');
          return;
        }
        toast.error(errJson.error || 'Failed to create referrals.');
        return;
      }

      const data = await res.json();
      setCreatedResults(data.data || []);
      setIsWizardOpen(false);
      setIsSuccessModalOpen(true);
      toast.success(`Successfully created ${data.count || selectedStudentIds.length} student referrals!`);
      fetchModuleData();
    } catch {
      toast.error('Failed to create referrals.');
    } finally {
      setIsSubmittingReferrals(false);
    }
  }, [activeJob, selectedStudentIds, generatedLetter, fetchModuleData]);

  const openShareLinkDialog = useCallback((job: VsJobPosting) => {
    setActiveShareJob(job);
    setCreatedShareLink(null);
    setIsShareLinkOpen(true);
  }, []);

  const closeShareLinkDialog = useCallback(() => {
    setIsShareLinkOpen(false);
    setActiveShareJob(null);
  }, []);

  const closeShareLinkSuccess = useCallback(() => {
    setCreatedShareLink(null);
  }, []);

  const createShareLink = useCallback(
    async (expiresInDays: number) => {
      if (!activeShareJob) return;

      setIsCreatingShareLink(true);
      setCreatedShareLink(null);
      try {
        const res = await fetch('/api/school-admin/job-referrals/share-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            job_id: activeShareJob.job_id,
            expires_in_days: expiresInDays,
          }),
        });

        if (!res.ok) {
          const errJson: { error?: string } = await res.json().catch(() => ({}));
          toast.error(errJson.error || 'Failed to create share link');
          return;
        }

        const json: { data?: CreatedShareLinkResult } = await res.json();
        if (!json.data) {
          toast.error('Failed to create share link');
          return;
        }

        setCreatedShareLink(json.data);
        setIsShareLinkOpen(false);
        fetchModuleData();
        toast.success(json.data.reused ? 'Existing share link reused' : 'Share link created');
      } catch {
        toast.error('Failed to create share link');
      } finally {
        setIsCreatingShareLink(false);
      }
    },
    [activeShareJob, fetchModuleData]
  );

  const revokeShareLink = useCallback(
    async (referralId: number) => {
      try {
        const res = await fetch(`/api/school-admin/job-referrals/${referralId}/revoke`, {
          method: 'POST',
        });

        if (!res.ok) {
          const errJson: { error?: string } = await res.json().catch(() => ({}));
          toast.error(errJson.error || 'Failed to revoke referral link');
          return;
        }

        toast.success('Referral link revoked');
        fetchModuleData();
      } catch {
        toast.error('Failed to revoke referral link');
      }
    },
    [fetchModuleData]
  );

  const resendReferral = useCallback(
    async (referralId: number) => {
      try {
        const res = await fetch(`/api/school-admin/job-referrals/${referralId}/resend`, {
          method: 'POST',
        });

        const json: { error?: string; email_sent?: boolean } = await res.json().catch(() => ({}));

        if (!res.ok) {
          toast.error(json.error || 'Failed to resend email');
          return;
        }

        if (json.email_sent === false) {
          toast.error('Email could not be sent');
        } else {
          toast.success('Email sent');
        }

        fetchModuleData();
      } catch {
        toast.error('Failed to resend email');
      }
    },
    [fetchModuleData]
  );

  return {
    jobs,
    students,
    referrals,
    schoolName,
    isLoading,
    error,
    refresh: fetchModuleData,

    activeJob,
    selectedStudentIds,
    isWizardOpen,
    isHistoryOpen,
    isSuccessModalOpen,
    createdResults,
    referredStudentIds,
    blockedStudents,
    clearBlockedStudents,

    openReferralWizard,
    closeReferralWizard,
    toggleStudentSelection,
    selectAllStudents,
    clearStudentSelection,
    setIsHistoryOpen,
    setIsSuccessModalOpen,

    isGeneratingLetter,
    generatedLetter,
    letterTone,
    setLetterTone,
    setGeneratedLetter,
    generateAILetter,

    isSubmittingReferrals,
    submitReferrals,
    resendReferral,

    activeShareJob,
    isShareLinkOpen,
    isCreatingShareLink,
    createdShareLink,
    openShareLinkDialog,
    closeShareLinkDialog,
    createShareLink,
    closeShareLinkSuccess,
    revokeShareLink,
  };
}
