// src/modules/vos-admin/request-management/components/SchoolDemandTable.tsx
//
// Grouped schools-awaiting-account demand. Rows come exclusively from
// `groupAwaitingAccountDemand`, so one row is one exact `matched_school_id`
// and groups that share requested-school text are never merged. The table
// summarizes demand only: a single `View requests` action hands the whole
// group to the caller, and no Route/Group/Reject control exists here. The
// account state stays `Waiting for account` because refinement belongs to the
// lazy detail surface, never to this table.
"use client";

import { useMemo } from "react";
import type { Column, ColumnDef, SortingFn } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/new-data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  groupAwaitingAccountDemand,
  type AwaitingSchoolGroup,
} from "../dashboard/school-demand.selectors";
import type { VsSchoolRequest } from "../types/request.types";

type DemandColumnDef = ColumnDef<AwaitingSchoolGroup, unknown>;

function columnMenuLabel(label: string): DemandColumnDef["meta"] {
  return { label } as DemandColumnDef["meta"];
}

const PH_DATE_TIME = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Asia/Manila",
});

export interface SchoolDemandTableProps {
  /** Unresolved rows from the school-request DTO; grouped by the selector. */
  readonly rows: readonly VsSchoolRequest[];
  readonly isLoading?: boolean;
  /** Sanitized load failure message; when set the table is replaced. */
  readonly error?: string | null;
  readonly onRetry?: () => void;
  /** Hands the exact-id group to the caller; decides nothing here. */
  readonly onViewRequests: (group: AwaitingSchoolGroup) => void;
}

function formatTimestamp(value: string | null): string {
  if (value === null) return "Unknown";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Unknown" : PH_DATE_TIME.format(parsed);
}

function sortableTime(value: string | null): number {
  if (value === null) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function locationLabel(group: AwaitingSchoolGroup): string | null {
  const parts = [group.displayCity, group.displayProvince].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? null : parts.join(", ");
}

function schoolLabel(group: AwaitingSchoolGroup): string {
  return group.displayName === "" ? "Unnamed school" : group.displayName;
}

function SortableHeader({
  column,
  label,
  alignEnd = false,
}: {
  column: Column<AwaitingSchoolGroup, unknown>;
  label: string;
  alignEnd?: boolean;
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={`inline-flex cursor-pointer items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none ${
        alignEnd ? "w-full justify-end" : ""
      }`}
    >
      {label}
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden="true" />
      <span className="sr-only">
        {sorted === "asc" ? " sorted ascending" : sorted === "desc" ? " sorted descending" : " sortable"}
      </span>
    </button>
  );
}

function numberColumn(
  id: "requestCount" | "distinctRequesterCount",
  label: string,
  testId: string,
): ColumnDef<AwaitingSchoolGroup, unknown> {
  return {
    id,
    meta: columnMenuLabel(label),
    sortDescFirst: true,
    accessorFn: (group) => group[id],
    header: ({ column }) => <SortableHeader column={column} label={label} alignEnd />,
    cell: ({ row }) => (
      <span
        className="block text-right tabular-nums"
        data-testid={`${testId}-${row.original.matchedSchoolId}`}
      >
        {row.original[id]}
      </span>
    ),
  };
}

function dateColumn(
  id: "oldestCreatedAt" | "latestCreatedAt",
  label: string,
  testId: string,
): ColumnDef<AwaitingSchoolGroup, unknown> {
  return {
    id,
    meta: columnMenuLabel(label),
    sortDescFirst: false,
    accessorFn: (group) => sortableTime(group[id]),
    header: ({ column }) => <SortableHeader column={column} label={label} />,
    cell: ({ row }) => (
      <span
        className="whitespace-nowrap tabular-nums"
        title={row.original[id] ?? undefined}
        data-testid={`${testId}-${row.original.matchedSchoolId}`}
      >
        {formatTimestamp(row.original[id])}
      </span>
    ),
  };
}

const schoolSort: SortingFn<AwaitingSchoolGroup> = (a, b) => {
  const left = a.original;
  const right = b.original;
  if (left.normalizedKey !== right.normalizedKey) {
    return left.normalizedKey < right.normalizedKey ? -1 : 1;
  }
  return left.matchedSchoolId - right.matchedSchoolId;
};

function buildColumns(
  onViewRequests: (group: AwaitingSchoolGroup) => void,
): ColumnDef<AwaitingSchoolGroup, unknown>[] {
  return [
    {
      id: "school",
      meta: columnMenuLabel("Requested school"),
      accessorFn: (group) =>
        [group.displayName, group.displayCity, group.displayProvince]
          .filter((part): part is string => part !== null)
          .join(" "),
      header: ({ column }) => <SortableHeader column={column} label="Requested school" />,
      sortingFn: schoolSort,
      enableHiding: false,
      cell: ({ row }) => (
        <div
          className="flex flex-col gap-0.5"
          data-testid={`school-demand-row-${row.original.matchedSchoolId}`}
          data-row-school-id={row.original.matchedSchoolId}
        >
          <span className="font-medium break-words">{schoolLabel(row.original)}</span>
          <span className="text-xs text-muted-foreground">
            {locationLabel(row.original) ?? `School #${row.original.matchedSchoolId}`}
          </span>
        </div>
      ),
    },
    {
      id: "accountState",
      meta: columnMenuLabel("Account state"),
      header: "Account state",
      enableSorting: false,
      cell: () => <StatusBadge tone="info">Waiting for account</StatusBadge>,
    },
    numberColumn("requestCount", "Requests", "school-demand-count"),
    numberColumn("distinctRequesterCount", "Requesters", "school-demand-requesters"),
    dateColumn("oldestCreatedAt", "Oldest", "school-demand-oldest"),
    dateColumn("latestCreatedAt", "Latest", "school-demand-latest"),
    {
      id: "actions",
      meta: columnMenuLabel("Actions"),
      header: () => <div className="text-right">Actions</div>,
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewRequests(row.original)}
            aria-label={`View requests for ${schoolLabel(row.original)} (school #${row.original.matchedSchoolId})`}
            data-testid={`school-demand-view-${row.original.matchedSchoolId}`}
          >
            View requests
          </Button>
        </div>
      ),
    },
  ];
}

export function SchoolDemandTable({
  rows,
  isLoading = false,
  error = null,
  onRetry,
  onViewRequests,
}: SchoolDemandTableProps) {
  const groups = useMemo(() => groupAwaitingAccountDemand(rows), [rows]);
  const data = useMemo(() => [...groups], [groups]);
  const columns = useMemo(() => buildColumns(onViewRequests), [onViewRequests]);

  if (error !== null) {
    return (
      <div
        data-testid="school-demand-error"
        role="alert"
        className="flex flex-col justify-between gap-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 sm:flex-row sm:items-center"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Schools awaiting account could not be loaded.</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        </div>
        {onRetry !== undefined ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            data-testid="school-demand-error-retry"
            className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 hover:text-red-800"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-testid="school-demand-table"
      role="region"
      aria-label="Schools awaiting account demand"
      aria-busy={isLoading}
      className="motion-reduce:[&_.animate-pulse]:animate-none motion-reduce:[&_.animate-spin]:animate-none motion-reduce:[&_.animate-in]:animate-none [&_.justify-between.px-2]:flex-wrap [&_.justify-between.px-2]:gap-y-2 [&_.justify-between.px-2>div:last-child]:flex-wrap [&_.justify-between.px-2>div:last-child]:justify-end [&_.justify-between.px-2>div:last-child]:gap-y-2 [&_td:last-child]:sticky [&_td:last-child]:right-0 [&_td:last-child]:z-10 [&_td:last-child]:border-l [&_td:last-child]:border-border/60 [&_td:last-child]:bg-card [&_th:last-child]:sticky [&_th:last-child]:right-0 [&_th:last-child]:z-10 [&_th:last-child]:border-l [&_th:last-child]:border-border/60 [&_th:last-child]:bg-card"
    >
      <DataTable
        columns={columns}
        data={data}
        searchKey="school"
        isLoading={isLoading}
        emptyTitle="No schools awaiting account"
        emptyDescription="Requests that name an exact school appear here once they are matched. Requests without a matched school stay in the unrouted queue."
      />
    </div>
  );
}
