"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Client-side state for the School Admin attendance inbox.
 *
 * Consumes the school-request API as-is:
 *   GET  /api/school-admin/school-requests          -> { inbox: { schoolId, schoolAdminId, routed[], finalizing[] } }
 *   PATCH /api/school-admin/school-requests/{id}    -> { result }  (strict discriminated approve/reject body)
 *   POST /api/school-admin/school-requests/reconcile-> { recovered[], count } (idempotent)
 *
 * Every fetch passes `cache: "no-store"` so a persistent browser profile can
 * never serve a stale inbox or another school's cached rows.
 *
 * The server DTO is privacy-limited; these client types mirror it structurally
 * because the server types module is `server-only` and must never be imported
 * by client code. Each row additionally carries the name-only `submitterName`
 * label supplied by the HTTP boundary; no email or other profile field is ever present.
 *
 * Recovery semantics enforced by the API contract:
 *   - 409 -> REFRESH the inbox; NEVER surface a success state.
 *   - 404 -> the row is terminal/foreign/absent; REMOVE it from the inbox.
 *   - 503 on approve -> the claim/finalize may have committed but the response
 *     was lost; surface Finalizing and offer ONLY `resume` of the persisted
 *     reviewer/time decision. Academics are fixed on the roster row at
 *     creation and are never re-sent by resume.
 */

// --------------------------------------------------------------------------
// Client DTO (mirrors src/modules/school-admin/school-requests/types.ts)
// --------------------------------------------------------------------------

export type SchoolInboxRowStatus = "RoutedToSchool" | "Approved";
export type SchoolInboxEducationStatus = "Pending" | "Verified" | "Unverified";

export interface SchoolInboxEducation {
  readonly employeeEducationId: number;
  readonly userId: number;
  readonly schoolId: number | null;
  readonly schoolCourseId: number | null;
  readonly courseNameRaw: string | null;
  readonly schoolNameRaw: string | null;
  readonly educationStatus: SchoolInboxEducationStatus;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

export interface SchoolInboxCourse {
  readonly schoolCourseId: number;
  readonly schoolId: number;
  readonly courseName: string;
  readonly courseCode: string | null;
}

/** Proof-document metadata; the protected read-route URL replaces any file id. */
export interface SchoolInboxDocument {
  readonly documentId: number;
  readonly type: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly url: string;
}

export interface SchoolInboxRow {
  readonly schoolRequestId: number;
  readonly requestStatus: SchoolInboxRowStatus;
  readonly matchedSchoolId: number;
  readonly requestedBy: number;
  /** Name-only submitter label resolved server-side; never an email or id. */
  readonly submitterName: string;
  readonly requestedSchoolName: string;
  readonly createdAt: string;
  readonly routedBy: number | null;
  readonly routedAt: string | null;
  readonly reviewedBy: number | null;
  readonly reviewedAt: string | null;
  readonly education: SchoolInboxEducation;
  readonly course: SchoolInboxCourse | null;
  readonly documents: readonly SchoolInboxDocument[];
}

export interface SchoolInbox {
  readonly schoolId: number;
  readonly schoolAdminId: number;
  readonly routed: readonly SchoolInboxRow[];
  readonly finalizing: readonly SchoolInboxRow[];
}

// --------------------------------------------------------------------------
// Typed inputs
// --------------------------------------------------------------------------

/** Optional academics are written ONCE to the roster row at approval creation. */
export interface SchoolAttendanceAcademics {
  readonly student_number?: string;
  readonly gpa?: number;
  readonly school_year?: string;
}

export type SchoolDecisionAction = "approve" | "reject";

/** Mirrors the strict discriminated union accepted by the PATCH endpoint. */
export type SchoolAttendanceDecision =
  | { readonly action: "approve"; readonly academics?: SchoolAttendanceAcademics }
  | { readonly action: "reject"; readonly remarks: string };

/** Actions the UI may offer for a row, derived from its persisted state. */
export type SchoolAttendanceAction = "approve" | "reject" | "resume";

// --------------------------------------------------------------------------
// Exhaustive outcome + status modeling (compiler-enforced)
// --------------------------------------------------------------------------

export function assertNeverSchoolAdminVariant(value: never): never {
  throw new Error(`Unhandled school-admin variant: ${JSON.stringify(value)}`);
}

/** The six statuses the school-request API contract can return. */
export type SchoolRequestHttpStatus = 400 | 401 | 403 | 404 | 409 | 503;

/**
 * Exhaustive disposition of every contract status. Switch on this to force the
 * compiler to prove all six statuses are handled.
 */
export type SchoolRequestStatusDisposition =
  | { readonly kind: "input"; readonly status: 400 }
  | { readonly kind: "unauthenticated"; readonly status: 401 }
  | { readonly kind: "forbidden"; readonly status: 403 }
  | { readonly kind: "gone"; readonly status: 404 }
  | { readonly kind: "stale"; readonly status: 409 }
  | { readonly kind: "retryable"; readonly status: 503 };

export function normalizeSchoolRequestStatus(status: number): SchoolRequestHttpStatus {
  switch (status) {
    case 400:
    case 401:
    case 403:
    case 404:
    case 409:
    case 503:
      return status;
    default:
      return 503;
  }
}

export function dispositionForSchoolRequestStatus(
  status: SchoolRequestHttpStatus,
): SchoolRequestStatusDisposition {
  switch (status) {
    case 400:
      return { kind: "input", status };
    case 401:
      return { kind: "unauthenticated", status };
    case 403:
      return { kind: "forbidden", status };
    case 404:
      return { kind: "gone", status };
    case 409:
      return { kind: "stale", status };
    case 503:
      return { kind: "retryable", status };
    default:
      return assertNeverSchoolAdminVariant(status);
  }
}

/** Parsed `{ result }` payload of a successful decision PATCH. */
export interface SchoolApprovedResult {
  readonly requestId: number;
  readonly requestStatus: "Approved";
  readonly educationStatus: "Pending" | "Verified";
  readonly rosterStudentId: number;
  readonly courseRequestId: number | null;
  readonly reviewedBy: number;
  readonly reviewedAt: string;
}

export interface SchoolRejectedResult {
  readonly requestId: number;
  readonly requestStatus: "Rejected";
  readonly reviewedBy: number;
  readonly reviewedAt: string;
}

export type SchoolDecisionResult =
  | { readonly requestStatus: "Approved"; readonly approved: SchoolApprovedResult }
  | { readonly requestStatus: "Rejected"; readonly rejected: SchoolRejectedResult };

/**
 * The attended outcomes, modeled as a discriminated union:
 *  - `completed`  approval verifies the education immediately; the education
 *    already carried a catalog course, so no follow-on was created.
 *  - `followUp`   approval verifies the education, but its course was free
 *    text (no catalog course), so the server also created a follow-on course
 *    request for VOS to route and resolve.
 *  - `deferred`   approval binds the education to the school but leaves it
 *    Pending because its typed course is still unresolved; the follow-on
 *    course request completes it (Pending -> Verified + course) when approved.
 *  - (Finalizing is represented by `SchoolAttendanceOutcome.kind === "finalizing"`.)
 */
export type SchoolApprovalResolution =
  | {
      readonly kind: "completed";
      readonly requestId: number;
      readonly rosterStudentId: number;
      readonly reviewedBy: number;
      readonly reviewedAt: string;
    }
  | {
      readonly kind: "followUp";
      readonly requestId: number;
      readonly rosterStudentId: number;
      readonly courseRequestId: number;
      readonly reviewedBy: number;
      readonly reviewedAt: string;
    }
  | {
      readonly kind: "deferred";
      readonly requestId: number;
      readonly rosterStudentId: number;
      readonly courseRequestId: number;
      readonly reviewedBy: number;
      readonly reviewedAt: string;
    };

/** Every terminal state an attendance decision can reach. */
export type SchoolAttendanceOutcome =
  | {
      readonly kind: "approved";
      readonly action: "approve";
      readonly requestId: number;
      readonly resolution: SchoolApprovalResolution;
    }
  | {
      readonly kind: "rejected";
      readonly action: "reject";
      readonly requestId: number;
      readonly reviewedBy: number;
      readonly reviewedAt: string;
    }
  | {
      readonly kind: "stale";
      readonly action: SchoolDecisionAction;
      readonly requestId: number;
      readonly status: 409;
      readonly message: string;
      readonly reloaded: SchoolInboxRow | null;
    }
  | {
      readonly kind: "removed";
      readonly action: SchoolDecisionAction;
      readonly requestId: number;
      readonly status: 404;
      readonly message: string;
    }
  | {
      readonly kind: "finalizing";
      readonly action: "approve";
      readonly requestId: number;
      readonly status: 503;
      readonly message: string;
      readonly claim: SchoolFinalizingClaim | null;
      readonly reloaded: SchoolInboxRow | null;
    }
  | {
      readonly kind: "failed";
      readonly action: SchoolDecisionAction;
      readonly requestId: number;
      readonly status: number;
      readonly message: string;
      readonly disposition: SchoolRequestStatusDisposition;
    };

/** Result of the idempotent reconcile (resume-all) operation. */
export type SchoolReconcileOutcome =
  | {
      readonly kind: "reconciled";
      readonly recovered: readonly SchoolApprovalResolution[];
    }
  | {
      readonly kind: "stale";
      readonly status: 409;
      readonly message: string;
    }
  | {
      readonly kind: "removed";
      readonly status: 404;
      readonly message: string;
    }
  | {
      readonly kind: "failed";
      readonly status: number;
      readonly message: string;
      readonly disposition: SchoolRequestStatusDisposition;
    };

export type SchoolAttendanceFeedbackTone =
  | "success"
  | "finalizing"
  | "stale"
  | "removed"
  | "error";

export interface SchoolAttendanceFeedback {
  readonly tone: SchoolAttendanceFeedbackTone;
  readonly message: string;
}

/** Persisted reviewer/time decision, the only thing `resume` may consume. */
export interface SchoolFinalizingClaim {
  readonly requestId: number;
  readonly reviewedBy: number;
  readonly reviewedAt: string;
  /** `claimed` = still RoutedToSchool (finalize in flight); `finalizing` = Approved but unresolved. */
  readonly phase: "claimed" | "finalizing";
}

/** Row-level state union. Only `actionable` accepts a fresh approve/reject. */
export type SchoolInboxRowState =
  | { readonly kind: "actionable" }
  | { readonly kind: "claimed" }
  | { readonly kind: "finalizing" };

// --------------------------------------------------------------------------
// Typed errors
// --------------------------------------------------------------------------

export class SchoolInboxLoadError extends Error {
  public readonly name = "SchoolInboxLoadError";
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class SchoolDecisionParseError extends Error {
  public readonly name = "SchoolDecisionParseError";
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// --------------------------------------------------------------------------
// Pure parsing helpers
// --------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function readErrorMessage(json: unknown, fallback: string): string {
  if (isRecord(json) && typeof json.error === "string") return json.error;
  return fallback;
}

function parseEducation(value: unknown): SchoolInboxEducation | null {
  if (!isRecord(value)) return null;
  const {
    employeeEducationId,
    userId,
    schoolId,
    schoolCourseId,
    courseNameRaw,
    schoolNameRaw,
    educationStatus,
    startDate,
    endDate,
  } = value;
  if (typeof employeeEducationId !== "number" || !Number.isInteger(employeeEducationId)) return null;
  if (typeof userId !== "number" || !Number.isInteger(userId)) return null;
  if (!isNullableNumber(schoolId) || !isNullableNumber(schoolCourseId)) return null;
  if (!isNullableText(courseNameRaw) || !isNullableText(schoolNameRaw) || !isNullableText(startDate) || !isNullableText(endDate)) return null;
  if (educationStatus !== "Pending" && educationStatus !== "Verified" && educationStatus !== "Unverified") {
    return null;
  }
  return {
    employeeEducationId,
    userId,
    schoolId,
    schoolCourseId,
    courseNameRaw,
    schoolNameRaw,
    educationStatus,
    startDate,
    endDate,
  };
}

function parseCourse(value: unknown): SchoolInboxCourse | null {
  if (!isRecord(value)) return null;
  const { schoolCourseId, schoolId, courseName, courseCode } = value;
  if (typeof schoolCourseId !== "number" || !Number.isInteger(schoolCourseId)) return null;
  if (typeof schoolId !== "number" || !Number.isInteger(schoolId)) return null;
  if (typeof courseName !== "string") return null;
  if (!isNullableText(courseCode)) return null;
  return { schoolCourseId, schoolId, courseName, courseCode };
}

function parseDocument(value: unknown): SchoolInboxDocument | null {
  if (!isRecord(value)) return null;
  const { documentId, type, fileName, mimeType, url } = value;
  if (typeof documentId !== "number" || !Number.isInteger(documentId) || documentId <= 0) return null;
  if (typeof type !== "string") return null;
  if (typeof fileName !== "string") return null;
  if (typeof mimeType !== "string") return null;
  if (typeof url !== "string") return null;
  return { documentId, type, fileName, mimeType, url };
}

function parseDocuments(value: unknown): readonly SchoolInboxDocument[] | null {
  if (!Array.isArray(value)) return null;
  const documents: SchoolInboxDocument[] = [];
  for (const entry of value) {
    const document = parseDocument(entry);
    if (document === null) return null;
    documents.push(document);
  }
  return documents;
}

export function parseSchoolInboxRow(value: unknown): SchoolInboxRow | null {
  if (!isRecord(value)) return null;
  const {
    schoolRequestId,
    requestStatus,
    matchedSchoolId,
    requestedBy,
    submitterName,
    requestedSchoolName,
    createdAt,
    routedBy,
    routedAt,
    reviewedBy,
    reviewedAt,
    education,
    course,
    documents,
  } = value;
  if (typeof schoolRequestId !== "number" || !Number.isInteger(schoolRequestId)) return null;
  if (requestStatus !== "RoutedToSchool" && requestStatus !== "Approved") return null;
  if (typeof matchedSchoolId !== "number" || !Number.isInteger(matchedSchoolId)) return null;
  if (typeof requestedBy !== "number" || !Number.isInteger(requestedBy)) return null;
  if (typeof submitterName !== "string") return null;
  if (typeof requestedSchoolName !== "string") return null;
  if (typeof createdAt !== "string") return null;
  if (!isNullableNumber(routedBy) || !isNullableText(routedAt)) return null;
  if (!isNullableNumber(reviewedBy) || !isNullableText(reviewedAt)) return null;
  const parsedEducation = parseEducation(education);
  if (parsedEducation === null) return null;
  if (course !== null && parseCourse(course) === null) return null;
  const parsedDocuments = parseDocuments(documents);
  if (parsedDocuments === null) return null;
  return {
    schoolRequestId,
    requestStatus,
    matchedSchoolId,
    requestedBy,
    submitterName,
    requestedSchoolName,
    createdAt,
    routedBy,
    routedAt,
    reviewedBy,
    reviewedAt,
    education: parsedEducation,
    course: course === null ? null : parseCourse(course),
    documents: parsedDocuments,
  };
}

/** Strict parse of `{ inbox: {...} }`. Malformed responses throw a 503 error. */
export function parseSchoolInboxPayload(json: unknown): SchoolInbox {
  if (!isRecord(json) || !isRecord(json.inbox)) {
    throw new SchoolInboxLoadError(503, "School request inbox response was malformed.");
  }
  const { schoolId, schoolAdminId, routed, finalizing } = json.inbox;
  if (typeof schoolId !== "number" || !Number.isInteger(schoolId)) {
    throw new SchoolInboxLoadError(503, "School request inbox response was malformed.");
  }
  if (typeof schoolAdminId !== "number" || !Number.isInteger(schoolAdminId)) {
    throw new SchoolInboxLoadError(503, "School request inbox response was malformed.");
  }
  if (!Array.isArray(routed) || !Array.isArray(finalizing)) {
    throw new SchoolInboxLoadError(503, "School request inbox response was malformed.");
  }
  const parseList = (entries: readonly unknown[]): SchoolInboxRow[] => {
    const rows: SchoolInboxRow[] = [];
    for (const entry of entries) {
      const row = parseSchoolInboxRow(entry);
      if (row === null) throw new SchoolInboxLoadError(503, "School request inbox response was malformed.");
      rows.push(row);
    }
    return rows;
  };
  return {
    schoolId,
    schoolAdminId,
    routed: parseList(routed),
    finalizing: parseList(finalizing),
  };
}

function parseApprovedResult(value: Record<string, unknown>): SchoolApprovedResult | null {
  const { requestId, requestStatus, educationStatus, rosterStudentId, courseRequestId, reviewedBy, reviewedAt } = value;
  if (typeof requestId !== "number" || !Number.isInteger(requestId)) return null;
  if (requestStatus !== "Approved") return null;
  if (educationStatus !== "Pending" && educationStatus !== "Verified") return null;
  if (typeof rosterStudentId !== "number" || !Number.isInteger(rosterStudentId)) return null;
  if (!isNullableNumber(courseRequestId)) return null;
  if (typeof reviewedBy !== "number" || !Number.isInteger(reviewedBy)) return null;
  if (typeof reviewedAt !== "string") return null;
  return { requestId, requestStatus, educationStatus, rosterStudentId, courseRequestId, reviewedBy, reviewedAt };
}

function parseRejectedResult(value: Record<string, unknown>): SchoolRejectedResult | null {
  const { requestId, requestStatus, reviewedBy, reviewedAt } = value;
  if (typeof requestId !== "number" || !Number.isInteger(requestId)) return null;
  if (requestStatus !== "Rejected") return null;
  if (typeof reviewedBy !== "number" || !Number.isInteger(reviewedBy)) return null;
  if (typeof reviewedAt !== "string") return null;
  return { requestId, requestStatus, reviewedBy, reviewedAt };
}

/**
 * Discriminate the `{ result }` payload on the persisted status. Every other
 * status is an unhandled variant and throws, forcing the caller to model it.
 */
export function parseSchoolDecisionResult(json: unknown): SchoolDecisionResult {
  if (!isRecord(json) || !isRecord(json.result)) {
    throw new SchoolDecisionParseError(503, "School decision response was malformed.");
  }
  const result = json.result;
  const status = result.requestStatus;
  if (status === "Approved") {
    const approved = parseApprovedResult(result);
    if (approved === null) throw new SchoolDecisionParseError(503, "School decision response was malformed.");
    return { requestStatus: "Approved", approved };
  }
  if (status === "Rejected") {
    const rejected = parseRejectedResult(result);
    if (rejected === null) throw new SchoolDecisionParseError(503, "School decision response was malformed.");
    return { requestStatus: "Rejected", rejected };
  }
  throw new SchoolDecisionParseError(503, "School decision response was malformed.");
}

export function parseSchoolReconcilePayload(json: unknown): readonly SchoolApprovalResolution[] {
  if (!isRecord(json) || !Array.isArray(json.recovered)) {
    throw new SchoolDecisionParseError(503, "School reconcile response was malformed.");
  }
  const resolutions: SchoolApprovalResolution[] = [];
  for (const entry of json.recovered) {
    if (!isRecord(entry)) throw new SchoolDecisionParseError(503, "School reconcile response was malformed.");
    const approved = parseApprovedResult(entry);
    if (approved === null) throw new SchoolDecisionParseError(503, "School reconcile response was malformed.");
    resolutions.push(classifyApprovalResolution(approved));
  }
  return resolutions;
}

/**
 * Classify the approved result. A catalog-course approval verifies the
 * education immediately (`completed`); a free-text-course approval either
 * verifies immediately with a follow-on course request (`followUp`) or —
 * when the typed course is still unresolved — binds the school while leaving
 * the education Pending for the course approval to complete (`deferred`).
 * A Pending education with no follow-on course request is impossible and throws.
 */
export function classifyApprovalResolution(result: SchoolApprovedResult): SchoolApprovalResolution {
  switch (result.educationStatus) {
    case "Verified":
      if (result.courseRequestId !== null) {
        return {
          kind: "followUp",
          requestId: result.requestId,
          rosterStudentId: result.rosterStudentId,
          courseRequestId: result.courseRequestId,
          reviewedBy: result.reviewedBy,
          reviewedAt: result.reviewedAt,
        };
      }
      return {
        kind: "completed",
        requestId: result.requestId,
        rosterStudentId: result.rosterStudentId,
        reviewedBy: result.reviewedBy,
        reviewedAt: result.reviewedAt,
      };
    case "Pending":
      if (result.courseRequestId !== null) {
        return {
          kind: "deferred",
          requestId: result.requestId,
          rosterStudentId: result.rosterStudentId,
          courseRequestId: result.courseRequestId,
          reviewedBy: result.reviewedBy,
          reviewedAt: result.reviewedAt,
        };
      }
      throw new SchoolDecisionParseError(
        503,
        "Approved response left the education pending with no follow-on course request.",
      );
    default:
      return assertNeverSchoolAdminVariant(result.educationStatus);
  }
}

// --------------------------------------------------------------------------
// Pure row-state / claim helpers
// --------------------------------------------------------------------------

export function buildSchoolDecisionBody(decision: SchoolAttendanceDecision): Record<string, unknown> {
  switch (decision.action) {
    case "approve": {
      const body: Record<string, unknown> = { action: "approve" };
      const academics = decision.academics;
      if (academics !== undefined) {
        if (academics.student_number !== undefined) body.student_number = academics.student_number;
        if (academics.gpa !== undefined) body.gpa = academics.gpa;
        if (academics.school_year !== undefined) body.school_year = academics.school_year;
      }
      return body;
    }
    case "reject":
      return { action: "reject", remarks: decision.remarks };
    default:
      return assertNeverSchoolAdminVariant(decision);
  }
}

/**
 * Derive the persisted reviewer/time claim from a row. A RoutedToSchool row
 * with a reviewer/time is `claimed` (finalize in flight); an Approved row is
 * `finalizing` (follow-on not yet present). Rows without both values report
 * null so a fresh decision is never mislabeled as resumable.
 */
export function deriveFinalizingClaim(row: SchoolInboxRow): SchoolFinalizingClaim | null {
  if (typeof row.reviewedBy !== "number") return null;
  if (row.reviewedAt === null || row.reviewedAt.trim().length === 0) return null;
  switch (row.requestStatus) {
    case "Approved":
      return {
        requestId: row.schoolRequestId,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
        phase: "finalizing",
      };
    case "RoutedToSchool":
      return {
        requestId: row.schoolRequestId,
        reviewedBy: row.reviewedBy,
        reviewedAt: row.reviewedAt,
        phase: "claimed",
      };
    default:
      return assertNeverSchoolAdminVariant(row.requestStatus);
  }
}

export function schoolInboxRowState(row: SchoolInboxRow): SchoolInboxRowState {
  if (row.requestStatus === "Approved") return { kind: "finalizing" };
  return deriveFinalizingClaim(row) === null ? { kind: "actionable" } : { kind: "claimed" };
}

export function availableSchoolAttendanceActions(row: SchoolInboxRow): readonly SchoolAttendanceAction[] {
  const state = schoolInboxRowState(row);
  switch (state.kind) {
    case "actionable":
      return ["approve", "reject"];
    case "claimed":
    case "finalizing":
      return ["resume"];
    default:
      return assertNeverSchoolAdminVariant(state);
  }
}

export function findInboxRow(inbox: SchoolInbox | null, requestId: number): SchoolInboxRow | undefined {
  if (inbox === null) return undefined;
  const all = [...inbox.routed, ...inbox.finalizing];
  return all.find((row) => row.schoolRequestId === requestId);
}

export function removeInboxRow(inbox: SchoolInbox | null, requestId: number): SchoolInbox | null {
  if (inbox === null) return null;
  return {
    ...inbox,
    routed: inbox.routed.filter((row) => row.schoolRequestId !== requestId),
    finalizing: inbox.finalizing.filter((row) => row.schoolRequestId !== requestId),
  };
}

export function emptyInbox(schoolId: number, schoolAdminId: number): SchoolInbox {
  return { schoolId, schoolAdminId, routed: [], finalizing: [] };
}

/**
 * True when a newly loaded inbox belongs to a different school than the one
 * already cached, in which case all per-row feedback/claims must be wiped so
 * no other school's data or decision history is ever shown.
 */
export function shouldResetSchoolScopedState(
  previousSchoolId: number | null,
  nextSchoolId: number,
): boolean {
  return previousSchoolId !== null && previousSchoolId !== nextSchoolId;
}

// --------------------------------------------------------------------------
// Exhaustive feedback
// --------------------------------------------------------------------------

export function feedbackForSchoolAttendanceOutcome(
  outcome: SchoolAttendanceOutcome,
): SchoolAttendanceFeedback {
  switch (outcome.kind) {
    case "approved": {
      switch (outcome.resolution.kind) {
        case "completed":
          return {
            tone: "success",
            message: "Attendance approved; the education is now verified.",
          };
        case "followUp":
          return {
            tone: "success",
            message: "Attendance approved; the education is now verified.",
          };
        case "deferred":
          return {
            tone: "success",
            message:
              "Attendance approved; the typed course still needs matching, so the education stays pending until it is resolved.",
          };
        default:
          return assertNeverSchoolAdminVariant(outcome.resolution);
      }
    }
    case "rejected":
      return { tone: "success", message: "School request rejected." };
    case "stale":
      return {
        tone: "stale",
        message: `Stale data: ${outcome.message} The inbox was refreshed; review the current row before retrying.`,
      };
    case "removed":
      return {
        tone: "removed",
        message: "This request is no longer in your inbox; it was removed.",
      };
    case "finalizing":
      return {
        tone: "finalizing",
        message:
          "The decision may have committed but the response was lost. Only Resume of the persisted reviewer/time decision is available; academics stay fixed on the roster row.",
      };
    case "failed":
      return { tone: "error", message: outcome.message };
    default:
      return assertNeverSchoolAdminVariant(outcome);
  }
}

export function feedbackForSchoolReconcileOutcome(
  outcome: SchoolReconcileOutcome,
): SchoolAttendanceFeedback {
  switch (outcome.kind) {
    case "reconciled":
      return {
        tone: "success",
        message:
          outcome.recovered.length === 0
            ? "No finalizing requests needed recovery."
            : `Recovered ${String(outcome.recovered.length)} finalizing request(s).`,
      };
    case "stale":
      return {
        tone: "stale",
        message: `Stale data: ${outcome.message} The inbox was refreshed; review the current rows before retrying.`,
      };
    case "removed":
      return { tone: "removed", message: "Nothing left to reconcile." };
    case "failed":
      return { tone: "error", message: outcome.message };
    default:
      return assertNeverSchoolAdminVariant(outcome);
  }
}

// --------------------------------------------------------------------------
// Decision / reconcile executors (pure; drive with a mock fetch)
// --------------------------------------------------------------------------

export interface SchoolAttendanceDecisionDeps {
  readonly fetchImpl: typeof fetch;
  readonly findRow: (id: number) => SchoolInboxRow | undefined;
  readonly refetchInbox: () => Promise<SchoolInbox | null>;
  readonly removeRow: (id: number) => void;
  readonly getClaim: (id: number) => SchoolFinalizingClaim | undefined;
  readonly setClaim: (id: number, claim: SchoolFinalizingClaim | undefined) => void;
  readonly setFeedback: (id: number, feedback: SchoolAttendanceFeedback) => void;
}

function messageForStatus(status: SchoolRequestHttpStatus): string {
  switch (status) {
    case 400:
      return "The decision input was rejected.";
    case 401:
      return "Your session is no longer valid.";
    case 403:
      return "You are not authorized to decide this request.";
    case 404:
      return "School request was not found.";
    case 409:
      return "The school request changed before the decision committed.";
    case 503:
      return "School request storage is temporarily unavailable.";
    default:
      return assertNeverSchoolAdminVariant(status);
  }
}

export async function executeSchoolAttendanceDecision(
  deps: SchoolAttendanceDecisionDeps,
  requestId: number,
  decision: SchoolAttendanceDecision,
): Promise<SchoolAttendanceOutcome> {
  const action = decision.action;
  if (!Number.isInteger(requestId) || requestId <= 0) {
    const outcome: SchoolAttendanceOutcome = {
      kind: "failed",
      action,
      requestId,
      status: 400,
      message: "School request id must be a positive integer.",
      disposition: dispositionForSchoolRequestStatus(400),
    };
    deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
    return outcome;
  }

  let res: Response;
  try {
    res = await deps.fetchImpl(`/api/school-admin/school-requests/${String(requestId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildSchoolDecisionBody(decision)),
      cache: "no-store",
    });
  } catch {
    const outcome: SchoolAttendanceOutcome = {
      kind: "failed",
      action,
      requestId,
      status: 503,
      message: messageForStatus(503),
      disposition: dispositionForSchoolRequestStatus(503),
    };
    deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
    return outcome;
  }

  const json: unknown = await res.json().catch(() => null);

  if (res.ok) {
    try {
      if (action === "reject") {
        const parsed = parseSchoolDecisionResult(json);
        if (parsed.requestStatus !== "Rejected") {
          throw new SchoolDecisionParseError(503, "A rejection returned an unexpected decision status.");
        }
        deps.removeRow(requestId);
        deps.setClaim(requestId, undefined);
        const outcome: SchoolAttendanceOutcome = {
          kind: "rejected",
          action: "reject",
          requestId,
          reviewedBy: parsed.rejected.reviewedBy,
          reviewedAt: parsed.rejected.reviewedAt,
        };
        deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
        return outcome;
      }
      const parsed = parseSchoolDecisionResult(json);
      if (parsed.requestStatus !== "Approved") {
        throw new SchoolDecisionParseError(503, "An approval returned an unexpected decision status.");
      }
      const resolution = classifyApprovalResolution(parsed.approved);
      await deps.refetchInbox();
      deps.setClaim(requestId, undefined);
      const outcome: SchoolAttendanceOutcome = {
        kind: "approved",
        action: "approve",
        requestId,
        resolution,
      };
      deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
      return outcome;
    } catch (parseError: unknown) {
      const outcome: SchoolAttendanceOutcome = {
        kind: "failed",
        action,
        requestId,
        status: 503,
        message:
          parseError instanceof SchoolDecisionParseError
            ? parseError.message
            : "School decision response was malformed.",
        disposition: dispositionForSchoolRequestStatus(503),
      };
      deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
      return outcome;
    }
  }

  const status = normalizeSchoolRequestStatus(res.status);
  const message = readErrorMessage(json, messageForStatus(status));

  switch (status) {
    case 409: {
      const reloaded = await deps.refetchInbox();
      const reloadedRow = findInboxRow(reloaded, requestId) ?? null;
      const reloadedClaim = reloadedRow === null ? null : deriveFinalizingClaim(reloadedRow);
      deps.setClaim(requestId, reloadedClaim ?? undefined);
      const outcome: SchoolAttendanceOutcome = {
        kind: "stale",
        action,
        requestId,
        status: 409,
        message,
        reloaded: reloadedRow,
      };
      deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
      return outcome;
    }
    case 404: {
      deps.removeRow(requestId);
      deps.setClaim(requestId, undefined);
      const outcome: SchoolAttendanceOutcome = {
        kind: "removed",
        action,
        requestId,
        status: 404,
        message,
      };
      deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
      return outcome;
    }
    case 503: {
      const reloaded = await deps.refetchInbox();
      if (action === "approve") {
        const reloadedRow = findInboxRow(reloaded, requestId) ?? null;
        const reloadedClaim = reloadedRow === null ? null : deriveFinalizingClaim(reloadedRow);
        const claim = reloadedClaim ?? deps.getClaim(requestId) ?? null;
        const finalizedClaim: SchoolFinalizingClaim | null =
          claim === null ? null : { ...claim, phase: "finalizing" };
        deps.setClaim(requestId, finalizedClaim ?? undefined);
        const outcome: SchoolAttendanceOutcome = {
          kind: "finalizing",
          action: "approve",
          requestId,
          status: 503,
          message,
          claim: finalizedClaim,
          reloaded: reloadedRow,
        };
        deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
        return outcome;
      }
      const outcome: SchoolAttendanceOutcome = {
        kind: "failed",
        action,
        requestId,
        status: 503,
        message: messageForStatus(503),
        disposition: dispositionForSchoolRequestStatus(503),
      };
      deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
      return outcome;
    }
    case 400:
    case 401:
    case 403: {
      const outcome: SchoolAttendanceOutcome = {
        kind: "failed",
        action,
        requestId,
        status,
        message,
        disposition: dispositionForSchoolRequestStatus(status),
      };
      deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
      return outcome;
    }
    default:
      return assertNeverSchoolAdminVariant(status);
  }
}

/**
 * Resume the persisted reviewer/time decision. Academics are NEVER accepted
 * here: the request body carries no academic fields, so a reloaded/second-admin
 * resume cannot overwrite the roster-held values written at creation.
 */
export async function resumeSchoolAttendanceDecision(
  deps: SchoolAttendanceDecisionDeps,
  requestId: number,
): Promise<SchoolAttendanceOutcome> {
  const row = deps.findRow(requestId);
  const state = row === undefined ? null : schoolInboxRowState(row);
  const persistedClaim = row === undefined ? null : deriveFinalizingClaim(row);
  const claim = persistedClaim ?? deps.getClaim(requestId) ?? null;
  if (claim === null || (state !== null && state.kind === "actionable")) {
    const outcome: SchoolAttendanceOutcome = {
      kind: "failed",
      action: "approve",
      requestId,
      status: 409,
      message: "There is no persisted finalizing decision to resume for this school request.",
      disposition: dispositionForSchoolRequestStatus(409),
    };
    deps.setFeedback(requestId, feedbackForSchoolAttendanceOutcome(outcome));
    return outcome;
  }
  return executeSchoolAttendanceDecision(deps, requestId, { action: "approve" });
}

export interface SchoolReconcileDeps {
  readonly fetchImpl: typeof fetch;
  readonly refetchInbox: () => Promise<SchoolInbox | null>;
  readonly setFeedback: (feedback: SchoolAttendanceFeedback) => void;
}

export async function executeSchoolReconcile(
  deps: SchoolReconcileDeps,
): Promise<SchoolReconcileOutcome> {
  let res: Response;
  try {
    res = await deps.fetchImpl("/api/school-admin/school-requests/reconcile", {
      method: "POST",
      cache: "no-store",
    });
  } catch {
    const outcome: SchoolReconcileOutcome = {
      kind: "failed",
      status: 503,
      message: messageForStatus(503),
      disposition: dispositionForSchoolRequestStatus(503),
    };
    deps.setFeedback(feedbackForSchoolReconcileOutcome(outcome));
    return outcome;
  }

  const json: unknown = await res.json().catch(() => null);
  if (res.ok) {
    const recovered = parseSchoolReconcilePayload(json);
    await deps.refetchInbox();
    const outcome: SchoolReconcileOutcome = { kind: "reconciled", recovered };
    deps.setFeedback(feedbackForSchoolReconcileOutcome(outcome));
    return outcome;
  }

  const status = normalizeSchoolRequestStatus(res.status);
  const message = readErrorMessage(json, messageForStatus(status));
  if (status === 409) {
    await deps.refetchInbox();
    const outcome: SchoolReconcileOutcome = { kind: "stale", status: 409, message };
    deps.setFeedback(feedbackForSchoolReconcileOutcome(outcome));
    return outcome;
  }
  if (status === 404) {
    const outcome: SchoolReconcileOutcome = { kind: "removed", status: 404, message };
    deps.setFeedback(feedbackForSchoolReconcileOutcome(outcome));
    return outcome;
  }
  if (status === 503) await deps.refetchInbox();
  const outcome: SchoolReconcileOutcome = {
    kind: "failed",
    status,
    message,
    disposition: dispositionForSchoolRequestStatus(status),
  };
  deps.setFeedback(feedbackForSchoolReconcileOutcome(outcome));
  return outcome;
}

// --------------------------------------------------------------------------
// The hook
// --------------------------------------------------------------------------

export interface UseSchoolRequestsResult {
  readonly inbox: SchoolInbox | null;
  readonly schoolId: number | null;
  readonly routed: readonly SchoolInboxRow[];
  readonly finalizing: readonly SchoolInboxRow[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly feedbackByRow: Readonly<Record<number, SchoolAttendanceFeedback>>;
  readonly claims: Readonly<Record<number, SchoolFinalizingClaim>>;
  readonly busyByRow: Readonly<Record<number, boolean>>;
  readonly reconcileBusy: boolean;
  readonly reconcileFeedback: SchoolAttendanceFeedback | null;
  readonly loadInbox: () => Promise<SchoolInbox | null>;
  readonly approveSchoolAttendance: (
    requestId: number,
    academics?: SchoolAttendanceAcademics,
  ) => Promise<SchoolAttendanceOutcome>;
  readonly rejectSchoolAttendance: (
    requestId: number,
    remarks: string,
  ) => Promise<SchoolAttendanceOutcome>;
  readonly resumeSchoolAttendance: (requestId: number) => Promise<SchoolAttendanceOutcome>;
  readonly reconcileSchoolAttendance: () => Promise<SchoolReconcileOutcome>;
}

export function useSchoolRequests(): UseSchoolRequestsResult {
  const [inbox, setInbox] = useState<SchoolInbox | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackByRow, setFeedbackByRow] = useState<Record<number, SchoolAttendanceFeedback>>({});
  const [claims, setClaims] = useState<Record<number, SchoolFinalizingClaim>>({});
  const [busyByRow, setBusyByRow] = useState<Record<number, boolean>>({});
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [reconcileFeedback, setReconcileFeedback] = useState<SchoolAttendanceFeedback | null>(null);
  const schoolIdRef = useRef<number | null>(null);

  // Never cache another school's data: a schoolId change wipes per-row state.
  const applyInbox = useCallback((next: SchoolInbox | null) => {
    if (next === null) {
      setInbox(null);
      return;
    }
    const previous = schoolIdRef.current;
    if (shouldResetSchoolScopedState(previous, next.schoolId)) {
      setFeedbackByRow({});
      setClaims({});
    }
    schoolIdRef.current = next.schoolId;
    setInbox(next);
  }, []);

  // Bound wrapper (NOT bare `fetch`): the deps object invokes
  // `deps.fetchImpl(...)` as a method, and native browser fetch throws
  // "Illegal invocation" when its receiver is not Window. Calling the global
  // through this wrapper preserves the browser receiver for every decision.
  const fetchImpl: typeof fetch = useCallback(
    (...args: Parameters<typeof fetch>) => fetch(...args),
    [],
  );

  const refetchInbox = useCallback(async (): Promise<SchoolInbox | null> => {
    try {
      const res = await fetchImpl("/api/school-admin/school-requests", { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) return null;
      const parsed = parseSchoolInboxPayload(json);
      applyInbox(parsed);
      return parsed;
    } catch {
      return null;
    }
  }, [applyInbox, fetchImpl]);

  const loadInbox = useCallback(async (): Promise<SchoolInbox | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchImpl("/api/school-admin/school-requests", { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        throw new SchoolInboxLoadError(res.status, readErrorMessage(json, "Failed to load the school request inbox."));
      }
      const parsed = parseSchoolInboxPayload(json);
      applyInbox(parsed);
      return parsed;
    } catch (err: unknown) {
      setError(err instanceof SchoolInboxLoadError ? err.message : "Failed to load the school request inbox.");
      setInbox(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyInbox, fetchImpl]);

  const removeRow = useCallback((requestId: number) => {
    setInbox((prev) => removeInboxRow(prev, requestId));
  }, []);

  const makeDecisionDeps = (): SchoolAttendanceDecisionDeps => ({
    fetchImpl,
    findRow: (id: number) => findInboxRow(inbox, id),
    refetchInbox,
    removeRow,
    getClaim: (id: number) => claims[id],
    setClaim: (id: number, claim: SchoolFinalizingClaim | undefined) => {
      setClaims((prev) => {
        const next = { ...prev };
        if (claim === undefined) {
          delete next[id];
        } else {
          next[id] = claim;
        }
        return next;
      });
    },
    setFeedback: (id: number, feedback: SchoolAttendanceFeedback) =>
      setFeedbackByRow((prev) => ({ ...prev, [id]: feedback })),
  });

  const guardConflict = (
    requestId: number,
    action: SchoolDecisionAction,
  ): SchoolAttendanceOutcome | null => {
    const row = findInboxRow(inbox, requestId);
    if (row === undefined) return null;
    // Only a fresh `actionable` row may accept approve/reject. A claimed or
    // finalizing row is resume-only, so a conflicting edit is refused locally
    // before any network call.
    if (schoolInboxRowState(row).kind === "actionable") return null;
    const outcome: SchoolAttendanceOutcome = {
      kind: "failed",
      action,
      requestId,
      status: 409,
      message: "This request already has a persisted decision; only resume is available.",
      disposition: dispositionForSchoolRequestStatus(409),
    };
    setFeedbackByRow((prev) => ({ ...prev, [requestId]: feedbackForSchoolAttendanceOutcome(outcome) }));
    return outcome;
  };

  const approveSchoolAttendance = async (
    requestId: number,
    academics?: SchoolAttendanceAcademics,
  ): Promise<SchoolAttendanceOutcome> => {
    const blocked = guardConflict(requestId, "approve");
    if (blocked !== null) return blocked;
    setBusyByRow((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await executeSchoolAttendanceDecision(makeDecisionDeps(), requestId, {
        action: "approve",
        ...(academics === undefined ? {} : { academics }),
      });
    } finally {
      setBusyByRow((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const rejectSchoolAttendance = async (
    requestId: number,
    remarks: string,
  ): Promise<SchoolAttendanceOutcome> => {
    const blocked = guardConflict(requestId, "reject");
    if (blocked !== null) return blocked;
    setBusyByRow((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await executeSchoolAttendanceDecision(makeDecisionDeps(), requestId, {
        action: "reject",
        remarks,
      });
    } finally {
      setBusyByRow((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const resumeSchoolAttendance = async (requestId: number): Promise<SchoolAttendanceOutcome> => {
    setBusyByRow((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await resumeSchoolAttendanceDecision(makeDecisionDeps(), requestId);
    } finally {
      setBusyByRow((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const reconcileSchoolAttendance = async (): Promise<SchoolReconcileOutcome> => {
    setReconcileBusy(true);
    try {
      return await executeSchoolReconcile({
        fetchImpl,
        refetchInbox,
        setFeedback: (feedback: SchoolAttendanceFeedback) => setReconcileFeedback(feedback),
      });
    } finally {
      setReconcileBusy(false);
    }
  };

  return {
    inbox,
    schoolId: inbox?.schoolId ?? null,
    routed: inbox?.routed ?? [],
    finalizing: inbox?.finalizing ?? [],
    loading,
    error,
    feedbackByRow,
    claims,
    busyByRow,
    reconcileBusy,
    reconcileFeedback,
    loadInbox,
    approveSchoolAttendance,
    rejectSchoolAttendance,
    resumeSchoolAttendance,
    reconcileSchoolAttendance,
  };
}
