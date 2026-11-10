"use client";

// src/modules/client/interviews/InterviewsModule.tsx

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useInterviews } from "./hooks/useInterviews";
import { useRealtime } from "@/modules/shared/providers/RealtimeProvider";
import InterviewList from "./components/InterviewList";
import InterviewBigCalendar from "./components/InterviewBigCalendar";
import InterviewForm, { JobOption, ApplicantOption } from "./components/InterviewForm";
import InterviewDetailsModal from "./components/InterviewDetailsModal";
import InterviewEvaluationModal from "./components/InterviewEvaluationModal";
import CancelInterviewModal from "./components/CancelInterviewModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CalendarDays, Plus, Search, Calendar, List } from "lucide-react";
import { Interview, InterviewFormData, InterviewStatus } from "./types";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import CompanyVerificationGuard from "../components/CompanyVerificationGuard";

const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "RESCHEDULED", label: "Rescheduled" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function InterviewsModule() {
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const {
    interviews,
    loading,
    saving,
    filterStatus,
    setFilterStatus,
    search,
    setSearch,
    loadInterviews,
    createInterview,
    updateStatus,
    saveEvaluation,
    clearMessages,
    EMPTY_FORM,
  } = useInterviews();

  const { subscribe } = useRealtime();

  const [availableJobs, setAvailableJobs] = useState<JobOption[]>([]);
  const [availableApplicants, setAvailableApplicants] = useState<ApplicantOption[]>([]);

  useEffect(() => {
    fetch("/api/client/applicants", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (json.jobs) setAvailableJobs(json.jobs);
        if (json.applicants) setAvailableApplicants(json.applicants);
      })
      .catch((e) => console.error("Error fetching available jobs/applicants:", e));
  }, []);

  useEffect(() => {
    const unsubscribe = subscribe("vs_interview_schedule", ({ data }) => {
      if (data && data.length > 0) {
        loadInterviews();
      }
    });
    return () => unsubscribe();
  }, [subscribe, loadInterviews]);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [formData, setFormData] = useState<InterviewFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof InterviewFormData, string>>>({});
  const [isRescheduling, setIsRescheduling] = useState(false);

  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [evaluationOpen, setEvaluationOpen] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [interviewToCancel, setInterviewToCancel] = useState<Interview | null>(null);

  const searchParams = useSearchParams();
  const targetInterviewId =
    searchParams.get("interviewId") ||
    searchParams.get("interview_id") ||
    searchParams.get("id");

  useEffect(() => {
    loadInterviews();
  }, [loadInterviews]);

  useEffect(() => {
    if (targetInterviewId && interviews.length > 0) {
      const match = interviews.find(
        (iv) => iv.interview_id === Number(targetInterviewId)
      );
      if (match) {
        const timer = setTimeout(() => {
          setSelectedInterview(match);
          setDetailsOpen(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [targetInterviewId, interviews]);

  const handleOpenSchedule = () => {
    clearMessages();
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setIsRescheduling(false);
    setScheduleDialogOpen(true);
  };

  const handleOpenReschedule = (interview: Interview) => {
    clearMessages();
    setSelectedInterview(interview);

    // Convert DB scheduled_at string to datetime-local format "YYYY-MM-DDTHH:mm" without UTC shift
    let localDatetime = "";
    if (interview.scheduled_at) {
      const normalized = interview.scheduled_at.replace(" ", "T");
      const match = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
      if (match) {
        localDatetime = match[1];
      } else {
        const d = new Date(normalized);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          const hours = String(d.getHours()).padStart(2, "0");
          const mins = String(d.getMinutes()).padStart(2, "0");
          localDatetime = `${year}-${month}-${day}T${hours}:${mins}`;
        }
      }
    }

    const appIds = interview.applications
      ? interview.applications.map((a) => a.application_id)
      : [];

    setFormData({
      interview_id: String(interview.interview_id),
      application_ids: appIds,
      scheduled_at: localDatetime,
      duration_minutes: interview.duration_minutes ?? 60,
      timezone: interview.timezone || "Asia/Manila",
      interview_format: interview.interview_format,
      meeting_link: interview.meeting_link || "",
      meeting_location: interview.meeting_location || "",
      interview_notes: interview.interview_notes || "",
    });
    setFormErrors({});
    setIsRescheduling(true);
    setScheduleDialogOpen(true);
  };

  const handleFieldChange = (field: keyof InterviewFormData, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveInterview = async () => {
    const errors: Partial<Record<keyof InterviewFormData, string>> = {};
    if (!isRescheduling && (!formData.application_ids || formData.application_ids.length === 0))
      errors.application_ids = "Please select at least one candidate application attendee.";
    if (!formData.scheduled_at) errors.scheduled_at = "Scheduled Date & Time is required.";
    if (!formData.interview_format) errors.interview_format = "Interview format is required.";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    if (isRescheduling && formData.interview_id) {
      const ok = await updateStatus(
        Number(formData.interview_id),
        "RESCHEDULED",
        formData
      );
      if (ok) setScheduleDialogOpen(false);
    } else {
      const ok = await createInterview(formData);
      if (ok) {
        setScheduleDialogOpen(false);
        loadInterviews();
      }
    }
  };

  const handleViewDetails = (interview: Interview) => {
    setSelectedInterview(interview);
    setDetailsOpen(true);
  };

  const handleOpenEvaluation = (interview: Interview) => {
    setSelectedInterview(interview);
    setEvaluationOpen(true);
  };

  const handleOpenCancelModal = (interview: Interview) => {
    setInterviewToCancel(interview);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (interviewId: number, reason: string) => {
    return await updateStatus(interviewId, "CANCELLED", { cancel_reason: reason });
  };

  const handleScheduleForDate = (dateStr: string) => {
    setIsRescheduling(false);
    setFormData({
      application_ids: [],
      scheduled_at: `${dateStr}T09:00`,
      duration_minutes: 60,
      timezone: "Asia/Manila",
      interview_format: "ONLINE",
      meeting_link: "",
      meeting_location: "",
      interview_notes: "",
    });
    setFormErrors({});
    setScheduleDialogOpen(true);
  };

  return (
    <CompanyVerificationGuard moduleName="Interviews Workspace">
      <div className="space-y-4 md:space-y-6 client-page-transition">
        <style>{`
          @keyframes page-entry {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .client-page-transition {
            animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card/70 backdrop-blur-xl border border-primary/10 shadow-lg shadow-primary/5 p-4 sm:p-8 rounded-2xl relative overflow-hidden text-foreground">
          <div className="absolute right-0 top-0 h-40 w-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4 relative z-10">
            <div className="p-3 bg-primary/10 text-primary backdrop-blur-md rounded-2xl border border-primary/15">
              <CalendarDays className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Interview & Batch Screening Workspace</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Schedule candidate batch interviews, review screening answers, and record individual candidate evaluations.
              </p>
            </div>
          </div>

          <Button
            onClick={handleOpenSchedule}
            className="relative z-10 h-10 max-md:min-h-10 px-5 max-md:px-4 text-sm max-md:text-xs md:text-xs font-semibold rounded-full bg-gradient-to-r from-primary to-info text-primary-foreground hover:brightness-110 border-0 shadow-lg shadow-primary/25 gap-2 transition-all"
          >
            <Plus className="h-4 w-4" />
            Schedule Interview
          </Button>
        </div>



        {/* Filter & View Switcher Card */}
        <Card className="shadow-sm border bg-card rounded-xl py-0 gap-0 overflow-hidden">
          <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 p-4 max-md:p-3 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-md:gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                Schedule & Interviews
              </CardTitle>

              {/* View Switcher Toggle Buttons */}
              <div className="flex items-center p-0.5 bg-zinc-200/60 dark:bg-zinc-800/80 rounded-lg">
                <button
                  type="button"
                  onClick={() => setViewMode("calendar")}
                  className={`flex items-center gap-1.5 px-3 max-md:px-2.5 py-1 max-md:min-h-10 text-xs font-semibold rounded-md transition-all ${
                    viewMode === "calendar"
                      ? "bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Big Calendar
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 max-md:px-2.5 py-1 max-md:min-h-10 text-xs font-semibold rounded-md transition-all ${
                    viewMode === "list"
                      ? "bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-2xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  List View
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 max-md:gap-2 flex-wrap">
              {/* Search */}
              <div className="relative w-full max-md:min-w-0 max-md:flex-1 sm:w-60">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search candidate / role..."
                  className="h-8 pl-8 md:text-xs max-md:h-10 max-md:pr-2.5 max-md:text-base rounded-lg"
                />
              </div>

              {/* Filter */}
              <div className="flex items-center min-w-[150px]">
                <SearchableSelect
                  options={STATUS_FILTER_OPTIONS}
                  value={filterStatus}
                  onValueChange={(val) => setFilterStatus(val as InterviewStatus | "ALL")}
                  placeholder="All Statuses"
                  className="h-8 max-md:min-h-10 max-md:text-xs md:text-xs rounded-lg border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 px-2.5 shadow-2xs font-semibold"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <span className="text-sm text-zinc-400">Loading interviews...</span>
              </div>
            ) : viewMode === "calendar" ? (
              <InterviewBigCalendar
                interviews={interviews}
                onViewDetails={handleViewDetails}
                onOpenEvaluation={handleOpenEvaluation}
                onReschedule={handleOpenReschedule}
                onOpenCancelModal={handleOpenCancelModal}
                onScheduleDate={handleScheduleForDate}
                availableJobs={availableJobs}
                availableApplicants={availableApplicants}
                saving={saving}
                onCreateInterview={createInterview}
                onUpdateStatus={updateStatus}
                onSaveEvaluation={saveEvaluation}
                onConfirmCancel={handleConfirmCancel}
              />
            ) : (
              <InterviewList
                interviews={interviews}
                onViewDetails={handleViewDetails}
                onOpenEvaluation={handleOpenEvaluation}
                onReschedule={handleOpenReschedule}
                onOpenCancelModal={handleOpenCancelModal}
              />
            )}
          </CardContent>
        </Card>

        {/* Schedule / Reschedule Dialog */}
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-y-auto max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">
                {isRescheduling ? "Reschedule Candidate Interview" : "Schedule New Candidate Interview"}
              </DialogTitle>
            </DialogHeader>

            <InterviewForm
              data={formData}
              onChange={handleFieldChange}
              errors={formErrors}
              disableApplicationId={isRescheduling}
              existingInterviews={interviews}
              availableJobs={availableJobs}
              availableApplicants={availableApplicants}
            />

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)} disabled={saving} className="h-9 max-md:min-h-10 text-sm md:text-xs rounded-lg">
                Cancel
              </Button>
              <Button
                onClick={handleSaveInterview}
                disabled={saving}
                className="h-9 max-md:min-h-10 text-sm md:text-xs rounded-lg bg-[#14a800] hover:bg-[#118f00] text-white border-0 font-medium"
              >
                {saving
                  ? "Saving..."
                  : isRescheduling
                  ? "Reschedule Interview"
                  : "Schedule Interview"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Details & Screening Answers Modal */}
        <InterviewDetailsModal
          interview={selectedInterview}
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          onOpenEvaluation={handleOpenEvaluation}
          onReschedule={handleOpenReschedule}
          onOpenCancelModal={handleOpenCancelModal}
        />

        {/* Evaluation & Rating Modal */}
        <InterviewEvaluationModal
          interview={selectedInterview}
          open={evaluationOpen}
          saving={saving}
          onClose={() => setEvaluationOpen(false)}
          onSubmitEvaluation={saveEvaluation}
        />

        {/* Cancel Interview Reason Modal */}
        <CancelInterviewModal
          interview={interviewToCancel}
          open={cancelModalOpen}
          saving={saving}
          onClose={() => setCancelModalOpen(false)}
          onConfirmCancel={handleConfirmCancel}
        />
      </div>
    </CompanyVerificationGuard>
  );
}
