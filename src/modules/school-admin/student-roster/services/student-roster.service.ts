import { StudentRosterFilter, VsSchoolStudent } from '../types/student-roster.types';
import { createStudentSchema, bulkStudentSchema, updateRosterAcademicsSchema, CreateStudentInput, BulkStudentInput } from '../types/student-roster.schema';
import * as repo from './student-roster.repo';
import { RosterHttpError, resolveExactSchoolAssignment } from './roster-auth';

export { RosterHttpError, resolveExactSchoolAssignment };

export async function getStudentRoster(filter: StudentRosterFilter) {
  if (!filter.school_id) {
    throw new Error('School ID is required');
  }
  return await repo.fetchStudentsRepo({ ...filter, is_alumni: filter.is_alumni ?? false });
}

export async function addSingleStudent(schoolId: number, createdByUserId: number, input: CreateStudentInput): Promise<VsSchoolStudent> {
  const validated = createStudentSchema.parse(input);

  const payload: Partial<VsSchoolStudent> = {
    school_id: schoolId,
    student_number: validated.student_number || null,
    first_name: validated.first_name,
    // Required non-null in Directus (rejects null/omission, accepts ''): a blank optional value must be sent as ''.
    middle_name: (validated.middle_name ?? '').trim(),
    last_name: validated.last_name,
    email: validated.email.toLowerCase(),
    school_course_id: validated.school_course_id || null,
    school_year: validated.school_year,
    gpa: validated.gpa ?? null,
    is_alumni: false,
    employee_education_id: null,
    registered_user_id: null,
    invitation_status: 'Not Sent',
    created_by: createdByUserId,
  };

  return await repo.createStudentRepo(payload);
}

import { getMyCourses, createMyCourse } from '@/modules/school-admin/services/school-admin.service';

export async function addBulkStudents(schoolId: number, createdByUserId: number, inputList: BulkStudentInput): Promise<VsSchoolStudent[]> {
  const validatedList = bulkStudentSchema.parse(inputList);

  // Fetch current courses for the school to resolve/auto-create
  let existingCourses = await getMyCourses(schoolId);

  // Map to cache course resolution: normalized key -> school_course_id
  const courseCache = new Map<string, number>();
  existingCourses.forEach((c) => {
    if (c.course_code) {
      courseCache.set(c.course_code.trim().toUpperCase(), c.school_course_id);
    }
    if (c.course_name) {
      courseCache.set(c.course_name.trim().toLowerCase(), c.school_course_id);
    }
  });

  const resolvedList: Partial<VsSchoolStudent>[] = [];

  for (const item of validatedList) {
    let resolvedCourseId = item.school_course_id || null;

    const codeKey = item.course_code ? item.course_code.trim().toUpperCase() : null;
    const nameKey = item.course_name ? item.course_name.trim().toLowerCase() : null;

    if (!resolvedCourseId) {
      if (codeKey && courseCache.has(codeKey)) {
        resolvedCourseId = courseCache.get(codeKey)!;
      } else if (nameKey && courseCache.has(nameKey)) {
        resolvedCourseId = courseCache.get(nameKey)!;
      } else if (codeKey || nameKey) {
        // Auto-create course in the school courses
        const courseName = item.course_name?.trim() || item.course_code?.trim() || 'General Course';
        const courseCode = item.course_code?.trim() || null;
        try {
          const newCourse = await createMyCourse(
            schoolId,
            {
              course_name: courseName,
              course_code: courseCode,
              degree: 'Bachelor',
              course_status: 'Active',
            },
            createdByUserId
          );
          resolvedCourseId = newCourse.school_course_id;
          if (courseCode) courseCache.set(courseCode.toUpperCase(), newCourse.school_course_id);
          courseCache.set(courseName.toLowerCase(), newCourse.school_course_id);
        } catch {
          // If auto-creation fails (e.g. duplicate constraint or DB issue), attempt refetching courses
          existingCourses = await getMyCourses(schoolId);
          const found = existingCourses.find((c) =>
            (courseCode && c.course_code?.toUpperCase() === courseCode.toUpperCase()) ||
            c.course_name?.toLowerCase() === courseName.toLowerCase()
          );
          if (found) {
            resolvedCourseId = found.school_course_id;
          }
        }
      }
    }

    resolvedList.push({
      school_id: schoolId,
      student_number: item.student_number || null,
      first_name: item.first_name,
      middle_name: (item.middle_name ?? '').trim(),
      last_name: item.last_name,
      email: item.email.toLowerCase(),
      school_course_id: resolvedCourseId,
      school_year: item.school_year,
      gpa: item.gpa ?? null,
      is_alumni: false,
      employee_education_id: null,
      registered_user_id: null,
      invitation_status: 'Not Sent',
      created_by: createdByUserId,
    });
  }

  return await repo.bulkCreateStudentsRepo(resolvedList);
}

export async function updateStudentAcademics(
  schoolId: number,
  studentId: number,
  input: unknown,
): Promise<VsSchoolStudent> {
  const parsed = updateRosterAcademicsSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first && first.path.length > 0 ? ` (${String(first.path[0])})` : '';
    throw new RosterHttpError(400, `Invalid roster update${where}: ${first?.message ?? 'rejected'}`);
  }

  const current = await repo.fetchStudentByIdRepo(studentId);
  if (!current || Number(current.school_id) !== Number(schoolId)) {
    throw new RosterHttpError(404, 'Student not found');
  }

  const { expected_updated_at, ...academics } = parsed.data;
  if (expected_updated_at !== undefined && String(current.updated_at ?? '') !== expected_updated_at) {
    throw new RosterHttpError(409, 'Stale roster row: refetch before editing');
  }

  const patch: Partial<VsSchoolStudent> = {};
  if (academics.student_number !== undefined) patch.student_number = academics.student_number;
  if (academics.gpa !== undefined) patch.gpa = academics.gpa;
  if (academics.school_year !== undefined) patch.school_year = academics.school_year;

  return await repo.updateStudentRepo(studentId, patch);
}

export async function removeStudentFromRoster(schoolId: number, studentId: number): Promise<boolean> {
  const current = await repo.fetchStudentByIdRepo(studentId);
  if (!current || Number(current.school_id) !== Number(schoolId)) {
    throw new RosterHttpError(404, 'Student not found');
  }
  if (current.employee_education_id !== null && current.employee_education_id !== undefined) {
    throw new RosterHttpError(409, 'Education-linked roster rows cannot be deleted');
  }
  return await repo.deleteStudentRepo(studentId);
}

export async function inviteStudentService(
  schoolId: number,
  studentId: number,
  originUrl: string
): Promise<{ token: string; invitation_url: string; expires_at: string; student: VsSchoolStudent }> {
  const student = await repo.getStudentByIdRepo(studentId);
  if (!student) {
    throw new RosterHttpError(404, 'Student not found');
  }

  if (Number(student.school_id) !== Number(schoolId)) {
    throw new RosterHttpError(404, 'Student not found');
  }

  if (student.employee_education_id !== null && student.employee_education_id !== undefined) {
    throw new RosterHttpError(409, 'Education-linked roster rows cannot be invited');
  }

  if (student.invitation_status === 'Registered') {
    throw new RosterHttpError(409, 'Student is already registered as a freelancer');
  }

  // Check for active unused token or create new
  let tokenRecord = await repo.findActiveStudentInvitationRepo(studentId, schoolId);

  if (!tokenRecord) {
    const crypto = await import('crypto');
    const token = crypto.randomBytes(24).toString('hex');
    const expiresDate = new Date();
    expiresDate.setDate(expiresDate.getDate() + 30);
    const expiresAt = expiresDate.toISOString().slice(0, 19).replace('T', ' ');

    tokenRecord = await repo.createStudentInvitationRepo(studentId, schoolId, token, expiresAt);

    // Update student status to Invited
    await repo.updateStudentRepo(studentId, {
      invitation_status: 'Invited',
      invited_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });
  }

  let effectiveOrigin = originUrl?.trim() || '';
  if (!effectiveOrigin || effectiveOrigin.includes('localhost') || effectiveOrigin.includes('127.0.0.1')) {
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o && !o.includes('localhost') && !o.includes('127.0.0.1'));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
    if (appUrl?.trim()) {
      effectiveOrigin = appUrl.trim();
    } else if (allowedOrigins.length > 0) {
      effectiveOrigin = allowedOrigins[0];
    }
  }

  const cleanOrigin = (effectiveOrigin || originUrl).replace(/\/$/, '');
  const invitationUrl = `${cleanOrigin}/student-register?token=${tokenRecord.token}`;

  // Dispatch Invitation Email
  if (student.email) {
    try {
      const { sendMail } = await import('@/lib/mail');
      await sendMail({
        to: student.email,
        subject: `🎓 You're invited to join LinkBridge Freelancer Network!`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #6366f1; margin: 0; font-size: 24px; font-weight: 800;">LinkBridge</h1>
              <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Student Career & Freelance Network</p>
            </div>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
              <h2 style="color: #0f172a; margin: 0 0 10px; font-size: 18px;">Hello ${student.first_name}!</h2>
              <p style="color: #334155; margin: 0; font-size: 14px; line-height: 1.5;">
                Your institution has registered you on LinkBridge. Activate your student freelancer account to showcase your skills, build your professional portfolio, and receive verified job recommendations and referrals from your school administrators.
              </p>
            </div>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${invitationUrl}" style="background-color: #6366f1; color: #ffffff; padding: 13px 32px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);">
                Activate Student Account
              </a>
            </div>

            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />

            <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0; line-height: 1.4;">
              This invitation link is unique to you and valid for 30 days.<br/>
              If the button does not work, copy and paste this URL into your browser:<br/>
              <span style="color: #6366f1; word-break: break-all;">${invitationUrl}</span>
            </p>
          </div>
        `,
      });
    } catch (mailErr) {
      console.warn(`[student-roster] Failed to send invitation email to ${student.email}:`, mailErr);
    }
  }

  return {
    token: tokenRecord.token,
    invitation_url: invitationUrl,
    expires_at: tokenRecord.expires_at,
    student,
  };
}
