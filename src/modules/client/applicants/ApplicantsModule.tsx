"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApplicants } from "./hooks/useApplicants";
import ApplicantList from "./components/ApplicantList";
import ApplicantFilters from "./components/ApplicantFilters";
import StatusUpdateDrawer from "./components/StatusUpdateDrawer";
import AssessmentMoveConfirmModal from "./components/AssessmentMoveConfirmModal";
import AssessmentReviewModal from "./components/AssessmentReviewModal";
import ApplicantDetailsModal from "./components/ApplicantDetailsModal";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {AlertCircle, ArrowLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ListSkeleton from "../components/ListSkeleton";
import { Applicant, ApplicationStatus, AssessmentMoveOutcome } from "./types";
import { CANONICAL_STAGE_TYPES } from "@/modules/client/pipeline/types";
import { matchesStageFilter, EMPTY_APPLICANT_FILTERS } from "./utils/applicantFilters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useInterviews } from "../interviews/hooks/useInterviews";
import InterviewForm from "../interviews/components/InterviewForm";
import { InterviewFormData } from "../interviews/types";
import { useJobs } from "../jobs/hooks/useJobs";
import { JobPosting } from "../jobs/types";
import CompanyVerificationGuard from "../components/CompanyVerificationGuard";
import { SearchableSelect } from "@/components/ui/searchable-select";
import BestMatchesTab from "./components/BestMatchesTab";

interface ApplicantsModuleProps {
  initialApplicationId?: number;
}

export function ApplicantsModuleInner({ initialApplicationId }: ApplicantsModuleProps = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const jobIdParam = searchParams.get("job_id");
  const tabParam = searchParams.get("tab");
  const applicantIdParam =
    searchParams.get("applicantId") ||
    searchParams.get("applicant_id") ||
    searchParams.get("applicationId") ||
    searchParams.get("application_id") ||
    searchParams.get("id");

  const effectiveApplicationId =
    initialApplicationId || (applicantIdParam ? parseInt(applicantIdParam, 10) : undefined);

  const [showBestMatches, setShowBestMatches] = useState<boolean>(tabParam === "best-matches");

  useEffect(() => {
    if (tabParam === "best-matches") {
      queueMicrotask(() => setShowBestMatches(true));
    }
  }, [tabParam]);

  const {
    applicants,
    rawApplicants,
    jobPipeline,
    loading,
    saving,
    error,
    filterStatus,
    setFilterStatus,
    search,
    setSearch,
    filters,
    setFilters,
    fetchApplicants,
    updateStatus,
    updateApplicantStage,
    clearError,
    detail,
    detailLoading,
    detailError,
    fetchApplicantDetail,
    clearDetail,
  } = useApplicants();

  const {
    interviews,
    loadInterviews,
    saving: scheduling,
    error: scheduleError,
    createInterview,
    EMPTY_FORM: EMPTY_INTERVIEW_FORM,
  } = useInterviews();

  const { jobs: allJobs, fetchJobs: fetchAllJobs } = useJobs();

  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(() => Boolean(effectiveApplicationId));
  const [assessmentReviewApp, setAssessmentReviewApp] = useState<Applicant | null>(null);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [interviewFormData, setInterviewFormData] = useState<InterviewFormData>(EMPTY_INTERVIEW_FORM);
  const [interviewErrors, setInterviewErrors] = useState<Partial<Record<keyof InterviewFormData, string>>>({});

  const [gatePending, setGatePending] = useState<{
    applicant: Applicant;
    toStageId: number;
    stageName: string;
    notes: string;
  } | null>(null);
  const [gateConfirming, setGateConfirming] = useState(false);
  const [gateError, setGateError] = useState("");

  // Sync selectedApplicant from applicants list if effectiveApplicationId is passed
  const [syncedInitialId, setSyncedInitialId] = useState<number | null>(null);
  if (
    effectiveApplicationId &&
    applicants.length > 0 &&
    syncedInitialId !== effectiveApplicationId
  ) {
    const found = applicants.find((a) => a.application_id === effectiveApplicationId);
    if (found) {
      setSyncedInitialId(effectiveApplicationId);
      setSelectedApplicant(found);
    }
  }

  useEffect(() => {
    fetchAllJobs();
  }, [fetchAllJobs]);

  const jobId = jobIdParam ? parseInt(jobIdParam, 10) : undefined;

  useEffect(() => {
    fetchApplicants(undefined, jobId);
  }, [fetchApplicants, jobId]);

  // Every tab count is derived from the same predicate the list filters with,
  // so the sub-stage badges always sum to the tab they sit under.
  const statusCounts = React.useMemo(() => {
    const keys: string[] = [
      "ALL",
      "ACTIVE_PIPELINE",
      ...CANONICAL_STAGE_TYPES,
      ...(jobPipeline?.stages?.map((s) => `STAGE_${s.id}`) ?? []),
    ];

    const counts: Record<string, number> = {};
    for (const key of keys) {
      counts[key] = rawApplicants.filter((a) =>
        matchesStageFilter(a, key, jobPipeline)
      ).length;
    }
    return counts;
  }, [rawApplicants, jobPipeline]);

  // A refetch keeps the previous rows in state, so only a first load that has
  // nothing to derive from should hide the numbers — gating on `loading` alone
  // would blank every badge each time a stage move refreshes the list.
  const countsPending = loading && rawApplicants.length === 0;

  const needsReviewCount = React.useMemo(
    () => rawApplicants.filter((a) => a.assessment_needs_review).length,
    [rawApplicants]
  );

  // Identity of the current query. The list resets to page 1 when this changes,
  // but not when a stage move merely refreshes the rows.
  const listResetKey = React.useMemo(
    () =>
      `${jobIdParam ?? "ALL"}|${filterStatus}|${search.trim().toLowerCase()}|${JSON.stringify(
        filters
      )}`,
    [jobIdParam, filterStatus, search, filters]
  );

  useEffect(() => {
    if (effectiveApplicationId) {
      fetchApplicantDetail(effectiveApplicationId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- URL-driven drawer open
      setDetailOpen(true);
    }
  }, [effectiveApplicationId, fetchApplicantDetail]);

  const handleJobChange = (value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value && value !== "ALL") {
      params.set("job_id", value);
    } else {
      params.delete("job_id");
      params.delete("tab");
      setShowBestMatches(false);
    }
    router.push(`/vos-sync/client/applicants?${params.toString()}`);
  };

  const toggleBestMatches = () => {
    const nextState = !showBestMatches;
    setShowBestMatches(nextState);
    const params = new URLSearchParams(window.location.search);
    if (nextState) {
      params.set("tab", "best-matches");
    } else {
      params.delete("tab");
    }
    router.push(`/vos-sync/client/applicants?${params.toString()}`);
  };

  const selectedJob = allJobs.find((j: JobPosting) => j.job_id === jobId);
  const selectedJobTitle = selectedJob?.job_title || "";

  const handleUpdateStatus = (applicant: Applicant) => {
    setSelectedApplicant(applicant);
    clearError();
    setDrawerOpen(true);
  };

  const handleViewDetails = (applicant: Applicant) => {
    setSelectedApplicant(applicant);
    fetchApplicantDetail(applicant.application_id);
    setDetailOpen(true);
  };

  const handleSaveStatus = async (
    applicationId: number,
    status: ApplicationStatus,
    notes: string
  ) => {
    const result = await updateStatus(applicationId, status, notes);
    if (result.gated && result.toStageId !== undefined) {
      const applicant =
        (selectedApplicant?.application_id === applicationId
          ? selectedApplicant
          : rawApplicants.find((a) => a.application_id === applicationId)) ??
        selectedApplicant;
      if (applicant) {
        const routed = await requestStageMove(
          applicant,
          result.toStageId,
          result.stageName ?? "the next stage",
          notes
        );
        if (routed.gated || routed.ok) setDrawerOpen(false);
        return;
      }
    }
    if (result.ok) setDrawerOpen(false);
  };

  const handleSaveStage = async (
    applicationId: number,
    toStageId: number,
    notes: string
  ) => {
    const applicant =
      (selectedApplicant?.application_id === applicationId
        ? selectedApplicant
        : rawApplicants.find((a) => a.application_id === applicationId)) ??
      selectedApplicant;
    if (!applicant) {
      const result = await updateApplicantStage(applicationId, toStageId, notes);
      if (result.ok) setDrawerOpen(false);
      return;
    }
    const targetName =
      applicant.allowed_next_stages?.find((s) => s.id === toStageId)?.stage_name ??
      "the next stage";
    const result = await requestStageMove(applicant, toStageId, targetName, notes);
    if (result.gated || result.ok) setDrawerOpen(false);
  };

  const handleQuickStageUpdate = async (
    applicant: Applicant,
    toStageId: number,
    stageName: string
  ) => {
    await requestStageMove(
      applicant,
      toStageId,
      stageName,
      applicant.client_notes || ""
    );
  };

  const performStageMove = async (
    applicant: Applicant,
    toStageId: number,
    stageName: string,
    notes: string,
    outcome?: AssessmentMoveOutcome
  ): Promise<boolean> => {
    const candidateName =
      applicant.applicant_name || `Applicant #${applicant.application_id}`;

    const result = await updateApplicantStage(
      applicant.application_id,
      toStageId,
      notes,
      outcome
    );

    if (!result.ok) {
      toast.error(`Failed to update ${candidateName}'s stage.`);
      return false;
    }
    if (!result.moved) {
      toast.success("Marked as failed — candidate stays at the assessment stage");
      return true;
    }
    toast.success(`${candidateName} moved to ${stageName}`);
    // Plan v3-6: a successful PASS into an INTERVIEW destination lands the recruiter in scheduling.
    const targetStageType = applicant.allowed_next_stages?.find(
      (s) => s.id === toStageId
    )?.stage_type;
    if (targetStageType === "INTERVIEW") {
      handleOpenSchedule(applicant);
    }
    if (applicant.application_id === selectedApplicant?.application_id) {
      setSelectedApplicant((prev) =>
        prev
          ? {
              ...prev,
              current_stage_id: toStageId,
              stage_name: stageName,
            }
          : null
      );
    }
    // Resync the list so each row's allowed_next_stages reflects the new stage;
    // the optimistic update rewrites only stage fields, not the transition set.
    fetchApplicants(undefined, jobId);
    return true;
  };

  // Routes a stage move through the assessment confirm modal when it leaves
  // an ASSESSMENT stage toward a task-bearing, configured, non-universal
  // target. The server pre-check decides; the PATCH remains authoritative.
  // Never auto-moves: the recorded outcome applies the caller's chosen target.
  const requestStageMove = async (
    applicant: Applicant,
    toStageId: number,
    stageName: string,
    notes: string
  ): Promise<{ gated: boolean; ok: boolean }> => {
    const target = applicant.allowed_next_stages?.find((s) => s.id === toStageId);
    const isUniversalExit =
      target?.stage_type === "REJECTED" || target?.stage_type === "WITHDRAWN";

    if (applicant.stage_type === "ASSESSMENT" && !isUniversalExit) {
      // An unread requirement is not "no requirement". Defaulting to false here
      // moved the candidate straight past the assessment stage; the PATCH then
      // rejected it with 409 and the recruiter saw a bare error instead of the
      // outcome modal. Asking for an outcome the move may not need is harmless:
      // the service only records it on a qualifying move.
      let requiresOutcome = true;
      try {
        const res = await fetch(
          `/api/client/applicants/${applicant.application_id}/stage?to_stage_id=${toStageId}`,
          { cache: "no-store" }
        );
        const json = await res.json().catch(() => null);
        if (res.ok) requiresOutcome = json?.requires_outcome === true;
      } catch {
        requiresOutcome = true;
      }
      if (requiresOutcome) {
        clearError();
        setGateError("");
        setGatePending({ applicant, toStageId, stageName, notes });
        return { gated: true, ok: false };
      }
    }

    const ok = await performStageMove(applicant, toStageId, stageName, notes);
    return { gated: false, ok };
  };

  const handleGateConfirm = async (outcome: AssessmentMoveOutcome) => {
    if (!gatePending || gateConfirming) return;
    setGateConfirming(true);
    setGateError("");
    const { applicant, toStageId, stageName, notes } = gatePending;
    const ok = await performStageMove(applicant, toStageId, stageName, notes, outcome);
    setGateConfirming(false);
    if (ok) {
      setGatePending(null);
      setDrawerOpen(false);
    } else {
      setGateError("Failed to record the assessment decision. Please try again.");
    }
  };

  const handleGateCancel = () => {
    if (gateConfirming) return;
    setGatePending(null);
    setGateError("");
  };

  // A requested revision never moves the candidate: it closes the decision
  // modal, then refreshes the list and the open detail so the new
  // IN_PROGRESS attempt surfaces.
  const handleGateRevisionDone = () => {
    const applicationId = gatePending?.applicant.application_id;
    setGatePending(null);
    setGateError("");
    toast.success("Revision requested — candidate stays at the assessment stage");
    fetchApplicants(undefined, jobId);
    if (applicationId !== undefined) {
      if (
        selectedApplicant?.application_id === applicationId ||
        detail?.application_id === applicationId
      ) {
        fetchApplicantDetail(applicationId);
      }
    }
  };

  const handleOpenSchedule = (applicant: Applicant) => {
    loadInterviews();
    setInterviewFormData({
      ...EMPTY_INTERVIEW_FORM,
      application_ids: [applicant.application_id],
    });
    setInterviewErrors({});
    setInterviewDialogOpen(true);
  };

  const handleInterviewFieldChange = (field: keyof InterviewFormData, value: unknown) => {
    setInterviewFormData((prev) => ({ ...prev, [field]: value }));
    if (interviewErrors[field]) {
      setInterviewErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveInterview = async () => {
    const errors: Partial<Record<keyof InterviewFormData, string>> = {};
    if (!interviewFormData.scheduled_at) errors.scheduled_at = "Scheduled Date & Time is required.";
    if (!interviewFormData.interview_format) errors.interview_format = "Interview format is required.";

    if (Object.keys(errors).length > 0) {
      setInterviewErrors(errors);
      return;
    }

    const ok = await createInterview(interviewFormData);
    if (ok) {
      setInterviewDialogOpen(false);
      fetchApplicants(undefined, jobId);
    }
  };

  const handleViewScheduledInterview = (interviewId: number) => {
    router.push(`/vos-sync/client/interviews?interview_id=${interviewId}`);
  };

  return (
    <CompanyVerificationGuard moduleName="Candidate Applicants">
      <div className="space-y-4 client-page-transition md:space-y-6">
        <style>{`
          @keyframes page-entry {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .client-page-transition {
            animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
        {/* ── Page Header (Clean Notifications-style layout) ─────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Applicant Management
            </h1>
            <p className="text-sm text-muted-foreground">
              {countsPending
                ? "— candidates shown"
                : `${applicants.length} candidate${applicants.length === 1 ? "" : "s"} shown`}
              {needsReviewCount > 0 && (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {" "}· {needsReviewCount} {needsReviewCount === 1 ? "needs" : "need"} review
                </span>
              )}
              {selectedJobTitle && (
                <span>
                  {" "}for <strong className="text-foreground">{selectedJobTitle}</strong>
                </span>
              )}
            </p>
          </div>

          {/* Action Toolbar & Job Selector */}
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            {/* Best Match AI Action Button */}
            {selectedJob && (
              <Button
                onClick={toggleBestMatches}
                variant={showBestMatches ? "secondary" : "default"}
                size="sm"
                className="h-9 max-md:min-h-10 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer shadow-xs"
              >
                {showBestMatches ? (
                  <>
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All Applicants
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Best Match AI
                  </>
                )}
              </Button>
            )}

            {/* Job Selector Dropdown */}
            <div className="w-full sm:w-auto sm:min-w-[220px]">
              <SearchableSelect
                options={[
                  { value: "ALL", label: "All Job Postings" },
                  ...allJobs.map((j: JobPosting) => ({ value: String(j.job_id), label: j.job_title })),
                ]}
                value={jobIdParam || "ALL"}
                onValueChange={handleJobChange}
                placeholder="Filter by Job Posting"
                className="h-9 max-md:min-h-10 text-xs font-medium rounded-xl border border-border/80 bg-card/80 text-foreground hover:bg-card/95 focus:ring-primary/20"
              />
            </div>
          </div>
        </div>



        {/* Main Content Area */}
        {showBestMatches && selectedJob ? (
          // Fed the whole job pool, not `applicants`: the search and stage filters
          // that shape the table are not visible in this mode, so a leftover
          // filter used to silently shrink the ranking — and re-run Gemini,
          // because the cache key is the pool's length.
          <BestMatchesTab
            job={selectedJob}
            applicants={rawApplicants}
            loading={loading}
            onViewDetails={handleViewDetails}
            onScheduleInterview={handleOpenSchedule}
          />
        ) : (
          <Card className="rounded-2xl border border-primary/10 bg-card/70 dark:bg-card/50 backdrop-blur-xl shadow-xs py-0 gap-0 overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-border/60 bg-card/40">
              <ApplicantFilters
                search={search}
                onSearchChange={setSearch}
                status={filterStatus}
                onStatusChange={setFilterStatus}
                filters={filters}
                onFiltersChange={setFilters}
                counts={countsPending ? undefined : statusCounts}
                pipelineStages={jobPipeline?.stages}
                resultCount={countsPending ? undefined : applicants.length}
              />
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              {loading ? (
                <ListSkeleton rows={5} label="Loading candidates…" />
              ) : (
                <ApplicantList
                  applicants={applicants}
                  totalCount={rawApplicants.length}
                  resetKey={listResetKey}
                  error={error}
                  onRetry={() => fetchApplicants(undefined, jobId)}
                  onClearFilters={() => {
                    setSearch("");
                    setFilterStatus("ALL");
                    setFilters(EMPTY_APPLICANT_FILTERS);
                  }}
                  onUpdateStatus={handleUpdateStatus}
                  onQuickStageUpdate={handleQuickStageUpdate}
                  onScheduleInterview={handleOpenSchedule}
                  onViewScheduledInterview={handleViewScheduledInterview}
                  onViewDetails={handleViewDetails}
                  onReviewAssessment={setAssessmentReviewApp}
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Update Dialog */}
        <StatusUpdateDrawer
          applicant={selectedApplicant}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSave={handleSaveStatus}
          onSaveStage={handleSaveStage}
          saving={saving}
          error={drawerOpen ? error : ""}
        />

        {/* Assessment move-time decision */}
        <AssessmentMoveConfirmModal
          open={gatePending !== null}
          applicationId={gatePending?.applicant.application_id ?? null}
          applicantName={
            gatePending?.applicant.applicant_name ??
            (gatePending ? `Applicant #${gatePending.applicant.application_id}` : "")
          }
          fromStageName={gatePending?.applicant.stage_name ?? "the current stage"}
          toStageName={gatePending?.stageName ?? ""}
          confirming={gateConfirming}
          error={gateError}
          onCancel={handleGateCancel}
          onConfirm={handleGateConfirm}
          onRevisionDone={handleGateRevisionDone}
        />

        {/* Assessment review (read-only view of the freelancer's submission) */}
          <AssessmentReviewModal
            open={assessmentReviewApp !== null}
            applicationId={assessmentReviewApp?.application_id ?? null}
            applicantName={assessmentReviewApp?.applicant_name}
            onClose={() => setAssessmentReviewApp(null)}
            onReviewed={() => {
              fetchApplicants(undefined, jobId);
              const reviewedId = assessmentReviewApp?.application_id;
              if (
                reviewedId !== undefined &&
                (selectedApplicant?.application_id === reviewedId ||
                  detail?.application_id === reviewedId)
              ) {
                fetchApplicantDetail(reviewedId);
              }
            }}
          />

        {/* Schedule Interview Dialog */}
        <Dialog open={interviewDialogOpen} onOpenChange={setInterviewDialogOpen}>
          <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl w-4xl max-h-[92vh] overflow-y-auto max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">Schedule Interview for Candidate</DialogTitle>
            </DialogHeader>
            {scheduleError && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 rounded-xl text-rose-700 dark:text-rose-300 text-sm md:text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {scheduleError}
              </div>
            )}
            <InterviewForm
              data={interviewFormData}
              onChange={handleInterviewFieldChange}
              errors={interviewErrors}
              disableApplicationId={true}
              existingInterviews={interviews}
            />
            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                onClick={() => setInterviewDialogOpen(false)}
                disabled={scheduling}
                className="h-9 max-md:min-h-10 text-sm rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveInterview}
                disabled={scheduling}
                className="h-9 max-md:min-h-10 text-sm rounded-lg gap-1.5 bg-[#14a800] hover:bg-[#118f00] text-white border-0 font-medium"
              >
                {scheduling ? "Scheduling..." : "Schedule Interview"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Candidate Details Modal */}
        <ApplicantDetailsModal
          applicant={selectedApplicant}
          detail={detail}
          loading={detailLoading}
          error={detailError}
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            clearDetail();
          }}
          onUpdateStatus={() => {
            setDetailOpen(false);
            if (selectedApplicant) handleUpdateStatus(selectedApplicant);
          }}
          onScheduleInterview={() => {
            setDetailOpen(false);
            if (selectedApplicant) handleOpenSchedule(selectedApplicant);
          }}
        />
      </div>
    </CompanyVerificationGuard>
  );
}

export default function ApplicantsModule({ initialApplicationId }: ApplicantsModuleProps = {}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32 gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-zinc-400 animate-pulse">Loading applicant dashboard...</span>
        </div>
      }
    >
      <ApplicantsModuleInner initialApplicationId={initialApplicationId} />
    </Suspense>
  );
}
