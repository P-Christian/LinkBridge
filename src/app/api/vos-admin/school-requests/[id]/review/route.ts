import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  fetchSchoolRequestById,
  groupSchoolRequestDecision,
  rejectSchoolRequestDecision,
  reviewSchoolRequest,
  reviewSchoolRequestSchema,
  reviewSchoolRoutingSchema,
  routeSchoolRequestDecision,
} from "@/modules/vos-admin/request-management";
import type { VsSchoolRequest } from "@/modules/vos-admin/request-management";
import {
  SchoolRequestRoutingError,
  parseRouteAudit,
} from "@/modules/school-request-routing";
import { fetchSchoolRequest as fetchRoutingSchoolRequest } from "@/modules/school-request-routing";
import {
  EDUCATION_FLOW_UNAVAILABLE_MESSAGE,
  EducationFlowUnavailableError,
  EducationVerificationModeError,
  getEducationVerificationMode,
} from "@/modules/education-verification";

// Plan 2 Todo 4 discriminated decision body: the legacy approve/reject union
// plus the Todo 3 attendance-mode Route/Group/Reject union. Both unions are
// Todo 2/3-owned and already exported through the request-management barrel,
// so they are composed here without editing those modules. The shared
// 'Rejected' literal is mode-dispatched below (legacy approval vs routing
// rejection); 'Approved' is legacy-only and 'Route'/'Group' are
// attendance-only.
const reviewDecisionSchema = z.union([
  reviewSchoolRequestSchema,
  reviewSchoolRoutingSchema,
]);

type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

const LEGACY_VALIDATION_MESSAGES: ReadonlySet<string> = new Set([
  "A matched school ID is required when approving a school request.",
  "Admin remarks are required when rejecting a school request.",
]);

function unsupportedInLegacy(): SchoolRequestRoutingError {
  return new SchoolRequestRoutingError(
    "UNSUPPORTED_ACTION",
    "Route, Group, and Reject are unavailable in legacy mode.",
    409
  );
}

function unsupportedInAttendance(): SchoolRequestRoutingError {
  return new SchoolRequestRoutingError(
    "UNSUPPORTED_ACTION",
    "Legacy school-request approval is unavailable in attendance mode.",
    409
  );
}

// Exact manual-route replay converges here without writing: the Todo 3
// service binds the legacy education link before routing, so a replay of an
// already-routed row would trip the Pending-only bind guard instead of
// reaching the primitive's converged path. The predicate mirrors
// `routeReplay` (same target + same actor + identical persisted manual
// audit, no claim audit); anything else falls through to the service, which
// owns all conflict reporting. Dependency failures propagate to the 503
// mapping below.
async function convergeManualRouteReplay(
  requestId: number,
  targetSchoolId: number,
  adminId: number
): Promise<VsSchoolRequest | null> {
  const current = await fetchRoutingSchoolRequest(requestId);
  if (
    current.request_status !== "RoutedToSchool" ||
    current.matched_school_id !== targetSchoolId ||
    current.routed_by !== adminId ||
    current.reviewed_by !== null ||
    current.reviewed_at !== null ||
    current.admin_remarks !== null
  ) {
    return null;
  }
  try {
    const audit = parseRouteAudit(current);
    if (audit.kind !== "manual") return null;
  } catch {
    return null;
  }
  return fetchSchoolRequestById(requestId);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Access restricted to administrators" : "Unauthorized: Invalid or missing token" },
        { status: session ? 403 : 401 }
      );
    }
    const auth = { adminId: Number(session.userId), roleId: Number(session.roleId ?? 3) };

    const { id: paramId } = await params;
    const id = parseInt(paramId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await req.json();
    const parsed: ReviewDecision = reviewDecisionSchema.parse(body);

    // Absent requests fail closed with 404 in every mode (reads stay
    // available even when frozen, so this pre-check never masks a 503: the
    // typed fetch separates NOT_FOUND from DEPENDENCY_FAILURE).
    try {
      await fetchRoutingSchoolRequest(id);
    } catch (error: unknown) {
      if (
        error instanceof SchoolRequestRoutingError &&
        error.code === "DEPENDENCY_FAILURE"
      ) {
        return NextResponse.json(
          { error: "Service temporarily unavailable" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "School request not found" },
        { status: 404 }
      );
    }

    // Invalid mode values throw on first read; frozen denies every write.
    // Both surface as sanitized 503 below.
    const mode = getEducationVerificationMode();
    if (mode === "frozen") {
      throw new EducationFlowUnavailableError();
    }

    if (mode === "legacy") {
      // Narrowing guard: legacy mode accepts ONLY legacy bodies.
      if (parsed.action !== "Approved" && parsed.action !== "Rejected") {
        throw unsupportedInLegacy();
      }
      // Legacy mode accepts ONLY legacy bodies; the quarantined legacy
      // branch keeps its existing behaviour (incl. education side effects).
      const request = await reviewSchoolRequest(id, parsed, auth.adminId);
      return NextResponse.json({ request });
    }

    if (parsed.action === "Approved") {
      throw unsupportedInAttendance();
    }
    // Attendance mode: VOS actions never mutate education/roster and never
    // accept a school override beyond the chosen routing target (the
    // decision carries only the target id or remarks).
    if (parsed.action === "Route") {
      const converged = await convergeManualRouteReplay(
        id,
        parsed.matched_school_id,
        auth.adminId
      );
      if (converged !== null) return NextResponse.json({ request: converged });
      const request = await routeSchoolRequestDecision(
        id,
        parsed.matched_school_id,
        auth.adminId
      );
      return NextResponse.json({ request });
    }
    if (parsed.action === "Group") {
      const request = await groupSchoolRequestDecision(
        id,
        parsed.matched_school_id,
        auth.adminId
      );
      return NextResponse.json({ request });
    }
    const request = await rejectSchoolRequestDecision(
      id,
      parsed.admin_remarks,
      auth.adminId
    );
    return NextResponse.json({ request });
  } catch (error: unknown) {
    if (error instanceof EducationFlowUnavailableError) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }
    if (error instanceof EducationVerificationModeError) {
      return NextResponse.json(
        { error: EDUCATION_FLOW_UNAVAILABLE_MESSAGE },
        { status: 503 }
      );
    }
    if (error instanceof SchoolRequestRoutingError) {
      if (error.code === "NOT_FOUND") {
        return NextResponse.json(
          { error: "School request not found" },
          { status: 404 }
        );
      }
      if (error.code === "DEPENDENCY_FAILURE") {
        // Sanitized: never leak storage internals.
        return NextResponse.json(
          { error: "Service temporarily unavailable" },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    if (error instanceof ZodError) {
      const [firstIssue] = error.issues;
      return NextResponse.json(
        { error: firstIssue?.message ?? "Malformed decision body." },
        { status: 400 }
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Malformed decision body." },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      // Narrowed: only the known quarantined-legacy validation failures
      // (request.service.ts legacy branch) are 400. Any other unexpected
      // Error is a sanitized 503 so storage internals never leak as 400.
      if (LEGACY_VALIDATION_MESSAGES.has(error.message)) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }
    // Sanitized dependency failure: never leak storage internals.
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }
}
