// src/modules/freelancer/freelancer-applications/components/application-table/ApplicationProgressTimeline.tsx
"use client";

import React from "react";
import {
  Calendar,
  CheckCircle,
  Clock,
  ClipboardList,
  FileCheck,
  Star,
  Users,
  XCircle,
  XOctagon,
} from "lucide-react";
import type { ApplicationItem, ApplicationStatus } from "../../types";

interface Props {
  status: ApplicationStatus;
  application?: ApplicationItem | null;
}

function getStageIcon(stageType: string) {
  switch (stageType) {
    case "APPLIED":
      return Clock;
    case "SCREENING":
      return FileCheck;
    case "ASSESSMENT":
      return ClipboardList;
    case "INTERVIEW":
      return Users;
    case "OFFER":
      return Star;
    case "HIRED":
      return CheckCircle;
    case "REJECTED":
      return XCircle;
    case "WITHDRAWN":
      return XOctagon;
    default:
      return Clock;
  }
}

export function ApplicationProgressTimeline({ status, application }: Props) {
  const isRejected = status === "REJECTED";
  const isWithdrawn = status === "WITHDRAWN";

  const allStages = application?.pipeline_stages || [];
  // Main progression line includes non-rejected / non-withdrawn stages in stage_order
  const linearStages = allStages.length > 0
    ? allStages
        .filter((s) => s.stage_type !== "REJECTED" && s.stage_type !== "WITHDRAWN")
        .sort((a, b) => a.stage_order - b.stage_order)
    : [];

  const currentStage = application?.current_stage;
  const currentStageId = application?.current_stage_id;
  const stageHistory = application?.stage_history || [];

  // Map to store reached date for a stage if recorded in history
  const historyDateMap = new Map<number, string>();
  stageHistory.forEach((h) => {
    if (h.to_stage_id && h.created_at) {
      historyDateMap.set(h.to_stage_id, h.created_at);
    }
  });

  // Fallback: If no dynamic stages exist from pipeline snapshot, use default 4 stages
  if (linearStages.length === 0) {
    const defaultSteps = [
      { label: "Application Submitted", desc: "Your application was successfully submitted.", statusKey: "APPLIED" },
      { label: "Shortlisted", desc: "The employer has shortlisted you for potential opportunities.", statusKey: "SHORTLISTED" },
      { label: "Interviewing", desc: "You have entered the interview phase with the employer.", statusKey: "INTERVIEWING" },
      { label: "Hired", desc: "Congratulations! You have been hired for this role.", statusKey: "HIRED" },
    ];
    const statusOrder = ["APPLIED", "SHORTLISTED", "INTERVIEWING", "HIRED"];
    const currentIndex = Math.max(0, statusOrder.indexOf(status));
    const visibleDefaultSteps = defaultSteps.slice(0, currentIndex + 1);

    return (
      <div className="border border-border bg-muted/20 p-5 rounded-xl space-y-4">
        <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-bold">
          Application Progress
        </p>

        <div className="relative pl-8 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
          {isRejected ? (
            <>
              <div className="relative flex gap-4 items-start">
                <span className="absolute -left-[29px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-background">
                  <CheckCircle className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Application Submitted</p>
                  <p className="text-sm md:text-xs text-muted-foreground mt-0.5">
                    Your application was successfully submitted.
                  </p>
                </div>
              </div>

              <div className="relative flex gap-4 items-start">
                <span className="absolute -left-[29px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-rose-500 text-white ring-4 ring-background">
                  <XCircle className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">Application Closed / Rejected</p>
                  <p className="text-sm md:text-xs text-muted-foreground mt-0.5">
                    The employer decided not to move forward with your application.
                  </p>
                </div>
              </div>
            </>
          ) : isWithdrawn ? (
            <div className="relative flex gap-4 items-start">
              <span className="absolute -left-[29px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-zinc-500 text-white ring-4 ring-background">
                <XOctagon className="h-3.5 w-3.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Withdrawn</p>
                <p className="text-sm md:text-xs text-muted-foreground mt-0.5">
                  You voluntarily withdrew your application.
                </p>
              </div>
            </div>
          ) : (
            visibleDefaultSteps.map((step, idx) => {
              const isCompleted = idx < currentIndex || status === "HIRED";
              const isActive = idx === currentIndex && status !== "HIRED";

              let iconBg = "bg-muted text-muted-foreground";
              let labelColor = "text-muted-foreground";
              let Icon = Clock;

              if (isCompleted) {
                iconBg = "bg-emerald-500 text-white";
                labelColor = "text-foreground font-medium";
                Icon = CheckCircle;
              } else if (isActive) {
                iconBg = "bg-primary text-primary-foreground ring-4 ring-primary/20";
                labelColor = "text-primary font-semibold";
                if (idx === 1) Icon = Star;
                else if (idx === 2) Icon = Calendar;
                else Icon = Clock;
              }

              return (
                <div key={idx} className="relative flex gap-4 items-start">
                  <span
                    className={`absolute -left-[29px] flex h-[22px] w-[22px] items-center justify-center rounded-full text-white ring-4 ring-background ${iconBg}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <p className={`text-sm ${labelColor}`}>{step.label}</p>
                    <p className="text-sm md:text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // Dynamic Pipeline Rendering: Only show stages reached up to currentStageIndex
  let currentStageIndex = linearStages.findIndex((s) => s.id === currentStageId);
  if (currentStageIndex === -1 && currentStage?.stage_order != null) {
    currentStageIndex = linearStages.findIndex((s) => s.stage_order >= currentStage.stage_order);
  }
  if (currentStageIndex === -1) {
    currentStageIndex = 0;
  }

  const visibleStages = linearStages.slice(0, currentStageIndex + 1);
  const isTerminalSuccess = status === "HIRED" || currentStage?.stage_type === "HIRED";

  return (
    <div className="border border-border bg-muted/20 p-5 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm md:text-xs text-muted-foreground uppercase tracking-wider font-bold">
          Application Progress & Hiring Pipeline
        </p>
        {currentStage && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Current: {currentStage.stage_name}
          </span>
        )}
      </div>

      <div className="relative pl-8 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
        {visibleStages.map((stage, idx) => {
          const isCompleted =
            isTerminalSuccess ||
            idx < currentStageIndex;

          const isActive =
            !isRejected &&
            !isWithdrawn &&
            !isTerminalSuccess &&
            idx === currentStageIndex;

          let iconBg = "bg-muted text-muted-foreground";
          let labelColor = "text-muted-foreground";
          let Icon = getStageIcon(stage.stage_type);

          if (isCompleted) {
            iconBg = "bg-emerald-500 text-white";
            labelColor = "text-foreground font-medium";
            Icon = CheckCircle;
          } else if (isActive) {
            iconBg = "bg-primary text-primary-foreground ring-4 ring-primary/20";
            labelColor = "text-primary font-semibold";
          }

          return (
            <div key={stage.id} className="relative flex gap-4 items-start">
              <span
                className={`absolute -left-[29px] flex h-[22px] w-[22px] items-center justify-center rounded-full text-white ring-4 ring-background ${iconBg}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className={`text-sm ${labelColor}`}>{stage.stage_name}</p>
                </div>
                <p className="text-sm md:text-xs text-muted-foreground mt-0.5">
                  {stage.description || (isActive ? "Application currently under review in this stage." : "")}
                </p>
              </div>
            </div>
          );
        })}

        {/* Terminal Rejected State */}
        {isRejected && (
          <div className="relative flex gap-4 items-start">
            <span className="absolute -left-[29px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-rose-500 text-white ring-4 ring-background">
              <XCircle className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">Application Closed / Rejected</p>
              <p className="text-sm md:text-xs text-muted-foreground mt-0.5">
                The employer decided not to move forward with your application.
              </p>
            </div>
          </div>
        )}

        {/* Terminal Withdrawn State */}
        {isWithdrawn && (
          <div className="relative flex gap-4 items-start">
            <span className="absolute -left-[29px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-zinc-500 text-white ring-4 ring-background">
              <XOctagon className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">Withdrawn</p>
              <p className="text-sm md:text-xs text-muted-foreground mt-0.5">
                You voluntarily withdrew this application.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

