// src/modules/school-admin/job-referrals/services/job-referrals.service.ts
import {
  VsJobPosting,
  VerifiedStudentCandidate,
  VsJobReferral,
  CreatedReferralResult,
  CreateReferralsPayload,
  StudentWorkExperienceItem,
  StudentJobPreferencesItem,
  ReferralStatus,
  CreatedShareLinkResult,
  BlockedStudent,
} from '../types/job-referrals.types';
import {
  fetchActiveJobsRepo,
  fetchEligibleStudentsRepo,
  fetchFreelancerProfilesBatchRepo,
  insertReferralsRepo,
  insertReferralHistoryBatchRepo,
  fetchReferralsByAdminRepo,
  findActiveShareLinkRepo,
  fetchClaimsByReferralIdsRepo,
  fetchApplicationReferralIdsRepo,
  expireStaleReferralsRepo,
  fetchLiveReferralStudentIdsRepo,
} from './job-referrals.repo';
import {
  hashString,
  generateReferralToken,
  maskEmail,
  getExpirationDate,
  buildReferralInviteEmail,
} from './job-referrals.helpers';

export class ReferralBatchConflictError extends Error {
  blocked: BlockedStudent[];
  constructor(blocked: BlockedStudent[]) {
    super("Some selected students cannot be referred to this job.");
    this.name = "ReferralBatchConflictError";
    this.blocked = blocked;
  }
}

export class ReferralActionError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ReferralActionError";
    this.status = status;
  }
}

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (DIRECTUS_TOKEN) h['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

export async function getActiveJobsService(): Promise<VsJobPosting[]> {
  return await fetchActiveJobsRepo();
}

export async function getEligibleStudentCandidatesService(schoolId: number): Promise<VerifiedStudentCandidate[]> {
  const rawStudents = await fetchEligibleStudentsRepo(schoolId);
  if (!rawStudents.length) return [];

  // Extract registered user IDs
  const userIds = rawStudents
    .map((s) => Number(s.registered_user_id))
    .filter((id) => !isNaN(id) && id > 0);

  const freelancerMap = await fetchFreelancerProfilesBatchRepo(userIds);

  const candidates: VerifiedStudentCandidate[] = rawStudents.map((item) => {
    let courseName: string | undefined = undefined;
    let courseId: number | null = null;

    if (item.school_course_id && typeof item.school_course_id === 'object') {
      const c = item.school_course_id as Record<string, unknown>;
      courseName = c.course_name ? String(c.course_name) : undefined;
      courseId = c.school_course_id ? Number(c.school_course_id) : null;
    } else if (item.school_course_id) {
      courseId = Number(item.school_course_id);
    }

    const regUserId = Number(item.registered_user_id);
    const flData = freelancerMap[regUserId] || {
      user: {},
      profile: {},
      skills: [],
      work_experiences: [],
      job_preferences: null,
    };

    const userObj = (flData.user || {}) as Record<string, unknown>;
    const profileObj = (flData.profile || {}) as Record<string, unknown>;
    const rawGpa = item.gpa !== null && item.gpa !== undefined && item.gpa !== '' ? Number(item.gpa) : null;

    return {
      student_id: Number(item.student_id),
      school_id: Number(item.school_id),
      student_number: item.student_number ? String(item.student_number) : null,
      first_name: String(item.first_name || ''),
      middle_name: item.middle_name ? String(item.middle_name) : null,
      last_name: String(item.last_name || ''),
      email: String(item.email || ''),
      school_course_id: courseId,
      course_name: courseName,
      school_year: String(item.school_year || ''),
      gpa: rawGpa !== null && !isNaN(rawGpa) ? rawGpa : null,
      invitation_status: String(item.invitation_status || 'Registered'),
      registered_user_id: regUserId,
      profile_image_url: userObj.profile_image_url ? String(userObj.profile_image_url) : null,
      user_position: userObj.user_position ? String(userObj.user_position) : null,
      profile_headline: profileObj.profile_headline ? String(profileObj.profile_headline) : null,
      professional_summary: profileObj.professional_summary ? String(profileObj.professional_summary) : null,
      skills: (flData.skills as string[]) || [],
      work_experiences: (flData.work_experiences as StudentWorkExperienceItem[]) || [],
      job_preferences: (flData.job_preferences as StudentJobPreferencesItem) || null,
      applied_job_ids: (flData.applied_job_ids as number[]) || [],
    };
  });

  return candidates;
}

export async function createBatchReferralsService(
  adminUserId: number,
  schoolId: number,
  baseUrl: string,
  payload: CreateReferralsPayload
): Promise<CreatedReferralResult[]> {
  const { job_id, student_ids, expires_in_days = 30 } = payload;
  const candidates = await getEligibleStudentCandidatesService(schoolId); // Query candidates strictly for this school
  const validSchoolCandidateMap = new Set(candidates.map((c) => c.student_id));

  // Security guard: verify that none of the submitted student_ids belong outside this school
  const unauthorizedIds = student_ids.filter((id) => !validSchoolCandidateMap.has(id));
  if (unauthorizedIds.length > 0) {
    throw new Error(`Forbidden: Candidates do not belong to the authorized school.`);
  }

  const requested = candidates.filter((c) => student_ids.includes(c.student_id));

  await expireStaleReferralsRepo(schoolId, job_id, student_ids);

  const liveReferralIds = await fetchLiveReferralStudentIdsRepo(schoolId, job_id, student_ids);

  const blocked: BlockedStudent[] = [];
  for (const student of requested) {
    const fullName = `${student.first_name} ${student.last_name}`.trim();
    if (liveReferralIds.has(student.student_id)) {
      blocked.push({ student_id: student.student_id, name: fullName, reason: "ALREADY_REFERRED" });
    } else if (student.applied_job_ids?.includes(job_id)) {
      blocked.push({ student_id: student.student_id, name: fullName, reason: "ALREADY_APPLIED" });
    }
  }
  if (blocked.length > 0) {
    throw new ReferralBatchConflictError(blocked);
  }

  const targetCandidates = requested;

  const expiresAt = getExpirationDate(expires_in_days);
  const tokenPairs: { token: string; tokenHash: string; student: VerifiedStudentCandidate }[] = [];

  const referralRecords: Partial<VsJobReferral>[] = targetCandidates.map((student) => {
    const token = generateReferralToken();
    const tokenHash = hashString(token);
    const emailHash = hashString(student.email.trim().toLowerCase());
    const displayHint = maskEmail(student.email);

    tokenPairs.push({ token, tokenHash, student });

    return {
      job_id,
      referrer_user_id: adminUserId,
      token_hash: tokenHash,
      recipient_email_hash: emailHash,
      display_hint: displayHint,
      status: 'CREATED',
      expires_at: expiresAt,
      student_id: student.student_id,
      school_id: schoolId,
      referral_letter: payload.referral_letter ?? null,
    };
  });

  if (!referralRecords.length) {
    throw new Error('No valid students found for referral creation.');
  }

  const createdDbRecords = await insertReferralsRepo(referralRecords);

  // Log History
  const historyEntries = createdDbRecords.map((rec) => ({
    referral_id: rec.referral_id,
    from_status: 'NONE',
    to_status: 'CREATED',
    actor: `admin:${adminUserId}`,
    reason_category: 'School Admin Student Referral',
  }));

  try {
    await insertReferralHistoryBatchRepo(historyEntries);
  } catch (err) {
    console.warn('Could not log referral history entry:', err);
  }

  // Fetch target job details for email
  let jobTitle = 'Job Opportunity';
  let companyName = 'Partner Company';
  try {
    const allJobs = await fetchActiveJobsRepo();
    const currentJob = allJobs.find((j) => j.job_id === job_id);
    if (currentJob) {
      jobTitle = currentJob.job_title;
      companyName = currentJob.company_name || 'Partner Company';
    }
  } catch (err) {
    console.warn('Could not fetch target job details for email:', err);
  }

  // Fetch school details if available
  let schoolName = 'Your Academic Institution';
  try {
    const schoolRes = await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')}/items/vs_school/${schoolId}?fields=school_name`, {
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.DIRECTUS_STATIC_TOKEN ? { Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` } : {}),
      },
      cache: 'no-store',
    });
    if (schoolRes.ok) {
      const sJson = await schoolRes.json();
      if (sJson.data?.school_name) {
        schoolName = sJson.data.school_name;
      }
    }
  } catch (err) {
    console.warn('Could not fetch school details for email:', err);
  }

  // Format Results and dispatch automated email notifications
  const results: CreatedReferralResult[] = await Promise.all(
    createdDbRecords.map(async (rec, index) => {
      const pair = tokenPairs[index] || tokenPairs.find((p) => p.tokenHash === rec.token_hash);
      const token = pair?.token || rec.token_hash;
      const student = pair?.student;

      const url = `${baseUrl.replace(/\/$/, '')}/referral/${token}`;

      // Dispatch Email
      let emailSent = false;
      if (student?.email) {
        try {
          const studentFullName = `${student.first_name} ${student.last_name}`.trim();
          const invite = buildReferralInviteEmail({
            schoolName,
            studentName: studentFullName,
            studentEmail: student.email,
            jobTitle,
            companyName,
            referralUrl: url,
            referralLetter: payload.referral_letter ?? null,
            expiresInDays: expires_in_days,
          });

          const { sendMail } = await import('@/lib/mail');
          await sendMail({
            to: student.email,
            subject: invite.subject,
            html: invite.html,
            ...(invite.attachments ? { attachments: invite.attachments } : {}),
          });
          emailSent = true;
        } catch (mailErr) {
          console.warn(`[job-referrals] Failed to send email to ${student.email}:`, mailErr);
        }
      }

      return {
        referral_id: rec.referral_id,
        student_id: student?.student_id || 0,
        student_name: student ? `${student.first_name} ${student.last_name}`.trim() : 'Student',
        email: student?.email || '',
        token: token,
        referral_url: url,
        status: rec.status,
        email_sent: emailSent,
      };
    })
  );

  await Promise.allSettled(
    createdDbRecords.map((record, index) =>
      fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '')}/items/vs_job_referral/${record.referral_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(process.env.DIRECTUS_STATIC_TOKEN ? { Authorization: `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` } : {}) },
        body: JSON.stringify({
          email_status: results[index]?.email_sent ? 'SENT' : 'FAILED',
          email_sent_at: new Date().toISOString(),
        }),
      })
    )
  );

  return results;
}

export async function getAdminReferralsService(adminUserId: number, baseUrl: string): Promise<VsJobReferral[]> {
  const records = await fetchReferralsByAdminRepo(adminUserId);
  if (!records.length) return [];

  const referralIds = records
    .map((r) => Number(r.referral_id))
    .filter((id) => Number.isSafeInteger(id) && id > 0);

  const [claims, appliedReferralIds] = await Promise.all([
    fetchClaimsByReferralIdsRepo(referralIds),
    fetchApplicationReferralIdsRepo(referralIds),
  ]);

  return records.map((r) => {
    const id = Number(r.referral_id);
    const claimants = claims
      .filter((c) => c.referralId === id)
      .sort((a, b) => a.consented_at.localeCompare(b.consented_at))
      .map((c) => ({
        name: c.name,
        email: c.email,
        consented_at: c.consented_at,
        claim_status: c.claim_status,
        applied: appliedReferralIds.has(id),
      }));

    return {
      ...r,
      referral_url: `${baseUrl.replace(/\/$/, '')}/referral/${r.token_hash}`,
      claimants,
      claim_count: claimants.length,
    };
  });
}

export async function createShareLinkService(
  adminUserId: number,
  jobId: number,
  baseUrl: string,
  expiresInDays: number
): Promise<CreatedShareLinkResult> {
  const origin = baseUrl.replace(/\/$/, '');

  const existing = await findActiveShareLinkRepo(adminUserId, jobId);
  if (existing) {
    return {
      referral_id: Number(existing.referral_id),
      token: String(existing.token_hash),
      referral_url: `${origin}/referral/${existing.token_hash}`,
      status: existing.status as ReferralStatus,
      expires_at: String(existing.expires_at),
      reused: true,
    };
  }

  const token = generateReferralToken();
  const tokenHash = hashString(token);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const [created] = await insertReferralsRepo([
    {
      job_id: jobId,
      referrer_user_id: adminUserId,
      token_hash: tokenHash,
      display_hint: "Public share link",
      status: "CREATED",
      expires_at: expiresAt,
    },
  ]);

  await insertReferralHistoryBatchRepo([
    {
      referral_id: created.referral_id,
      from_status: "NONE",
      to_status: "CREATED",
      actor: `admin:${adminUserId}`,
      reason_category: "School Admin Share Link",
    },
  ]);

  return {
    referral_id: Number(created.referral_id),
    token,
    referral_url: `${origin}/referral/${token}`,
    status: "CREATED",
    expires_at: expiresAt,
    reused: false,
  };
}

export async function resendReferralEmailService(
  adminUserId: number,
  referralId: number,
  baseUrl: string
): Promise<{ email_sent: boolean }> {
  const refRes = await fetch(
    `${DIRECTUS_BASE}/items/vs_job_referral/${referralId}?fields=referrer_user_id,student_id,school_id,token_hash,status,expires_at,referral_letter,job_id`,
    { headers: getHeaders(), cache: 'no-store' }
  );
  if (!refRes.ok) {
    throw new ReferralActionError(404, "Referral not found.");
  }
  const refJson = (await refRes.json()) as { data?: Record<string, unknown> };
  const referral = refJson.data;
  if (!referral) {
    throw new ReferralActionError(404, "Referral not found.");
  }

  if (Number(referral.referrer_user_id) !== adminUserId) {
    throw new ReferralActionError(403, "Unauthorized access to this referral.");
  }

  if (referral.student_id === null || referral.student_id === undefined || String(referral.student_id).trim() === '') {
    throw new ReferralActionError(400, "Share links do not have a recipient.");
  }

  const statusValue = String(referral.status ?? '').toUpperCase();
  if (statusValue === 'REVOKED' || statusValue === 'EXPIRED') {
    throw new ReferralActionError(400, "This invitation is no longer active.");
  }
  if (statusValue === 'CLAIMED' || statusValue === 'APPLIED') {
    throw new ReferralActionError(400, "This invitation was already accepted.");
  }

  const expiresAtMs = referral.expires_at ? Date.parse(String(referral.expires_at)) : NaN;
  if (!referral.expires_at || isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new ReferralActionError(400, "This invitation has expired.");
  }

  const studentId = referral.student_id;
  const studentRes = await fetch(
    `${DIRECTUS_BASE}/items/vs_school_student/${studentId}?fields=first_name,last_name,email`,
    { headers: getHeaders(), cache: 'no-store' }
  );
  if (!studentRes.ok) {
    throw new ReferralActionError(404, "Recipient not found.");
  }
  const studentJson = (await studentRes.json()) as { data?: Record<string, unknown> };
  const student = studentJson.data;
  if (!student || !student.email || String(student.email).trim() === '') {
    throw new ReferralActionError(404, "Recipient not found.");
  }
  const studentEmail = String(student.email);
  const studentName = `${String(student.first_name ?? '')} ${String(student.last_name ?? '')}`.trim() || 'Student';

  let jobTitle = "Job Opportunity";
  let companyName = "Partner Company";
  try {
    const jobRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_posting/${referral.job_id}?fields=job_title,company_id.company_name`,
      { headers: getHeaders(), cache: 'no-store' }
    );
    if (jobRes.ok) {
      const jobJson = (await jobRes.json()) as { data?: Record<string, unknown> };
      const job = jobJson.data;
      if (job) {
        if (job.job_title) jobTitle = String(job.job_title);
        const companyRef = job.company_id;
        if (companyRef && typeof companyRef === 'object') {
          const companyObj = companyRef as Record<string, unknown>;
          if (companyObj.company_name) companyName = String(companyObj.company_name);
        } else if (typeof companyRef === 'string' && companyRef.trim() !== '') {
          companyName = companyRef;
        }
      }
    }
  } catch {
  }

  let schoolName = "Your Academic Institution";
  if (referral.school_id !== null && referral.school_id !== undefined && String(referral.school_id).trim() !== '') {
    try {
      const schoolRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_school/${referral.school_id}?fields=school_name`,
        { headers: getHeaders(), cache: 'no-store' }
      );
      if (schoolRes.ok) {
        const schoolJson = (await schoolRes.json()) as { data?: Record<string, unknown> };
        if (schoolJson.data?.school_name) {
          schoolName = String(schoolJson.data.school_name);
        }
      }
    } catch {
    }
  }

  const referralUrl = `${baseUrl.replace(/\/$/, "")}/referral/${referral.token_hash}`;
  const expiresInDays = Math.max(1, Math.ceil((expiresAtMs - Date.now()) / 86400000));

  const invite = buildReferralInviteEmail({
    schoolName,
    studentName,
    studentEmail,
    jobTitle,
    companyName,
    referralUrl,
    referralLetter: referral.referral_letter ? String(referral.referral_letter) : null,
    expiresInDays,
  });

  const { sendMail } = await import('@/lib/mail');
  try {
    await sendMail({
      to: studentEmail,
      subject: invite.subject,
      html: invite.html,
      ...(invite.attachments ? { attachments: invite.attachments } : {}),
    });
  } catch {
    await fetch(`${DIRECTUS_BASE}/items/vs_job_referral/${referralId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        email_status: "FAILED",
        email_sent_at: new Date().toISOString(),
      }),
    });
    return { email_sent: false };
  }

  await fetch(`${DIRECTUS_BASE}/items/vs_job_referral/${referralId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({
      email_status: "SENT",
      email_sent_at: new Date().toISOString(),
    }),
  });
  return { email_sent: true };
}
