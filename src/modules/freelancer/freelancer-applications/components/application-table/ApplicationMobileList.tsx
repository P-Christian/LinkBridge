// src/modules/freelancer/freelancer-applications/components/application-table/ApplicationMobileList.tsx
"use client";

import React from "react";
import { Eye, MoreVertical, XOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ApplicationItem } from "../../types";
import { ApplicationStatusBadge } from "./ApplicationStatusBadge";
import { AssessmentActionItem } from "./AssessmentActionItem";
import { AssessmentDueBadge } from "./AssessmentDueBadge";
import { formatDate, formatJobType } from "./formatters";

interface Props {
  applications: ApplicationItem[];
  mobileSearch?: string;
  onView: (application: ApplicationItem) => void;
  onWithdraw: (application: ApplicationItem) => void;
  onOpenAssessment: (application: ApplicationItem) => void;
}

export function ApplicationMobileList({
  applications,
  mobileSearch,
  onView,
  onWithdraw,
  onOpenAssessment,
}: Props) {
  const mobileQuery = (mobileSearch ?? "").trim().toLowerCase();
  const mobileApplications = mobileQuery
    ? applications.filter(
        (app) =>
          (app.job_title ?? "").toLowerCase().includes(mobileQuery) ||
          (app.company_name ?? "").toLowerCase().includes(mobileQuery),
      )
    : applications;

  if (mobileApplications.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
        {mobileQuery ? (
          <>
            <p className="text-base font-semibold text-foreground">No matching applications</p>
            <p className="text-sm text-muted-foreground mt-1">
              Try a different search term or clear the filter.
            </p>
          </>
        ) : (
          <>
            <p className="text-base font-semibold text-foreground">No applications found</p>
            <p className="text-sm text-muted-foreground mt-1">
              You haven&apos;t applied to any jobs yet.
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mobileApplications.map((app) => (
        <div key={app.application_id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-foreground">{app.job_title ?? "—"}</h3>
              <p className="text-sm text-muted-foreground mt-0.5 break-words">
                {[formatJobType(app.job_type), app.job_location].filter(Boolean).join(" • ")}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5 break-words">
                {app.company_name ?? "—"}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground max-md:size-11"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {app.assessment?.available && (
                  <AssessmentActionItem application={app} onOpen={onOpenAssessment} />
                )}
                <DropdownMenuItem
                  onClick={() => onView(app)}
                  className="cursor-pointer gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Application
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onWithdraw(app)}
                  className="cursor-pointer gap-2 text-rose-500 focus:text-rose-500"
                >
                  <XOctagon className="w-4 h-4" />
                  Withdraw Application
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm text-muted-foreground">{formatDate(app.applied_at)}</span>
            {app.assessment?.needs_action ? (
              <AssessmentDueBadge deadline={app.assessment?.deadline ?? null} />
            ) : (
              <ApplicationStatusBadge
                status={app.application_status}
                stageName={app.current_stage?.stage_name}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
