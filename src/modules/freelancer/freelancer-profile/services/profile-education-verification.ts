import "server-only";

import { z } from "zod";

import type {
  FreelancerProfile,
  VsEducation,
} from "../types/freelancer-profile.types";

const COURSE_REQUEST_FIELDS =
  "course_request_id,employee_education_id,request_status,admin_remarks,created_at";
const SCHOOL_REQUEST_FIELDS =
  "school_request_id,employee_education_id,request_status,city_municipality,province,created_at";

const courseRequestRowSchema = z.object({
  course_request_id: z.number().int().positive(),
  employee_education_id: z.number().int().positive(),
  request_status: z.enum(["Pending", "RoutedToSchool", "Approved", "Rejected"]),
  admin_remarks: z.string().nullable(),
  created_at: z.string(),
});

const schoolRequestRowSchema = z.object({
  school_request_id: z.number().int().positive(),
  employee_education_id: z.number().int().positive(),
  // Tolerant read: an unrecognized status is never treated as a rejection.
  request_status: z.string(),
  city_municipality: z.string().nullable(),
  province: z.string().nullable(),
  created_at: z.string(),
});

type CourseRequestRow = z.infer<typeof courseRequestRowSchema>;
type SchoolRequestRow = z.infer<typeof schoolRequestRowSchema>;

interface LatestQuery<Row> {
  readonly collection: string;
  readonly fields: string;
  readonly sort: string;
  readonly schema: z.ZodType<Row>;
}

function educationId(education: VsEducation): number | null {
  const id = education.employee_education_id ?? education.id;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

/** Newest row per education. Rows are already sorted newest-first by Directus. */
async function fetchLatestByEducation<Row extends { employee_education_id: number }>(
  query: LatestQuery<Row>,
  educationIds: readonly number[],
): Promise<Map<number, Row>> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Directus API URL or Static Token is not configured.");
  }

  const url = new URL(`${baseUrl}/items/${query.collection}`);
  url.searchParams.set("filter[employee_education_id][_in]", educationIds.join(","));
  url.searchParams.set("fields", query.fields);
  url.searchParams.set("sort", query.sort);
  url.searchParams.set("limit", "-1");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${query.collection} from Directus: HTTP ${response.status}`,
    );
  }

  const parsed = z
    .object({ data: z.array(query.schema) })
    .parse(await response.json());

  const latest = new Map<number, Row>();
  for (const row of parsed.data) {
    if (!latest.has(row.employee_education_id)) {
      latest.set(row.employee_education_id, row);
    }
  }
  return latest;
}

function rejectionReason(remarks: string | null | undefined): string {
  const trimmed = remarks?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "No rejection reason was provided.";
}

/**
 * Correlates each education row with its latest attendance (school) request and
 * course request by the exact `employee_education_id`. A rejected school request
 * marks the row as attendance-rejected so the profile can omit it; a rejected
 * course request is recorded separately so the profile can omit the course while
 * keeping the verified attendance. Never mutates `education_status`.
 */
export async function attachEducationVerification(
  profile: FreelancerProfile,
): Promise<FreelancerProfile> {
  const education = profile.education ?? [];
  const educationIds = education
    .map(educationId)
    .filter((id): id is number => id !== null);
  if (educationIds.length === 0) return profile;

  const [courseRequests, schoolRequests] = await Promise.all([
    fetchLatestByEducation<CourseRequestRow>(
      {
        collection: "vs_course_request",
        fields: COURSE_REQUEST_FIELDS,
        sort: "-created_at,-course_request_id",
        schema: courseRequestRowSchema,
      },
      educationIds,
    ),
    fetchLatestByEducation<SchoolRequestRow>(
      {
        collection: "vs_school_request",
        fields: SCHOOL_REQUEST_FIELDS,
        sort: "-created_at,-school_request_id",
        schema: schoolRequestRowSchema,
      },
      educationIds,
    ),
  ]);

  return {
    ...profile,
    education: education.map((item) => {
      const id = educationId(item);
      const courseRequest = id === null ? undefined : courseRequests.get(id);
      const schoolRequest = id === null ? undefined : schoolRequests.get(id);
      const attendanceRejected = schoolRequest?.request_status === "Rejected";
      return {
        ...item,
        school_city_raw: schoolRequest?.city_municipality ?? null,
        school_province_raw: schoolRequest?.province ?? null,
        attendance_rejected: attendanceRejected,
        course_verification: !attendanceRejected && courseRequest
          ? {
              status: courseRequest.request_status,
              remarks:
                courseRequest.request_status === "Rejected"
                  ? rejectionReason(courseRequest.admin_remarks)
                  : null,
            }
          : null,
      };
    }),
  };
}
