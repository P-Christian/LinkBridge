// src/app/api/client/settings/team/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";
import { DirectusError, directusItems, directusSettled } from "@/lib/server/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ASSIGNABLE_ROLES = ["ADMIN", "MEMBER"];
const ASSIGNABLE_STATUSES = ["ACTIVE", "INACTIVE"];

async function getCompanyId(userId: number): Promise<number | null> {
  // Rejects on an unreadable link. Returning null here answered the roster with
  // "no members", which a recruiter reads as an empty team rather than an outage.
  const links = await directusItems<{ company_id: number }>("vs_company_user", {
    query: `filter[user_id][_eq]=${userId}&fields=company_id&limit=1`,
  });
  return links[0]?.company_id ?? null;
}

// ─── GET — Fetch company team members ─────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user." }, { status: 401 });
    }

    const companyId = await getCompanyId(userId);
    if (!companyId) {
      return NextResponse.json({ members: [] });
    }

    // Fetch company_user records
    const rawMembers = await directusItems<Record<string, unknown>>("vs_company_user", {
      query: `filter[company_id][_eq]=${companyId}&fields=company_user_id,company_id,user_id,company_user_role,is_primary_contact,status,created_at,user_id.user_fname,user_id.user_lname,user_id.user_email,user_id.user_contact,user_id.profile_image_url&limit=-1`,
    });

    const members = rawMembers.map((m) => {
      const u = (m.user_id as Record<string, unknown>) || {};
      return {
        company_user_id: m.company_user_id,
        company_id: m.company_id,
        user_id: typeof m.user_id === "object" ? (u.user_id ?? 0) : m.user_id,
        user_fname: u.user_fname ?? "Team",
        user_lname: u.user_lname ?? "Member",
        user_email: u.user_email ?? "",
        user_contact: u.user_contact ?? null,
        profile_image_url: u.profile_image_url ?? null,
        company_user_role: m.company_user_role ?? "MEMBER",
        is_primary_contact: m.is_primary_contact === 1 || m.is_primary_contact === true,
        status: m.status ?? "ACTIVE",
        created_at: m.created_at ?? null,
      };
    });

    return NextResponse.json({ members });
  } catch (err: unknown) {
    console.error("GET /api/client/settings/team error:", err);
    const upstream = err instanceof DirectusError;
    return NextResponse.json(
      {
        error: upstream
          ? "Team members could not be read. Please try again."
          : safeErrorMessage(err, "Internal server error"),
      },
      { status: upstream ? 502 : 500 }
    );
  }
}

// ─── PATCH — Modify team member role or active status ─────────────────────

async function getCompanyLink(
  userId: number
): Promise<{ company_id: number; company_user_role: string } | null> {
  // Rejects on an unreadable link. Answering null sent the caller down the
  // "No company linked." 403 branch, so an outage locked an owner out of their
  // own team settings and said the reason was their account.
  const links = await directusItems<{ company_id: number; company_user_role?: string | null }>(
    "vs_company_user",
    { query: `filter[user_id][_eq]=${userId}&fields=company_id,company_user_role&limit=1` }
  );
  const link = links[0];
  if (!link?.company_id) return null;
  return {
    company_id: Number(link.company_id),
    company_user_role: String(link.company_user_role ?? "").toUpperCase(),
  };
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const userId = Number(session.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return NextResponse.json({ error: "Invalid user." }, { status: 401 });
    }

    const callerLink = await getCompanyLink(userId);
    if (!callerLink) {
      return NextResponse.json({ error: "No company linked." }, { status: 403 });
    }
    if (callerLink.company_user_role !== "OWNER" && callerLink.company_user_role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const companyUserId = Number(body?.company_user_id);
    const role = body?.role;
    const status = body?.status;

    if (!Number.isSafeInteger(companyUserId) || companyUserId <= 0) {
      return NextResponse.json(
        { error: "company_user_id is required." },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {};
    if (role !== undefined) {
      const nextRole = String(role).toUpperCase();
      if (!ASSIGNABLE_ROLES.includes(nextRole)) {
        return NextResponse.json({ error: "Invalid role." }, { status: 400 });
      }
      updatePayload.company_user_role = nextRole;
    }
    if (status !== undefined) {
      const nextStatus = String(status).toUpperCase();
      if (!ASSIGNABLE_STATUSES.includes(nextStatus)) {
        return NextResponse.json({ error: "Invalid status." }, { status: 400 });
      }
      updatePayload.status = nextStatus;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const targetRes = await directusSettled<{
      data?: { company_user_id: number; company_id: number; company_user_role?: string | null };
    }>(`/items/vs_company_user/${companyUserId}`, {
      query: "fields=company_user_id,company_id,company_user_role",
    });
    if (!targetRes.ok) {
      // Only a real 404 may be reported as "not found" — anything else from
      // Directus is an outage, and the admin needs to know the row was not
      // checked rather than missing.
      if (targetRes.status !== 404) {
        console.error("Directus team member read error:", targetRes.error);
        return NextResponse.json(
          { error: "Team member could not be verified. Please try again." },
          { status: 502 }
        );
      }
      return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    }
    const target = targetRes.data?.data;
    if (!target || Number(target.company_id) !== callerLink.company_id) {
      return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    }
    if (String(target.company_user_role ?? "").toUpperCase() === "OWNER") {
      return NextResponse.json(
        { error: "The company owner cannot be modified." },
        { status: 403 }
      );
    }

    const patchRes = await directusSettled(`/items/vs_company_user/${companyUserId}`, {
      method: "PATCH",
      body: updatePayload,
    });

    if (!patchRes.ok) {
      console.error("Directus patch team error:", patchRes.error);
      return NextResponse.json(
        { error: "Failed to update team member role." },
        { status: patchRes.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("PATCH /api/client/settings/team error:", err);
    const upstream = err instanceof DirectusError;
    return NextResponse.json(
      {
        error: upstream
          ? "Team member could not be updated. Please try again."
          : safeErrorMessage(err, "Internal server error"),
      },
      { status: upstream ? 502 : 500 }
    );
  }
}
