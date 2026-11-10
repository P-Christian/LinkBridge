// src/app/api/client/saved-talent/route.ts

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isClientSession } from "@/lib/authenticated-session";
import { checkCompanyVerificationStatus } from "@/lib/status-validator";
import { getPHTimeString } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/api-error";
import {
  DirectusError,
  directusItems,
  directusItemsWhereIn,
  directusSettled,
} from "@/lib/server/directus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SavedRow {
  saved_applicant_id: number;
  applicant_user_id: number;
  notes?: string | null;
  created_at?: string | null;
}

interface SavedUser {
  user_id: number;
  user_fname?: string | null;
  user_lname?: string | null;
  user_email?: string | null;
  profile_image_url?: string | null;
  user_city?: string | null;
  user_province?: string | null;
}

interface SavedProfile {
  user_id: number;
  profile_headline?: string | null;
  profile_visibility?: string | null;
}

interface SavedSkillRow {
  user_id: number;
  skill_id?: { skill_name?: string } | null;
}

function maskEmail(email?: string | null): string {
  if (!email || typeof email !== "string") return "";
  const parts = email.trim().split("@");
  if (parts.length !== 2) return "***";
  const [name, domain] = parts;
  if (name.length <= 2) return `${name.slice(0, 1)}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

// GET — list all saved talents for this company
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
    const { isVerified, verification_status, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified) {
      return NextResponse.json({ error: `Company not verified: ${verification_status}`, saved: [] }, { status: 403 });
    }

    if (!companyId) {
      return NextResponse.json({ saved: [] });
    }

    const savedRows = await directusItems<SavedRow>("vs_saved_applicant", {
      query: `filter[company_id][_eq]=${companyId}&fields=saved_applicant_id,applicant_user_id,notes,created_at&sort[]=-created_at&limit=-1`,
    });

    if (savedRows.length === 0) {
      return NextResponse.json({ saved: [] });
    }

    const userIds = savedRows.map((s) => s.applicant_user_id);

    // Fetch basic user info + profile + skills
    const [users, profiles, skillRows] = await Promise.all([
      directusItemsWhereIn<SavedUser>("vs_user", "user_id", userIds,
        "user_id,user_fname,user_lname,user_email,profile_image_url,user_city,user_province"),
      directusItemsWhereIn<SavedProfile>("vs_job_seeker_profile", "user_id", userIds,
        "user_id,profile_headline,profile_visibility"),
      directusItemsWhereIn<SavedSkillRow>("vs_user_skills_map", "user_id", userIds,
        "user_id,skill_id.skill_name"),
    ]);

    const usersMap = new Map(users.map((u) => [u.user_id, u]));
    const profilesMap = new Map(profiles.map((p) => [p.user_id, p]));
    const skillsMap = new Map<number, string[]>();
    for (const row of skillRows) {
      const name = row.skill_id?.skill_name;
      if (!name) continue;
      if (!skillsMap.has(row.user_id)) skillsMap.set(row.user_id, []);
      skillsMap.get(row.user_id)!.push(name);
    }

    // A bookmark does not override the freelancer's visibility choice: only the
    // two employer-visible values are readable here.
    const saved = savedRows
      .filter((s) => {
        const vis = profilesMap.get(s.applicant_user_id)?.profile_visibility;
        return vis === "Public" || vis === "Recruiters Only";
      })
      .map((s) => {
        const user = usersMap.get(s.applicant_user_id);
        const profile = profilesMap.get(s.applicant_user_id);
        return {
          id: s.saved_applicant_id,
          talent_user_id: s.applicant_user_id,
          notes: s.notes ?? null,
          created_at: s.created_at ?? null,
          name: user ? `${user.user_fname} ${user.user_lname}`.trim() : `Talent #${s.applicant_user_id}`,
          email: user?.user_email ? maskEmail(user.user_email) : null,
          profile_image_url: user?.profile_image_url ?? null,
          location: [user?.user_city, user?.user_province].filter(Boolean).join(", ") || null,
          headline: profile?.profile_headline ?? null,
          skills: skillsMap.get(s.applicant_user_id) ?? [],
        };
      });

    return NextResponse.json({ saved });
  } catch (err: unknown) {
    const upstream = err instanceof DirectusError;
    console.error("[saved-talent GET] Error:", err);
    // The three attach reads used to answer `[]`, so an outage rendered every
    // bookmark as "Talent #123" with no headline and no skills — the shortlist
    // looked like a list of strangers rather than an unreadable one.
    return NextResponse.json(
      {
        error: upstream
          ? "Saved talent could not be read. Please try again."
          : safeErrorMessage(err, "Internal server error"),
      },
      { status: upstream ? 502 : 500 }
    );
  }
}

// POST — save a talent
export async function POST(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (!isClientSession(session)) {
      return NextResponse.json({ error: "Client account required." }, { status: 403 });
    }

    const userId = Number(session.userId);
    const { isVerified, verification_status, companyId } = await checkCompanyVerificationStatus(userId);
    if (!isVerified) {
      return NextResponse.json({ error: `Company not verified: ${verification_status}` }, { status: 403 });
    }

    if (!companyId) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const body = await req.json();
    const { talent_user_id, notes } = body;

    const talentUserIdNum = Number(talent_user_id);
    if (!talentUserIdNum || isNaN(talentUserIdNum)) {
      return NextResponse.json({ error: "Valid talent_user_id is required." }, { status: 400 });
    }

    // Check if already saved
    const existing = await directusItems<{ saved_applicant_id: number }>("vs_saved_applicant", {
      query: `filter[company_id][_eq]=${companyId}&filter[applicant_user_id][_eq]=${talentUserIdNum}&fields=saved_applicant_id&limit=1`,
    });
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Talent already saved.", already_saved: true },
        { status: 409 }
      );
    }

    const nowPH = getPHTimeString();
    const sanitizedNotes = typeof notes === "string" ? notes.trim().slice(0, 1000) : null;

    const createRes = await directusSettled<{ data?: Record<string, unknown> }>(
      "/items/vs_saved_applicant",
      {
        method: "POST",
        body: {
          company_id: companyId,
          applicant_user_id: talentUserIdNum,
          notes: sanitizedNotes,
          created_by: userId,
          created_at: nowPH,
          updated_at: nowPH,
        },
      }
    );

    if (!createRes.ok) {
      console.error("[saved-talent POST] Failed to save talent in Directus:", createRes.error);
      return NextResponse.json({ error: "Failed to save talent." }, { status: 502 });
    }

    const created = createRes.data?.data;
    return NextResponse.json({ success: true, saved: created }, { status: 201 });
  } catch (err: unknown) {
    console.error("[saved-talent POST] Error:", err);
    const upstream = err instanceof DirectusError;
    return NextResponse.json(
      { error: upstream ? "Talent could not be saved. Please try again." : "Internal server error." },
      { status: upstream ? 502 : 500 }
    );
  }
}

