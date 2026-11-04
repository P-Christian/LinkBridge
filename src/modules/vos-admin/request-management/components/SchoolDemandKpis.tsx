// src/modules/vos-admin/request-management/components/SchoolDemandKpis.tsx
//
// Unresolved-demand KPI strip for the VOS request-management dashboard.
// Presentational only: every number arrives through the typed selector result
// (see ../dashboard/school-demand.selectors) and nothing here fetches data.
// Only the cards whose view-filter mapping is unambiguous are keyboard
// activatable; the remaining cards stay read-only summaries.

"use client";

import * as React from "react";
import { Building2, CalendarClock, Inbox, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { KpiPending, KpiValue } from "@/components/shared/KpiValue";
import type { SchoolDemandKpis as SchoolDemandKpiValues } from "../dashboard/school-demand.selectors";

/** The two view filters whose card mapping is unambiguous. */
export type SchoolDemandKpiFilter = "unrouted" | "awaiting-school";

export interface SchoolDemandKpisProps {
  kpis: SchoolDemandKpiValues;
  onFilterSelect?: (filter: SchoolDemandKpiFilter) => void;
  currentFilter?: SchoolDemandKpiFilter | null;
  loading?: boolean;
}

interface KpiCardSpec {
  readonly id: string;
  readonly title: string;
  readonly value: React.ReactNode;
  readonly Icon: React.ComponentType<{ className?: string }>;
  readonly tone: string;
  readonly tileTone: string;
  readonly filter?: SchoolDemandKpiFilter;
  readonly selectedBorder?: string;
  readonly tooltip?: string;
  readonly srContext?: string;
}

const PH_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** UTC+8 wall-clock stamp; deterministic across environments and ICU builds. */
function formatPhilippineStamp(value: string | null): string | null {
  if (value === null) return null;
  const millis = Date.parse(value);
  if (Number.isNaN(millis)) return null;
  const wall = new Date(millis + 8 * 3_600_000);
  const month = PH_MONTHS[wall.getUTCMonth()];
  const hours = wall.getUTCHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const period = hours < 12 ? "AM" : "PM";
  const minute = String(wall.getUTCMinutes()).padStart(2, "0");
  return `${month} ${wall.getUTCDate()}, ${wall.getUTCFullYear()}, ${hour12}:${minute} ${period} PHT`;
}

/** Valid, non-negative age in whole days, or null when unavailable. */
function validAgeDays(kpis: SchoolDemandKpiValues): number | null {
  const days = kpis.oldestUnresolvedAgeDays;
  return typeof days === "number" && Number.isFinite(days) && days >= 0 ? days : null;
}

export function SchoolDemandKpis({
  kpis,
  onFilterSelect,
  currentFilter,
  loading,
}: SchoolDemandKpisProps): React.ReactElement {
  const interactive = typeof onFilterSelect === "function";
  const ageDays = validAgeDays(kpis);
  const ageStamp = ageDays === null ? null : formatPhilippineStamp(kpis.oldestUnresolvedAt);
  const ageAvailable = ageDays !== null && ageStamp !== null;

  const activate = (filter: SchoolDemandKpiFilter | undefined): void => {
    if (filter === undefined) return;
    onFilterSelect?.(filter);
  };
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    filter: SchoolDemandKpiFilter | undefined,
  ): void => {
    if (filter === undefined) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    activate(filter);
  };

  const cards: readonly KpiCardSpec[] = [
    {
      id: "unrouted",
      title: "Unrouted requests",
      value: <KpiValue value={kpis.unroutedCount} loading={loading} />,
      Icon: Inbox,
      tone: "text-primary",
      tileTone: "bg-primary/10",
      filter: "unrouted",
      selectedBorder: "border-primary",
    },
    {
      id: "awaiting-school",
      title: "Schools awaiting account",
      value: <KpiValue value={kpis.awaitingSchoolCount} loading={loading} />,
      Icon: Building2,
      tone: "text-warning",
      tileTone: "bg-warning/10",
      filter: "awaiting-school",
      selectedBorder: "border-warning",
    },
    {
      id: "distinct-requesters",
      title: "Distinct requesters",
      value: <KpiValue value={kpis.distinctRequesterCount} loading={loading} />,
      Icon: Users,
      tone: "text-info",
      tileTone: "bg-info/10",
    },
    {
      id: "oldest-unresolved",
      title: "Oldest unresolved",
      value: loading ? (
        <KpiPending />
      ) : ageAvailable ? (
        <>
          <span className="tabular-nums">{ageDays}</span>
          <span className="text-sm font-medium text-muted-foreground"> days</span>
        </>
      ) : (
        <span className="text-sm font-semibold text-muted-foreground">No unresolved requests</span>
      ),
      Icon: CalendarClock,
      tone: "text-muted-foreground",
      tileTone: "bg-muted",
      tooltip: ageAvailable ? `Oldest unresolved request: created ${ageStamp}` : undefined,
      srContext: loading
        ? undefined
        : ageAvailable
          ? `Oldest unresolved request created ${ageStamp}`
          : "No unresolved requests",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {cards.map((card) => {
        const Icon = card.Icon;
        const selected = card.filter !== undefined && currentFilter === card.filter;
        const clickable = interactive && card.filter !== undefined;
        return (
          <Card
            key={card.id}
            data-kpi-card={card.id}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-pressed={clickable ? selected : undefined}
            title={card.tooltip}
            onClick={clickable ? () => activate(card.filter) : undefined}
            onKeyDown={clickable ? (event) => handleKeyDown(event, card.filter) : undefined}
            className={`border ${clickable ? "cursor-pointer transition-all hover:shadow-md motion-reduce:transition-none" : ""} ${
              selected ? card.selectedBorder : "border-border"
            } ${
              clickable
                ? "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                : ""
            }`}
          >
            <CardContent className="p-5 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
                  {card.title}
                </p>
                <p className="text-2xl font-bold mt-1 text-foreground tabular-nums">{card.value}</p>
                {card.srContext ? <span className="sr-only">{card.srContext}</span> : null}
              </div>
              <div className={`p-3 rounded-xl ${card.tileTone} ${card.tone}`}>
                <Icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
