"use client";

// src/modules/client/talent-search/components/TalentProfileDrawer.tsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Briefcase, GraduationCap, Award, Link2, FileText,
  Send, BookmarkPlus, BookmarkCheck, AlertCircle, Download, ExternalLink,
  Sparkles, Loader2, Check, Mail, Banknote, Building2, ChevronRight, ChevronDown, ChevronUp, Laptop,
} from "lucide-react";
import { cn } from "@/lib/utils"; 
import { TalentProfile, MatchBreakdown,  } from "../types";
import { formatExperienceYears, formatDateRange, getInitials,   getPlatformIcon, getImageUrl } from "../utils/talentUtils";
import { getCachedExplanation, setCachedExplanation } from "@/lib/gemini/useExplanationCache";
import { orderEducation } from "@/modules/client/education/order-education";

interface TalentProfileDrawerProps {
  open: boolean;
  profile: TalentProfile | null;
  matchScore?: number | null;
  matchBreakdown?: MatchBreakdown | null;
  aiExplanation?: string | null;
  searchKeyword?: string;
  loading: boolean;
  error: string;
  onClose: () => void;
  onToggleSave: (profile: TalentProfile) => void;
  onInvite: (profile: TalentProfile) => void;
  saving: boolean;
}

const sectionHeading =
  "mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground md:text-xs";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Header and footer rise into place as the sheet finishes sliding. */
const drawerHeadMotion = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: EASE_OUT },
};

const drawerFootMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay: 0.16, ease: EASE_OUT },
};

// const tabContentMotion = {
//   initial: { opacity: 0, y: 10 },
//   animate: { opacity: 1, y: 0 },
//   exit: { opacity: 0, y: -8 },
//   transition: { duration: 0.2, ease: EASE_OUT },
// };

/** Top-to-bottom cascade container for tabs and lists */
const listStaggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.03,
    },
  },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

/** Single child item in top-to-bottom list */
const listStaggerItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASE_OUT },
  },
};

/** Individual animated word with index-based stagger */
const wordItemMotion = {
  hidden: { opacity: 0, y: 4 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.16,
      delay: i * 0.025,
      ease: EASE_OUT,
    },
  }),
};

/** One-by-one badge motion for skills */
const skillBadgeVariants = {
  hidden: { opacity: 0, scale: 0.8, y: 4 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.2,
      delay: i * 0.03,
      ease: EASE_OUT,
    },
  }),
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
};

const tabTrigger =
  "rounded-lg text-sm max-md:px-1.5 max-md:text-xs md:text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40";

// Taxonomy names often arrive verbose ("Structure query language SQL"); show the short form.
const SKILL_ALIASES: Record<string, string> = {
  "structure query language sql": "SQL",
  "google angular": "Angular",
  "microsoft .net framework": ".NET Framework",
};
const displaySkill = (s: string) => SKILL_ALIASES[s.trim().toLowerCase()] ?? s;

// Salary can arrive as a decimal string ("140000.00"), so coerce before formatting.
function formatSalary(value: number | string | null | undefined): string | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `₱${n.toLocaleString("en-PH", { maximumFractionDigits: 0 })}` : null;
}

function ExpandableText({
  text,
  // threshold = 220,
  clamp = "line-clamp-3",
  className,
  animateWords = false,
  expandable = true,
}: {
  text: string;
  threshold?: number;
  clamp?: string;
  className?: string;
  animateWords?: boolean;
  expandable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const [shouldAnimateWords] = useState(animateWords);
  const textRef = useRef<HTMLParagraphElement>(null);
  const cleanText = text.trim();

  // Detect whether the content actually overflows its clamped bounds (avoids ghost "Show more")
  useEffect(() => {
    if (!expandable || expanded) return;
    const el = textRef.current;
    if (!el) return;

    const id = requestAnimationFrame(() => {
      if (el) {
        const isClipped = el.scrollHeight > el.clientHeight + 2;
        setCanExpand(isClipped);
      }
    });

    return () => cancelAnimationFrame(id);
  }, [cleanText, clamp, expanded, expandable]);

  const paragraphs = useMemo(() => {
    return cleanText.split(/\n+/).map((para) => para.trim().split(/\s+/).filter(Boolean));
  }, [cleanText]);

  let wordCounter = 0;

  return (
    <div>
      <motion.div layout transition={{ duration: 0.25, ease: EASE_OUT }}>
        <p
          ref={textRef}
          className={cn(
            "whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-xs",
            className,
            expandable && !expanded && clamp
          )}
        >
          {shouldAnimateWords ? (
            <span className="inline">
              {paragraphs.map((words, pIdx) => (
                <span key={pIdx} className={pIdx > 0 ? "mt-2 block" : "inline"}>
                  {words.map((w, wIdx) => {
                    const idx = wordCounter++;
                    return (
                      <motion.span
                        key={`${w}-${pIdx}-${wIdx}`}
                        custom={idx}
                        variants={wordItemMotion}
                        initial="hidden"
                        animate="visible"
                        className="mr-1 inline-block"
                      >
                        {w}
                      </motion.span>
                    );
                  })}
                </span>
              ))}
            </span>
          ) : (
            cleanText
          )}
        </p>
      </motion.div>
      {expandable && (canExpand || expanded) && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.96 }}
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 inline-flex items-center text-xs font-semibold text-primary hover:underline max-md:min-h-10 cursor-pointer"
        >
          {expanded ? "Show less" : "Show more"}
        </motion.button>
      )}
    </div>
  );
}

function GlanceCard({
  icon,
  label,
  value,
  sub,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/30 p-3", className)}>
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:text-[10px]">
        {icon}
        {label}
      </div>
      <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function TalentProfileDrawer({
  open,
  profile,
  matchBreakdown,
  aiExplanation,
  searchKeyword,
  loading,
  error,
  onClose,
  onToggleSave,
  onInvite,
  saving,
}: TalentProfileDrawerProps) {
  // Tab selection is remembered per candidate, so opening someone new always starts on Overview
  const [tabState, setTabState] = useState<{ userId: number | null; tab: string }>({
    userId: null,
    tab: "overview",
  });
  const currentUserId = profile?.user_id ?? null;
  const tab = tabState.userId === currentUserId ? tabState.tab : "overview";
  const setTab = (t: string) => setTabState({ userId: currentUserId, tab: t });

  // Skills collapse is also per candidate
  const [skillsExpandedFor, setSkillsExpandedFor] = useState<number | null>(null);
  const showAllSkills = skillsExpandedFor === currentUserId;
  const skillsContainerRef = useRef<HTMLDivElement>(null);
  const [skillsExceedsTwoLines, setSkillsExceedsTwoLines] = useState(false);

  // Professional summary animation triggers once per sheet open session
  const [animatedSummaryUserId, setAnimatedSummaryUserId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setAnimatedSummaryUserId(null);
      });
    }
  }, [open]);

  const shouldAnimateSummary = Boolean(
    open && !loading && profile && animatedSummaryUserId !== profile.user_id
  );

  useEffect(() => {
    if (open && !loading && profile?.user_id && animatedSummaryUserId !== profile.user_id) {
      const uid = profile.user_id;
      queueMicrotask(() => {
        setAnimatedSummaryUserId(uid);
      });
    }
  }, [open, loading, profile?.user_id, animatedSummaryUserId]);

  useEffect(() => {
    const el = skillsContainerRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      if (el) {
        // Measure whether the full content height exceeds 2 lines (~68px)
        const overflows = el.scrollHeight > 68;
        setSkillsExceedsTwoLines(overflows);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [profile?.skills, open]);

  const [lazyExplanation, setLazyExplanation] = useState<string | null>(null);
  const [fetchingExplanation, setFetchingExplanation] = useState(false);

  useEffect(() => {
    if (!open || !profile || !searchKeyword) {
      queueMicrotask(() => {
        setLazyExplanation(null);
        setFetchingExplanation(false);
      });
      return;
    }

    // 1. Eager explanation already provided by the search result batch —
    //    cache it so reopening this drawer costs nothing.
    if (aiExplanation) {
      setCachedExplanation(searchKeyword, profile.user_id, aiExplanation);
      queueMicrotask(() => {
        setLazyExplanation(null);
        setFetchingExplanation(false);
      });
      return;
    }

    // 2. Check sessionStorage before making any network call.
    const cached = getCachedExplanation(searchKeyword, profile.user_id);
    if (cached) {
      queueMicrotask(() => {
        setLazyExplanation(cached);
        setFetchingExplanation(false);
      });
      return;
    }

    // 3. Cache miss — fetch lazily from the explain endpoint.
    let isMounted = true;
    queueMicrotask(() => setFetchingExplanation(true));

    fetch("/api/client/talent-search/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: searchKeyword,
        candidate: {
          name: profile.name,
          title: profile.headline ?? null,
          skills: profile.skills ?? [],
          summary: profile.summary ?? null,
          experience_years: profile.experience_years ?? 0,
        },
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.explanation) {
          setCachedExplanation(searchKeyword, profile.user_id, data.explanation);
          setLazyExplanation(data.explanation);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setFetchingExplanation(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, profile, aiExplanation, searchKeyword]);

  const activeExplanation = aiExplanation || lazyExplanation;

  const initials = profile ? getInitials(profile.name) : "";
  // const scoreClass = matchScore !== undefined ? matchScoreColor(matchScore) : "";
  const avatarSrc = profile ? getImageUrl(profile.profile_image_url) : "";
  const orderedEducation = profile
    ? orderEducation(profile.education, {
        status: (edu) => edu.education_status ?? null,
        endDate: (edu) => edu.end_date,
        startDate: (edu) => edu.start_date,
        id: (edu) => edu.id,
      })
    : [];



  const currentRole = profile
    ? profile.work_experience.find((e) => e.is_current_role) ?? profile.work_experience[0] ?? null
    : null;
  const salaryLabel = profile ? formatSalary(profile.expected_salary) : null;
  const emailIsMasked = !!profile?.email && profile.email.includes("*");
  const educationCount = profile ? profile.education.length + profile.certifications.length : 0;
  const primaryResumes = profile
    ? profile.resumes.filter(
        (r) => r.is_primary === true || (r.is_primary as unknown) === 1 || (r.is_primary as unknown) === "1"
      )
    : [];
  const displayResumes = primaryResumes.length > 0
    ? primaryResumes.slice(0, 1)
    : (profile?.resumes.slice(0, 1) ?? []);
  const portfolioCount = profile ? profile.social_links.length + displayResumes.length : 0;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 border-l border-border bg-background p-0 sm:max-w-2xl lg:max-w-[760px] max-md:max-h-[90dvh]"
      >
        {/* Loading */}
        {loading && (
          <>
            <SheetTitle className="sr-only">Loading candidate profile</SheetTitle>
            <div className="animate-pulse space-y-5 p-6" aria-busy="true">
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 shrink-0 rounded-2xl bg-muted" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <div className="h-5 w-1/2 rounded bg-muted" />
                  <div className="h-3.5 w-2/3 rounded bg-muted/70" />
                  <div className="h-3 w-1/3 rounded bg-muted/60" />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-24 rounded-full bg-muted" />
                <div className="h-6 w-20 rounded-full bg-muted" />
              </div>
              <div className="h-9 w-full rounded-xl bg-muted" />
              <div className="space-y-2.5">
                <div className="h-3.5 w-full rounded bg-muted/70" />
                <div className="h-3.5 w-11/12 rounded bg-muted/70" />
                <div className="h-3.5 w-4/5 rounded bg-muted/70" />
              </div>
            </div>
          </>
        )}

        {/* Error */}
        {!loading && error && (
          <>
            <SheetTitle className="sr-only">Candidate profile unavailable</SheetTitle>
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive/80" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}

        {/* Nothing to show (e.g. closing animation) — keep the dialog accessible */}
        {!loading && !error && !profile && (
          <SheetTitle className="sr-only">Candidate profile</SheetTitle>
        )}

        {/* Profile */}
        {!loading && !error && profile && (
          <>
            {/* Header */}
            <motion.div
              key={`head-${profile.user_id}`}
              {...drawerHeadMotion}
              className="shrink-0 border-b border-border bg-muted/30 px-6 pb-4 pt-6"
            >
              <SheetHeader className="space-y-3 p-0">
                <div className="flex items-start gap-4 pr-8">
                  {avatarSrc ? (
                    <Image
                      src={avatarSrc}
                      alt=""
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 rounded-2xl border border-border object-cover shadow-sm"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-xl font-bold text-primary">
                      {initials}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg font-bold leading-tight text-foreground">
                      {profile.name}
                    </SheetTitle>
                    {/* Fall back to the current role so the header is never name-only */}
                    {(profile.headline || currentRole) && (
                      <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                        {profile.headline ??
                          `${currentRole?.job_title}${currentRole?.company_name ? ` at ${currentRole.company_name}` : ""}`}
                      </p>
                    )}
                    {profile.location && (
                      <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground/80 md:text-xs">
                        <MapPin className="h-3 w-3" />
                        {profile.location}
                      </p>
                    )}
                  </div>
                </div>

              </SheetHeader>
            </motion.div>

            {/* Tabs */}
            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-6 mt-3 grid h-9 shrink-0 grid-cols-4 rounded-xl bg-muted p-1 max-md:min-h-10">
                <TabsTrigger value="overview" className={tabTrigger}>
                  Overview
                </TabsTrigger>
                <TabsTrigger value="experience" className={tabTrigger}>
                  Experience
                  {profile.work_experience.length > 0 && (
                    <span className="ml-1 text-muted-foreground">({profile.work_experience.length})</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="education" className={tabTrigger}>
                  Education
                  {educationCount > 0 && <span className="ml-1 text-muted-foreground">({educationCount})</span>}
                </TabsTrigger>
                <TabsTrigger value="portfolio" className={tabTrigger}>
                  Portfolio
                  {portfolioCount > 0 && <span className="ml-1 text-muted-foreground">({portfolioCount})</span>}
                </TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <AnimatePresence mode="wait" initial={false}>
                  {/* ── OVERVIEW ── */}
                  {tab === "overview" && (
                    <TabsContent key="overview" value="overview" forceMount className="mt-4">
                  <motion.div
                    variants={listStaggerContainer}
                    initial="hidden"
                    animate="visible"
                    exit={listStaggerContainer.exit}
                    className="space-y-6"
                  >
                    {/* AI match insight */}
                    {(activeExplanation || fetchingExplanation) && (
                      <motion.div variants={listStaggerItem}>
                        <AnimatePresence mode="wait">
                          {activeExplanation && (
                            <motion.div
                              key="active-explanation"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.2, ease: EASE_OUT }}
                              className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
                            >
                              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div>
                                <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                                  AI match insight
                                </p>
                                <p className="text-sm leading-relaxed text-foreground/90 md:text-xs">{activeExplanation}</p>
                              </div>
                            </motion.div>
                          )}
                          {fetchingExplanation && !activeExplanation && (
                            <motion.div
                              key="fetching-explanation"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -6 }}
                              transition={{ duration: 0.2, ease: EASE_OUT }}
                              className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-4 py-2.5 text-sm text-primary md:text-xs"
                            >
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                              <span>Generating AI match insight…</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}

                  {/* At a glance */}
                  {(currentRole || profile.experience_years > 0 || salaryLabel || profile.work_setup) && (
                    <motion.div variants={listStaggerItem} className="grid grid-cols-2 gap-2.5">
                      {currentRole && (
                        <GlanceCard
                          className="col-span-2"
                          icon={<Building2 className="h-3 w-3" />}
                          label={Boolean(currentRole.is_current_role) ? "Current role" : "Latest role"}
                          value={currentRole.job_title}
                          sub={currentRole.company_name}
                        />
                      )}
                      {profile.experience_years > 0 && (
                        <GlanceCard
                          icon={<Briefcase className="h-3 w-3" />}
                          label="Experience"
                          value={formatExperienceYears(profile.experience_years)}
                        />
                      )}
                      {salaryLabel && (
                        <GlanceCard
                          icon={<Banknote className="h-3 w-3" />}
                          label="Expected salary"
                          value={salaryLabel}
                          sub="per month"
                        />
                      )}
                      {profile.work_setup && (
                        <GlanceCard
                          icon={<Laptop className="h-3 w-3" />}
                          label="Preferred work setup"
                          value={profile.work_setup}
                        />
                      )}
                    </motion.div>
                  )}

                  {/* Browse-mode hint: only when there is nothing match-related to show */}
                  {!matchBreakdown && !activeExplanation && !fetchingExplanation && (
                    <motion.p
                      variants={listStaggerItem}
                      className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      Search for a role or skill and open a result to see a compatibility score.
                    </motion.p>
                  )}

                  {/* Match breakdown */}
                  {matchBreakdown && (
                    <motion.div variants={listStaggerItem} className="space-y-4 rounded-xl border border-primary/15 bg-primary/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold uppercase tracking-wider text-foreground md:text-xs">
                            Compatibility analysis
                          </h4>
                          {matchBreakdown.confidence && (
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-xs font-bold uppercase tracking-wider md:text-[10px]",
                                matchBreakdown.confidence.level === "HIGH"
                                  ? "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                                  : matchBreakdown.confidence.level === "MEDIUM"
                                  ? "border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
                                  : "border-border bg-muted text-muted-foreground"
                              )}
                            >
                              {matchBreakdown.confidence.level} confidence
                            </span>
                          )}
                        </div>
                        <span className="text-xl font-black tabular-nums text-primary">
                          {matchBreakdown.overallScore}%
                        </span>
                      </div>

                      {/* Overall bar */}
                      <div
                        className="h-2 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={matchBreakdown.overallScore}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Overall match"
                      >
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(100, Math.max(0, matchBreakdown.overallScore))}%` }}
                        />
                      </div>

                      {matchBreakdown.explanation?.summary && (
                        <p className="rounded-lg border border-border/70 bg-background/70 p-2.5 text-sm font-medium text-foreground/80 md:text-xs">
                          {matchBreakdown.explanation.summary}
                        </p>
                      )}

                      {/* Section scores as bars */}
                      {matchBreakdown.sections && matchBreakdown.sections.length > 0 ? (
                        <div className="space-y-2.5">
                          {matchBreakdown.sections.map((sec, idx) => {
                            const pct = sec.max > 0 ? Math.min(100, Math.round((sec.score / sec.max) * 100)) : 0;
                            return (
                              <div key={idx}>
                                <div className="mb-1 flex items-center justify-between text-sm md:text-xs">
                                  <span className="font-medium text-foreground/80">{sec.label}</span>
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {sec.score} / {sec.max} pts
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* Fallback legacy section rendering if sections not present */
                        <div className="grid grid-cols-2 gap-2.5 text-sm md:text-xs">
                          <div className="rounded-lg border border-border/70 bg-background p-2.5">
                            <span className="block text-muted-foreground">Skills</span>
                            <span className="font-bold text-foreground">{matchBreakdown.skills ?? 0} pts</span>
                          </div>
                          <div className="rounded-lg border border-border/70 bg-background p-2.5">
                            <span className="block text-muted-foreground">Experience</span>
                            <span className="font-bold text-foreground">{matchBreakdown.experience?.score ?? 0} pts</span>
                          </div>
                        </div>
                      )}

                      {/* Evidence chips */}
                      {matchBreakdown.evidence && matchBreakdown.evidence.length > 0 && (
                        <div className="space-y-1.5 border-t border-primary/15 pt-3">
                          <span className="block text-xs font-bold uppercase tracking-wider text-foreground md:text-[11px]">
                            Verified match signals
                          </span>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {matchBreakdown.evidence.map((ev, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-background px-2.5 py-1 text-sm font-semibold text-foreground shadow-xs md:text-[11px]"
                              >
                                <Check className="h-3 w-3 text-emerald-500" />
                                {ev.label}: <span className="font-normal text-muted-foreground">{ev.value}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Highlights */}
                      {matchBreakdown.explanation?.strengths && matchBreakdown.explanation.strengths.length > 0 && (
                        <div className="space-y-1.5 border-t border-primary/15 pt-3">
                          <span className="block text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 md:text-[11px]">
                            Highlights
                          </span>
                          <ul className="space-y-1 text-sm text-foreground/85 md:text-xs">
                            {matchBreakdown.explanation.strengths.map((str, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                <span>{str}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Summary */}
                  {profile.summary && (
                    <motion.div variants={listStaggerItem}>
                      <h4 className={sectionHeading}>Professional summary</h4>
                      <ExpandableText
                        key={profile.user_id + "-summary"}
                        text={profile.summary}
                        expandable={false}
                        className="text-foreground/85 md:text-sm"
                        animateWords={shouldAnimateSummary}
                      />
                    </motion.div>
                  )}

                  {/* Skills */}
                  {profile.skills.length > 0 && (
                    <motion.div variants={listStaggerItem}>
                      <h4 className={sectionHeading}>
                        Skills
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                          {profile.skills.length}
                        </span>
                      </h4>
                      <motion.div
                        layout
                        initial={false}
                        animate={{
                          height: showAllSkills ? "auto" : skillsExceedsTwoLines ? 64 : "auto",
                        }}
                        transition={{ duration: 0.28, ease: EASE_OUT }}
                        className="relative overflow-hidden"
                      >
                        <div ref={skillsContainerRef} className="flex flex-wrap gap-1.5 pb-0.5">
                          {profile.skills.map((skill, idx) => (
                            <motion.span
                              layout
                              custom={idx}
                              variants={skillBadgeVariants}
                              initial="hidden"
                              animate="visible"
                              key={skill}
                              className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                            >
                              {displaySkill(skill)}
                            </motion.span>
                          ))}
                        </div>
                      </motion.div>
                      {skillsExceedsTwoLines && (
                        <motion.button
                          type="button"
                          layout
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => setSkillsExpandedFor(showAllSkills ? null : currentUserId)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline max-md:min-h-10 cursor-pointer"
                        >
                          {showAllSkills ? (
                            <>
                              Show fewer
                              <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              Show more
                              <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </motion.button>
                      )}
                    </motion.div>
                  )}

                  {/* Experience preview */}
                  {profile.work_experience.length > 0 && (
                    <motion.div variants={listStaggerItem}>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className={cn(sectionHeading, "mb-0")}>
                          <Briefcase className="h-3.5 w-3.5" />
                          Recent experience
                        </h4>
                        {profile.work_experience.length > 2 && (
                          <motion.button
                            type="button"
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setTab("experience")}
                            className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline max-md:min-h-10 cursor-pointer"
                          >
                            View all {profile.work_experience.length}
                            <ChevronRight className="h-3 w-3" />
                          </motion.button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {profile.work_experience.slice(0, 2).map((exp) => (
                          <div key={exp.id} className="rounded-xl border border-border bg-muted/30 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{exp.job_title}</p>
                              {Boolean(exp.is_current_role) && (
                                <Badge
                                  variant="outline"
                                  className="border-emerald-300 bg-emerald-50 px-1.5 py-0 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
                                >
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-primary md:text-xs">
                              {exp.company_name}
                              <span className="text-muted-foreground">
                                {" · "}
                                {formatDateRange(exp.start_date, exp.end_date, exp.is_current_role)}
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Education preview */}
                  {orderedEducation.length > 0 && (
                    <motion.div variants={listStaggerItem}>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className={cn(sectionHeading, "mb-0")}>
                          <GraduationCap className="h-3.5 w-3.5" />
                          Education
                        </h4>
                        {(orderedEducation.length > 1 || profile.certifications.length > 0) && (
                          <motion.button
                            type="button"
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setTab("education")}
                            className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline max-md:min-h-10 cursor-pointer"
                          >
                            View all
                            <ChevronRight className="h-3 w-3" />
                          </motion.button>
                        )}
                      </div>
                      <div className="rounded-xl border border-border bg-muted/30 p-3">
                        <p className="text-sm font-semibold text-foreground">{orderedEducation[0].school_name ?? "—"}</p>
                        {orderedEducation[0].course_name && (
                          <p className="text-sm text-primary md:text-xs">{orderedEducation[0].course_name}</p>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Contact */}
                  {(profile.email) && (
                    <motion.div variants={listStaggerItem}>
                      <h4 className={sectionHeading}>Contact</h4>
                      <dl className="grid grid-cols-[96px_1fr] gap-x-3 gap-y-2 text-sm">
                        {profile.email && (
                          <>
                            <dt className="text-sm font-medium text-muted-foreground md:text-xs">Email</dt>
                            <dd className="min-w-0 truncate">
                              {emailIsMasked ? (
                                // Masked addresses can't be mailed — show as text and point to the invite flow
                                <span className="inline-flex items-center gap-1.5 text-foreground/85">
                                  <Mail className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{profile.email}</span>
                                  <span className="text-xs text-muted-foreground">· send an invitation to connect</span>
                                </span>
                              ) : (
                                <a
                                  href={`mailto:${profile.email}`}
                                  className="inline-flex items-center gap-1.5 text-foreground/85 hover:text-primary hover:underline"
                                >
                                  <Mail className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{profile.email}</span>
                                </a>
                              )}
                            </dd>
                          </>
                        )}
                      </dl>
                    </motion.div>
                  )}
                  </motion.div>
                </TabsContent>
              )}

              {/* ── EXPERIENCE ── */}
              {tab === "experience" && (
                <TabsContent key="experience" value="experience" forceMount className="mt-4">
                  <motion.div
                    variants={listStaggerContainer}
                    initial="hidden"
                    animate="visible"
                    exit={listStaggerContainer.exit}
                    className="space-y-4"
                  >
                    {profile.work_experience.length === 0 ? (
                      <p className="py-8 text-center text-sm text-muted-foreground">No work experience listed.</p>
                    ) : (
                      profile.work_experience.map((exp) => (
                        <motion.div
                          key={exp.id}
                          variants={listStaggerItem}
                          className="relative border-l-2 border-primary/30 pb-4 pl-5 last:pb-0"
                        >
                          <div className="absolute left-[-5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{exp.job_title}</p>
                            {Boolean(exp.is_current_role) && (
                              <Badge
                                variant="outline"
                                className="border-emerald-300 bg-emerald-50 px-1.5 py-0 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
                              >
                                Current
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium text-primary md:text-xs">{exp.company_name}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground md:text-xs">
                            {formatDateRange(exp.start_date, exp.end_date, exp.is_current_role)}
                            {exp.employment_type && ` · ${exp.employment_type}`}
                          </p>
                          {exp.location && (
                            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground md:text-xs">
                              <MapPin className="h-2.5 w-2.5" />
                              {exp.location}
                            </p>
                          )}
                          {exp.description && (
                            <div className="mt-2">
                              <ExpandableText key={exp.id + "-desc"} text={exp.description} />
                            </div>
                          )}
                          {exp.skills.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {exp.skills.map((s) => (
                                <span
                                  key={s}
                                  className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                >
                                  {displaySkill(s)}
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </motion.div>
                </TabsContent>
              )}

              {/* ── EDUCATION ── */}
              {tab === "education" && (
                <TabsContent key="education" value="education" forceMount className="mt-4">
                  <motion.div
                    variants={listStaggerContainer}
                    initial="hidden"
                    animate="visible"
                    exit={listStaggerContainer.exit}
                    className="space-y-5"
                  >
                    {profile.education.length > 0 && (
                      <motion.div variants={listStaggerItem}>
                        <h4 className={sectionHeading}>
                          <GraduationCap className="h-3.5 w-3.5" />
                          Education
                        </h4>
                        <motion.div
                          variants={listStaggerContainer}
                          initial="hidden"
                          animate="visible"
                          className="space-y-3"
                        >
                          {orderedEducation.map((edu) => (
                            <motion.div
                              key={edu.id}
                              variants={listStaggerItem}
                              className="rounded-xl border border-border bg-muted/40 p-3"
                            >
                              <p className="text-sm font-semibold text-foreground">{edu.school_name ?? "—"}</p>
                              {edu.course_name && (
                                <p className="text-sm text-primary md:text-xs">{edu.course_name}</p>
                              )}
                              {(edu.start_date || edu.end_date) && (
                                <p className="mt-0.5 text-sm text-muted-foreground md:text-xs">
                                  {formatDateRange(edu.start_date, edu.end_date, false)}
                                </p>
                              )}
                              {edu.school_location && (
                                <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground md:text-xs">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {edu.school_location}
                                </p>
                              )}
                            </motion.div>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}

                    {profile.certifications.length > 0 && (
                      <motion.div variants={listStaggerItem}>
                        <h4 className={sectionHeading}>
                          <Award className="h-3.5 w-3.5" />
                          Certifications
                        </h4>
                        <motion.div
                          variants={listStaggerContainer}
                          initial="hidden"
                          animate="visible"
                          className="space-y-2"
                        >
                          {profile.certifications.map((cert) => (
                            <motion.div
                              key={cert.id}
                              variants={listStaggerItem}
                              className="rounded-xl border border-border bg-muted/40 p-3"
                            >
                              <p className="text-sm font-semibold text-foreground">{cert.certificate_name}</p>
                              <p className="text-sm text-muted-foreground md:text-xs">{cert.issuing_organization}</p>
                              {cert.issue_date && (
                                <p className="mt-0.5 text-sm text-muted-foreground/80 md:text-xs">
                                  Issued{" "}
                                  {new Date(cert.issue_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </p>
                              )}
                              {cert.credential_url && (
                                <a
                                  href={cert.credential_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 flex items-center gap-1 text-sm text-primary hover:underline md:text-xs max-md:min-h-10"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  View credential
                                </a>
                              )}
                            </motion.div>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}

                    {profile.education.length === 0 && profile.certifications.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted-foreground">No education records listed.</p>
                    )}
                  </motion.div>
                </TabsContent>
              )}

              {/* ── PORTFOLIO ── */}
              {tab === "portfolio" && (
                <TabsContent key="portfolio" value="portfolio" forceMount className="mt-4">
                  <motion.div
                    variants={listStaggerContainer}
                    initial="hidden"
                    animate="visible"
                    exit={listStaggerContainer.exit}
                    className="space-y-5"
                  >
                    {profile.social_links.length > 0 && (
                      <motion.div variants={listStaggerItem}>
                        <h4 className={sectionHeading}>
                          <Link2 className="h-3.5 w-3.5" />
                          Links &amp; portfolio
                        </h4>
                        <motion.div
                          variants={listStaggerContainer}
                          initial="hidden"
                          animate="visible"
                          className="space-y-2"
                        >
                          {profile.social_links.map((link) => (
                            <motion.a
                              key={link.id}
                              variants={listStaggerItem}
                              href={link.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 p-3 transition-colors hover:border-primary/40"
                            >
                              <span className="text-lg">{getPlatformIcon(link.platform_name)}</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold capitalize text-foreground md:text-xs">
                                  {link.platform_name}
                                </p>
                                <p className="truncate text-sm text-muted-foreground md:text-xs">{link.profile_url}</p>
                              </div>
                              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                            </motion.a>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}

                    {displayResumes.length > 0 && (
                      <motion.div variants={listStaggerItem}>
                        <h4 className={sectionHeading}>
                          <FileText className="h-3.5 w-3.5" />
                          Primary Resume
                        </h4>
                        <motion.div
                          variants={listStaggerContainer}
                          initial="hidden"
                          animate="visible"
                          className="space-y-2"
                        >
                          {displayResumes.map((resume) => (
                            <motion.div
                              key={resume.id}
                              variants={listStaggerItem}
                              className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3"
                            >
                              <FileText className="h-5 w-5 shrink-0 text-primary" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground md:text-xs">
                                  {resume.file_name ?? "Resume"}
                                </p>
                                {resume.is_primary && (
                                  <span className="text-xs font-medium text-primary">Primary</span>
                                )}
                              </div>
                              <Button
                                asChild
                                size="sm"
                                variant="outline"
                                className="h-7 shrink-0 gap-1 rounded-lg px-2.5 text-xs max-md:min-h-10"
                              >
                                <a href={resume.file_url} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-3 w-3" />
                                  Download
                                </a>
                              </Button>
                            </motion.div>
                          ))}
                        </motion.div>
                      </motion.div>
                    )}

                    {profile.social_links.length === 0 && displayResumes.length === 0 && (
                      <p className="py-8 text-center text-sm text-muted-foreground">
                        No portfolio links or resumes uploaded.
                      </p>
                    )}
                  </motion.div>
                </TabsContent>
              )}
            </AnimatePresence>
          </div>
        </Tabs>

            {/* Sticky actions */}
            <motion.div
              {...drawerFootMotion}
              className="flex shrink-0 items-center gap-3 border-t border-border bg-background/95 px-6 py-3 backdrop-blur-sm"
            >
              <Button
                id={`drawer-save-${profile.user_id}`}
                variant="outline"
                size="sm"
                onClick={() => onToggleSave(profile)}
                disabled={saving}
                title={profile.is_saved ? "Click to remove from saved candidates" : undefined}
                className={cn(
                  "h-9 flex-1 gap-1.5 rounded-xl text-sm max-md:min-h-10 max-md:text-xs",
                  profile.is_saved && "border-primary/40 bg-primary/10 text-primary"
                )}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : profile.is_saved ? (
                  <BookmarkCheck className="h-4 w-4" />
                ) : (
                  <BookmarkPlus className="h-4 w-4" />
                )}
                {profile.is_saved ? "Saved" : "Save candidate"}
              </Button>
              <Button
                id={`drawer-invite-${profile.user_id}`}
                size="sm"
                onClick={() => onInvite(profile)}
                className="h-9 flex-1 gap-1.5 rounded-xl text-sm font-medium max-md:min-h-10 max-md:text-xs"
              >
                <Send className="h-4 w-4" />
                Send invitation
              </Button>
            </motion.div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}