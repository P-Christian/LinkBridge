import { NextRequest, NextResponse } from "next/server";
import { getMySchool, updateMySchool } from "@/modules/school-admin/services/school-admin.service";
import { updateSchoolProfileSchema } from "@/modules/school-admin/school-profile/types/school-profile.schema";
import { checkRestriction } from "@/lib/status-validator";
import { authenticateCookieSession } from "@/lib/authenticated-session";

/**
 * Closed-world PATCH body (SEC-035): only the profile columns the school
 * dashboard edits are forwarded. Verification, status, audit and ownership
 * keys are rejected instead of reaching the Directus spread, so a school admin
 * can no longer self-verify or flip their own suspension.
 */
const strictUpdateSchoolBodySchema = updateSchoolProfileSchema.partial().strict();

async function getUserIdFromToken() {
  const session = await authenticateCookieSession();
  return session ? Number(session.userId) : null;
}

export async function GET() {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const school = await getMySchool(userId);
    if (!school) return NextResponse.json({ error: "School not found." }, { status: 404 });

    return NextResponse.json({ school });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getUserIdFromToken();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Validate UPDATE_SCHOOL Restriction
    const isRestricted = await checkRestriction(userId, "UPDATE_SCHOOL");
    if (isRestricted) {
      return NextResponse.json(
        { error: "Your school modification privileges are temporarily suspended." },
        { status: 403 }
      );
    }

    const school = await getMySchool(userId);
    if (!school) return NextResponse.json({ error: "School not found." }, { status: 404 });

    const parsed = strictUpdateSchoolBodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid school profile payload." }, { status: 400 });
    }

    const updated = await updateMySchool(school.school_id, parsed.data, userId);

    return NextResponse.json({ school: updated });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
