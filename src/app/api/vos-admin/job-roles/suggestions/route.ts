// src/app/api/vos-admin/job-roles/suggestions/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import { getPHTimeString } from "@/lib/utils";
import { slugifyCode } from "@/modules/vos-admin/role-matching/validators";
import type {
  IntelligenceRequest,
  IntelligenceRequestStatus,
  ResolutionType,
} from "@/modules/vos-admin/role-matching/types";

import { safeErrorMessage } from "@/lib/api-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Normalize a raw `vs_role_category_suggestion` DB row into IntelligenceRequest. */
function normalizeRow(row: Record<string, unknown>): IntelligenceRequest {
  return {
    suggestion_id: Number(row.suggestion_id),
    job_id: row.job_id != null ? Number(row.job_id) : null,
    entity_type: "JOB_CATEGORY",
    source: "CLIENT",
    category_name: (row.category_name as string) ?? null,
    category_description: (row.category_description as string | null) ?? null,
    company_id: row.company_id != null ? Number(row.company_id) : null,
    suggested_by_user_id: row.suggested_by_user_id != null ? Number(row.suggested_by_user_id) : null,
    status: (row.status as IntelligenceRequestStatus) ?? "PENDING",
    resolution_type: (row.resolution_type as ResolutionType | null) ?? null,
    resolved_category_id: row.resolved_category_id != null ? Number(row.resolved_category_id) : null,
    admin_remarks: (row.admin_remarks as string | null) ?? null,
    reviewed_by: row.reviewed_by != null ? Number(row.reviewed_by) : null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

// ── GET /api/vos-admin/job-roles/suggestions ────────────────────────────────
// Query params:
//   status: PENDING | APPROVED | REJECTED (optional — omit for ALL)
export async function GET(req: NextRequest) {
  try {
    if (!(await requireAdministrator(req))) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    let url = `${DIRECTUS_BASE}/items/vs_role_category_suggestion?sort[]=-created_at&limit=-1`;

    if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
      url += `&filter[status][_eq]=${statusFilter}`;
    }

    const res = await fetch(url, { headers: getHeaders(), cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch intelligence requests.");

    const json = await res.json();
    const rows: Record<string, unknown>[] = json.data ?? [];
    const requests: IntelligenceRequest[] = rows.map(normalizeRow);

    return NextResponse.json({ requests });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Server error") },
      { status: 500 }
    );
  }
}

// ── PATCH /api/vos-admin/job-roles/suggestions ─────────────────────────────
// Body:
//   suggestion_id: number                           (required)
//   action: "APPROVE" | "REJECT"                    (required)
//   resolution_type?: "CREATED_NEW" | "MAPPED_EXISTING" | "REJECTED"
//   -- for CREATED_NEW --
//   category_name?: string
//   category_description?: string
//   category_code?: string
//   -- for MAPPED_EXISTING --
//   existing_category_id?: number
//   -- for all (mandatory for REJECT) --
//   admin_remarks?: string
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      suggestion_id,
      action,
      resolution_type,
      category_name,
      category_description,
      category_code,
      existing_category_id,
      admin_remarks,
    } = body as {
      suggestion_id?: number;
      action?: string;
      resolution_type?: ResolutionType;
      category_name?: string;
      category_description?: string;
      category_code?: string;
      existing_category_id?: number;
      admin_remarks?: string;
    };

    const suggestionId = toPositiveId(suggestion_id);
    if (!suggestionId) {
      return NextResponse.json({ error: "suggestion_id is required." }, { status: 400 });
    }
    if (!action || !["APPROVE", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "action must be APPROVE or REJECT." }, { status: 400 });
    }

    // 1. Fetch existing suggestion. Only 404 means it is gone; an outage
    // otherwise told the admin the suggestion had disappeared from the queue.
    const sgRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_role_category_suggestion/${suggestionId}`,
      { headers: getHeaders(), cache: "no-store" }
    );
    if (sgRes.status === 404) {
      return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
    }
    if (!sgRes.ok) {
      return NextResponse.json(
        { error: `The suggestion could not be read (${sgRes.status}). Please try again.` },
        { status: 502 }
      );
    }
    const sgData = (await sgRes.json()).data as Record<string, unknown>;
    if (!sgData) {
      return NextResponse.json({ error: "Suggestion not found." }, { status: 404 });
    }
    if (sgData.status !== "PENDING") {
      return NextResponse.json(
        { error: `Suggestion is already ${sgData.status}. Only PENDING suggestions can be reviewed.` },
        { status: 409 }
      );
    }

    const nowPH = getPHTimeString();
    const linkedJobId = sgData.job_id != null ? Number(sgData.job_id) : null;

    // The review decision is committed before the side writes below; each one
    // that fails is reported instead of being swallowed with a 200.
    const warnings: string[] = [];

    // ── APPROVE ──────────────────────────────────────────────────────────────
    if (action === "APPROVE") {
      // Option A: Map to Existing Category
      if (resolution_type === "MAPPED_EXISTING") {
        const catId = toPositiveId(existing_category_id);
        if (!catId) {
          return NextResponse.json(
            { error: "existing_category_id is required when mapping to an existing category." },
            { status: 400 }
          );
        }

        // Fetch existing category to get canonical name
        const catRes = await fetch(`${DIRECTUS_BASE}/items/vs_role_category/${catId}`, {
          headers: getHeaders(),
          cache: "no-store",
        });
        if (catRes.status === 404) {
          return NextResponse.json({ error: "Selected existing category does not exist." }, { status: 404 });
        }
        if (!catRes.ok) {
          return NextResponse.json(
            { error: `The selected category could not be read (${catRes.status}). Please try again.` },
            { status: 502 }
          );
        }
        const existingCat = (await catRes.json()).data;
        const canonicalName = existingCat?.category_name || (sgData.category_name as string);

        // Update linked job posting if present
        if (linkedJobId && !isNaN(linkedJobId)) {
          const linkRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${linkedJobId}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({
              category_id: catId,
              job_category: canonicalName,
              updated_at: nowPH,
            }),
          }).catch(() => null);
          if (!linkRes?.ok) {
            warnings.push(
              `The request was approved, but job #${linkedJobId} was not moved to "${canonicalName}".`
            );
          }
        }

        // Update suggestion status
        const statusRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_role_category_suggestion/${suggestionId}`,
          {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify({
              status: "APPROVED",
              resolution_type: "MAPPED_EXISTING",
              resolved_category_id: catId,
              admin_remarks: (admin_remarks ?? "").trim() || null,
              reviewed_by: auth.adminId,
              reviewed_at: nowPH,
              updated_at: nowPH,
            }),
          }
        ).catch(() => null);
        if (!statusRes?.ok) {
          warnings.push(
            "The category mapping is saved, but this request is still marked PENDING — its approval did not save."
          );
        }

        return NextResponse.json({
          success: true,
          action: "APPROVED",
          resolution_type: "MAPPED_EXISTING",
          suggestion_id: suggestionId,
          resolved_category_id: catId,
          linked_job_id: linkedJobId,
          ...(warnings.length > 0 ? { warnings } : {}),
        });
      }

      // Option B: Create New Category
      const finalName = (category_name ?? (sgData.category_name as string) ?? "").trim();
      if (!finalName) {
        return NextResponse.json({ error: "Category name is required to approve." }, { status: 400 });
      }

      const finalCode = (category_code ?? slugifyCode(finalName)).trim();
      const finalDesc = (category_description ?? (sgData.category_description as string | null) ?? "").trim();

      // Create official category
      const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_role_category`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          category_name: finalName,
          category_code: finalCode,
          description: finalDesc || null,
          is_active: true,
          created_at: nowPH,
          updated_at: nowPH,
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => "");
        return NextResponse.json(
          { error: `Failed to create official category. ${errText}` },
          { status: 502 }
        );
      }

      const createdCategory = (await createRes.json()).data;
      const createdCategoryId = Number(createdCategory?.category_id ?? createdCategory?.id);

      // Link job posting if present
      if (linkedJobId && !isNaN(linkedJobId) && createdCategoryId) {
        const linkRes = await fetch(`${DIRECTUS_BASE}/items/vs_job_posting/${linkedJobId}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({
            category_id: createdCategoryId,
            job_category: finalName,
            updated_at: nowPH,
          }),
        }).catch(() => null);
        if (!linkRes?.ok) {
          warnings.push(
            `The category was created, but job #${linkedJobId} was not moved to "${finalName}".`
          );
        }
      }

      // Update suggestion status
      const statusRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_role_category_suggestion/${suggestionId}`,
        {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({
            status: "APPROVED",
            resolution_type: "CREATED_NEW",
            resolved_category_id: createdCategoryId,
            admin_remarks: (admin_remarks ?? "").trim() || null,
            reviewed_by: auth.adminId,
            reviewed_at: nowPH,
            updated_at: nowPH,
          }),
        }
      ).catch(() => null);
      if (!statusRes?.ok) {
        // Approving again would POST a second copy of this category.
        warnings.push(
          `"${finalName}" was created, but this request is still marked PENDING. Do not approve it again — map it to the new category instead.`
        );
      }

      return NextResponse.json({
        success: true,
        action: "APPROVED",
        resolution_type: "CREATED_NEW",
        suggestion_id: suggestionId,
        resolved_category_id: createdCategoryId,
        linked_job_id: linkedJobId,
        created_category: createdCategory,
        ...(warnings.length > 0 ? { warnings } : {}),
      });
    }

    // ── REJECT ───────────────────────────────────────────────────────────────
    // Rejection requires admin remarks explaining why the taxonomy candidate was rejected
    const trimmedRemarks = (admin_remarks ?? "").trim();
    if (!trimmedRemarks) {
      return NextResponse.json(
        { error: "Rejection reason / admin remarks are required when rejecting a suggestion." },
        { status: 400 }
      );
    }

    const rejectRes = await fetch(
      `${DIRECTUS_BASE}/items/vs_role_category_suggestion/${suggestionId}`,
      {
        method: "PATCH",
        headers: getHeaders(),
        body: JSON.stringify({
          status: "REJECTED",
          resolution_type: "REJECTED",
          resolved_category_id: null,
          admin_remarks: trimmedRemarks,
          reviewed_by: auth.adminId,
          reviewed_at: nowPH,
          updated_at: nowPH,
        }),
      }
    );

    if (!rejectRes.ok) {
      throw new Error("Failed to update suggestion status.");
    }

    return NextResponse.json({
      success: true,
      action: "REJECTED",
      resolution_type: "REJECTED",
      suggestion_id: suggestionId,
      linked_job_id: linkedJobId,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(err, "Server error") },
      { status: 500 }
    );
  }
}
