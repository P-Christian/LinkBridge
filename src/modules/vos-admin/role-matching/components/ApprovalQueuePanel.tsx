"use client";

// src/modules/vos-admin/role-matching/components/ApprovalQueuePanel.tsx

import React, { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Inbox,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Loader2,
  ShieldAlert,
  FolderTree,
  X,
  Link2,
  PlusCircle,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useIntelligenceRequests } from "../hooks/useIntelligenceRequests";
import { useJobCategories } from "../hooks/useJobCategories";
import { slugifyCode } from "../validators";
import type {
  IntelligenceRequest,
  IntelligenceRequestStatus,
  ResolutionType,
  ReviewRequestPayload,
  JobCategory,
} from "../types";

// ── Status helpers ────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  icon: React.ReactNode;
  badge: string;
}

const STATUS_CONFIGS: Record<IntelligenceRequestStatus, StatusConfig> = {
  PENDING: {
    label: "Pending",
    icon: <Clock className="h-3 w-3" />,
    badge: "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300",
  },
  APPROVED: {
    label: "Approved",
    icon: <CheckCircle2 className="h-3 w-3" />,
    badge: "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300",
  },
  REJECTED: {
    label: "Rejected",
    icon: <XCircle className="h-3 w-3" />,
    badge: "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300",
  },
};

const RESOLUTION_CONFIGS: Record<ResolutionType, { label: string; badge: string }> = {
  CREATED_NEW: {
    label: "Created New",
    badge: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  },
  MAPPED_EXISTING: {
    label: "Mapped to Existing",
    badge: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  },
  REJECTED: {
    label: "Rejected",
    badge: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
  },
};

const ENTITY_LABELS: Record<string, string> = {
  JOB_CATEGORY: "Job Category",
  JOB_ROLE: "Job Role",
  SKILL: "Skill",
  KEYWORD: "Keyword",
  ROLE_SKILL: "Role Skill",
  ROLE_KEYWORD: "Role Keyword",
  CERTIFICATION: "Certification",
  EXPERIENCE_LEVEL: "Experience Level",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Status Filter Tabs ────────────────────────────────────────────────────────

type FilterOption = "ALL" | IntelligenceRequestStatus;

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

// ── Review Dialog ─────────────────────────────────────────────────────────────

interface ReviewDialogProps {
  request: IntelligenceRequest;
  open: boolean;
  onClose: () => void;
  categories: JobCategory[];
  onApprove: (
    suggestionId: number,
    payload: Omit<ReviewRequestPayload, "action">
  ) => Promise<boolean>;
  onReject: (suggestionId: number, adminRemarks: string) => Promise<boolean>;
}

type ResolutionMode = "CREATE_NEW" | "MAPPED_EXISTING" | "REJECT";

function ReviewDialog({
  request,
  open,
  onClose,
  categories,
  onApprove,
  onReject,
}: ReviewDialogProps) {
  const [resolutionMode, setResolutionMode] = useState<ResolutionMode>("CREATE_NEW");
  const [categoryName, setCategoryName] = useState(request.category_name ?? "");
  const [categoryCode, setCategoryCode] = useState(slugifyCode(request.category_name ?? ""));
  const [categoryDesc, setCategoryDesc] = useState(request.category_description ?? "");
  const [selectedExistingCategoryId, setSelectedExistingCategoryId] = useState<string>("");
  const [adminRemarks, setAdminRemarks] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  // Sync fields when a new request is selected
  React.useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setResolutionMode("CREATE_NEW");
        setCategoryName(request.category_name ?? "");
        setCategoryCode(slugifyCode(request.category_name ?? ""));
        setCategoryDesc(request.category_description ?? "");
        setSelectedExistingCategoryId(categories.length > 0 ? String(categories[0].category_id) : "");
        setAdminRemarks("");
        setActionError("");
      });
    }
  }, [open, request, categories]);

  const handleCreateNewApprove = useCallback(async () => {
    const name = categoryName.trim();
    if (!name) {
      setActionError("Category name is required to create a new category.");
      return;
    }
    const code = categoryCode.trim() || slugifyCode(name);
    setSubmitting(true);
    setActionError("");
    const ok = await onApprove(request.suggestion_id, {
      resolution_type: "CREATED_NEW",
      category_name: name,
      category_description: categoryDesc.trim(),
      category_code: code,
      admin_remarks: adminRemarks.trim(),
    });
    setSubmitting(false);
    if (ok) onClose();
    else setActionError("Approval failed. The category may already exist or the server is unavailable.");
  }, [categoryName, categoryCode, categoryDesc, adminRemarks, onApprove, request.suggestion_id, onClose]);

  const handleMapExistingApprove = useCallback(async () => {
    const catId = Number(selectedExistingCategoryId);
    if (!catId || isNaN(catId)) {
      setActionError("Please select an existing official category to map.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    const ok = await onApprove(request.suggestion_id, {
      resolution_type: "MAPPED_EXISTING",
      existing_category_id: catId,
      admin_remarks: adminRemarks.trim(),
    });
    setSubmitting(false);
    if (ok) onClose();
    else setActionError("Mapping failed. Please ensure the selected category exists.");
  }, [selectedExistingCategoryId, adminRemarks, onApprove, request.suggestion_id, onClose]);

  const handleReject = useCallback(async () => {
    const remarks = adminRemarks.trim();
    if (!remarks) {
      setActionError("Rejection reason / admin remarks are required when rejecting a suggestion.");
      return;
    }
    setSubmitting(true);
    setActionError("");
    const ok = await onReject(request.suggestion_id, remarks);
    setSubmitting(false);
    if (ok) onClose();
    else setActionError("Rejection failed. Please try again.");
  }, [adminRemarks, onReject, request.suggestion_id, onClose]);

  const isPending = request.status === "PENDING";
  const resolvedCategory = categories.find((c) => c.category_id === request.resolved_category_id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xl rounded-2xl overflow-hidden p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <FolderTree className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold truncate">Review Intelligence Request</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                #{request.suggestion_id} · {ENTITY_LABELS[request.entity_type] ?? request.entity_type}
              </p>
            </div>
          </div>
          {/* Status badge */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${STATUS_CONFIGS[request.status].badge}`}
          >
            {STATUS_CONFIGS[request.status].icon}
            {STATUS_CONFIGS[request.status].label}
          </span>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[70vh] p-6 space-y-5 text-xs">
          {/* Error banner */}
          {actionError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Context & Source Info */}
          <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Request Context</p>
              {request.job_id && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold text-[10px] border border-indigo-200 dark:border-indigo-800">
                  <FileText className="h-3 w-3" />
                  Originating Job #{request.job_id}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Proposed Category</p>
                <p className="font-semibold text-foreground">{request.category_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Current Official Taxonomy</p>
                <p className="font-semibold text-amber-600 dark:text-amber-400">
                  {resolvedCategory ? resolvedCategory.category_name : "Not mapped (NULL)"}
                </p>
              </div>
              {request.suggested_by_user_id && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Submitted By</p>
                  <p className="font-medium text-foreground">User #{request.suggested_by_user_id}</p>
                </div>
              )}
              {request.company_id && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium">Company</p>
                  <p className="font-medium text-foreground">Company #{request.company_id}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Submitted Date</p>
                <p className="font-medium text-foreground">{formatDate(request.created_at)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-medium">Source</p>
                <p className="font-medium text-foreground">{request.source}</p>
              </div>
            </div>

            {request.category_description && (
              <div className="pt-1 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground font-medium">Description</p>
                <p className="text-foreground leading-relaxed mt-0.5">{request.category_description}</p>
              </div>
            )}
          </div>

          {/* Decision Workflow for PENDING */}
          {isPending ? (
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Select Governance Action
              </p>

              {/* Action Tabs */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setResolutionMode("CREATE_NEW");
                    setActionError("");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    resolutionMode === "CREATE_NEW"
                      ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <PlusCircle className="h-3.5 w-3.5 text-emerald-600" />
                    Create New
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Approve as official category</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResolutionMode("MAPPED_EXISTING");
                    setActionError("");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    resolutionMode === "MAPPED_EXISTING"
                      ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 ring-1 ring-blue-500"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Link2 className="h-3.5 w-3.5 text-blue-600" />
                    Map Existing
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Map to existing taxonomy</p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResolutionMode("REJECT");
                    setActionError("");
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    resolutionMode === "REJECT"
                      ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 ring-1 ring-rose-500"
                      : "border-border hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                    Reject
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Reject taxonomy suggestion</p>
                </button>
              </div>

              {/* Mode 1: Create New */}
              {resolutionMode === "CREATE_NEW" && (
                <div className="p-4 rounded-xl border border-emerald-200/70 dark:border-emerald-800/40 bg-emerald-50/20 dark:bg-emerald-950/10 space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="rev-cat-name" className="font-semibold text-foreground">
                      Category Name <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="rev-cat-name"
                      value={categoryName}
                      onChange={(e) => {
                        setCategoryName(e.target.value);
                        if (!categoryCode || categoryCode === slugifyCode(categoryName)) {
                          setCategoryCode(slugifyCode(e.target.value));
                        }
                      }}
                      placeholder="e.g. Blockchain & Web3"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="rev-cat-code" className="font-semibold text-foreground">
                      Category Code
                    </label>
                    <Input
                      id="rev-cat-code"
                      value={categoryCode}
                      onChange={(e) => setCategoryCode(e.target.value)}
                      placeholder="e.g. blockchain_web3"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="rev-cat-desc" className="font-semibold text-foreground">
                      Description
                    </label>
                    <textarea
                      id="rev-cat-desc"
                      rows={2}
                      value={categoryDesc}
                      onChange={(e) => setCategoryDesc(e.target.value)}
                      placeholder="Brief description of this domain…"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="rev-remarks-new" className="font-semibold text-foreground">
                      Admin Remarks (Optional)
                    </label>
                    <textarea
                      id="rev-remarks-new"
                      rows={2}
                      value={adminRemarks}
                      onChange={(e) => setAdminRemarks(e.target.value)}
                      placeholder="Optional notes for this decision…"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}

              {/* Mode 2: Map to Existing */}
              {resolutionMode === "MAPPED_EXISTING" && (
                <div className="p-4 rounded-xl border border-blue-200/70 dark:border-blue-800/40 bg-blue-50/20 dark:bg-blue-950/10 space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="rev-existing-cat" className="font-semibold text-foreground">
                      Select Canonical Category <span className="text-destructive">*</span>
                    </label>
                    <SearchableSelect
                      value={selectedExistingCategoryId}
                      onValueChange={setSelectedExistingCategoryId}
                      options={categories.map((cat) => ({
                        value: String(cat.category_id),
                        label: `${cat.category_name} (${cat.category_code})`,
                      }))}
                      placeholder="Choose official category..."
                      triggerClassName="h-9 text-xs w-full"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="rev-remarks-map" className="font-semibold text-foreground">
                      Admin Remarks (Optional)
                    </label>
                    <textarea
                      id="rev-remarks-map"
                      rows={2}
                      value={adminRemarks}
                      onChange={(e) => setAdminRemarks(e.target.value)}
                      placeholder="e.g. Mapped to canonical Frontend category..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  {request.job_id && (
                    <p className="text-[11px] text-muted-foreground italic">
                      Job #{request.job_id} will be linked to the selected official category.
                    </p>
                  )}
                </div>
              )}

              {/* Mode 3: Reject */}
              {resolutionMode === "REJECT" && (
                <div className="p-4 rounded-xl border border-rose-200/70 dark:border-rose-800/40 bg-rose-50/20 dark:bg-rose-950/10 space-y-3">
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-100/50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-[11px]">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>
                      Rejecting applies strictly to the <strong>taxonomy suggestion</strong>. The originating job remains <strong>active and usable</strong> with its original text category.
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="rev-remarks-rej" className="font-semibold text-foreground">
                      Rejection Reason / Admin Remarks <span className="text-destructive">*</span>
                    </label>
                    <textarea
                      id="rev-remarks-rej"
                      rows={3}
                      value={adminRemarks}
                      onChange={(e) => setAdminRemarks(e.target.value)}
                      placeholder="e.g. Too specific and not suitable as a standard job category..."
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Read-only view for reviewed requests */
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Governance Decision History
              </p>
              <div className="p-3.5 rounded-xl bg-muted/50 border border-border/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">Resolution Type</p>
                    {request.resolution_type && RESOLUTION_CONFIGS[request.resolution_type] ? (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mt-0.5 ${
                          RESOLUTION_CONFIGS[request.resolution_type].badge
                        }`}
                      >
                        {RESOLUTION_CONFIGS[request.resolution_type].label}
                      </span>
                    ) : (
                      <span className="font-semibold text-foreground">{request.status}</span>
                    )}
                  </div>
                  {request.reviewed_at && (
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground font-medium">Reviewed Date</p>
                      <p className="font-medium text-foreground">{formatDate(request.reviewed_at)}</p>
                    </div>
                  )}
                </div>

                {request.resolved_category_id && (
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">Resolved Official Category</p>
                    <p className="font-semibold text-foreground">
                      {resolvedCategory ? resolvedCategory.category_name : `Category #${request.resolved_category_id}`}
                    </p>
                  </div>
                )}

                {request.admin_remarks && (
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">Admin Feedback / Remarks</p>
                    <p className="text-foreground leading-relaxed mt-0.5">{request.admin_remarks}</p>
                  </div>
                )}

                {request.status === "REJECTED" && (
                  <div className="p-2 rounded-lg bg-muted border border-border/60 text-[11px] text-muted-foreground">
                    Note: The originating job remains active and fully usable without an official taxonomy classification.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {isPending && (
          <div className="px-6 py-4 border-t flex items-center justify-end gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={submitting}
              className="h-9 text-xs"
            >
              Cancel
            </Button>

            {resolutionMode === "CREATE_NEW" && (
              <Button
                size="sm"
                onClick={handleCreateNewApprove}
                disabled={submitting || !categoryName.trim()}
                className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white border-0 gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Approve &amp; Create Category
              </Button>
            )}

            {resolutionMode === "MAPPED_EXISTING" && (
              <Button
                size="sm"
                onClick={handleMapExistingApprove}
                disabled={submitting || !selectedExistingCategoryId}
                className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white border-0 gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Approve &amp; Map to Existing
              </Button>
            )}

            {resolutionMode === "REJECT" && (
              <Button
                size="sm"
                onClick={handleReject}
                disabled={submitting || !adminRemarks.trim()}
                className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white border-0 gap-1.5"
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                Reject Suggestion
              </Button>
            )}
          </div>
        )}
        {!isPending && (
          <div className="px-6 py-4 border-t flex justify-end shrink-0">
            <Button variant="outline" size="sm" onClick={onClose} className="h-9 text-xs">
              <X className="h-3.5 w-3.5" />
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ApprovalQueuePanel() {
  const [filterStatus, setFilterStatus] = useState<FilterOption>("PENDING");
  // The hook loads from this value, so a tab switch is one state write and one
  // fetch; calling loadRequests here as well fetched the same tab twice.
  const queueStatus = filterStatus === "ALL" ? undefined : filterStatus;
  const { requests, loading, loadRequests, approveRequest, rejectRequest } =
    useIntelligenceRequests(queueStatus);
  const { categories } = useJobCategories();

  const [reviewingRequest, setReviewingRequest] = useState<IntelligenceRequest | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const handleFilterChange = useCallback((status: FilterOption) => {
    setFilterStatus(status);
    setCurrentPage(1);
  }, []);

  const handleRefresh = useCallback(() => {
    loadRequests(queueStatus);
  }, [loadRequests, queueStatus]);

  const filteredRequests = useMemo(() => {
    let result = requests;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((req) => {
        const nameMatch = (req.category_name || "").toLowerCase().includes(q);
        const descMatch = (req.category_description || "").toLowerCase().includes(q);
        const sourceMatch = (req.source || "").toLowerCase().includes(q);
        const entityMatch = (req.entity_type || "").toLowerCase().includes(q);
        const jobMatch = req.job_id ? String(req.job_id).includes(q) : false;
        const idMatch = String(req.suggestion_id).includes(q);
        return nameMatch || descMatch || sourceMatch || entityMatch || jobMatch || idMatch;
      });
    }
    return result;
  }, [requests, searchQuery]);

  const totalItems = filteredRequests.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedRequests = filteredRequests.slice(startIdx, startIdx + pageSize);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "PENDING").length,
    [requests]
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Back Link */}
      <div>
        <Link
          href="/linkbridge/admin/job-roles"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Matching Intelligence
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Inbox className="h-5 w-5 text-indigo-600" />
            Approval Queue
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review proposed changes to the matching intelligence dataset before they become official.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
          className="h-9 px-4 rounded-xl text-xs gap-2 shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search suggestions, source, job #..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8 pr-8 h-9 text-xs rounded-xl"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-1 border border-border/60 w-fit">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleFilterChange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                filterStatus === opt.value
                  ? "bg-background text-foreground shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests table */}
      <div className="bg-background rounded-2xl border border-border overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 border-b border-border uppercase tracking-wider text-muted-foreground font-bold">
            <tr>
              <th className="p-4">Type</th>
              <th className="p-4">Suggestion</th>
              <th className="p-4">Source &amp; Job</th>
              <th className="p-4">Submitted</th>
              <th className="p-4">Status &amp; Resolution</th>
              <th className="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-medium">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading requests…
                </td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center">
                  <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No requests found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {searchQuery
                      ? "No suggestions match your search criteria."
                      : filterStatus === "PENDING"
                      ? "All requests have been reviewed."
                      : "No requests match the selected filter."}
                  </p>
                </td>
              </tr>
            ) : (
              paginatedRequests.map((req) => {
                const statusCfg = STATUS_CONFIGS[req.status];
                const resolutionCfg = req.resolution_type ? RESOLUTION_CONFIGS[req.resolution_type] : null;
                return (
                  <tr
                    key={req.suggestion_id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {/* Type */}
                    <td className="p-4">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        <FolderTree className="h-3 w-3" />
                        {ENTITY_LABELS[req.entity_type] ?? req.entity_type}
                      </span>
                    </td>

                    {/* Suggestion */}
                    <td className="p-4">
                      <p className="font-semibold text-foreground">{req.category_name ?? "—"}</p>
                      {req.category_description && (
                        <p className="text-muted-foreground text-[11px] mt-0.5 max-w-xs truncate">
                          {req.category_description}
                        </p>
                      )}
                    </td>

                    {/* Source & Job */}
                    <td className="p-4 text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1">
                          <span>{req.source}</span>
                          {req.suggested_by_user_id && (
                            <span className="text-[10px] text-muted-foreground/70">
                              (User #{req.suggested_by_user_id})
                            </span>
                          )}
                        </div>
                        {req.job_id && (
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            Job #{req.job_id}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Submitted */}
                    <td className="p-4 text-muted-foreground">{formatDate(req.created_at)}</td>

                    {/* Status & Resolution */}
                    <td className="p-4">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusCfg.badge}`}
                        >
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                        {resolutionCfg && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold ${resolutionCfg.badge}`}
                          >
                            {resolutionCfg.label}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="p-4 text-right">
                      <button
                        type="button"
                        onClick={() => setReviewingRequest(req)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                      >
                        {req.status === "PENDING" ? "Review" : "View"}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination Footer */}
        {!loading && filteredRequests.length > 0 && (
          <div className="px-4 py-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 text-xs text-muted-foreground">
            <div>
              Showing{" "}
              <span className="font-semibold text-foreground">
                {totalItems === 0 ? 0 : startIdx + 1}
              </span>{" "}
              to{" "}
              <span className="font-semibold text-foreground">
                {Math.min(startIdx + pageSize, totalItems)}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-foreground">{totalItems}</span>{" "}
              requests
            </div>

            {totalPages > 1 && (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (safePage > 1) setCurrentPage((p) => p - 1);
                      }}
                      className={safePage <= 1 ? "pointer-events-none opacity-40 cursor-not-allowed" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map((page, idx, arr) => {
                      const prev = arr[idx - 1];
                      return (
                        <React.Fragment key={page}>
                          {prev && page - prev > 1 && (
                            <PaginationItem>
                              <span className="px-2 text-muted-foreground">…</span>
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={page === safePage}
                              onClick={(e) => {
                                e.preventDefault();
                                setCurrentPage(page);
                              }}
                              className="cursor-pointer h-8 w-8 text-xs"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </React.Fragment>
                      );
                    })}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (safePage < totalPages) setCurrentPage((p) => p + 1);
                      }}
                      className={safePage >= totalPages ? "pointer-events-none opacity-40 cursor-not-allowed" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        )}
      </div>

      {/* Review Dialog */}
      {reviewingRequest && (
        <ReviewDialog
          request={reviewingRequest}
          open={!!reviewingRequest}
          onClose={() => setReviewingRequest(null)}
          categories={categories}
          onApprove={approveRequest}
          onReject={rejectRequest}
        />
      )}
    </div>
  );
}
