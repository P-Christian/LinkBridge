import "server-only";

/**
 * Server-only rollout gate for the attendance-gated education flow.
 *
 * Four-state contract for `EDUCATION_VERIFICATION_MODE`:
 * - `EDUCATION_VERIFICATION_MODE` is optional; absent or empty (after trim)
 *   -> `opt-in` (production default).
 * - Explicit `legacy` -> legacy behavior; `attendance` -> all-claim
 *   attendance-request creation with legacy VOS school approval disabled;
 *   `opt-in` -> claim creation as `AwaitingOptIn` rows without routing;
 *   `frozen` -> reads stay available while education/request decision writes
 *   return sanitized 503.
 * - Any other value throws at startup; never silently defaults to a
 *   permissive mode. Matching is exact lowercase (surrounding whitespace is
 *   trimmed); case variants such as `LEGACY` are rejected.
 * - The mode is read on every call and never memoized.
 *
 * Frozen-only rollback rule: after `opt-in` claims exist, roll back with
 * `frozen`, not `attendance`, because claims would render as Pending and
 * never route.
 */
export type EducationVerificationMode = "legacy" | "attendance" | "opt-in" | "frozen";

const MODE_ENV_KEY = "EDUCATION_VERIFICATION_MODE";

export class EducationVerificationModeError extends Error {
  public readonly name = "EducationVerificationModeError";

  constructor(rawValue: string) {
    super(
      `Invalid ${MODE_ENV_KEY} value ${JSON.stringify(rawValue)}. ` +
        `Expected "legacy", "attendance", "opt-in", or "frozen".`
    );
  }
}

function parseEducationVerificationMode(rawValue: string | undefined): EducationVerificationMode {
  const trimmed = rawValue?.trim() ?? "";
  if (trimmed === "") {
    return "opt-in";
  }
  if (trimmed === "legacy" || trimmed === "attendance" || trimmed === "opt-in" || trimmed === "frozen") {
    return trimmed;
  }
  throw new EducationVerificationModeError(rawValue ?? "");
}

/** Read and validate the rollout mode on every call; never memoize a stale env. */
export function getEducationVerificationMode(): EducationVerificationMode {
  return parseEducationVerificationMode(process.env[MODE_ENV_KEY]);
}

/** True only when every claim must create/reuse a school-attendance request. */
export function isAttendanceModeEnabled(): boolean {
  return getEducationVerificationMode() === "attendance";
}

/** True only when decision writes must be denied while reads stay available. */
export function isFrozenMode(): boolean {
  return getEducationVerificationMode() === "frozen";
}

/** Sanitized message for temporarily unavailable education/request writes. Never leaks internals. */
export const EDUCATION_FLOW_UNAVAILABLE_MESSAGE = "This action is temporarily unavailable.";

/** Typed sanitized error for gate-denied education/request decision writes (maps to HTTP 503). */
export class EducationFlowUnavailableError extends Error {
  public readonly name = "EducationFlowUnavailableError";

  constructor(message: string = EDUCATION_FLOW_UNAVAILABLE_MESSAGE) {
    super(message);
  }
}

/** True only when education writes must create/reuse a school-attendance request. */
export function shouldCreateAttendanceRequest(): boolean {
  const mode = getEducationVerificationMode();
  return mode === "attendance" || mode === "opt-in";
}

/** Throw the typed sanitized error when education writes are frozen. Reads stay allowed. */
export function assertEducationWriteAllowed(): void {
  if (getEducationVerificationMode() === "frozen") {
    throw new EducationFlowUnavailableError();
  }
}

/**
 * Legacy VOS school approval stays reachable only in legacy mode.
 * Attendance mode disables it; frozen mode denies all decision writes.
 */
export function assertSchoolRequestReviewAllowed(): void {
  if (getEducationVerificationMode() !== "legacy") {
    throw new EducationFlowUnavailableError();
  }
}

/** VOS course-request decisions stay reachable except in frozen mode. */
export function assertCourseRequestReviewAllowed(): void {
  if (getEducationVerificationMode() === "frozen") {
    throw new EducationFlowUnavailableError();
  }
}
