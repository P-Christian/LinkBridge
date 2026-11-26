import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { listActiveCourseCandidates, listCourseRequestInbox } from "@/modules/school-admin/course-requests";
import { requireSchoolAdminSession, toErrorResponse } from "./_http";
import { attachSubmitterNames } from "./_submitter";

/**
 * GET /api/school-admin/course-requests
 *
 * Role-authorized, exactly-scoped School Admin inbox. The SCHOOL_ADMIN role
 * and the exact-one active assignment are resolved server-side BEFORE any
 * request or course query. Returns exactly
 * `{ inbox: { schoolId, routed, finalizing, courses } }` for the caller's own
 * school: actionable `RoutedToSchool` decisions, recoverable claim-locked
 * `RoutedToSchool` finalizing rows, and Active same-school candidates. No
 * other school's rows or courses are disclosed, and no requester
 * identity beyond the name-only label is exposed.
 *
 * The name-only `submitterName` label is attached here at the route boundary,
 * keeping the domain module identity-free: the allowlisted fields are domain
 * parsed first, and the resolved label is spread in only after that parse has
 * already succeeded.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireSchoolAdminSession(req);
    const ctx = { userId: session.userId, schoolId: session.schoolId };
    const [listing, courses] = await Promise.all([
      listCourseRequestInbox(ctx),
      listActiveCourseCandidates(ctx),
    ]);
    return NextResponse.json({ inbox: await attachSubmitterNames(ctx, listing, courses) });
  } catch (error: unknown) {
    return toErrorResponse(error);
  }
}
