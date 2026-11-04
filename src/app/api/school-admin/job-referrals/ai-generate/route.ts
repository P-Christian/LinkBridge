// src/app/api/school-admin/job-referrals/ai-generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';
import { fetchSchoolByUserIdRepo } from '@/modules/school-admin/services/school-admin.repo';
import { generateLetterSchema } from '@/modules/school-admin/job-referrals/types/job-referrals.schema';
import { callGeminiMonitored } from '@/lib/gemini/geminiMonitoring';
import { getJwtVerificationSecret } from '@/modules/auth/registration/registration.session';
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'vos_sync_access_token';

async function getAuthSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value || req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const { payload } = await jose.jwtVerify(token, getJwtVerificationSecret());
    const userId = Number(payload.user_id || payload.sub);
    if (!userId) return null;

    const school = await fetchSchoolByUserIdRepo(userId);
    if (!school) return null;

    return {
      userId,
      schoolId: school.school_id,
      schoolName: school.school_name || 'Academic Institution',
      adminName: String(payload.user_fname || payload.name || 'School Administrator'),
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. School Admin access required.' }, { status: 401 });
    }

    const rawBody = await req.json();
    const parsed = generateLetterSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input for AI Letter Generation', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { job, students, tone = 'professional' } = parsed.data;
    const schoolName = session.schoolName;
    const adminName = session.adminName;
    const isSingle = students.length === 1;
    const mode = isSingle ? 'tailored' : 'unified';

    let prompt = '';
    let suggestedSubject = '';

    if (isSingle) {
      const student = students[0];
      suggestedSubject = `Official Student Endorsement: ${student.full_name} for ${job.job_title}`;

      prompt = `
You are an authorized School Administrator representing "${schoolName}".
Write an official, compelling, and professional Student Referral / Recommendation Letter endorsing student "${student.full_name}" for the job vacancy "${job.job_title}"${job.company_name ? ` at ${job.company_name}` : ''}.

Tone: ${tone} (Warm, authoritative, articulate, and endorsing).

--- TARGET JOB DETAILS ---
Title: ${job.job_title}
${job.company_name ? `Company: ${job.company_name}` : ''}
Work Type & Arrangement: ${job.job_type || 'Full-Time'} | ${job.work_arrangement || 'Remote'}
Job Description: ${job.job_description}
Key Qualifications: ${job.job_qualifications}

--- CANDIDATE PROFILE ---
Name: ${student.full_name}
Course / Major: ${student.course_name || 'Degree Candidate'}
GPA / Academic Standing: ${student.gpa ? `${student.gpa} GPA` : 'In Good Academic Standing'}
Professional Headline: ${student.headline || 'Verified Student Freelancer'}
Summary: ${student.summary || 'Demonstrated strong aptitude in coursework and practical projects.'}
Registered Skills: ${student.skills.length ? student.skills.join(', ') : 'Applied technical problem solving'}
Work & Project Experience:
${student.work_experiences.length > 0
  ? student.work_experiences.map((w) => `- ${w.job_title} at ${w.company_name}: ${w.description || 'Hands-on delivery'}`).join('\n')
  : '- Academic capstone and industry-simulated projects'}

--- INSTRUCTIONS ---
1. Address the hiring team / employer professionally.
2. Clearly state that "${schoolName}" officially endorses ${student.full_name} for this specific vacancy.
3. Explicitly bridge the student's listed skills, academic preparation, and project experience to the requirements of "${job.job_title}".
4. Highlight their dedication, work ethic, and verified status in our institutional talent pool.
5. Conclude with a warm invitation to interview and the administrator's endorsement sign-off.
6. Format cleanly with standard letter paragraphs in markdown. Do NOT output raw JSON or code fences, just the formatted letter.
`.trim();
    } else {
      suggestedSubject = `Official Cohort Endorsement: Recommended Candidates for ${job.job_title}`;

      const candidateProfilesText = students
        .map(
          (s, idx) => `
Candidate #${idx + 1}: ${s.full_name}
- Academic Program: ${s.course_name || 'Degree Program'} (GPA: ${s.gpa ?? 'Good Standing'})
- Key Skills: ${s.skills.join(', ') || 'Core competencies'}
- Background Summary: ${s.headline || s.summary || 'High-performing student talent'}
`
        )
        .join('\n');

      prompt = `
You are an authorized School Administrator representing "${schoolName}".
Write an official, cohesive Unified Cohort Recommendation Letter endorsing a curated group of ${students.length} verified students for the open position "${job.job_title}"${job.company_name ? ` at ${job.company_name}` : ''}.

Tone: ${tone} (Authoritative, collegiate, persuasive, and structured).

--- TARGET JOB DETAILS ---
Title: ${job.job_title}
${job.company_name ? `Company: ${job.company_name}` : ''}
Job Description: ${job.job_description}
Key Qualifications: ${job.job_qualifications}

--- SELECTED COHORT OF CANDIDATES (${students.length} Students) ---
${candidateProfilesText}

--- INSTRUCTIONS ---
1. Address the hiring team / talent acquisition department.
2. State that "${schoolName}" has hand-selected this cohort of ${students.length} verified top students whose academic training and practical skillsets directly match "${job.job_title}".
3. Provide a brief synthesized highlight for each candidate explaining their specific strength or alignment with the job.
4. Emphasize why this cohort brings fresh perspectives, fast onboarding capability, and strong foundational rigor.
5. Provide a clear recommendation encouraging the employer to review their attached profiles and schedule interviews.
6. Sign off officially on behalf of ${schoolName}. Format cleanly in markdown paragraphs.
`.trim();
    }

    let generatedLetter = '';

    try {
      const aiResponse = await callGeminiMonitored({
        prompt,
        feature: 'ROLE_INTELLIGENCE',
        endpoint: '/api/school-admin/job-referrals/ai-generate',
        userId: session.userId,
        timeoutMs: 15000,
      });

      if (!aiResponse) {
        throw new Error('Empty response received from Gemini');
      }

      generatedLetter = aiResponse.trim();
    } catch (aiErr) {
      console.warn('[ai-generate] Gemini service fallback triggered:', aiErr);
      // Fallback template if Gemini is unavailable
      if (isSingle) {
        const student = students[0];
        generatedLetter = `Dear Hiring Team${job.company_name ? ` at ${job.company_name}` : ''},

I am writing on behalf of **${schoolName}** to officially endorse **${student.full_name}** for the **${job.job_title}** position.

${student.full_name} has demonstrated exemplary dedication in ${student.course_name || 'their academic program'}${student.gpa ? ` with a GPA of ${student.gpa}` : ''}. Through rigorous coursework and practical projects, they have developed strong proficiencies in **${student.skills.slice(0, 4).join(', ') || 'relevant industry tools'}**, making them an outstanding match for the requirements of this role.

Our institution takes pride in verifying the competencies and character of our students, and we are confident that ${student.full_name} will make an immediate positive contribution to your team.

We warmly encourage you to review their profile and consider them for an interview. Please feel free to reach out if you require further academic verification.

Sincerely,

**${adminName}**  
Academic & Industry Partnerships  
*${schoolName}*`;
      } else {
        generatedLetter = `Dear Hiring Team${job.company_name ? ` at ${job.company_name}` : ''},

On behalf of **${schoolName}**, I am pleased to endorse a curated cohort of **${students.length} verified candidates** for your **${job.job_title}** vacancy.

Each of these students has demonstrated strong academic rigor and hands-on skill alignment with your listed requirements:

${students.map((s) => `* **${s.full_name}** (${s.course_name || 'Student'}): Demonstrates core strengths in ${s.skills.slice(0, 3).join(', ') || 'practical applications'}.`).join('\n')}

We highly recommend reviewing their profiles and considering them for your selection process.

Sincerely,

**${adminName}**  
Academic & Industry Partnerships  
*${schoolName}*`;
      }
    }

    return NextResponse.json({
      letter: generatedLetter,
      mode,
      studentCount: students.length,
      suggestedSubject,
    });
  } catch (error: unknown) {
    const msg = safeErrorMessage(error, "Failed to generate recommendation letter");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
