import "server-only";

import { z } from "zod";
import { updatePendingEducation } from "./education-update.repo";

const EDUCATION_FIELDS = [
  "employee_education_id",
  "user_id",
  "school_id",
  "school_name_raw",
  "course_name_raw",
  "education_status",
  "school_course_id",
  "course_request_draft_key",
  "start_date",
  "end_date",
].join(",");

const educationRowSchema = z.object({
  employee_education_id: z.coerce.number().int().positive(),
  user_id: z.coerce.number().int().positive(),
  school_id: z.coerce.number().int().positive().nullable(),
  school_name_raw: z.string().nullable(),
  course_name_raw: z.string().nullable(),
  education_status: z.literal("Pending"),
  school_course_id: z.coerce.number().int().positive().nullable(),
  course_request_draft_key: z.uuid().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});

export type PersistedPendingEducation = z.infer<typeof educationRowSchema>;

export type PendingEducationWrite = {
  readonly school_id: number | null;
  readonly school_name_raw: string | null;
  readonly course_name_raw: string | null;
  readonly school_city_raw: string | null;
  readonly school_province_raw: string | null;
  readonly school_course_id: number | null;
  readonly course_request_draft_key: string | null;
  readonly start_date: string | null;
  readonly end_date: string | null;
};

export class EducationPersistenceError extends Error {
  public readonly name = "EducationPersistenceError";
}

function config(): { readonly baseUrl: string; readonly headers: Record<string, string> } {
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/u, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!baseUrl || !token) {
    throw new EducationPersistenceError("Education storage is not configured.");
  }
  return {
    baseUrl,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };
}

const courseSchema = z.object({
  school_course_id: z.coerce.number().int().positive(),
  school_id: z.coerce.number().int().positive(),
  course_status: z.literal("Active"),
});

async function requireActiveSameSchoolCourse(
  schoolId: number,
  schoolCourseId: number
): Promise<void> {
  const { baseUrl, headers } = config();
  const query = new URLSearchParams({
    fields: "school_course_id,school_id,course_status",
  });
  const response = await fetch(
    `${baseUrl}/items/vs_school_course/${schoolCourseId}?${query.toString()}`,
    { headers, cache: "no-store" }
  );
  if (!response.ok) {
    throw new EducationPersistenceError("The selected course is unavailable.");
  }
  const parsed = z.object({ data: courseSchema }).safeParse(await response.json());
  if (
    !parsed.success ||
    parsed.data.data.school_course_id !== schoolCourseId ||
    parsed.data.data.school_id !== schoolId
  ) {
    throw new EducationPersistenceError("The selected course is invalid for this school.");
  }
}

async function requireValidCourseClaim(input: PendingEducationWrite): Promise<void> {
  if (input.school_id !== null && input.school_course_id !== null) {
    await requireActiveSameSchoolCourse(input.school_id, input.school_course_id);
  }
}

async function fetchAnyStatusByDraftKey(draftKey: string): Promise<AnyStatusEducation | null> {
  const { baseUrl, headers } = config();
  const query = new URLSearchParams({ fields: EDUCATION_FIELDS, limit: "2" });
  query.set("filter[course_request_draft_key][_eq]", draftKey);
  const response = await fetch(`${baseUrl}/items/vs_employee_education?${query.toString()}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new EducationPersistenceError("Education storage is temporarily unavailable.");
  }
  const parsed = z
    .object({ data: z.array(educationAnyStatusSchema).max(2) })
    .safeParse(await response.json());
  if (!parsed.success) {
    throw new EducationPersistenceError("Education storage returned an invalid result.");
  }
  const rows = parsed.data.data;
  if (rows.length > 1) {
    throw new EducationPersistenceError("This education draft key is already in use.");
  }
  return rows[0] ?? null;
}

function toPersistedPending(row: AnyStatusEducation): PersistedPendingEducation {
  return {
    employee_education_id: row.employee_education_id,
    user_id: row.user_id,
    school_id: row.school_id,
    school_name_raw: row.school_name_raw,
    course_name_raw: row.course_name_raw,
    education_status: "Pending",
    school_course_id: row.school_course_id,
    course_request_draft_key: row.course_request_draft_key,
    start_date: row.start_date,
    end_date: row.end_date,
  };
}

function requireOwnedPending(row: AnyStatusEducation, userId: number): void {
  if (row.user_id !== userId || row.education_status !== "Pending") {
    throw new EducationPersistenceError("This education draft key is already in use.");
  }
}

async function reclaimOwnedPendingEducation(
  userId: number,
  row: AnyStatusEducation,
  input: PendingEducationWrite & { readonly course_request_draft_key: string }
): Promise<PersistedPendingEducation> {
  requireOwnedPending(row, userId);
  if (sameClaimAnyStatus(row, input)) return toPersistedPending(row);
  return updatePendingEducation(row.employee_education_id, userId, input);
}

export async function createOrFetchPendingEducation(
  userId: number,
  input: PendingEducationWrite & { readonly course_request_draft_key: string }
): Promise<PersistedPendingEducation> {
  await requireValidCourseClaim(input);
  const existing = await fetchAnyStatusByDraftKey(input.course_request_draft_key);
  if (existing) return reclaimOwnedPendingEducation(userId, existing, input);

  const { baseUrl, headers } = config();
  try {
    const response = await fetch(
      `${baseUrl}/items/vs_employee_education?fields=${encodeURIComponent(EDUCATION_FIELDS)}`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(pendingPayload(userId, input)),
        cache: "no-store",
      }
    );
    if (response.ok) {
      const parsed = z.object({ data: educationRowSchema }).safeParse(await response.json());
      if (parsed.success) {
        if (sameClaim(parsed.data.data, input)) return parsed.data.data;
        return updatePendingEducation(parsed.data.data.employee_education_id, userId, input);
      }
    }
  } catch (error: unknown) {
    if (error instanceof EducationPersistenceError) throw error;
  }

  const recovered = await fetchAnyStatusByDraftKey(input.course_request_draft_key);
  if (recovered) return reclaimOwnedPendingEducation(userId, recovered, input);
  throw new EducationPersistenceError("Education could not be saved.");
}

function sameClaim(row: PersistedPendingEducation, input: PendingEducationWrite): boolean {
  return (
    row.school_id === input.school_id &&
    row.school_name_raw === input.school_name_raw &&
    row.course_name_raw === input.course_name_raw &&
    row.school_course_id === input.school_course_id &&
    row.course_request_draft_key === input.course_request_draft_key &&
    row.start_date === input.start_date &&
    row.end_date === input.end_date
  );
}

function pendingPayload(userId: number, input: PendingEducationWrite): Record<string, unknown> {
  return {
    user_id: userId,
    school_id: input.school_id,
    school_name_raw: input.school_name_raw,
    course_name_raw: input.course_name_raw,
    education_status: "Pending",
    school_course_id: input.school_course_id,
    course_request_draft_key: input.course_request_draft_key,
    start_date: input.start_date,
    end_date: input.end_date,
  };
}

const educationAnyStatusSchema = z.object({
  employee_education_id: z.coerce.number().int().positive(),
  user_id: z.coerce.number().int().positive(),
  school_id: z.coerce.number().int().positive().nullable(),
  school_name_raw: z.string().nullable(),
  course_name_raw: z.string().nullable(),
  education_status: z.string(),
  school_course_id: z.coerce.number().int().positive().nullable(),
  course_request_draft_key: z.uuid().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
});

type AnyStatusEducation = z.infer<typeof educationAnyStatusSchema>;

function sameClaimAnyStatus(row: AnyStatusEducation, input: PendingEducationWrite): boolean {
  return (
    row.school_id === input.school_id &&
    row.school_name_raw === input.school_name_raw &&
    row.course_name_raw === input.course_name_raw &&
    row.school_course_id === input.school_course_id &&
    row.course_request_draft_key === input.course_request_draft_key &&
    row.start_date === input.start_date &&
    row.end_date === input.end_date
  );
}
