// src/modules/vos-admin/request-management/components/RequestStatusBadge.tsx
//
// Plan 2 Todo 7 lane A: exhaustively renders the five RequestStatus values
// plus the derived waiting indicator (grouped `Pending`: request_status is
// `Pending` AND matched_school_id is set). The old default fall-through
// rendered everything-unknown as Pending; unknown values now render an
// explicit "Unknown" badge (never silently blank). The waiting state is
// derived only and is never a stored or typed status.
import React from 'react';
import { RequestStatus, VsSchoolRequest } from '../types/request.types';

interface Props {
  status: RequestStatus;
  /** True for grouped `Pending` rows (matched_school_id set, still Pending). */
  isWaiting?: boolean;
}

/**
 * Derived waiting state: grouped `Pending` (a target school is attached but
 * the request still awaits school-side certification). Zero-DB-change model:
 * this is computed from `request_status` + `matched_school_id`, never stored.
 */
export function isWaitingSchoolRequest(
  row: Pick<VsSchoolRequest, 'request_status' | 'matched_school_id'>,
): boolean {
  return row.request_status === 'Pending' && row.matched_school_id !== null && row.matched_school_id !== undefined;
}

function WaitingPill() {
  return (
    <span
      data-testid="request-status-waiting"
      className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20"
    >
      Waiting for school
    </span>
  );
}

export function RequestStatusBadge({ status, isWaiting = false }: Props) {
  if (status === 'Approved') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        Approved
      </span>
    );
  }
  if (status === 'Rejected') {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
        Rejected
      </span>
    );
  }
  if (status === 'RoutedToSchool') {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
        Routed to School
      </span>
    );
  }
  if (status === 'Pending') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
          Pending
        </span>
        {isWaiting ? <WaitingPill /> : null}
      </span>
    );
  }
  if (status === 'AwaitingOptIn') {
    return (
      <span className="inline-flex items-center rounded-full bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/30">
        Awaiting Opt-In
      </span>
    );
  }
  // Explicit fall-through: an unknown/derived state never renders blank.
  const unknown = status as unknown as string;
  return (
    <span
      data-testid="request-status-unknown"
      className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-500/20"
    >
      {`Unknown${typeof unknown === 'string' && unknown !== '' ? `: ${unknown}` : ''}`}
    </span>
  );
}
