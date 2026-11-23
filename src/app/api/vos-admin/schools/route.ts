import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  SCHOOL_SEARCH_LIMIT,
  classifySearchRow,
  isBlankSearchTerm,
  schoolRouteCandidateSchema,
  searchClassifiedSchools,
} from "@/modules/vos-admin/school-verification/services/schoolRouteSearch.repo";
import { decideSchoolDraft } from "@/modules/vos-admin/school-verification/services/schoolDraftGuard";

const searchTermSchema = z
  .string()
  .trim()
  .min(1, "Search term must not be empty.")
  .max(100, "Search term must be at most 100 characters.");

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Access restricted to administrators" : "Unauthorized: Invalid or missing token" },
        { status: session ? 403 : 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("search");
    if (isBlankSearchTerm(raw)) {
      return NextResponse.json({ schools: [] });
    }
    const termResult = searchTermSchema.safeParse(raw);
    if (!termResult.success) {
      const [firstIssue] = termResult.error.issues;
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid search term." },
        { status: 400 }
      );
    }

    const schools = await searchClassifiedSchools(termResult.data);
    const parsed = schoolRouteCandidateSchema
      .array()
      .max(SCHOOL_SEARCH_LIMIT)
      .parse(schools);
    return NextResponse.json({ schools: parsed });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const [firstIssue] = error.issues;
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid school data." },
        { status: 400 }
      );
    }
    // Sanitized dependency failure: never leak storage internals.
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }
}

// The system never auto-creates a school row from freelancer free text;
// only this endpoint creates exactly one normalized placeholder per identity.

function directusBase(): string {
  return (
    process.env.DIRECTUS_URL || process.env.NEXT_PUBLIC_API_BASE_URL || ""
  ).replace(/\/$/, "");
}

function directusHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const token = process.env.DIRECTUS_STATIC_TOKEN;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

const placeholderBodySchema = z.object({
  school_name: z
    .string()
    .trim()
    .min(1, "School name must not be empty.")
    .max(200, "School name must be at most 200 characters."),
  city_municipality: z
    .string()
    .trim()
    .max(100, "City/municipality must be at most 100 characters.")
    .optional()
    .nullable(),
  province: z
    .string()
    .trim()
    .max(100, "Province must be at most 100 characters.")
    .optional()
    .nullable(),
});

const placeholderRowSchema = z.object({
  school_id: z.number().int(),
  school_name: z.string(),
  city_municipality: z.string().nullable(),
  province: z.string().nullable(),
  school_status: z.string(),
  verification_status: z.string(),
  is_active: z.union([z.boolean(), z.number(), z.string()]).optional(),
});

const placeholderAdminRowSchema = z.object({
  school_id: z.union([
    z.number().int(),
    z.object({ school_id: z.number().int() }),
  ]),
  is_active: z.union([z.boolean(), z.number(), z.string()]).optional(),
});

/** Collapse internal whitespace and trim; comparison additionally lowercases. */
function normalizeIdentityPart(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Access restricted to administrators" : "Unauthorized: Invalid or missing token" },
        { status: session ? 403 : 401 }
      );
    }
    const adminId = Number(session.userId);

    const raw = (await req.json()) as unknown;
    const parsed = placeholderBodySchema.safeParse(raw);
    if (!parsed.success) {
      const [firstIssue] = parsed.error.issues;
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid placeholder input." },
        { status: 400 }
      );
    }

    const schoolName = normalizeIdentityPart(parsed.data.school_name);
    if (schoolName === "") {
      return NextResponse.json(
        { error: "School name must not be empty." },
        { status: 400 }
      );
    }
    const city = parsed.data.city_municipality?.trim() || null;
    const province = parsed.data.province?.trim() || null;

    const base = directusBase();
    if (!base) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    // Scan every school BEFORE creating anything: the school name is the
    // identity and location only disambiguates. Any name match fails closed
    // into reuse or VOS resolution (409); only with no match is a
    // placeholder created.
    const PAGE_SIZE = 500;
    const MAX_ROWS = 20000;
    const allRows: Array<z.infer<typeof placeholderRowSchema>> = [];
    let offset = 0;
    for (;;) {
      const pageQuery = new URLSearchParams({
        fields:
          "school_id,school_name,city_municipality,province,school_status,verification_status,is_active",
        sort: "school_id",
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const pageRes = await fetch(`${base}/items/vs_school?${pageQuery.toString()}`, {
        headers: directusHeaders(),
        cache: "no-store",
      });
      if (!pageRes.ok) {
        return NextResponse.json(
          { error: "Service temporarily unavailable" },
          { status: 503 }
        );
      }
      const pageJson = (await pageRes.json()) as unknown;
      const pageRows = z
        .object({ data: z.array(placeholderRowSchema) })
        .parse(pageJson).data;
      allRows.push(...pageRows);
      if (allRows.length > MAX_ROWS) {
        return NextResponse.json(
          { error: "Service temporarily unavailable" },
          { status: 503 }
        );
      }
      if (pageRows.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    const decision = decideSchoolDraft(allRows, {
      school_name: schoolName,
      city_municipality: city,
      province,
    });

    const toCandidate = async (
      row: z.infer<typeof placeholderRowSchema>
    ): Promise<z.infer<typeof schoolRouteCandidateSchema> | null> => {
      const adminQuery = new URLSearchParams({
        "filter[school_id][_eq]": String(row.school_id),
        "filter[is_active][_eq]": "1",
        fields: "school_id,is_active",
        limit: "1",
      });
      const adminRes = await fetch(
        `${base}/items/vs_school_admin?${adminQuery.toString()}`,
        { headers: directusHeaders(), cache: "no-store" }
      );
      if (!adminRes.ok) return null;
      const adminJson = (await adminRes.json()) as unknown;
      const admins = z
        .object({ data: z.array(placeholderAdminRowSchema) })
        .parse(adminJson).data;
      const hasActiveAdmin = admins.some(
        (admin) => admin.is_active === true || admin.is_active === 1
      );
      const route = classifySearchRow(row, hasActiveAdmin);
      if (route === null) return null;
      return schoolRouteCandidateSchema.parse({
        school_id: row.school_id,
        school_name: row.school_name,
        city_municipality: row.city_municipality,
        province: row.province,
        school_status: row.school_status,
        verification_route: route,
      });
    };

    if (decision.kind === "invalid-name") {
      return NextResponse.json(
        { error: "School name must not be empty." },
        { status: 400 }
      );
    }
    if (decision.kind === "reuse") {
      const full = allRows.find((row) => row.school_id === decision.row.school_id);
      if (!full) {
        return NextResponse.json(
          { error: "Service temporarily unavailable" },
          { status: 503 }
        );
      }
      const candidate = await toCandidate(full);
      if (candidate === null) {
        return NextResponse.json(
          {
            error:
              "A school with this name already exists but cannot be selected. Resolve it in VOS before proceeding.",
            code: "NOT_SELECTABLE",
            school: {
              school_id: decision.row.school_id,
              school_name: decision.row.school_name,
              city_municipality: decision.row.city_municipality,
              province: decision.row.province,
            },
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ school: candidate, reused: true });
    }
    if (decision.kind === "location-conflict") {
      return NextResponse.json(
        {
          error:
            "A school with this name already exists in a different location. Use the existing school or resolve the location in VOS.",
          code: "LOCATION_CONFLICT",
          school: {
            school_id: decision.row.school_id,
            school_name: decision.row.school_name,
            city_municipality: decision.row.city_municipality,
            province: decision.row.province,
          },
        },
        { status: 409 }
      );
    }
    if (decision.kind === "ambiguous") {
      return NextResponse.json(
        {
          error:
            "Multiple schools match this name. Resolve the ambiguity in VOS before creating a draft.",
          code: decision.code,
          candidates: decision.rows.map((row) => ({
            school_id: row.school_id,
            school_name: row.school_name,
            city_municipality: row.city_municipality,
            province: row.province,
          })),
        },
        { status: 409 }
      );
    }

    // No name match: create one Draft placeholder row.
    // vs_school requires a non-null school_type and location, so an
    // unclassified placeholder uses 'Other' and empty strings.
    const createRes = await fetch(`${base}/items/vs_school`, {
      method: "POST",
      headers: directusHeaders(),
      body: JSON.stringify({
        school_name: schoolName,
        school_type: "Other",
        city_municipality: city ?? "",
        province: province ?? "",
        school_status: "Draft",
        verification_status: "DRAFT",
        is_active: true,
        profile_completion_percent: 0,
        created_by: adminId,
      }),
    });
    const createJson = (await createRes.json()) as unknown;
    if (!createRes.ok) {
      console.error(
        "POST /api/vos-admin/schools placeholder create failed:",
        createRes.status,
        JSON.stringify(createJson)
      );
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }
    const created = z.object({ data: placeholderRowSchema }).parse(createJson).data;
    const candidate = await toCandidate(created);
    if (candidate === null) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }
    return NextResponse.json({ school: candidate, reused: false }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const [firstIssue] = error.issues;
      return NextResponse.json(
        { error: firstIssue?.message ?? "Invalid school data." },
        { status: 400 }
      );
    }
    console.error("POST /api/vos-admin/schools failed:", error);
    // Sanitized dependency failure: never leak storage internals.
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }
}
