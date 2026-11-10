"use client";

import { useState, useCallback } from 'react';
import { useRequestAbort } from '@/hooks/useRequestAbort';
import { VsSchoolRequest, VsCourseRequest, ReviewAction } from '../types/request.types';
import type {
  CourseAvailableAction,
  CourseDecisionAction,
  CourseDecisionFeedback,
  CourseDecisionOutcome,
  CourseRequestCandidate,
  CourseRequestCandidatesResult,
  CourseRequestDecision,
  PersistedCourseClaim,
  RequestStatus,
} from '../types/request.types';

export function assertNeverCourseVariant(value: never): never {
  throw new Error(`Unhandled course variant: ${JSON.stringify(value)}`);
}

export interface SchoolInviteLink {
  readonly invitationUrl: string;
  readonly expiresAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readDecisionErrorMessage(json: unknown, fallback: string): string {
  if (isRecord(json) && typeof json.error === 'string') return json.error;
  return fallback;
}

export class CourseCandidatesLoadError extends Error {
  public readonly name = 'CourseCandidatesLoadError';
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function parseCandidate(value: unknown): CourseRequestCandidate | null {
  if (!isRecord(value)) return null;
  const { school_course_id, school_id, course_name, course_code, degree, course_status } = value;
  if (typeof school_course_id !== 'number') return null;
  if (typeof school_id !== 'number') return null;
  if (typeof course_name !== 'string') return null;
  if (course_code !== null && typeof course_code !== 'string') return null;
  if (degree !== null && typeof degree !== 'string') return null;
  if (course_status !== 'Active') return null;
  return { school_course_id, school_id, course_name, course_code, degree, course_status: 'Active' };
}

export function parseCourseCandidatesPayload(json: unknown): CourseRequestCandidatesResult {
  if (!isRecord(json)) throw new CourseCandidatesLoadError(503, 'Course candidate response was malformed.');
  const { requestId, schoolId, candidates } = json;
  if (typeof requestId !== 'number' || typeof schoolId !== 'number' || !Array.isArray(candidates)) {
    throw new CourseCandidatesLoadError(503, 'Course candidate response was malformed.');
  }
  const parsed: CourseRequestCandidate[] = [];
  for (const entry of candidates) {
    const candidate = parseCandidate(entry);
    if (!candidate) throw new CourseCandidatesLoadError(503, 'Course candidate response was malformed.');
    parsed.push(candidate);
  }
  return { requestId, schoolId, candidates: parsed };
}

export async function loadCourseRequestCandidates(
  fetchImpl: typeof fetch,
  requestId: number,
): Promise<CourseRequestCandidatesResult> {
  if (!Number.isInteger(requestId) || requestId <= 0) {
    throw new CourseCandidatesLoadError(400, 'Course request id must be a positive integer.');
  }
  const res = await fetchImpl(`/api/vos-admin/course-requests/${requestId}/candidates`);
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    throw new CourseCandidatesLoadError(res.status, readDecisionErrorMessage(json, 'Failed to load course candidates.'));
  }
  return parseCourseCandidatesPayload(json);
}

export function buildCourseDecisionBody(decision: CourseRequestDecision): Record<string, unknown> {
  switch (decision.action) {
    case 'Approved': {
      const body: Record<string, unknown> = {
        action: 'Approved',
        matched_school_course_id: decision.matched_school_course_id,
      };
      if (decision.admin_remarks !== undefined) body.admin_remarks = decision.admin_remarks;
      return body;
    }
    case 'Rejected':
      return { action: 'Rejected', admin_remarks: decision.admin_remarks };
    case 'RoutedToSchool': {
      const body: Record<string, unknown> = { action: 'RoutedToSchool' };
      if (decision.admin_remarks !== undefined) body.admin_remarks = decision.admin_remarks;
      return body;
    }
    default:
      return assertNeverCourseVariant(decision);
  }
}

export function decisionVerb(action: CourseDecisionAction): string {
  switch (action) {
    case 'Approved':
      return 'approved';
    case 'Rejected':
      return 'rejected';
    case 'RoutedToSchool':
      return 'routed to school';
    default:
      return assertNeverCourseVariant(action);
  }
}

export function applyCourseRequestRow(
  prev: readonly VsCourseRequest[],
  row: VsCourseRequest,
): VsCourseRequest[] {
  return prev.map((entry) => (entry.course_request_id === row.course_request_id ? row : entry));
}

export function availableCourseActions(
  status: RequestStatus,
  claim: PersistedCourseClaim | undefined,
): readonly CourseAvailableAction[] {
  switch (status) {
    case 'Pending':
      return claim !== undefined && claim.phase === 'finalizing' ? ['resume'] : ['approve', 'route', 'reject'];
    case 'Approved':
    case 'Rejected':
    case 'RoutedToSchool':
      return [];
    default:
      return assertNeverCourseVariant(status);
  }
}

export function resolveClaimInitiator(
  reloaded: VsCourseRequest | null,
  preservedInitiator: number | null | undefined,
  submittedBy?: number,
): number | null {
  if (typeof preservedInitiator === 'number') return preservedInitiator;
  if (typeof reloaded?.reviewed_by === 'number') return reloaded.reviewed_by;
  if (typeof submittedBy === 'number') return submittedBy;
  return preservedInitiator ?? null;
}

export function shouldRetainFinalizing(reloaded: VsCourseRequest | null, claim: PersistedCourseClaim): boolean {
  if (reloaded === null) return true;
  return (
    reloaded.request_status === 'Pending' &&
    reloaded.matched_school_course_id === claim.courseId &&
    typeof reloaded.reviewed_by === 'number'
  );
}

export function feedbackForOutcome(outcome: CourseDecisionOutcome): CourseDecisionFeedback {
  switch (outcome.kind) {
    case 'decided':
      return { tone: 'success', message: `Course request ${decisionVerb(outcome.action)}.` };
    case 'stale':
      return {
        tone: 'stale',
        message: `Stale data: ${outcome.message} The list was refreshed; review the current row before retrying.`,
      };
    case 'finalizing':
      return {
        tone: 'finalizing',
        message:
          'The decision claim may have committed but the response was lost. The persisted course was reloaded; only Resume is available.',
      };
    case 'failed':
      return { tone: 'error', message: outcome.message };
    default:
      return assertNeverCourseVariant(outcome);
  }
}

function asCourseRequest(json: unknown): VsCourseRequest | null {
  if (!isRecord(json) || !isRecord(json.request)) return null;
  if (typeof json.request.course_request_id !== 'number') return null;
  return json.request as unknown as VsCourseRequest;
}

export interface CourseDecisionOptions {
  readonly submittedBy?: number;
}

export interface CourseDecisionDeps {
  readonly fetchImpl: typeof fetch;
  readonly findRow: (id: number) => VsCourseRequest | undefined;
  readonly replaceRow: (row: VsCourseRequest) => void;
  readonly refetchRow: (id: number) => Promise<VsCourseRequest | null>;
  readonly getClaim: (id: number) => PersistedCourseClaim | undefined;
  readonly setClaim: (id: number, claim: PersistedCourseClaim | undefined) => void;
  readonly setFeedback: (id: number, feedback: CourseDecisionFeedback) => void;
  readonly submittedBy?: number;
}

export async function executeCourseDecision(
  deps: CourseDecisionDeps,
  requestId: number,
  decision: CourseRequestDecision,
  options?: CourseDecisionOptions,
): Promise<CourseDecisionOutcome> {
  const action = decision.action;
  if (!Number.isInteger(requestId) || requestId <= 0) {
    const outcome: CourseDecisionOutcome = {
      kind: 'failed',
      action,
      requestId,
      status: 400,
      message: 'Course request id must be a positive integer.',
    };
    deps.setFeedback(requestId, feedbackForOutcome(outcome));
    return outcome;
  }
  const submittedBy = options?.submittedBy ?? deps.submittedBy;
  let res: Response;
  try {
    res = await deps.fetchImpl(`/api/vos-admin/course-requests/${requestId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildCourseDecisionBody(decision)),
    });
  } catch {
    const outcome: CourseDecisionOutcome = {
      kind: 'failed',
      action,
      requestId,
      status: 503,
      message: 'Course request storage is temporarily unavailable.',
    };
    deps.setFeedback(requestId, feedbackForOutcome(outcome));
    return outcome;
  }
  const json = (await res.json()) as unknown;
  if (res.ok) {
    const row = asCourseRequest(json);
    if (row !== null && row.course_request_id === requestId) {
      deps.replaceRow(row);
    } else {
      await deps.refetchRow(requestId);
    }
    deps.setClaim(requestId, undefined);
    const decided = deps.findRow(requestId) ?? (row !== null && row.course_request_id === requestId ? row : undefined);
    if (decided === undefined) {
      const outcome: CourseDecisionOutcome = {
        kind: 'failed',
        action,
        requestId,
        status: 503,
        message: 'Course request storage is temporarily unavailable.',
      };
      deps.setFeedback(requestId, feedbackForOutcome(outcome));
      return outcome;
    }
    const outcome: CourseDecisionOutcome = { kind: 'decided', action, request: decided };
    deps.setFeedback(requestId, feedbackForOutcome(outcome));
    return outcome;
  }
  const message = readDecisionErrorMessage(json, 'Failed to review course request.');
  if (res.status === 409) {
    const reloaded = await deps.refetchRow(requestId);
    const claim = deps.getClaim(requestId);
    if (claim !== undefined && reloaded !== null && !shouldRetainFinalizing(reloaded, claim)) {
      deps.setClaim(requestId, undefined);
    }
    const outcome: CourseDecisionOutcome = { kind: 'stale', action, requestId, message, reloaded };
    deps.setFeedback(requestId, feedbackForOutcome(outcome));
    return outcome;
  }
  if (res.status === 503 && decision.action === 'Approved') {
    const reloaded = await deps.refetchRow(requestId);
    const existing = deps.getClaim(requestId);
    const initiator = resolveClaimInitiator(reloaded, existing?.claimInitiator, submittedBy);
    const claim: PersistedCourseClaim = {
      requestId,
      courseId: decision.matched_school_course_id,
      claimInitiator: initiator,
      phase: 'finalizing',
    };
    deps.setClaim(requestId, claim);
    const outcome: CourseDecisionOutcome = {
      kind: 'finalizing',
      requestId,
      courseId: claim.courseId,
      claimInitiator: claim.claimInitiator,
      persistedCourse: reloaded,
    };
    deps.setFeedback(requestId, feedbackForOutcome(outcome));
    return outcome;
  }
  if (res.status === 503) {
    await deps.refetchRow(requestId);
  }
  const outcome: CourseDecisionOutcome = { kind: 'failed', action, requestId, status: res.status, message };
  deps.setFeedback(requestId, feedbackForOutcome(outcome));
  return outcome;
}

export async function resumeCourseDecision(
  deps: CourseDecisionDeps,
  requestId: number,
  options?: CourseDecisionOptions,
): Promise<CourseDecisionOutcome> {
  const claim = deps.getClaim(requestId);
  if (claim !== undefined) {
    return executeCourseDecision(
      deps,
      requestId,
      { action: 'Approved', matched_school_course_id: claim.courseId },
      { submittedBy: options?.submittedBy ?? deps.submittedBy },
    );
  }
  // Cold-recovery: no in-memory claim (reload / second admin / crash recovery).
  // The persisted row already carries the locked course id + original reviewer
  // (effectiveCourseClaim shape). Re-dispatch approve with that locked id; the
  // server claim is idempotent on exact replay (reviewer preserved) and 409s
  // on any conflicting state, so no guard is weakened.
  const persisted = deps.findRow(requestId);
  if (
    persisted !== undefined &&
    persisted.request_status === 'Pending' &&
    typeof persisted.matched_school_course_id === 'number' &&
    typeof persisted.reviewed_by === 'number'
  ) {
    return executeCourseDecision(
      deps,
      requestId,
      { action: 'Approved', matched_school_course_id: persisted.matched_school_course_id },
      { submittedBy: options?.submittedBy ?? deps.submittedBy },
    );
  }
  const outcome: CourseDecisionOutcome = {
    kind: 'failed',
    action: 'Approved',
    requestId,
    status: 409,
    message: 'There is no finalizing claim to resume for this course request.',
  };
  deps.setFeedback(requestId, feedbackForOutcome(outcome));
  return outcome;
}

// --- Todo 5 additions: school routing decision machinery (append-only) ---
// Mirrors the course decision machinery above for school Route/Group/Reject.
// All helpers are pure and testable with a mock fetchImpl (no React).

export function assertNeverSchoolVariant(value: never): never {
  throw new Error(`Unhandled school variant: ${JSON.stringify(value)}`);
}

/** Every VOS school decision variant (mirrors PATCH /api/vos-admin/school-requests/[id]/review). */
export type SchoolDecisionAction = 'Route' | 'Group' | 'Rejected';

/** Discriminated decision input accepted by the school review endpoint. */
export type SchoolRequestDecision =
  | { action: 'Route'; matched_school_id: number; admin_remarks?: string }
  | { action: 'Group'; matched_school_id: number; admin_remarks?: string }
  | { action: 'Rejected'; admin_remarks: string };

/**
 * Client-safe school routing candidate (structural subset of
 * GET /api/vos-admin/schools?search=). verification_route is the
 * server-classified route state; shaped, never inferred client-side.
 */
export interface SchoolRoutingCandidate {
  school_id: number;
  school_name: string;
  city_municipality: string | null;
  province: string | null;
  verification_route: string;
  school_status: string;
}

/** Actions the UI may offer for a school request row. */
export type SchoolAvailableAction = 'route' | 'group' | 'reject';

/** Feedback tone per school-request row. 409 surfaces `stale` (non-success). */
export interface SchoolDecisionFeedback {
  tone: 'success' | 'stale' | 'error';
  message: string;
}

/** Exhaustive outcome of a school decision mutation. */
export type SchoolDecisionOutcome =
  | { kind: 'decided'; action: SchoolDecisionAction; request: VsSchoolRequest }
  | { kind: 'stale'; action: SchoolDecisionAction; requestId: number; message: string; reloaded: VsSchoolRequest | null }
  | { kind: 'failed'; action: SchoolDecisionAction; requestId: number; status: number; message: string };

/**
 * Route-audit descriptor for a persisted school request. MANUAL carries the
 * VOS actor + time; SYSTEM carries only the neutral label + time (actor is
 * null for direct selection and activation-triggered release). NEVER
 * fabricate actor/time: rows with neither field report `none`.
 */
export type SchoolRouteAudit =
  | { kind: 'manual'; actor: number; routedAt: string }
  | { kind: 'system'; routedAt: string }
  | { kind: 'none' };

export function describeSchoolRouteAudit(
  row: Pick<VsSchoolRequest, 'routed_by' | 'routed_at'>,
): SchoolRouteAudit {
  if (typeof row.routed_by === 'number') {
    if (typeof row.routed_at === 'string' && row.routed_at.length > 0) {
      return { kind: 'manual', actor: row.routed_by, routedAt: row.routed_at };
    }
    return { kind: 'none' };
  }
  if (typeof row.routed_at === 'string' && row.routed_at.length > 0) {
    return { kind: 'system', routedAt: row.routed_at };
  }
  return { kind: 'none' };
}

/** Neutral system-route label rendered when the actor is null. */
export const SYSTEM_ROUTE_LABEL = 'System routed';

export function renderSchoolRouteAudit(audit: SchoolRouteAudit): string | null {
  switch (audit.kind) {
    case 'manual':
      return `Routed by ${audit.actor} at ${audit.routedAt}`;
    case 'system':
      return `${SYSTEM_ROUTE_LABEL} at ${audit.routedAt}`;
    case 'none':
      return null;
    default:
      return assertNeverSchoolVariant(audit);
  }
}

export class SchoolSearchError extends Error {
  public readonly name = 'SchoolSearchError';
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function parseSchoolCandidate(value: unknown): SchoolRoutingCandidate | null {
  if (!isRecord(value)) return null;
  const { school_id, school_name, city_municipality, province, verification_route, school_status } = value;
  if (typeof school_id !== 'number') return null;
  if (typeof school_name !== 'string') return null;
  if (city_municipality !== null && typeof city_municipality !== 'string') return null;
  if (province !== null && typeof province !== 'string') return null;
  if (typeof verification_route !== 'string') return null;
  if (typeof school_status !== 'string') return null;
  return { school_id, school_name, city_municipality, province, verification_route, school_status };
}

export function parseSchoolSearchPayload(json: unknown): SchoolRoutingCandidate[] {
  if (!isRecord(json) || !Array.isArray(json.schools)) {
    throw new SchoolSearchError(503, 'School search response was malformed.');
  }
  const parsed: SchoolRoutingCandidate[] = [];
  for (const entry of json.schools) {
    const candidate = parseSchoolCandidate(entry);
    if (!candidate) throw new SchoolSearchError(503, 'School search response was malformed.');
    parsed.push(candidate);
  }
  return parsed;
}

/**
 * All-state server-classified correction search. Blank/whitespace-only
 * queries return [] without a network call; terms over 100 chars surface a
 * 400 error instead of silently truncating.
 */
export async function searchSchoolsForRouting(
  fetchImpl: typeof fetch,
  query: string,
): Promise<SchoolRoutingCandidate[]> {
  const term = query.trim();
  if (term.length === 0) return [];
  if (term.length > 100) {
    throw new SchoolSearchError(400, 'Search term must be 100 characters or fewer.');
  }
  const res = await fetchImpl(`/api/vos-admin/schools?search=${encodeURIComponent(term)}`);
  const json = (await res.json()) as unknown;
  if (!res.ok) {
    throw new SchoolSearchError(res.status, readDecisionErrorMessage(json, 'Failed to search schools.'));
  }
  return parseSchoolSearchPayload(json);
}

export function buildSchoolDecisionBody(decision: SchoolRequestDecision): Record<string, unknown> {
  switch (decision.action) {
    case 'Route': {
      const body: Record<string, unknown> = {
        action: 'Route',
        matched_school_id: decision.matched_school_id,
      };
      if (decision.admin_remarks !== undefined) body.admin_remarks = decision.admin_remarks;
      return body;
    }
    case 'Group': {
      const body: Record<string, unknown> = {
        action: 'Group',
        matched_school_id: decision.matched_school_id,
      };
      if (decision.admin_remarks !== undefined) body.admin_remarks = decision.admin_remarks;
      return body;
    }
    case 'Rejected':
      return { action: 'Rejected', admin_remarks: decision.admin_remarks };
    default:
      return assertNeverSchoolVariant(decision);
  }
}

export function schoolDecisionVerb(action: SchoolDecisionAction): string {
  switch (action) {
    case 'Route':
      return 'routed';
    case 'Group':
      return 'grouped';
    case 'Rejected':
      return 'rejected';
    default:
      return assertNeverSchoolVariant(action);
  }
}

export function applySchoolRequestRow(
  prev: readonly VsSchoolRequest[],
  row: VsSchoolRequest,
): VsSchoolRequest[] {
  return prev.map((entry) => (entry.school_request_id === row.school_request_id ? row : entry));
}

export function availableSchoolActions(status: RequestStatus): readonly SchoolAvailableAction[] {
  switch (status) {
    case 'Pending':
      return ['route', 'group', 'reject'];
    case 'Approved':
    case 'Rejected':
    case 'RoutedToSchool':
      return [];
    default:
      return assertNeverSchoolVariant(status);
  }
}

export function feedbackForSchoolOutcome(outcome: SchoolDecisionOutcome): SchoolDecisionFeedback {
  switch (outcome.kind) {
    case 'decided':
      return { tone: 'success', message: `School request ${schoolDecisionVerb(outcome.action)}.` };
    case 'stale':
      return {
        tone: 'stale',
        message: `Stale data: ${outcome.message} The list was refreshed; review the current row before retrying.`,
      };
    case 'failed':
      return { tone: 'error', message: outcome.message };
    default:
      return assertNeverSchoolVariant(outcome);
  }
}

function asSchoolRequest(json: unknown): VsSchoolRequest | null {
  if (!isRecord(json) || !isRecord(json.request)) return null;
  if (typeof json.request.school_request_id !== 'number') return null;
  return json.request as unknown as VsSchoolRequest;
}

export interface SchoolDecisionDeps {
  readonly fetchImpl: typeof fetch;
  readonly findRow: (id: number) => VsSchoolRequest | undefined;
  readonly replaceRow: (row: VsSchoolRequest) => void;
  readonly refetchRow: (id: number) => Promise<VsSchoolRequest | null>;
  readonly setFeedback: (id: number, feedback: SchoolDecisionFeedback) => void;
}

export async function executeSchoolDecision(
  deps: SchoolDecisionDeps,
  requestId: number,
  decision: SchoolRequestDecision,
): Promise<SchoolDecisionOutcome> {
  const action = decision.action;
  if (!Number.isInteger(requestId) || requestId <= 0) {
    const outcome: SchoolDecisionOutcome = {
      kind: 'failed',
      action,
      requestId,
      status: 400,
      message: 'School request id must be a positive integer.',
    };
    deps.setFeedback(requestId, feedbackForSchoolOutcome(outcome));
    return outcome;
  }
  let res: Response;
  try {
    res = await deps.fetchImpl(`/api/vos-admin/school-requests/${requestId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSchoolDecisionBody(decision)),
    });
  } catch {
    const outcome: SchoolDecisionOutcome = {
      kind: 'failed',
      action,
      requestId,
      status: 503,
      message: 'School request storage is temporarily unavailable.',
    };
    deps.setFeedback(requestId, feedbackForSchoolOutcome(outcome));
    return outcome;
  }
  const json = (await res.json()) as unknown;
  if (res.ok) {
    const row = asSchoolRequest(json);
    if (row !== null && row.school_request_id === requestId) {
      deps.replaceRow(row);
    } else {
      await deps.refetchRow(requestId);
    }
    const decided = deps.findRow(requestId) ?? (row !== null && row.school_request_id === requestId ? row : undefined);
    if (decided === undefined) {
      const outcome: SchoolDecisionOutcome = {
        kind: 'failed',
        action,
        requestId,
        status: 503,
        message: 'School request storage is temporarily unavailable.',
      };
      deps.setFeedback(requestId, feedbackForSchoolOutcome(outcome));
      return outcome;
    }
    const outcome: SchoolDecisionOutcome = { kind: 'decided', action, request: decided };
    deps.setFeedback(requestId, feedbackForSchoolOutcome(outcome));
    return outcome;
  }
  const message = readDecisionErrorMessage(json, 'Failed to review school request.');
  if (res.status === 409) {
    const reloaded = await deps.refetchRow(requestId);
    const outcome: SchoolDecisionOutcome = { kind: 'stale', action, requestId, message, reloaded };
    deps.setFeedback(requestId, feedbackForSchoolOutcome(outcome));
    return outcome;
  }
  if (res.status === 503) {
    await deps.refetchRow(requestId);
    const outcome: SchoolDecisionOutcome = {
      kind: 'failed',
      action,
      requestId,
      status: res.status,
      message: 'School request storage is temporarily unavailable.',
    };
    deps.setFeedback(requestId, feedbackForSchoolOutcome(outcome));
    return outcome;
  }
  const outcome: SchoolDecisionOutcome = { kind: 'failed', action, requestId, status: res.status, message };
  deps.setFeedback(requestId, feedbackForSchoolOutcome(outcome));
  return outcome;
}

export function useRequests() {
  const [schoolRequests, setSchoolRequests] = useState<VsSchoolRequest[]>([]);
  const [courseRequests, setCourseRequests] = useState<VsCourseRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRead = useRequestAbort();
  const [courseCandidates, setCourseCandidates] = useState<Record<number, CourseRequestCandidate[]>>({});
  const [candidatesLoading, setCandidatesLoading] = useState<Record<number, boolean>>({});
  const [candidatesError, setCandidatesError] = useState<Record<number, string | null>>({});
  const [courseFeedback, setCourseFeedback] = useState<Record<number, CourseDecisionFeedback>>({});
  const [courseClaims, setCourseClaims] = useState<Record<number, PersistedCourseClaim>>({});
  const [courseDecisionBusy, setCourseDecisionBusy] = useState<Record<number, boolean>>({});
  const [schoolsForRouting, setSchoolsForRouting] = useState<Record<number, SchoolRoutingCandidate[]>>({});
  const [schoolSearchLoading, setSchoolSearchLoading] = useState<Record<number, boolean>>({});
  const [schoolSearchError, setSchoolSearchError] = useState<Record<number, string | null>>({});
  const [schoolFeedback, setSchoolFeedback] = useState<Record<number, SchoolDecisionFeedback>>({});
  const [schoolDecisionBusy, setSchoolDecisionBusy] = useState<Record<number, boolean>>({});

  const fetchSchoolRequests = useCallback(async (status: string = 'Pending') => {
    setLoading(true);
    setError(null);
    // Each status tab starts a new read; only the newest one may write, or the
    // queue under one tab is filled from another.
    const signal = abortRead();
    try {
      const q = status !== 'ALL' ? `?status=${status}` : '';
      const res = await fetch(`/api/vos-admin/school-requests${q}`, { signal });
      const json = await res.json();
      if (signal.aborted) return;
      if (!res.ok) throw new Error(json.error || 'Failed to fetch school requests');
      setSchoolRequests(json.requests ?? []);
    } catch (err: unknown) {
      if (signal.aborted) return;
      setError((err as Error).message);
      setSchoolRequests([]);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [abortRead]);

  const fetchCourseRequests = useCallback(async (status: string = 'Pending') => {
    setLoading(true);
    setError(null);
    try {
      const q = status !== 'ALL' ? `?status=${status}` : '';
      const res = await fetch(`/api/vos-admin/course-requests${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch course requests');
      setCourseRequests(json.requests ?? []);
    } catch (err: unknown) {
      setError((err as Error).message);
      setCourseRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateSchoolInvite = async (schoolId: number, email: string): Promise<SchoolInviteLink | null> => {
    try {
      const res = await fetch('/api/vos-admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, invited_email: email }),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as unknown;
      if (!isRecord(json)) return null;
      const { invitation_url, expires_at } = json;
      if (typeof invitation_url !== 'string' || typeof expires_at !== 'string') return null;
      return { invitationUrl: invitation_url, expiresAt: expires_at };
    } catch {
      return null;
    }
  };

  const reviewSchoolRequest = async (id: number, data: ReviewAction): Promise<boolean> => {
    try {
      const res = await fetch(`/api/vos-admin/school-requests/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as unknown;
      if (!res.ok) {
        const message = readDecisionErrorMessage(json, 'Failed to review school request.');
        if (res.status === 409) {
          const stale: SchoolDecisionFeedback = {
            tone: 'stale',
            message: `Stale data: ${message} The list was refreshed; review the current row before retrying.`,
          };
          setSchoolFeedback((prev) => ({ ...prev, [id]: stale }));
          await refreshSchoolRequestRow(id);
        } else if (res.status === 503) {
          await refreshSchoolRequestRow(id);
          throw new Error('School request storage is temporarily unavailable.');
        }
        throw new Error(message);
      }

      const row = asSchoolRequest(json);
      if (row !== null) {
        setSchoolRequests((prev) => applySchoolRequestRow(prev, row));
      } else {
        await refreshSchoolRequestRow(id);
      }
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    }
  };

  const reviewCourseRequest = async (id: number, data: ReviewAction): Promise<boolean> => {
    try {
      const res = await fetch(`/api/vos-admin/course-requests/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Failed to review course request');
      }
      
      const json = await res.json();
      
      // Optimistic update
      setCourseRequests(prev => prev.map(r => r.course_request_id === id ? json.request : r));
      return true;
    } catch (err: unknown) {
      setError((err as Error).message);
      return false;
    }
  };

  const fetchCourseCandidates = async (requestId: number): Promise<CourseRequestCandidatesResult | null> => {
    setCandidatesLoading((prev) => ({ ...prev, [requestId]: true }));
    setCandidatesError((prev) => ({ ...prev, [requestId]: null }));
    try {
      const result = await loadCourseRequestCandidates(fetch, requestId);
      setCourseCandidates((prev) => ({ ...prev, [requestId]: [...result.candidates] }));
      return result;
    } catch (err: unknown) {
      setCandidatesError((prev) => ({ ...prev, [requestId]: (err as Error).message }));
      return null;
    } finally {
      setCandidatesLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const refreshCourseRequestRow = async (requestId: number): Promise<VsCourseRequest | null> => {
    try {
      const res = await fetch(`/api/vos-admin/course-requests?status=ALL`);
      const json = (await res.json()) as unknown;
      if (!res.ok || !isRecord(json) || !Array.isArray(json.requests)) return null;
      const found = json.requests.find(
        (entry): entry is VsCourseRequest => isRecord(entry) && entry.course_request_id === requestId,
      ) ?? null;
      if (found !== null) setCourseRequests((prev) => applyCourseRequestRow(prev, found));
      return found;
    } catch {
      return null;
    }
  };

  const makeCourseDecisionDeps = (): CourseDecisionDeps => ({
    // Bound wrapper (not bare `fetch`): `executeCourseDecision` invokes
    // `deps.fetchImpl(...)` as a method, and native browser fetch throws
    // "Illegal invocation" when its receiver is not Window (proven by Plan 2
    // Todo 7 closure QA). The arrow calls the global directly (bound).
    fetchImpl: (...args: Parameters<typeof fetch>) => fetch(...args),
    findRow: (id: number) => courseRequests.find((entry) => entry.course_request_id === id),
    replaceRow: (row: VsCourseRequest) => setCourseRequests((prev) => applyCourseRequestRow(prev, row)),
    refetchRow: refreshCourseRequestRow,
    getClaim: (id: number) => courseClaims[id],
    setClaim: (id: number, claim: PersistedCourseClaim | undefined) => {
      setCourseClaims((prev) => {
        const next = { ...prev };
        if (claim === undefined) {
          delete next[id];
        } else {
          next[id] = claim;
        }
        return next;
      });
    },
    setFeedback: (id: number, feedback: CourseDecisionFeedback) =>
      setCourseFeedback((prev) => ({ ...prev, [id]: feedback })),
  });

  const decideCourseRequest = async (
    requestId: number,
    decision: CourseRequestDecision,
    options?: CourseDecisionOptions,
  ): Promise<CourseDecisionOutcome> => {
    setCourseDecisionBusy((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await executeCourseDecision(makeCourseDecisionDeps(), requestId, decision, options);
    } finally {
      setCourseDecisionBusy((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const resumeCourseClaim = async (
    requestId: number,
    options?: CourseDecisionOptions,
  ): Promise<CourseDecisionOutcome> => {
    setCourseDecisionBusy((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await resumeCourseDecision(makeCourseDecisionDeps(), requestId, options);
    } finally {
      setCourseDecisionBusy((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const refreshSchoolRequestRow = async (requestId: number): Promise<VsSchoolRequest | null> => {
    try {
      const res = await fetch(`/api/vos-admin/school-requests?status=ALL`);
      const json = (await res.json()) as unknown;
      if (!res.ok || !isRecord(json) || !Array.isArray(json.requests)) return null;
      const found = json.requests.find(
        (entry): entry is VsSchoolRequest => isRecord(entry) && entry.school_request_id === requestId,
      ) ?? null;
      if (found !== null) setSchoolRequests((prev) => applySchoolRequestRow(prev, found));
      return found;
    } catch {
      return null;
    }
  };

  const makeSchoolDecisionDeps = (): SchoolDecisionDeps => ({
    // Bound wrapper (not bare `fetch`): `executeSchoolDecision` invokes
    // `deps.fetchImpl(...)` as a method, and native browser fetch throws
    // "Illegal invocation" when its receiver is not Window (proven by Plan 2
    // Todo 7 closure QA). The arrow calls the global directly (bound).
    fetchImpl: (...args: Parameters<typeof fetch>) => fetch(...args),
    findRow: (id: number) => schoolRequests.find((entry) => entry.school_request_id === id),
    replaceRow: (row: VsSchoolRequest) => setSchoolRequests((prev) => applySchoolRequestRow(prev, row)),
    refetchRow: refreshSchoolRequestRow,
    setFeedback: (id: number, feedback: SchoolDecisionFeedback) =>
      setSchoolFeedback((prev) => ({ ...prev, [id]: feedback })),
  });

  const decideSchoolRequest = async (
    requestId: number,
    decision: SchoolRequestDecision,
  ): Promise<SchoolDecisionOutcome> => {
    setSchoolDecisionBusy((prev) => ({ ...prev, [requestId]: true }));
    try {
      return await executeSchoolDecision(makeSchoolDecisionDeps(), requestId, decision);
    } finally {
      setSchoolDecisionBusy((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const searchSchools = async (requestId: number, query: string): Promise<SchoolRoutingCandidate[] | null> => {
    setSchoolSearchLoading((prev) => ({ ...prev, [requestId]: true }));
    setSchoolSearchError((prev) => ({ ...prev, [requestId]: null }));
    try {
      const result = await searchSchoolsForRouting(fetch, query);
      setSchoolsForRouting((prev) => ({ ...prev, [requestId]: [...result] }));
      return result;
    } catch (err: unknown) {
      setSchoolSearchError((prev) => ({ ...prev, [requestId]: (err as Error).message }));
      return null;
    } finally {
      setSchoolSearchLoading((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  return {
    schoolRequests,
    courseRequests,
    loading,
    error,
    fetchSchoolRequests,
    fetchCourseRequests,
    reviewSchoolRequest,
    generateSchoolInvite,
    reviewCourseRequest,
    courseCandidates,
    candidatesLoading,
    candidatesError,
    courseFeedback,
    courseClaims,
    courseDecisionBusy,
    fetchCourseCandidates,
    decideCourseRequest,
    resumeCourseClaim,
    schoolsForRouting,
    schoolSearchLoading,
    schoolSearchError,
    schoolFeedback,
    schoolDecisionBusy,
    searchSchoolsForRouting: searchSchools,
    decideSchoolRequest,
    refreshSchoolRequestRow,
  };
}
