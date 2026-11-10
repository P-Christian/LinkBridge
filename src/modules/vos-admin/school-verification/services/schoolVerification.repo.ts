// src/modules/vos-admin/school-verification/services/schoolVerification.repo.ts
import { directusItems, directusItemsWhereIn, directusRequest } from "@/lib/server/directus";

export async function fetchSchoolsRepo(status?: string, search?: string): Promise<Record<string, unknown>[]> {
  const filter: Record<string, unknown> = {};

  if (status && status.toUpperCase() !== "ALL") {
    filter.verification_status = { _eq: status };
  }

  if (search && search.trim()) {
    const q = search.trim();
    filter._or = [
      { school_name: { _icontains: q } },
      { school_email: { _icontains: q } },
      { city_municipality: { _icontains: q } },
      { province: { _icontains: q } },
      { school_type: { _icontains: q } },
    ];
  }

  const queries: string[] = ["sort=-created_at", "limit=-1"];
  if (Object.keys(filter).length > 0) {
    queries.push(`filter=${encodeURIComponent(JSON.stringify(filter))}`);
  }

  return directusItems("vs_school", { query: queries.join("&") });
}

export async function fetchSchoolByIdRepo(schoolId: number): Promise<Record<string, unknown> | null> {
  const rows = await directusItems("vs_school", {
    query: `filter[school_id][_eq]=${schoolId}&limit=1`,
  });
  return rows[0] ?? null;
}

export async function fetchSchoolDocumentsRepo(schoolIds: number[]): Promise<Record<string, unknown>[]> {
  if (schoolIds.length === 0) return [];
  return directusItemsWhereIn("vs_school_document", "school_id", schoolIds, "*");
}

export async function fetchSchoolCoursesRepo(schoolIds: number[]): Promise<Record<string, unknown>[]> {
  if (schoolIds.length === 0) return [];
  return directusItemsWhereIn("vs_school_course", "school_id", schoolIds, "*", {
    extra: "sort=-created_at",
  });
}

export async function fetchCoursesBySchoolRepo(schoolId: number): Promise<Record<string, unknown>[]> {
  return directusItems("vs_school_course", {
    query: `filter[school_id][_eq]=${schoolId}&sort=-created_at&limit=-1`,
  });
}

/**
 * Every read here feeds a verification decision, so a failed one throws instead
 * of returning an empty list. "No documents / no admins / no ID submission" is
 * evidence the moderator acts on; an outage must not be allowed to produce it.
 */
export async function fetchSchoolAdminsRepo(
  schoolIds: number[],
  additionalUserIds: number[] = []
): Promise<{
  admins: Record<string, unknown>[];
  users: Record<string, unknown>[];
  identityVerifications: Record<string, unknown>[];
}> {
  if (schoolIds.length === 0) return { admins: [], users: [], identityVerifications: [] };

  const admins = await directusItemsWhereIn("vs_school_admin", "school_id", schoolIds, "*");

  const uids = Array.from(
    new Set(
      [
        ...admins.map((a) => {
          const raw = typeof a.user_id === "object" && a.user_id !== null ? (a.user_id as Record<string, unknown>).user_id : a.user_id;
          return Number(raw);
        }),
        ...additionalUserIds,
      ].filter(Boolean)
    )
  );

  if (uids.length === 0) return { admins, users: [], identityVerifications: [] };

  const [users, identityVerifications] = await Promise.all([
    directusItemsWhereIn("vs_user", "user_id", uids, "*"),
    directusItemsWhereIn("vs_identity_verifications", "user_id", uids, "*"),
  ]);

  return { admins, users, identityVerifications };
}

export async function patchSchoolRepo(schoolId: number, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const envelope = await directusRequest<{ data?: Record<string, unknown> }>(
    `/items/vs_school/${schoolId}`,
    { method: "PATCH", body: payload }
  );
  return envelope?.data ?? {};
}

export async function patchUserRepo(userId: number, payload: Record<string, unknown>): Promise<void> {
  await directusRequest(`/items/vs_user/${userId}`, { method: "PATCH", body: payload });
}

export async function patchIdentityVerificationsRepo(userId: number, payload: Record<string, unknown>): Promise<void> {
  const rows = await directusItems("vs_identity_verifications", {
    query: `filter[user_id][_eq]=${userId}&sort=-submitted_at&limit=1`,
  });
  const latest = rows[0];
  const id = latest?.id;
  if (!id) return;
  await directusRequest(`/items/vs_identity_verifications/${id}`, { method: "PATCH", body: payload });
}

export async function createAuditTrailRepo(payload: Record<string, unknown>): Promise<void> {
  await directusRequest("/items/vs_audit_trail", { method: "POST", body: payload });
}
