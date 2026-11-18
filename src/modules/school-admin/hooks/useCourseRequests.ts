"use client";

import { useCallback, useRef, useState } from "react";
import { executeCreateSchoolCourse } from "@/modules/school-admin/school-courses/services/school-courses.service";
import type { CreateCourseDTO } from "@/modules/school-admin/school-courses/types/school-courses.types";

/**
 * Client-side state for the School Admin course-request inbox.
 *
 * Consumes the course-request API as-is:
 *   GET   /api/school-admin/course-requests     -> { inbox: { schoolId, routed[], finalizing[], courses[] } }
 *   PATCH /api/school-admin/course-requests/{id} -> { result } (strict discriminated approve/reject body)
 *
 * Every fetch passes `cache: "no-store"` so a persistent browser profile can
 * never serve a stale inbox or another school's cached rows.
 *
 * The server DTO is privacy-limited; these client types mirror the inbox
 * contract structurally because the server contracts module is `server-only`
 * and must never be imported by client code. Each row additionally carries the
 * name-only `submitterName` label supplied by the HTTP boundary; no email or
 * other profile field is ever present.
 *
 * Recovery semantics enforced by the API contract:
 *   - 409 -> REFRESH the inbox; NEVER surface a success state.
 *   - 404 -> the row is terminal/foreign/absent; REMOVE it from the inbox
 *     (never a retryable error, never an error toast).
 *   - 503 on approve -> the claim/finalize may have committed but the response
 *     was lost; surface Finalizing and offer ONLY `resume` of the persisted
 *     locked course + original reviewer, and ONLY when the reloaded persisted
 *     row is finalizing. A reloaded actionable/missing row yields `failed`
 *     with any in-memory claim cleared, so no phantom Resume is ever offered.
 *   - Finalizing rows LOCK the persisted course/original reviewer: reject and
 *     different-course approve actions are refused LOCALLY with zero network
 *     traffic; only an exact same-course approve (resume) may dispatch.
 */

// --------------------------------------------------------------------------
// Client DTO (see
// src/modules/school-admin/course-requests/schemas.ts + types.ts)
// --------------------------------------------------------------------------

export interface CourseRequestDocument {
  readonly documentId: number;
  readonly type: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly url: string;
}

export interface CourseRequestActionableRow {
  readonly courseRequestId: number;
  readonly requestStatus: "RoutedToSchool";
  readonly requestedCourseName: string;
  /** Name-only submitter label resolved server-side; never an email or id. */
  readonly submitterName: string;
  /** Submission timestamp (`created_at`), rendered as a readable date. */
  readonly submittedAt: string;
  readonly routedBy: number;
  readonly routedAt: string;
  readonly matchedSchoolCourseId: null;
  readonly reviewedBy: null;
  readonly reviewedAt: null;
  readonly documents: readonly CourseRequestDocument[];
}

export interface CourseRequestFinalizingRow {
  readonly courseRequestId: number;
  readonly requestStatus: "RoutedToSchool";
  readonly requestedCourseName: string;
  /** Name-only submitter label resolved server-side; never an email or id. */
  readonly submitterName: string;
  /** Submission timestamp (`created_at`), rendered as a readable date. */
  readonly submittedAt: string;
  readonly routedBy: number;
  readonly routedAt: string;
  readonly matchedSchoolCourseId: number;
  readonly reviewedBy: number;
  readonly reviewedAt: null;
  readonly documents: readonly CourseRequestDocument[];
}

export type CourseRequestInboxRow = CourseRequestActionableRow | CourseRequestFinalizingRow;

export interface CourseRequestCandidate {
  readonly schoolCourseId: number;
  readonly courseName: string;
  readonly courseCode: string | null;
  readonly degree: string | null;
  readonly courseStatus: "Active";
}

export interface CourseRequestInbox {
  readonly schoolId: number;
  readonly routed: readonly CourseRequestActionableRow[];
  readonly finalizing: readonly CourseRequestFinalizingRow[];
  readonly courses: readonly CourseRequestCandidate[];
}

// --------------------------------------------------------------------------
// Typed inputs
// --------------------------------------------------------------------------

export type CourseRequestDecisionAction = "approve" | "reject";

/** Client decision input (wire uses snake_case keys; see buildCourseDecisionBody). */
export type CourseRequestDecision =
  | { readonly action: "approve"; readonly courseId: number }
  | { readonly action: "reject"; readonly remarks: string };

/** Actions the UI may offer for a row, derived from its persisted state. */
export type CourseRequestInboxAction = "approve" | "reject" | "resume";

// --------------------------------------------------------------------------
// Exhaustive outcome + status modeling (compiler-enforced)
// --------------------------------------------------------------------------

export function assertNeverCourseRequestVariant(value: never): never {
  throw new Error(`Unhandled course-request variant: ${JSON.stringify(value)}`);
}

/** The six statuses the course-request API contract can return. */
export type CourseRequestHttpStatus = 400 | 401 | 403 | 404 | 409 | 503;

/**
 * Exhaustive disposition of every contract status. Switch on this to force the
 * compiler to prove all six statuses are handled.
 */
export type CourseRequestStatusDisposition =
  | { readonly kind: "input"; readonly status: 400 }
  | { readonly kind: "unauthenticated"; readonly status: 401 }
  | { readonly kind: "forbidden"; readonly status: 403 }
  | { readonly kind: "gone"; readonly status: 404 }
  | { readonly kind: "stale"; readonly status: 409 }
  | { readonly kind: "retryable"; readonly status: 503 };

export function normalizeCourseRequestStatus(status: number): CourseRequestHttpStatus {
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

export function dispositionForCourseRequestStatus(
  status: CourseRequestHttpStatus,
): CourseRequestStatusDisposition {
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
      return assertNeverCourseRequestVariant(status);
  }
}

/** Parsed `{ result }` payload of a successful decision PATCH. */
export interface CourseRequestDecisionResult {
  readonly courseRequestId: number;
  readonly requestStatus: "Approved" | "Rejected";
  readonly matchedSchoolCourseId: number | null;
  readonly reviewedBy: number;
  readonly reviewedAt: string;
  readonly adminRemarks: string | null;
}

/** Every terminal state a course-request decision can reach. */
export type CourseRequestOutcome =
  | {
      readonly kind: "approved";
      readonly action: "approve";
      readonly requestId: number;
      readonly result: CourseRequestDecisionResult;
    }
  | {
      readonly kind: "rejected";
      readonly action: "reject";
      readonly requestId: number;
      readonly result: CourseRequestDecisionResult;
    }
  | {
      readonly kind: "stale";
      readonly action: CourseRequestDecisionAction;
      readonly requestId: number;
      readonly status: 409;
      readonly message: string;
      readonly reloaded: CourseRequestInboxRow | null;
    }
  | {
      readonly kind: "removed";
      readonly action: CourseRequestDecisionAction;
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
      readonly claim: CourseFinalizingClaim | null;
      readonly reloaded: CourseRequestInboxRow | null;
    }
  | {
      readonly kind: "failed";
      readonly action: CourseRequestDecisionAction;
      readonly requestId: number;
      readonly status: number;
      readonly message: string;
      readonly disposition: CourseRequestStatusDisposition;
    };

export type CourseRequestFeedbackTone = "success" | "finalizing" | "stale" | "removed" | "error";

export interface CourseRequestFeedback {
  readonly tone: CourseRequestFeedbackTone;
  readonly message: string;
}

/**
 * Persisted reviewer/course lock: the ONLY thing `resume` may consume. It is
 * always derived from persisted row fields (`matchedSchoolCourseId` +
 * `reviewedBy`), never invented client-side.
 */
export interface CourseFinalizingClaim {
  readonly requestId: number;
  readonly courseId: number;
  readonly reviewedBy: number;
}

/** Row-level state union. Only `actionable` accepts a fresh approve/reject. */
export type CourseInboxRowState = { readonly kind: "actionable" } | { readonly kind: "finalizing" };

// --------------------------------------------------------------------------
// Typed errors
// --------------------------------------------------------------------------

export class CourseInboxLoadError extends Error {
  public readonly name = "CourseInboxLoadError";
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export class CourseDecisionParseError extends Error {
  public readonly name = "CourseDecisionParseError";
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// --------------------------------------------------------------------------
// Pure parsing helpers (closed-world: unknown keys fail, malformed throws)
// --------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNonBlankText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDocument(value: unknown): CourseRequestDocument | null {
  if (!isRecord(value)) return null;
  const { documentId, type, fileName, mimeType, url } = value;
  if (!isPositiveInteger(documentId)) return null;
  if (typeof type !== "string") return null;
  if (typeof fileName !== "string") return null;
  if (typeof mimeType !== "string") return null;
  if (typeof url !== "string") return null;
  return { documentId, type, fileName, mimeType, url };
}

function parseDocuments(value: unknown): readonly CourseRequestDocument[] | null {
  if (!Array.isArray(value)) return null;
  const documents: CourseRequestDocument[] = [];
  for (const entry of value) {
    const document = parseDocument(entry);
    if (document === null) return null;
    documents.push(document);
  }
  return documents;
}

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function readErrorMessage(json: unknown, fallback: string): string {
  if (isRecord(json) && typeof json.error === "string" && json.error.trim().length > 0) {
    return json.error;
  }
  return fallback;
}

const ACTIONABLE_ROW_KEYS = [
  "courseRequestId",
  "requestStatus",
  "requestedCourseName",
  "submitterName",
  "submittedAt",
  "routedBy",
  "routedAt",
  "matchedSchoolCourseId",
  "reviewedBy",
  "reviewedAt",
  "documents",
] as const;

const ALLOWED_ROW_KEYS: readonly string[] = ACTIONABLE_ROW_KEYS;

const CANDIDATE_KEYS: readonly string[] = [
  "schoolCourseId",
  "courseName",
  "courseCode",
  "degree",
  "courseStatus",
];

const INBOX_KEYS: readonly string[] = ["schoolId", "routed", "finalizing", "courses"];

const RESULT_KEYS: readonly string[] = [
  "courseRequestId",
  "requestStatus",
  "matchedSchoolCourseId",
  "reviewedBy",
  "reviewedAt",
  "adminRemarks",
];

function parseCandidate(value: unknown): CourseRequestCandidate | null {
  if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS)) return null;
  const { schoolCourseId, courseName, courseCode, degree, courseStatus } = value;
  if (!isPositiveInteger(schoolCourseId)) return null;
  if (!isNonBlankText(courseName)) return null;
  if (!isNullableText(courseCode)) return null;
  if (!isNullableText(degree)) return null;
  if (courseStatus !== "Active") return null;
  return { schoolCourseId, courseName, courseCode, degree, courseStatus };
}

export function parseCourseRequestInboxRow(value: unknown): CourseRequestInboxRow | null {
  if (!isRecord(value) || !hasExactKeys(value, ALLOWED_ROW_KEYS)) return null;
  const {
    courseRequestId,
    requestStatus,
    requestedCourseName,
    submitterName,
    submittedAt,
    routedBy,
    routedAt,
    matchedSchoolCourseId,
    reviewedBy,
    reviewedAt,
    documents,
  } = value;
  if (!isPositiveInteger(courseRequestId)) return null;
  if (requestStatus !== "RoutedToSchool") return null;
  if (!isNonBlankText(requestedCourseName)) return null;
  if (!isNonBlankText(submitterName)) return null;
  if (!isNonBlankText(submittedAt)) return null;
  if (!isPositiveInteger(routedBy)) return null;
  if (!isNonBlankText(routedAt)) return null;
  if (reviewedAt !== null) return null;
  const parsedDocuments = parseDocuments(documents);
  if (parsedDocuments === null) return null;
  if (matchedSchoolCourseId === null && reviewedBy === null) {
    return {
      courseRequestId,
      requestStatus,
      requestedCourseName,
      submitterName,
      submittedAt,
      routedBy,
      routedAt,
      matchedSchoolCourseId: null,
      reviewedBy: null,
      reviewedAt: null,
      documents: parsedDocuments,
    };
  }
  if (isPositiveInteger(matchedSchoolCourseId) && isPositiveInteger(reviewedBy)) {
    return {
      courseRequestId,
      requestStatus,
      requestedCourseName,
      submitterName,
      submittedAt,
      routedBy,
      routedAt,
      matchedSchoolCourseId,
      reviewedBy,
      reviewedAt: null,
      documents: parsedDocuments,
    };
  }
  // Mixed-claim hybrids (one null, one set) never cross the boundary.
  return null;
}

/** Strict parse of `{ inbox: { schoolId, routed, finalizing, courses } }`. */
export function parseCourseRequestInboxPayload(json: unknown): CourseRequestInbox {
  if (!isRecord(json) || !isRecord(json.inbox) || !hasExactKeys(json, ["inbox"])) {
    throw new CourseInboxLoadError(503, "We could not read the course requests. Please refresh the page.");
  }
  const inbox = json.inbox;
  if (!hasExactKeys(inbox, INBOX_KEYS)) {
    throw new CourseInboxLoadError(503, "We could not read the course requests. Please refresh the page.");
  }
  const { schoolId, routed, finalizing, courses } = inbox;
  if (!isPositiveInteger(schoolId)) {
    throw new CourseInboxLoadError(503, "We could not read the course requests. Please refresh the page.");
  }
  if (!Array.isArray(routed) || !Array.isArray(finalizing) || !Array.isArray(courses)) {
    throw new CourseInboxLoadError(503, "We could not read the course requests. Please refresh the page.");
  }
  const parseRows = (entries: readonly unknown[]): CourseRequestInboxRow[] => {
    const rows: CourseRequestInboxRow[] = [];
    for (const entry of entries) {
      const row = parseCourseRequestInboxRow(entry);
      if (row === null) {
        throw new CourseInboxLoadError(503, "We could not read the course requests. Please refresh the page.");
      }
      rows.push(row);
    }
    return rows;
  };
  const parsedRows = parseRows([...routed, ...finalizing]);
  const parsedCandidates: CourseRequestCandidate[] = [];
  for (const entry of courses) {
    const candidate = parseCandidate(entry);
    if (candidate === null) {
      throw new CourseInboxLoadError(503, "We could not read the course requests. Please refresh the page.");
    }
    parsedCandidates.push(candidate);
  }
  const parsedRouted: CourseRequestActionableRow[] = [];
  const parsedFinalizing: CourseRequestFinalizingRow[] = [];
  for (const row of parsedRows) {
    if (row.matchedSchoolCourseId === null) {
      parsedRouted.push(row);
    } else {
      parsedFinalizing.push(row);
    }
  }
  return { schoolId, routed: parsedRouted, finalizing: parsedFinalizing, courses: parsedCandidates };
}

function parseDecisionResultBody(value: Record<string, unknown>): CourseRequestDecisionResult | null {
  if (!hasExactKeys(value, RESULT_KEYS)) return null;
  const {
    courseRequestId,
    requestStatus,
    matchedSchoolCourseId,
    reviewedBy,
    reviewedAt,
    adminRemarks,
  } = value;
  if (!isPositiveInteger(courseRequestId)) return null;
  if (requestStatus !== "Approved" && requestStatus !== "Rejected") return null;
  if (!isNullablePositiveInteger(matchedSchoolCourseId)) return null;
  if (!isPositiveInteger(reviewedBy)) return null;
  if (!isNonBlankText(reviewedAt)) return null;
  if (!isNullableText(adminRemarks)) return null;
  return {
    courseRequestId,
    requestStatus,
    matchedSchoolCourseId,
    reviewedBy,
    reviewedAt,
    adminRemarks,
  };
}

/**
 * Strict parse of the `{ result }` PATCH payload. Any malformed shape throws;
 * the caller converts it to a non-success `failed` outcome (never success).
 */
export function parseCourseRequestDecisionResult(json: unknown): CourseRequestDecisionResult {
  if (!isRecord(json) || !isRecord(json.result) || !hasExactKeys(json, ["result"])) {
    throw new CourseDecisionParseError(503, "The decision result could not be read. Refresh the list to check the latest state.");
  }
  const result = parseDecisionResultBody(json.result);
  if (result === null) {
    throw new CourseDecisionParseError(503, "The decision result could not be read. Refresh the list to check the latest state.");
  }
  return result;
}

// --------------------------------------------------------------------------
// Pure row-state / claim helpers
// --------------------------------------------------------------------------

export function buildCourseDecisionBody(decision: CourseRequestDecision): Record<string, unknown> {
  switch (decision.action) {
    case "approve":
      return { action: "approve", matched_school_course_id: decision.courseId };
    case "reject":
      return { action: "reject", remarks: decision.remarks };
    default:
      return assertNeverCourseRequestVariant(decision);
  }
}

/**
 * Derive the persisted reviewer/course lock from a row. Only a
 * `RoutedToSchool` row carrying BOTH a positive course id and a positive
 * reviewer reports a claim; actionable rows report null so a fresh decision is
 * never mislabeled as resumable. Cold reload reconstructs Resume purely from
 * these persisted fields.
 */
export function deriveFinalizingClaim(row: CourseRequestInboxRow): CourseFinalizingClaim | null {
  if (row.matchedSchoolCourseId === null || row.reviewedBy === null) return null;
  return {
    requestId: row.courseRequestId,
    courseId: row.matchedSchoolCourseId,
    reviewedBy: row.reviewedBy,
  };
}

export function courseInboxRowState(row: CourseRequestInboxRow): CourseInboxRowState {
  return deriveFinalizingClaim(row) === null ? { kind: "actionable" } : { kind: "finalizing" };
}

export function availableCourseRequestActions(row: CourseRequestInboxRow): readonly CourseRequestInboxAction[] {
  const state = courseInboxRowState(row);
  switch (state.kind) {
    case "actionable":
      return ["approve", "reject"];
    case "finalizing":
      return ["resume"];
    default:
      return assertNeverCourseRequestVariant(state);
  }
}

export function findInboxRow(
  inbox: CourseRequestInbox | null,
  requestId: number,
): CourseRequestInboxRow | undefined {
  if (inbox === null) return undefined;
  const all: readonly CourseRequestInboxRow[] = [...inbox.routed, ...inbox.finalizing];
  return all.find((row) => row.courseRequestId === requestId);
}

export function findCandidate(
  inbox: CourseRequestInbox | null,
  courseId: number,
): CourseRequestCandidate | undefined {
  if (inbox === null) return undefined;
  return inbox.courses.find((candidate) => candidate.schoolCourseId === courseId);
}

export function removeInboxRow(inbox: CourseRequestInbox | null, requestId: number): CourseRequestInbox | null {
  if (inbox === null) return null;
  return {
    ...inbox,
    routed: inbox.routed.filter((row) => row.courseRequestId !== requestId),
    finalizing: inbox.finalizing.filter((row) => row.courseRequestId !== requestId),
  };
}

/**
 * True when a newly loaded inbox belongs to a different school than the one
 * already cached, in which case all per-row feedback/claims must be wiped so
 * no other school's data or decision history is ever shown.
 */
export function shouldResetCourseRequestState(
  previousSchoolId: number | null,
  nextSchoolId: number,
): boolean {
  return previousSchoolId !== null && previousSchoolId !== nextSchoolId;
}

/** True when a decision for this row is already in flight: duplicate submits must be blocked. */
export function isRowBusy(busyByRow: Readonly<Record<number, boolean>>, requestId: number): boolean {
  return busyByRow[requestId] === true;
}

// --------------------------------------------------------------------------
// Exhaustive feedback (every outcome kind maps to exactly one tone)
// --------------------------------------------------------------------------

export function feedbackForCourseRequestOutcome(outcome: CourseRequestOutcome): CourseRequestFeedback {
  switch (outcome.kind) {
    case "approved":
      return {
        tone: "success",
        message:
          outcome.result.requestStatus === "Approved"
            ? "Course request approved. The selected course was saved on the student's record."
            : "Your decision was saved.",
      };
    case "rejected":
      return { tone: "success", message: "Course request rejected." };
    case "stale":
      return {
        tone: "stale",
        message: `${outcome.message} The list was refreshed, so check the latest details, then try again.`,
      };
    case "removed":
      return {
        tone: "removed",
        message: "This request is no longer in your list.",
      };
    case "finalizing":
      return {
        tone: "finalizing",
        message:
          "Your approval may already be saved, but the page did not get the response. Press Resume to finish it. The saved course cannot be changed.",
      };
    case "failed":
      return { tone: "error", message: outcome.message };
    default:
      return assertNeverCourseRequestVariant(outcome);
  }
}

// --------------------------------------------------------------------------
// Decision executor (pure; drive with a mock fetch)
// --------------------------------------------------------------------------

export interface CourseRequestDecisionDeps {
  readonly fetchImpl: typeof fetch;
  readonly findRow: (id: number) => CourseRequestInboxRow | undefined;
  readonly refetchInbox: () => Promise<CourseRequestInbox | null>;
  readonly removeRow: (id: number) => void;
  readonly getClaim: (id: number) => CourseFinalizingClaim | undefined;
  readonly setClaim: (id: number, claim: CourseFinalizingClaim | undefined) => void;
  readonly setFeedback: (id: number, feedback: CourseRequestFeedback) => void;
}

function messageForStatus(status: CourseRequestHttpStatus): string {
  switch (status) {
    case 400:
      return "Something was wrong with this decision. Refresh the list and try again.";
    case 401:
      return "Your session has ended. Sign in again.";
    case 403:
      return "You do not have permission to decide this request.";
    case 404:
      return "This request was not found.";
    case 409:
      return "This request changed before your decision was saved.";
    case 503:
      return "Course requests are temporarily unavailable. Please try again.";
    default:
      return assertNeverCourseRequestVariant(status);
  }
}

function failedOutcome(
  action: CourseRequestDecisionAction,
  requestId: number,
  status: number,
  message: string,
): Extract<CourseRequestOutcome, { kind: "failed" }> {
  return {
    kind: "failed",
    action,
    requestId,
    status,
    message,
    disposition: dispositionForCourseRequestStatus(normalizeCourseRequestStatus(status)),
  };
}

function validateDecisionInput(
  requestId: number,
  decision: CourseRequestDecision,
): Extract<CourseRequestOutcome, { kind: "failed" }> | null {
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return failedOutcome(decision.action, requestId, 400, "Something went wrong with this request. Refresh the list and try again.");
  }
  if (decision.action === "approve") {
    if (!Number.isInteger(decision.courseId) || decision.courseId <= 0) {
      return failedOutcome(decision.action, requestId, 400, "Select a course before approving.");
    }
    return null;
  }
  if (decision.remarks.trim().length === 0) {
    return failedOutcome(decision.action, requestId, 400, "Enter a reason to reject this request.");
  }
  return null;
}

/**
 * Refuse locally against the persisted lock BEFORE any network call: a
 * finalizing row rejects `reject` and any `approve` for a different course.
 * Only an exact same-course approve (resume) may proceed to the server, which
 * remains authoritative.
 */
function guardPersistedLock(
  row: CourseRequestInboxRow | undefined,
  requestId: number,
  decision: CourseRequestDecision,
): Extract<CourseRequestOutcome, { kind: "failed" }> | null {
  if (row === undefined) return null;
  const claim = deriveFinalizingClaim(row);
  if (claim === null) return null;
  if (decision.action === "reject") {
    return failedOutcome(
      decision.action,
      requestId,
      409,
      "This request is already being approved. Press Resume to finish it.",
    );
  }
  if (decision.courseId !== claim.courseId) {
    return failedOutcome(
      decision.action,
      requestId,
      409,
      "This request is already being approved with a different course. Press Resume to finish it.",
    );
  }
  return null;
}

export async function executeCourseRequestDecision(
  deps: CourseRequestDecisionDeps,
  requestId: number,
  decision: CourseRequestDecision,
): Promise<CourseRequestOutcome> {
  const action = decision.action;

  const invalid = validateDecisionInput(requestId, decision);
  if (invalid !== null) {
    deps.setFeedback(requestId, feedbackForCourseRequestOutcome(invalid));
    return invalid;
  }

  const locked = guardPersistedLock(deps.findRow(requestId), requestId, decision);
  if (locked !== null) {
    deps.setFeedback(requestId, feedbackForCourseRequestOutcome(locked));
    return locked;
  }

  let res: Response;
  try {
    res = await deps.fetchImpl(`/api/school-admin/course-requests/${String(requestId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCourseDecisionBody(decision)),
      cache: "no-store",
    });
  } catch {
    const outcome = failedOutcome(action, requestId, 503, messageForStatus(503));
    deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
    return outcome;
  }

  // Single read: never call res.json() twice.
  const json: unknown = await res.json().catch(() => null);

  if (res.ok) {
    try {
      const result = parseCourseRequestDecisionResult(json);
      if (action === "approve" && result.requestStatus !== "Approved") {
        throw new CourseDecisionParseError(503, "The approval result was not what we expected. Refresh the list to check the latest state.");
      }
      if (action === "reject" && result.requestStatus !== "Rejected") {
        throw new CourseDecisionParseError(503, "The rejection result was not what we expected. Refresh the list to check the latest state.");
      }
      if (result.courseRequestId !== requestId) {
        throw new CourseDecisionParseError(503, "The decision result could not be read. Refresh the list to check the latest state.");
      }
      if (action === "reject") {
        deps.removeRow(requestId);
        deps.setClaim(requestId, undefined);
        const outcome: CourseRequestOutcome = { kind: "rejected", action: "reject", requestId, result };
        deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
        return outcome;
      }
      await deps.refetchInbox();
      deps.setClaim(requestId, undefined);
      const outcome: CourseRequestOutcome = { kind: "approved", action: "approve", requestId, result };
      deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
      return outcome;
    } catch (parseError: unknown) {
      const outcome = failedOutcome(
        action,
        requestId,
        503,
        parseError instanceof CourseDecisionParseError
          ? parseError.message
          : "The decision result could not be read. Refresh the list to check the latest state.",
      );
      deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
      return outcome;
    }
  }

  const status = normalizeCourseRequestStatus(res.status);
  const message = readErrorMessage(json, messageForStatus(status));

  switch (status) {
    case 409: {
      const reloaded = await deps.refetchInbox();
      const reloadedRow = reloaded === null ? null : (findInboxRow(reloaded, requestId) ?? null);
      const reloadedClaim = reloadedRow === null ? null : deriveFinalizingClaim(reloadedRow);
      deps.setClaim(requestId, reloadedClaim ?? undefined);
      const outcome: CourseRequestOutcome = {
        kind: "stale",
        action,
        requestId,
        status: 409,
        message,
        reloaded: reloadedRow,
      };
      deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
      return outcome;
    }
    case 404: {
      deps.removeRow(requestId);
      deps.setClaim(requestId, undefined);
      const outcome: CourseRequestOutcome = { kind: "removed", action, requestId, status: 404, message };
      deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
      return outcome;
    }
    case 503: {
      if (action === "approve") {
        const reloaded = await deps.refetchInbox();
        const reloadedRow = reloaded === null ? null : (findInboxRow(reloaded, requestId) ?? null);
        const persistedClaim = reloadedRow === null ? null : deriveFinalizingClaim(reloadedRow);
        if (reloadedRow !== null && persistedClaim !== null) {
          deps.setClaim(requestId, persistedClaim);
          const outcome: CourseRequestOutcome = {
            kind: "finalizing",
            action: "approve",
            requestId,
            status: 503,
            message,
            claim: persistedClaim,
            reloaded: reloadedRow,
          };
          deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
          return outcome;
        }
        // Resume is exposed ONLY from persisted finalizing fields: a reloaded
        // actionable/missing row clears any in-memory claim so no phantom
        // Resume is ever offered.
        deps.setClaim(requestId, undefined);
      }
      const outcome = failedOutcome(action, requestId, 503, messageForStatus(503));
      deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
      return outcome;
    }
    case 400:
    case 401:
    case 403: {
      const outcome = failedOutcome(action, requestId, status, message);
      deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
      return outcome;
    }
    default:
      return assertNeverCourseRequestVariant(status);
  }
}

/**
 * Resume the persisted locked course + original reviewer. The lock is
 * reconstructed from PERSISTED row fields (cold reload, second admin, crash
 * recovery); an in-memory claim is only a fallback. The request body carries
 * just the locked course id: the server preserves the original reviewer, so
 * resume never replaces it. Academics/course selection are never invented
 * here. A fresh actionable row or a missing lock fails locally with zero
 * network traffic.
 */
export async function resumeCourseRequestDecision(
  deps: CourseRequestDecisionDeps,
  requestId: number,
): Promise<CourseRequestOutcome> {
  const row = deps.findRow(requestId);
  const persistedClaim = row === undefined ? null : deriveFinalizingClaim(row);
  const claim = persistedClaim ?? deps.getClaim(requestId) ?? null;
  if (claim === null || (row !== undefined && courseInboxRowState(row).kind === "actionable")) {
    const outcome = failedOutcome(
      "approve",
      requestId,
      409,
      "This request has no saved approval to resume.",
    );
    deps.setFeedback(requestId, feedbackForCourseRequestOutcome(outcome));
    return outcome;
  }
  return executeCourseRequestDecision(deps, requestId, { action: "approve", courseId: claim.courseId });
}

// --------------------------------------------------------------------------
// Course creation bridge (pure; drive with a mock create fn)
// --------------------------------------------------------------------------

export interface CourseCreateDeps {
  readonly createCourse: (data: CreateCourseDTO) => Promise<unknown>;
  readonly refetchInbox: () => Promise<CourseRequestInbox | null>;
}

/**
 * Invoke the EXISTING `executeCreateSchoolCourse`, convert success/error to
 * the `AddCourseModal` `Promise<boolean>` contract, then refetch candidates on
 * success. Never selects a course and never approves anything: no decision
 * PATCH is issued here, so the request stays `RoutedToSchool` until an
 * explicit separate approval.
 */
export async function executeCreateCourseRequest(
  deps: CourseCreateDeps,
  data: CreateCourseDTO,
): Promise<boolean> {
  try {
    await deps.createCourse(data);
  } catch {
    return false;
  }
  await deps.refetchInbox();
  return true;
}

// --------------------------------------------------------------------------
// The hook
// --------------------------------------------------------------------------

export interface UseCourseRequestsResult {
  readonly inbox: CourseRequestInbox | null;
  readonly schoolId: number | null;
  readonly routed: readonly CourseRequestActionableRow[];
  readonly finalizing: readonly CourseRequestFinalizingRow[];
  readonly courses: readonly CourseRequestCandidate[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly feedbackByRow: Readonly<Record<number, CourseRequestFeedback>>;
  readonly claims: Readonly<Record<number, CourseFinalizingClaim>>;
  readonly busyByRow: Readonly<Record<number, boolean>>;
  readonly createBusy: boolean;
  readonly loadInbox: () => Promise<CourseRequestInbox | null>;
  readonly approveCourseRequest: (requestId: number, courseId: number) => Promise<CourseRequestOutcome>;
  readonly rejectCourseRequest: (requestId: number, remarks: string) => Promise<CourseRequestOutcome>;
  readonly resumeCourseRequest: (requestId: number) => Promise<CourseRequestOutcome>;
  readonly createCourse: (data: CreateCourseDTO) => Promise<boolean>;
}

export function useCourseRequests(): UseCourseRequestsResult {
  const [inbox, setInbox] = useState<CourseRequestInbox | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackByRow, setFeedbackByRow] = useState<Record<number, CourseRequestFeedback>>({});
  const [claims, setClaims] = useState<Record<number, CourseFinalizingClaim>>({});
  const [busyByRow, setBusyByRow] = useState<Record<number, boolean>>({});
  const [createBusy, setCreateBusy] = useState(false);
  const schoolIdRef = useRef<number | null>(null);

  // Never cache another school's data: a schoolId change wipes per-row state.
  const applyInbox = useCallback((next: CourseRequestInbox | null) => {
    if (next === null) {
      setInbox(null);
      return;
    }
    const previous = schoolIdRef.current;
    if (shouldResetCourseRequestState(previous, next.schoolId)) {
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

  const refetchInbox = useCallback(async (): Promise<CourseRequestInbox | null> => {
    try {
      const res = await fetchImpl("/api/school-admin/course-requests", { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) return null;
      const parsed = parseCourseRequestInboxPayload(json);
      applyInbox(parsed);
      return parsed;
    } catch {
      return null;
    }
  }, [applyInbox, fetchImpl]);

  const loadInbox = useCallback(async (): Promise<CourseRequestInbox | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchImpl("/api/school-admin/course-requests", { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        throw new CourseInboxLoadError(res.status, readErrorMessage(json, "Something went wrong while loading. Please try again."));
      }
      const parsed = parseCourseRequestInboxPayload(json);
      applyInbox(parsed);
      return parsed;
    } catch (err: unknown) {
      setError(err instanceof CourseInboxLoadError ? err.message : "Something went wrong while loading. Please try again.");
      setInbox(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [applyInbox, fetchImpl]);

  const removeRow = useCallback((requestId: number) => {
    setInbox((prev) => removeInboxRow(prev, requestId));
  }, []);

  const makeDecisionDeps = (): CourseRequestDecisionDeps => ({
    fetchImpl,
    findRow: (id: number) => findInboxRow(inbox, id),
    refetchInbox,
    removeRow,
    getClaim: (id: number) => claims[id],
    setClaim: (id: number, claim: CourseFinalizingClaim | undefined) => {
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
    setFeedback: (id: number, feedback: CourseRequestFeedback) =>
      setFeedbackByRow((prev) => ({ ...prev, [id]: feedback })),
  });

  const blockedDuplicate = (requestId: number): CourseRequestOutcome | null => {
    if (!isRowBusy(busyByRow, requestId)) return null;
    const outcome = failedOutcome(
      "approve",
      requestId,
      409,
      "Your decision is still being saved. Please wait.",
    );
    setFeedbackByRow((prev) => ({ ...prev, [requestId]: feedbackForCourseRequestOutcome(outcome) }));
    return outcome;
  };

  const approveCourseRequest = async (
    requestId: number,
    courseId: number,
  ): Promise<CourseRequestOutcome> => {
    const blocked = blockedDuplicate(requestId);
    if (blocked !== null) return blocked;
    setBusyByRow((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await executeCourseRequestDecision(makeDecisionDeps(), requestId, {
        action: "approve",
        courseId,
      });
    } finally {
      setBusyByRow((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const rejectCourseRequest = async (
    requestId: number,
    remarks: string,
  ): Promise<CourseRequestOutcome> => {
    const blocked = blockedDuplicate(requestId);
    if (blocked !== null) return blocked;
    setBusyByRow((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await executeCourseRequestDecision(makeDecisionDeps(), requestId, {
        action: "reject",
        remarks,
      });
    } finally {
      setBusyByRow((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const resumeCourseRequest = async (requestId: number): Promise<CourseRequestOutcome> => {
    const blocked = blockedDuplicate(requestId);
    if (blocked !== null) return blocked;
    setBusyByRow((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await resumeCourseRequestDecision(makeDecisionDeps(), requestId);
    } finally {
      setBusyByRow((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const createCourse = async (data: CreateCourseDTO): Promise<boolean> => {
    setCreateBusy(true);
    try {
      return await executeCreateCourseRequest({ createCourse: executeCreateSchoolCourse, refetchInbox }, data);
    } finally {
      setCreateBusy(false);
    }
  };

  return {
    inbox,
    schoolId: inbox?.schoolId ?? null,
    routed: inbox?.routed ?? [],
    finalizing: inbox?.finalizing ?? [],
    courses: inbox?.courses ?? [],
    loading,
    error,
    feedbackByRow,
    claims,
    busyByRow,
    createBusy,
    loadInbox,
    approveCourseRequest,
    rejectCourseRequest,
    resumeCourseRequest,
    createCourse,
  };
}
