// src/modules/school-admin/job-referrals/services/job-referrals.service.ts
import {
  VsJobPosting,
  VerifiedStudentCandidate,
  VsJobReferral,
  CreatedReferralResult,
  CreateReferralsPayload,
  StudentWorkExperienceItem,
  StudentJobPreferencesItem,
} from '../types/job-referrals.types';
import {
  fetchActiveJobsRepo,
  fetchEligibleStudentsRepo,
  fetchFreelancerProfilesBatchRepo,
  insertReferralsRepo,
  insertReferralHistoryBatchRepo,
  fetchReferralsByAdminRepo,
} from './job-referrals.repo';
import {
  hashString,
  generateReferralToken,
  maskEmail,
  getExpirationDate,
  markdownToHtml,
  generateRecommendationPdfBuffer,
} from './job-referrals.helpers';
import { escapeHtml, safeHttpUrl } from '@/lib/mail/templates/escape-html';

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

  const targetCandidates = candidates.filter(
    (c) => student_ids.includes(c.student_id) && !c.applied_job_ids?.includes(job_id)
  );

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
      if (student?.email) {
        try {
          const studentFullName = `${student.first_name} ${student.last_name}`.trim();
          let pdfBuffer: Buffer | null = null;
          if (payload.referral_letter) {
            try {
              pdfBuffer = generateRecommendationPdfBuffer({
                schoolName,
                studentName: studentFullName,
                jobTitle,
                companyName,
                letterContent: payload.referral_letter,
              });
            } catch (pdfErr) {
              console.warn('[job-referrals] Failed to generate PDF recommendation:', pdfErr);
            }
          }

          const claimHref = safeHttpUrl(url) ?? '#';

          const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #6366f1; margin: 0; font-size: 24px; font-weight: 800;">LinkBridge</h1>
                <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Official Academic & Career Referral</p>
              </div>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <h2 style="color: #0f172a; margin: 0 0 10px; font-size: 18px;">Congratulations, ${escapeHtml(student.first_name)}!</h2>
                <p style="color: #334155; margin: 0; font-size: 14px; line-height: 1.5;">
                  <strong>${escapeHtml(schoolName)}</strong> has officially endorsed and referred your verified freelancer profile for an active opportunity:
                </p>
                <div style="margin-top: 14px; padding: 14px; background: #ffffff; border-radius: 6px; border: 1px solid #cbd5e1;">
                  <p style="margin: 0; font-weight: bold; font-size: 16px; color: #1e293b;">${escapeHtml(jobTitle)}</p>
                  <p style="margin: 4px 0 0; font-size: 13px; color: #64748b;">${escapeHtml(companyName)}</p>
                </div>
              </div>

              ${payload.referral_letter ? `
                <div style="margin-bottom: 20px; padding: 18px 20px; background: #faf5ff; border: 1px solid #e9d5ff; border-left: 4px solid #9333ea; border-radius: 8px;">
                  <div style="display: flex; align-items: center; margin-bottom: 12px;">
                    <p style="margin: 0; font-weight: 700; font-size: 13px; color: #7e22ce; text-transform: uppercase; letter-spacing: 0.5px;">
                      🎓 Official Institutional Recommendation
                    </p>
                  </div>
                  <div style="font-size: 13.5px; color: #334155; line-height: 1.65;">
                    <p style="margin: 0 0 12px; line-height: 1.6; color: #334155;">
                      ${markdownToHtml(payload.referral_letter)}
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
                This referral link is unique to you and valid for ${expires_in_days} days.<br/>
                <span style="color: #4f46e5; word-break: break-all; margin-top: 6px; display: inline-block;">${escapeHtml(url)}</span>
              </p>
            </div>
          `;

          const { sendMail } = await import('@/lib/mail');
          const cleanSafeName = studentFullName.replace(/[^a-zA-Z0-9_-]/g, '_');
          await sendMail({
            to: student.email,
            subject: `🎓 Official Job Referral: ${jobTitle} at ${companyName}`,
            html: htmlBody,
            ...(pdfBuffer
              ? {
                attachments: [
                  {
                    filename: `Recommendation_Letter_${cleanSafeName}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf',
                  },
                ],
              }
              : {}),
          });
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
      };
    })
  );

  return results;
}

export async function getAdminReferralsService(adminUserId: number, baseUrl: string): Promise<VsJobReferral[]> {
  const records = await fetchReferralsByAdminRepo(adminUserId);
  return records.map((r) => ({
    ...r,
    referral_url: `${baseUrl.replace(/\/$/, '')}/referral/${r.token_hash}`,
  }));
}
