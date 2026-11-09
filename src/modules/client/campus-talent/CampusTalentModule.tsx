"use client";
// src/modules/client/campus-talent/CampusTalentModule.tsx

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence, useSpring } from "framer-motion";
import {
  GraduationCap,
  Search,
  X,
  Building2,
  Users,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Loader2,
  RefreshCw,
  BookOpen,
  Bot,
  MapPin,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { KpiValue } from "@/components/shared/KpiValue";
import { useRequestAbort } from "@/hooks/useRequestAbort";
import Image from "next/image";
import CompanyVerificationGuard from "@/modules/client/components/CompanyVerificationGuard";
import { CampusMatchResult } from "@/modules/matching-engine/campus/types";
import { RawJobPosting } from "@/modules/matching-engine/campus/requirementNormalizer";
import { CampusCandidate } from "@/modules/matching-engine/campus/types";
import StudentMatchTable from "./components/StudentMatchTable";
import StudentMatchDrawer from "./components/StudentMatchDrawer";
import SendInvitationDialog from "./components/SendInvitationDialog";
import { PublicSchoolAdminProfileRender } from "@/modules/public/public-profile/components/PublicSchoolAdminProfileRender";
import { PublicSchoolAdminProfile } from "@/modules/public/public-profile/services/public-profile.service";

// ── Local Types ────────────────────────────────────────────────────────────────

interface School {
  school_id: number;
  school_name: string;
  school_type: string | null;
  school_logo_url: string | null;
  city_municipality: string | null;
  province: string | null;
  student_count: number;
  course_count: number;
}

type CampusView = "SCHOOLS" | "STUDENTS" | "MATCH";

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveSchoolLogoUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string" || !value.trim()) return null;
  const t = value.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/api/assets/")) return t;
  if (t.startsWith("/assets/")) return `/api${t}`;
  if (t.startsWith("/")) return t;
  const parts = t.split("/");
  const fileId = parts[parts.length - 1];
  return fileId ? `/api/assets/${fileId}` : null;
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...options, credentials: "include" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Pipeline Loading Stages ───────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    title: "Running campus match pipeline...",
    subtitle: "Initializing deterministic match evaluation engine",
  },
  {
    title: "Extracting job requirement taxonomies...",
    subtitle: "Analyzing required competencies, education & experience levels",
  },
  {
    title: "Evaluating university curriculum alignment...",
    subtitle: "Cross-referencing course syllabus & transcript competencies",
  },
  {
    title: "Scoring candidates and generating AI insights...",
    subtitle: "Synthesizing deterministic match weights & Gemini evidence",
  },
  {
    title: "Finalizing candidate ranking...",
    subtitle: "Organizing verified talent roster ready for review",
  },
];

// ── Isolated Leaf Progress Counter ──────────────────────────────────────────
function ProgressPercentDisplay({
  motionValue,
}: {
  motionValue: ReturnType<typeof useSpring>;
}) {
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    let lastRounded = 0;
    return motionValue.on("change", (latest) => {
      const rounded = Math.min(100, Math.max(0, Math.round(latest * 100)));
      if (rounded !== lastRounded) {
        lastRounded = rounded;
        setPercent(rounded);
      }
    });
  }, [motionValue]);

  return (
    <span className="tabular-nums font-semibold text-foreground">
      {percent}%
    </span>
  );
}

function MatchPipelineLoadingState({
  jobTitle,
  schoolName,
  isDataReady,
  onComplete,
}: {
  jobTitle: string;
  schoolName: string;
  isDataReady: boolean;
  onComplete: () => void;
}) {
  const [stageIndex, setStageIndex] = useState(0);

  // Motion spring for fluid compositor-friendly interpolation (0.00 to 1.00)
  const springProgress = useSpring(0, { stiffness: 65, damping: 18 });

  const currentStage = PIPELINE_STAGES[stageIndex];

  // Stage progression coordinator
  useEffect(() => {
    const isLastStage = stageIndex === PIPELINE_STAGES.length - 1;

    if (!isLastStage) {
      const base = stageIndex * 0.2;
      const target = (stageIndex + 1) * 0.2;

      // Incremental micro-crawl within stage
      springProgress.set(base + 0.04);
      const t1 = setTimeout(() => springProgress.set(base + 0.11), 160);
      const t2 = setTimeout(() => springProgress.set(target), 360);
      const tNext = setTimeout(() => {
        setStageIndex((prev) => prev + 1);
      }, 550);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(tNext);
      };
    } else {
      // Stage 5 (Final Step):
      // If network response is still pending, cap smoothly at 0.94
      // If data is already ready, glide directly to 1.00
      springProgress.set(0.85);
      const t1 = setTimeout(() => {
        if (!isDataReady) {
          springProgress.set(0.94);
        } else {
          springProgress.set(1.0);
        }
      }, 200);

      return () => clearTimeout(t1);
    }
  }, [stageIndex, isDataReady, springProgress]);

  // When in the final stage and data is ready, glide to 100% and transition
  useEffect(() => {
    const isLastStage = stageIndex === PIPELINE_STAGES.length - 1;
    if (isLastStage && isDataReady) {
      springProgress.set(1.0);
      const completionTimer = setTimeout(() => {
        onComplete();
      }, 400);
      return () => clearTimeout(completionTimer);
    }
  }, [stageIndex, isDataReady, springProgress, onComplete]);

  return (
    <motion.div
      className="flex flex-col items-center justify-center py-16 px-4 max-w-lg mx-auto text-center"
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {/* Glowing icon pulse with AI Bot */}
      <div className="relative mb-6 flex items-center justify-center">
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative h-14 w-14 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-center">
          <Bot className="h-7 w-7 text-primary animate-pulse" />
        </div>
      </div>

      {/* Dynamic Stage Text with PopLayout Crossfade */}
      <div className="min-h-[68px] flex flex-col items-center justify-center">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={stageIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="space-y-1"
          >
            <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {currentStage.title}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {currentStage.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Target Info Pill */}
      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 border border-border/80 px-4 py-1.5 rounded-full shadow-2xs">
        <span className="font-semibold text-foreground">{schoolName}</span>
        <span>•</span>
        <span className="truncate max-w-[240px] font-medium text-foreground/85">{jobTitle}</span>
      </div>

      {/* Compositor-friendly Progress Bar */}
      <div className="w-full max-w-xs mt-6 space-y-2">
        <div className="h-2 w-full bg-muted/80 rounded-full overflow-hidden">
          <motion.div
            className="h-full w-full bg-primary rounded-full origin-left"
            style={{ scaleX: springProgress }}
          />
        </div>
        <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
          <span>
            Stage {stageIndex + 1} of {PIPELINE_STAGES.length}
          </span>
          <ProgressPercentDisplay motionValue={springProgress} />
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Module ────────────────────────────────────────────────────────────────

export default function CampusTalentModule() {
  // ── View state ───────────────────────────────────────────────────────────
  const [view, setView] = useState<CampusView>("SCHOOLS");

  // ── School Discovery ─────────────────────────────────────────────────────
  const [schoolQuery, setSchoolQuery] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(false);
  const [schoolsError, setSchoolsError] = useState<string | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolTab, setSchoolTab] = useState<string>("about");
  const [schoolProfile, setSchoolProfile] = useState<PublicSchoolAdminProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ── Student Roster ───────────────────────────────────────────────────────
  const [candidates, setCandidates] = useState<CampusCandidate[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState("");

  // ── Job Selection ─────────────────────────────────────────────────────────
  const [jobs, setJobs] = useState<RawJobPosting[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<RawJobPosting | null>(null);

  const jobOptions = useMemo(
    () => jobs.map((job) => ({ value: String(job.job_id), label: job.job_title })),
    [jobs]
  );

  // ── Match Results ─────────────────────────────────────────────────────────
  const [matchResults, setMatchResults] = useState<CampusMatchResult[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [isMatchDataReady, setIsMatchDataReady] = useState(false);
  const [pendingMatchResults, setPendingMatchResults] = useState<CampusMatchResult[] | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // ── Drawer & Dialog ───────────────────────────────────────────────────────
  const [drawerResult, setDrawerResult] = useState<CampusMatchResult | null>(null);
  const [inviteTarget, setInviteTarget] = useState<CampusMatchResult | null>(null);

  // ── School Search & Category Filters ─────────────────────────────────────
  const [selectedSchoolType, setSelectedSchoolType] = useState<string>("ALL");

  const abortRead = useRequestAbort();

  const handleSchoolSearch = useCallback(async () => {
    setSchoolsLoading(true);
    setSchoolsError(null);
    const signal = abortRead();
    try {
      const data = await fetchJson<{ data: School[] }>(
        `/api/client/campus-talent/schools?q=${encodeURIComponent(schoolQuery)}`,
        { signal }
      );
      setSchools(data.data ?? []);
    } catch (e: unknown) {
      if (signal.aborted) return;
      setSchoolsError(e instanceof Error ? e.message : "Failed to load schools.");
    } finally {
      if (!signal.aborted) {
        setSchoolsLoading(false);
      }
    }
  }, [schoolQuery, abortRead]);

  useEffect(() => {
    // Without this the search fired on every keystroke, and a slow early
    // response could land after a later one and replace the newer results.
    const timer = setTimeout(() => {
      void handleSchoolSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [handleSchoolSearch]);

  const schoolStats = useMemo(() => {
    const totalSchools = schools.length;
    const totalStudents = schools.reduce((acc, s) => acc + (Number(s.student_count) || 0), 0);
    const totalCourses = schools.reduce((acc, s) => acc + (Number(s.course_count) || 0), 0);
    return { totalSchools, totalStudents, totalCourses };
  }, [schools]);

  // A school search keeps the previous results, so only the first load — with
  // nothing summed yet — may swap these three metrics for a placeholder.
  const schoolStatsPending = schoolsLoading && schools.length === 0;

  const availableSchoolTypes = useMemo(() => {
    const types = new Set<string>();
    for (const s of schools) {
      if (s.school_type?.trim()) types.add(s.school_type.trim());
    }
    return Array.from(types);
  }, [schools]);

  const filteredSchools = useMemo(() => {
    if (selectedSchoolType === "ALL") return schools;
    return schools.filter(
      (s) => s.school_type?.toLowerCase() === selectedSchoolType.toLowerCase()
    );
  }, [schools, selectedSchoolType]);

  // ── Select School → Load Students ─────────────────────────────────────────
  // Separate slots per school-scoped read: picking a second school must abandon
  // the first school's roster and profile, not let a late response fill the
  // student list of the school on screen.
  const abortProfile = useRequestAbort();
  const abortStudents = useRequestAbort();

  const handleSelectSchool = useCallback(async (school: School) => {
    setSelectedSchool(school);
    setView("STUDENTS");
    setSchoolTab("about");
    setStudentsLoading(true);
    setStudentsError(null);
    setProfileLoading(true);
    setProfileError(null);
    setCandidates([]);
    setMatchResults([]);
    setSelectedJob(null);
    setSchoolProfile(null);

    // Fetch school profile
    const profileSignal = abortProfile();
    fetchJson<{ data: PublicSchoolAdminProfile }>(
      `/api/client/campus-talent/schools/${school.school_id}`,
      { signal: profileSignal }
    )
      .then((data) => {
        if (profileSignal.aborted) return;
        setSchoolProfile(data.data ?? null);
      })
      .catch((e: unknown) => {
        if (profileSignal.aborted) return;
        setProfileError(e instanceof Error ? e.message : "Failed to load school profile.");
      })
      .finally(() => {
        if (!profileSignal.aborted) setProfileLoading(false);
      });

    try {
      const studentsSignal = abortStudents();
      const data = await fetchJson<{ data: CampusCandidate[] }>(
        `/api/client/campus-talent/schools/${school.school_id}/students`,
        { signal: studentsSignal }
      );
      if (studentsSignal.aborted) return;
      setCandidates(data.data ?? []);
    } catch (e: unknown) {
      setStudentsError(e instanceof Error ? e.message : "Failed to load students.");
    } finally {
      setStudentsLoading(false);
    }

    // Load jobs in parallel
    setJobsLoading(true);
    try {
      const jobData = await fetchJson<{ data: RawJobPosting[] }>("/api/client/campus-talent/jobs");
      setJobs(jobData.data ?? []);
    } catch (e: unknown) {
      // An unread roster of jobs looked like a company with none, and the picker
      // then offered an empty list with nothing on screen to retry.
      toast.error(e instanceof Error ? e.message : "Failed to load your job postings.");
    } finally {
      setJobsLoading(false);
    }
  }, [abortProfile, abortStudents]);

  // ── Run Match ─────────────────────────────────────────────────────────────
  const handleRunMatch = useCallback(async () => {
    if (!selectedJob || candidates.length === 0) return;
    setMatchLoading(true);
    setIsMatchDataReady(false);
    setPendingMatchResults(null);
    setMatchError(null);
    setView("MATCH");
    try {
      const data = await fetchJson<{ results: CampusMatchResult[] }>(
        "/api/client/campus-talent/match",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job: selectedJob, candidates }),
        }
      );
      setPendingMatchResults(data.results ?? []);
      setIsMatchDataReady(true);
    } catch (e: unknown) {
      setMatchError(e instanceof Error ? e.message : "Match failed.");
      setMatchLoading(false);
    }
  }, [selectedJob, candidates]);

  const handleMatchPipelineComplete = useCallback(() => {
    if (pendingMatchResults) {
      setMatchResults(pendingMatchResults);
    }
    setMatchLoading(false);
  }, [pendingMatchResults]);

  // ── Filtered students for student view ────────────────────────────────────
  const filteredCandidates = useMemo(() => {
    if (!studentSearch.trim()) return candidates;
    const lower = studentSearch.toLowerCase();
    return candidates.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(lower) ||
        c.email.toLowerCase().includes(lower) ||
        (c.courseName?.toLowerCase().includes(lower) ?? false)
    );
  }, [candidates, studentSearch]);

  return (
    <CompanyVerificationGuard moduleName="Campus Talent">
      <div className="flex flex-col min-h-screen bg-background wrap-anywhere">
        {/* Header */}
        {view === "SCHOOLS" ? (
          <div className="border-b border-border px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Campus Talent</h1>
                <p className="text-sm text-muted-foreground">
                  Discover and match academic candidates from verified schools
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="border-b border-border px-6 py-3.5 bg-background">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button
                onClick={() => { setView("SCHOOLS"); setSelectedSchool(null); }}
                className="hover:text-foreground transition-colors font-medium text-xs sm:text-sm"
              >
                Schools
              </button>
              {selectedSchool && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <button
                    onClick={() => {
                      setView("STUDENTS");
                      setSchoolTab("about");
                    }}
                    className={cn(
                      "hover:text-foreground transition-colors font-medium text-xs sm:text-sm",
                      view === "STUDENTS" && schoolTab === "about" && "text-foreground font-semibold"
                    )}
                  >
                    {selectedSchool.school_name}
                  </button>
                  {view === "STUDENTS" && schoolTab === "roster" && (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-foreground font-semibold text-xs sm:text-sm">Student Roster</span>
                    </>
                  )}
                  {view === "STUDENTS" && schoolTab === "courses" && (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-foreground font-semibold text-xs sm:text-sm">Courses</span>
                    </>
                  )}
                </>
              )}
              {view === "MATCH" && selectedJob && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-foreground font-semibold text-xs sm:text-sm">{selectedJob.job_title}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className={cn("flex-1", view === "STUDENTS" ? "" : "p-6")}>
          {/* ── School Discovery View ─────────────────────────────────────── */}
          {view === "SCHOOLS" && (
            <div className="space-y-6">
              {/* Institutional Overview Metrics Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-card border border-border/80 rounded-xl p-4.5 flex items-center gap-4 shadow-2xs">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      <KpiValue value={schoolStats.totalSchools} loading={schoolStatsPending} />
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Partner Institutions
                    </p>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-xl p-4.5 flex items-center gap-4 shadow-2xs">
                  <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      <KpiValue value={schoolStats.totalStudents} loading={schoolStatsPending} />
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Verified Student Network
                    </p>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-xl p-4.5 flex items-center gap-4 shadow-2xs">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      <KpiValue value={schoolStats.totalCourses} loading={schoolStatsPending} />
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      Academic Degree Programs
                    </p>
                  </div>
                </div>
              </div>

              {/* Search and Category Filter Toolbar */}
              <div className="flex flex-col md:flex-row md:items-center justify-end gap-3 bg-muted/20 border border-border rounded-xl p-3.5">
                <div className="flex gap-2 flex-1 max-w-lg">
                  <Input
                    placeholder="Search schools by name, city, or province..."
                    value={schoolQuery}
                    onChange={(e) => setSchoolQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSchoolSearch(); }}
                    className="flex-1 bg-background"
                  />
                  <Button onClick={handleSchoolSearch} disabled={schoolsLoading}>
                    {schoolsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-1.5 hidden sm:inline">Search</span>
                  </Button>
                </div>

        
              </div>

              {schoolsError && (
                <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/5 border border-destructive/20 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{schoolsError}</span>
                </div>
              )}

              {filteredSchools.length === 0 && !schoolsLoading && !schoolsError && (
                <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-muted/10 text-muted-foreground space-y-2">
                  <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p className="font-semibold text-foreground text-base">No partner institutions found</p>
                  <p className="text-xs max-w-md mx-auto text-muted-foreground">
                    Try adjusting your search criteria or filter to discover verified universities and browse their candidate rosters.
                  </p>
                </div>
              )}

              {/* School Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <AnimatePresence mode="popLayout">
                  {filteredSchools.map((school) => (
                    <motion.button
                      layout
                      key={school.school_id}
                      onClick={() => handleSelectSchool(school)}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{
                        layout: { duration: 0.32, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.2 },
                        scale: { duration: 0.2 },
                      }}
                      whileHover={{ y: -3, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className="text-left bg-card border border-border/80 rounded-2xl p-5 hover:border-primary/50 hover:shadow-md transition-[border-color,box-shadow] group flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start gap-3.5">
                          <div className="h-12 w-12 rounded-xl border border-border overflow-hidden shrink-0 bg-muted/60 flex items-center justify-center shadow-2xs">
                            {resolveSchoolLogoUrl(school.school_logo_url) ? (
                              <Image
                                src={resolveSchoolLogoUrl(school.school_logo_url)!}
                                alt={school.school_name}
                                width={48}
                                height={48}
                                unoptimized
                                className="object-contain p-1"
                              />
                            ) : (
                              <Building2 className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground text-sm leading-snug group-hover:text-primary transition-colors line-clamp-2">
                              {school.school_name}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {[school.city_municipality, school.province].filter(Boolean).join(", ") || "Philippines"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 text-primary border-primary/20">
                            <ShieldCheck className="h-3 w-3" />
                            Verified
                          </Badge>
                          {school.school_type && (
                            <Badge variant="secondary" className="text-[10px]">
                              {school.school_type}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-primary/80" />
                            <strong className="text-foreground font-medium">{school.student_count}</strong> students
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5 text-primary/80" />
                            <strong className="text-foreground font-medium">{school.course_count}</strong> courses
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 font-medium text-primary group-hover:translate-x-1 transition-transform">
                          Explore <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* ── Students / School Detail View ───────────────────────────────── */}
          {view === "STUDENTS" && (
            <div className="space-y-6">
              {profileLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-sm font-medium">Loading school profile...</p>
                </div>
              ) : profileError ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-destructive text-sm p-4 bg-destructive/10 rounded-xl flex-1 mr-4">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{profileError}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1"
                      onClick={() => {
                        setView("SCHOOLS");
                        setSelectedSchool(null);
                      }}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Change School
                    </Button>
                  </div>
                </div>
              ) : schoolProfile ? (
                <PublicSchoolAdminProfileRender
                  profile={schoolProfile}
                  activeTab={schoolTab}
                  onTabChange={setSchoolTab}
                  studentCount={candidates.length}
                  containerClassName="w-full"
                  badgeText="Partner Institution"
                  headerAction={
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5 rounded-lg border-border hover:bg-muted"
                      onClick={() => {
                        setView("SCHOOLS");
                        setSelectedSchool(null);
                      }}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Change School
                    </Button>
                  }
                  studentRosterContent={
                    <div className="space-y-4">
                      {/* Action bar */}
                      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-card border border-border rounded-2xl p-3 shadow-xs">
                        <div className="relative flex-1 max-w-md">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            placeholder="Filter students by name, email, or course..."
                            value={studentSearch}
                            onChange={(e) => setStudentSearch(e.target.value)}
                            className="w-full pl-9 pr-8 bg-background h-10 text-xs sm:text-sm rounded-xl border-border"
                          />
                          {studentSearch && (
                            <button
                              type="button"
                              onClick={() => setStudentSearch("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                          {/* Searchable Job selector */}
                          <div className="w-full sm:w-[300px] md:w-[340px] lg:w-[380px]">
                            <SearchableSelect
                              options={jobOptions}
                              value={selectedJob ? String(selectedJob.job_id) : ""}
                              onValueChange={(val) => {
                                const found = jobs.find((j) => String(j.job_id) === val);
                                if (found) setSelectedJob(found);
                              }}
                              placeholder={
                                jobsLoading
                                  ? "Loading company jobs..."
                                  : "Select job to match against..."
                              }
                              disabled={jobsLoading || jobs.length === 0}
                              className="h-10 text-xs sm:text-sm font-normal truncate rounded-xl"
                            />
                          </div>

                          <Button
                            onClick={handleRunMatch}
                            disabled={!selectedJob || candidates.length === 0 || matchLoading}
                            size="sm"
                            className="shrink-0 h-10 px-4 rounded-xl gap-2 font-medium"
                          >
                            {matchLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                            Run AI Match
                          </Button>
                        </div>
                      </div>

                      {studentsError && (
                        <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 border border-destructive/20 p-3 rounded-xl">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>{studentsError}</span>
                        </div>
                      )}

                      {studentsLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground space-y-2">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          <span className="text-xs">Loading campus students...</span>
                        </div>
                      ) : (
                        <StudentMatchTable
                          candidates={filteredCandidates}
                          matchResults={[]}
                          showScores={false}
                          onViewDetails={(r) => {
                            // In plain student view, construct a minimal result for drawer
                            setDrawerResult(r);
                          }}
                          onInvite={(r) => setInviteTarget(r)}
                        />
                      )}
                    </div>
                  }
                />
              ) : null}
            </div>
          )}

          {/* ── Match Results View ─────────────────────────────────────────── */}
          {view === "MATCH" && (
            <div className="w-full max-w-7xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Match Results — {selectedJob?.job_title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {matchResults.filter((r) => r.eligibility.eligible).length} eligible of {matchResults.length} students ranked
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setView("STUDENTS");
                      setSchoolTab("roster");
                    }}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Back to Student Roster
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRunMatch}
                    disabled={matchLoading}
                  >
                    <RefreshCw className={cn("h-4 w-4 mr-1", matchLoading && "animate-spin")} />
                    Re-run
                  </Button>
                </div>
              </div>

              {matchError && (
                <div className="flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {matchError}
                </div>
              )}

              <AnimatePresence mode="wait">
                {matchLoading ? (
                  <MatchPipelineLoadingState
                    key="match-pipeline-loader"
                    jobTitle={selectedJob?.job_title ?? "Selected Position"}
                    schoolName={selectedSchool?.school_name ?? "Selected School"}
                    isDataReady={isMatchDataReady}
                    onComplete={handleMatchPipelineComplete}
                  />
                ) : (
                  <motion.div
                    key="match-table"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <StudentMatchTable
                      candidates={filteredCandidates}
                      matchResults={matchResults}
                      showScores
                      onViewDetails={(r) => setDrawerResult(r)}
                      onInvite={(r) => setInviteTarget(r)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Student Detail Drawer */}
        <StudentMatchDrawer
          result={drawerResult}
          onClose={() => setDrawerResult(null)}
          onInvite={(r) => { setDrawerResult(null); setInviteTarget(r); }}
        />

        {/* Send Invitation Dialog */}
        <SendInvitationDialog
          target={inviteTarget}
          jobId={selectedJob?.job_id ?? null}
          jobTitle={selectedJob?.job_title ?? null}
          schoolId={selectedSchool?.school_id}
          schoolName={selectedSchool?.school_name ?? ""}
          onClose={() => setInviteTarget(null)}
          onSent={() => {
            // Refresh candidate list to reflect updated invitation_status
            if (selectedSchool) handleSelectSchool(selectedSchool);
            setInviteTarget(null);
          }}
        />
      </div>
    </CompanyVerificationGuard>
  );
}
