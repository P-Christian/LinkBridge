import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSchoolRequests } from "@/modules/vos-admin/request-management";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";

// Plan 2 Todo 4: the school-request LIST status filter is exactly
// 'ALL' | RequestStatus (FOUR statuses). Line 133 (Final contract override)
// supersedes any five-status/SchoolRequestStatus wording elsewhere.
const listStatusSchema = z.enum([
  "ALL",
  "Pending",
  "Approved",
  "Rejected",
  "RoutedToSchool",
]);

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
    const statusResult = listStatusSchema.safeParse(
      searchParams.get("status") || "ALL"
    );
    if (!statusResult.success) {
      const [firstIssue] = statusResult.error.issues;
      return NextResponse.json(
        { error: firstIssue?.message ?? "Unknown list status." },
        { status: 400 }
      );
    }

    const requests = await getSchoolRequests(statusResult.data);
    return NextResponse.json({ requests });
  } catch {
    // Sanitized dependency failure: never leak storage internals.
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }
}
