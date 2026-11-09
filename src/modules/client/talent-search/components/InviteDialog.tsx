"use client";

// src/modules/client/talent-search/components/InviteDialog.tsx

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Send, Briefcase, AlertCircle, Loader2, Check, ChevronsUpDown, Search, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface JobOption {
  job_id: number;
  job_title: string;
  status?: string;
}

interface InviteDialogProps {
  open: boolean;
  talentName: string;
  onClose: () => void;
  onSend: (message: string, jobId?: number) => Promise<void>;
  sending: boolean;
  error: string;
}

const GENERAL_INTEREST = "General interest (no specific job)";

const DEFAULT_MESSAGE = (name: string) =>
  `Hi ${name.split(" ")[0]},\n\nWe came across your profile and believe you could be a great fit for an opportunity at our company.\n\nWe'd love to connect and discuss further. Please feel free to reach out or apply through our platform.\n\nBest regards,`;

export default function InviteDialog({
  open,
  talentName,
  onClose,
  onSend,
  sending,
  error,
}: InviteDialogProps) {
  const [message, setMessage] = useState(() => DEFAULT_MESSAGE(talentName));
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsError, setJobsError] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setJobsError(false);
    try {
      const res = await fetch("/api/client/jobs");
      if (!res.ok) throw new Error("Failed to load jobs");
      const json = await res.json();
      const list: JobOption[] = json.jobs ?? [];
      // Only active jobs can be linked to an invitation
      setJobs(list.filter((j) => !j.status || j.status === "ACTIVE"));
    } catch {
      setJobsError(true);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  // Fresh state every time the dialog opens
  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setMessage(DEFAULT_MESSAGE(talentName));
      setSelectedJobId("");
      setSearchQuery("");
      setIsDropdownOpen(false);
      void loadJobs();
    });
  }, [open, talentName, loadJobs]);

  // Close the job dropdown when clicking outside of it
  useEffect(() => {
    if (!isDropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleSend = useCallback(async () => {
    const jobIdNum = selectedJobId && selectedJobId !== "none" ? Number(selectedJobId) : undefined;
    await onSend(message, jobIdNum);
  }, [selectedJobId, onSend, message]);

  const selectOptions = useMemo(
    () => [
      { value: "none", label: GENERAL_INTEREST },
      ...jobs.map((j) => ({
        value: String(j.job_id),
        label: `${j.job_title} `,
      })),
    ],
    [jobs]
  );

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return selectOptions;
    const q = searchQuery.toLowerCase().trim();
    return selectOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [selectOptions, searchQuery]);

  const selectedLabel = useMemo(
    () => selectOptions.find((opt) => opt.value === (selectedJobId || "none"))?.label || GENERAL_INTEREST,
    [selectOptions, selectedJobId]
  );

  const isTemplateUnchanged = message === DEFAULT_MESSAGE(talentName);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent
        key={talentName}
        className="max-w-lg max-md:max-h-[90dvh] max-md:max-w-[calc(100vw-2rem)] max-md:overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-bold">
            <Send className="h-4 w-4 text-primary" />
            Invite {talentName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            They&apos;ll receive your message and, if you pick one, a link to the job posting.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive md:text-xs"
          >
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Searchable job select */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground md:text-xs">
              <Briefcase className="h-3.5 w-3.5" />
              Link to a job posting <span className="font-normal">(optional)</span>
            </Label>

            {loadingJobs ? (
              <div className="flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground md:text-xs">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading company jobs…
              </div>
            ) : jobsError ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive md:text-xs">
                <span className="flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  Couldn&apos;t load your jobs. You can still send a general invitation.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void loadJobs()}
                  className="h-7 shrink-0 gap-1 text-xs max-md:min-h-10"
                >
                  <RotateCcw className="h-3 w-3" />
                  Retry
                </Button>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isDropdownOpen}
                  aria-haspopup="listbox"
                  onClick={() => {
                    setIsDropdownOpen((prev) => !prev);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "h-9 w-full justify-between rounded-lg border-border px-3 text-sm font-normal md:text-xs max-md:min-h-10",
                    (!selectedJobId || selectedJobId === "none") && "text-muted-foreground"
                  )}
                >
                  <span className="truncate">{selectedLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>

                {isDropdownOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
                    <div className="flex items-center border-b border-border px-2.5 py-1.5">
                      <Search className="mr-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      <input
                        type="text"
                        placeholder="Search company jobs..."
                        aria-label="Search company jobs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        className="flex h-7 w-full rounded-md bg-transparent outline-none placeholder:text-muted-foreground max-md:min-h-10 max-md:text-base md:text-xs"
                      />
                    </div>
                    <div role="listbox" className="max-h-48 overflow-y-auto overscroll-contain p-1">
                      {filteredOptions.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground md:text-xs">
                          No matching jobs found.
                        </div>
                      ) : (
                        filteredOptions.map((opt) => {
                          const selected = (selectedJobId || "none") === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              role="option"
                              aria-selected={selected}
                              onClick={() => {
                                setSelectedJobId(opt.value);
                                setIsDropdownOpen(false);
                              }}
                              className={cn(
                                "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-7 pr-2 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground md:text-xs max-md:min-h-10",
                                selected && "bg-accent/50 font-medium"
                              )}
                            >
                              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                                {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                              </span>
                              <span className="truncate">{opt.label}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!loadingJobs && !jobsError && jobs.length === 0 && (
              <p className="text-sm text-muted-foreground md:text-xs">
                You have no active job postings, so this will be sent as a general invitation.
              </p>
            )}
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="invite-message" className="text-sm font-medium text-muted-foreground md:text-xs">
                Message <span className="text-destructive">*</span>
              </Label>
              {!isTemplateUnchanged && (
                <button
                  type="button"
                  onClick={() => setMessage(DEFAULT_MESSAGE(talentName))}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground max-md:min-h-10"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to template
                </button>
              )}
            </div>
            <Textarea
              id="invite-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={8}
              className="resize-none rounded-lg max-md:text-base md:text-sm"
              placeholder="Write a personalized invitation message…"
            />
            <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
              <span>Tip: mention the role and what stood out in their profile.</span>
              <span className="shrink-0 tabular-nums">{message.length} characters</span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 max-md:flex-col-reverse">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={sending}
            className="h-9 rounded-lg text-sm max-md:min-h-10"
          >
            Cancel
          </Button>
          <Button
            id="invite-send-btn"
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="h-9 gap-1.5 rounded-lg text-sm font-medium max-md:min-h-10"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}