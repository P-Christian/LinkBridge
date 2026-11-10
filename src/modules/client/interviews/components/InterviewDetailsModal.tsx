"use client";

// src/modules/client/interviews/components/InterviewDetailsModal.tsx

import React from "react";
import Image from "next/image";
import { Interview } from "../types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import InterviewStatusBadge from "./InterviewStatusBadge";

import {
  Calendar,
  Clock,
  Video,
  MapPin,
  Globe,
  MessageSquare,
  User,
  RefreshCw,
  XCircle,
  ExternalLink,

  StickyNote,
} from "lucide-react";
import {
  attendanceMeta,
  formatInterviewDate,
  formatInterviewTime,
  formatLabel,
  isActiveInterview,
  normalizeLink,
  relativeDayLabel

} from "./interviewUtils";

interface InterviewDetailsModalProps {
  interview: Interview | null;
  open: boolean;
  onClose: () => void;
  onOpenEvaluation?: (interview: Interview) => void;
  onReschedule?: (interview: Interview) => void;
  onOpenCancelModal?: (interview: Interview) => void;
}

function CandidateAvatar({ name, avatar }: { name?: string; avatar?: string | null }) {
  const [imgError, setImgError] = React.useState(false);

  if (avatar && !imgError) {
    return (
      <Image
        src={avatar}
        alt={name || "Candidate"}
        width={64}
        height={64}
        onError={() => setImgError(true)}
        className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-zinc-900 shrink-0"
      />
    );
  }

  return (
    <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-sm shrink-0">
      {(name?.[0] || "C").toUpperCase()}
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl min-w-0">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 block">{label}</span>
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 block truncate">{value}</span>
        {hint && <span className="text-xs text-zinc-400 block">{hint}</span>}
      </div>
    </div>
  );
}

export default function InterviewDetailsModal({
  interview,
  open,
  onClose,
  onOpenEvaluation,
  onReschedule,
  onOpenCancelModal,
}: InterviewDetailsModalProps) {
  if (!interview) return null;

  const applications = interview.applications ?? [];
  const active = isActiveInterview(interview);
  const isOnline = interview.interview_format === "ONLINE";
  const relative = relativeDayLabel(interview.scheduled_at);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh]">
        <DialogHeader className="space-y-1">
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Interview Details
            </DialogTitle>
            <InterviewStatusBadge
              status={interview.interview_status}
              scheduledAt={interview.scheduled_at}
              durationMinutes={interview.duration_minutes}
            />
          </div>
          <DialogDescription className="text-sm md:text-xs">
            {formatInterviewDate(interview.scheduled_at, true)} · {formatInterviewTime(interview.scheduled_at)}
            {relative ? ` · ${relative}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Cancellation reason comes first so it is never missed */}
          {interview.cancel_reason && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 rounded-xl text-sm md:text-xs text-rose-700 dark:text-rose-300">
              <span className="font-bold">Cancellation reason: </span>
              {interview.cancel_reason}
            </div>
          )}

          {/* Schedule summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <InfoTile
              icon={<Calendar className="h-4 w-4 text-indigo-500" />}
              label="Date"
              value={formatInterviewDate(interview.scheduled_at)}
              hint={relative}
            />
            <InfoTile
              icon={<Clock className="h-4 w-4 text-indigo-500" />}
              label="Time"
              value={formatInterviewTime(interview.scheduled_at)}
              hint={`${interview.duration_minutes ?? 60} minutes`}
            />
            <InfoTile
              icon={<Globe className="h-4 w-4 text-indigo-500" />}
              label="Timezone"
              value={interview.timezone || "Asia/Manila"}
            />
          </div>

          {/* Where / how */}
          <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-200">
              {isOnline ? (
                <Video className="h-4 w-4 text-emerald-500" />
              ) : (
                <MapPin className="h-4 w-4 text-amber-500" />
              )}
              {formatLabel(interview.interview_format)} interview
            </div>

            {interview.meeting_link && (
              <div className="flex items-center justify-between gap-3 flex-wrap text-sm md:text-xs">
                <span className="text-indigo-600 dark:text-indigo-400 font-mono break-all min-w-0">
                  {interview.meeting_link}
                </span>
                <Button asChild size="sm" variant="outline" className="h-8 rounded-lg gap-1.5 text-xs font-semibold">
                  <a href={normalizeLink(interview.meeting_link)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Join meeting
                  </a>
                </Button>
              </div>
            )}

            {interview.meeting_location && (
              <div className="text-sm md:text-xs text-zinc-700 dark:text-zinc-300">
                <span className="text-zinc-400">Location: </span>
                {interview.meeting_location}
              </div>
            )}

            {!interview.meeting_link && !interview.meeting_location && (
              <p className="text-sm md:text-xs text-zinc-400">
                No {isOnline ? "meeting link" : "location"} added yet. Use Reschedule to add one.
              </p>
            )}

            {interview.interview_notes && (
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-sm md:text-xs text-zinc-600 dark:text-zinc-400 flex gap-2">
                <StickyNote className="h-3.5 w-3.5 mt-0.5 text-zinc-400 shrink-0" />
                <div>
                  <span className="font-semibold text-zinc-500">Internal notes: </span>
                  {interview.interview_notes}
                </div>
              </div>
            )}
          </div>

          {/* Candidates */}
          <section className="space-y-3">
            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-indigo-500" />
              Candidates ({applications.length})
            </h4>

            {applications.length === 0 && (
              <p className="text-sm md:text-xs text-zinc-400 p-4 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center">
                No candidates are attached to this interview.
              </p>
            )}

            <div className="space-y-3">
              {applications.map((app) => {
                const attendance = attendanceMeta(app.attendance_status);


                return (
                  <div
                    key={app.interview_application_id || app.application_id}
                    className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800 rounded-xl space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <CandidateAvatar name={app.applicant_name} avatar={app.applicant_avatar} />
                        <div className="min-w-0">
                          <h5 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {app.applicant_name}
                          </h5>
                          <p className="text-sm md:text-xs text-zinc-500 truncate">
                            {app.job_title || "Position not specified"}
                          </p>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-xs md:text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${attendance.className}`}
                      >
                        {attendance.label}
                      </Badge>
                    </div>

                    {app.feedback && (
                      <div className="p-3 bg-white dark:bg-zinc-950 border border-zinc-200/60 dark:border-zinc-800 rounded-lg text-sm md:text-xs space-y-1">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <MessageSquare className="h-3.5 w-3.5" /> Recruiter feedback
                        </span>
                        <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{app.feedback}</p>
                      </div>
                    )}



                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 flex-wrap">
            {onOpenEvaluation && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenEvaluation(interview);
                }}
                className="h-8 max-md:min-h-10 text-sm md:text-xs rounded-lg gap-1.5 font-semibold"
              >
                <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                {interview.interview_status === "COMPLETED" ? "View feedback" : "Record feedback"}
              </Button>
            )}

            {active && onReschedule && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onReschedule(interview);
                }}
                className="h-8 max-md:min-h-10 text-sm md:text-xs rounded-lg gap-1.5 font-semibold text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              >
                <RefreshCw className="h-3.5 w-3.5 text-amber-500" />
                Reschedule
              </Button>
            )}

            {active && onOpenCancelModal && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenCancelModal(interview);
                }}
                className="h-8 max-md:min-h-10 text-sm md:text-xs rounded-lg gap-1.5 font-semibold text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
                Cancel interview
              </Button>
            )}
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={onClose}
            className="h-8 max-md:min-h-10 text-sm md:text-xs rounded-lg font-semibold px-4 bg-indigo-600 hover:bg-indigo-700"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}