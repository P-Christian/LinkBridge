// src/modules/client/campus-talent/components/StudentMatchTable.tsx

"use client";
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Send,
  GraduationCap,
  Zap,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Code2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import {
  CampusCandidate,
  CampusMatchResult,
  CampusEvidenceItem,
  EnhancedCandidate,
} from "@/modules/matching-engine/campus/types";
import { resolveCurriculumDomain } from "@/modules/matching-engine/campus/curriculumTaxonomy";
import { classifySkillNames } from "../utils/skillClassifier";

interface StudentMatchTableProps {
  candidates: CampusCandidate[];
  matchResults: CampusMatchResult[];
  showScores: boolean;
  onViewDetails: (result: CampusMatchResult) => void;
  onInvite: (result: CampusMatchResult) => void;
}

function getScoreColor(score: number): string {
  if (score >= 70) {
    return "text-emerald-600 dark:text-emerald-400";
  }

  if (score >= 50) {
    return "text-amber-600 dark:text-amber-400";
  }

  return "text-muted-foreground";
}

function getScoreBg(score: number): string {
  if (score >= 70) {
    return "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800";
  }

  if (score >= 50) {
    return "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800";
  }

  return "bg-muted border-border";
}

function getScoreLabel(score: number): string {
  if (score >= 70) return "Strong match";
  if (score >= 50) return "Potential match";
  return "Low match";
}

function InvitationBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase() ?? "not sent";

  if (normalized === "invited") {
    return (
      <Badge
        variant="secondary"
        className="h-6 gap-1 rounded-md px-2 text-[11px] font-medium"
      >
        <Mail className="h-3 w-3" />
        Invited
      </Badge>
    );
  }

  if (normalized === "registered") {
    return (
      <Badge
        variant="default"
        className="h-6 gap-1 rounded-md px-2 text-[11px] font-medium"
      >
        <CheckCircle2 className="h-3 w-3" />
        Registered
      </Badge>
    );
  }

  return (
    <span className="text-[11px] text-muted-foreground">
      Not invited
    </span>
  );
}



const tableHeaderClass =
  "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export default function StudentMatchTable({
  candidates,
  matchResults,
  showScores,
  onViewDetails,
  onInvite,
}: StudentMatchTableProps) {
  const [filterTab, setFilterTab] = useState<"ALL" | "REGISTERED" | "UNINVITED" | "INVITED">("ALL");

  const resultMap = useMemo(() => {
    const map = new Map<number, CampusMatchResult>();

    for (const result of matchResults) {
      map.set(result.candidateId, result);
    }

    return map;
  }, [matchResults]);

  const rows: CampusMatchResult[] = useMemo(() => {
    if (showScores && matchResults.length > 0) {
      return matchResults;
    }

    return candidates.map((candidate): CampusMatchResult => {
      let verifiedSkillItems: CampusEvidenceItem[] = [];
      let curriculumItems: CampusEvidenceItem[] = [];
      let technicalItems: CampusEvidenceItem[] = [];
      let softItems: CampusEvidenceItem[] = [];
      let experienceItems: CampusEvidenceItem[] = [];

      if (candidate.isRegistered) {
        const userSkills = (candidate as EnhancedCandidate).verifiedSkills ?? [];
        verifiedSkillItems = userSkills.map((s) => ({
          label: s,
          source: "USER_SKILL" as const,
          verified: true,
        }));

        const techNames = candidate.technicalSkills ?? classifySkillNames(userSkills).technicalSkills;
        const softNames = candidate.softSkills ?? classifySkillNames(userSkills).softSkills;

        technicalItems = techNames.map((s) => ({
          label: s,
          source: "USER_SKILL" as const,
          verified: true,
        }));

        softItems = softNames.map((s) => ({
          label: s,
          source: "USER_SKILL" as const,
          verified: true,
        }));

        if ((candidate as EnhancedCandidate).workExperienceYears > 0) {
          const yrs = (candidate as EnhancedCandidate).workExperienceYears;
          experienceItems = [
            {
              label: `${yrs} year${yrs !== 1 ? "s" : ""} of work experience`,
              source: "WORK_EXPERIENCE" as const,
              verified: true,
            },
          ];
        }

        const { competencies } = resolveCurriculumDomain(candidate.courseName);
        curriculumItems = competencies.map((comp) => ({
          label: comp,
          source: "CURRICULUM" as const,
          verified: false,
        }));
      } else {
        const { competencies } = resolveCurriculumDomain(candidate.courseName);
        curriculumItems = competencies.map((comp) => ({
          label: comp,
          source: "CURRICULUM" as const,
          verified: false,
        }));

        const techNames = candidate.technicalSkills ?? classifySkillNames(competencies).technicalSkills;
        const softNames = candidate.softSkills ?? classifySkillNames(competencies).softSkills;

        technicalItems = techNames.map((s) => ({
          label: s,
          source: "CURRICULUM" as const,
          verified: false,
        }));

        softItems = softNames.map((s) => ({
          label: s,
          source: "CURRICULUM" as const,
          verified: false,
        }));
      }

      return {
        candidateId: candidate.studentId,
        studentNumber: candidate.studentNumber,
        studentName: `${candidate.firstName} ${candidate.lastName}`,
        email: candidate.email,
        courseName: candidate.courseName,
        schoolYear: candidate.schoolYear,
        gpa: candidate.gpa,
        isRegistered: candidate.isRegistered,
        registeredUserId: candidate.isRegistered
          ? candidate.registeredUserId
          : null,
        invitationStatus: candidate.invitationStatus,
        matchModel: "ACADEMIC",
        evidenceLevel: candidate.isRegistered
          ? "ACADEMIC_ENRICHED"
          : "ACADEMIC_ONLY",
        score: 0,
        eligibility: {
          eligible: true,
          reasons: [],
        },
        evidence: {
          curriculum: curriculumItems,
          verifiedSkills: verifiedSkillItems,
          technicalSkills: technicalItems,
          softSkills: softItems,
          experience: experienceItems,
          responsibilities: [],
        },
        gaps: [],
        explanation: null,
      };
    });
  }, [candidates, matchResults, showScores]);

  const stats = useMemo(() => {
    const total = rows.length;
    const registered = rows.filter((r) => r.isRegistered).length;
    const invited = rows.filter((r) => r.invitationStatus?.toLowerCase() === "invited").length;
    const validGpas = rows
      .filter((r) => r.gpa !== null && r.gpa !== undefined)
      .map((r) => r.gpa as number);
    const avgGpa =
      validGpas.length > 0
        ? (validGpas.reduce((a, b) => a + b, 0) / validGpas.length).toFixed(2)
        : null;
    return { total, registered, invited, avgGpa };
  }, [rows]);

  const displayedRows = useMemo(() => {
    if (filterTab === "REGISTERED") {
      return rows.filter((r) => r.isRegistered);
    }
    if (filterTab === "UNINVITED") {
      return rows.filter((r) => {
        const s = r.invitationStatus?.toLowerCase() ?? "";
        return s !== "invited" && s !== "registered";
      });
    }
    if (filterTab === "INVITED") {
      return rows.filter((r) => r.invitationStatus?.toLowerCase() === "invited");
    }
    return rows;
  }, [rows, filterTab]);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset to first page when dataset size changes
  useEffect(() => {
    queueMicrotask(() => {
      setCurrentPage(1);
    });
  }, [candidates.length, matchResults.length]);

  const totalCount = displayedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedRows = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * pageSize;
    return displayedRows.slice(startIndex, startIndex + pageSize);
  }, [displayedRows, safeCurrentPage, pageSize]);

  const startItem = totalCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(safeCurrentPage * pageSize, totalCount);

  if (rows.length === 0) {
    return (
      <motion.div
        className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 px-6 text-center"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{
          duration: 0.25,
          ease: "easeOut",
        }}
      >
        <motion.div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Users className="h-5 w-5 text-muted-foreground" />
        </motion.div>

        <h3 className="text-sm font-semibold text-foreground">
          No students found
        </h3>

        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          There are no students matching the current filters or
          search criteria.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      transition={{
        layout: { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
      }}
      className="overflow-hidden rounded-xl border border-border bg-background shadow-sm space-y-0 min-h-[560px] flex flex-col justify-between wrap-anywhere"
    >
      {/* Table Toolbar & Segment Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden pb-1 sm:pb-0 bg-muted/60 p-1 rounded-xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs rounded-lg font-medium transition-all px-3",
              filterTab === "ALL"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              setFilterTab("ALL");
              setCurrentPage(1);
            }}
          >
            All Students ({stats.total})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs rounded-lg font-medium transition-all px-3 gap-1.5",
              filterTab === "REGISTERED"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              setFilterTab("REGISTERED");
              setCurrentPage(1);
            }}
          >
            <Zap className="h-3 w-3 text-primary" />
            Registered on VOS ({stats.registered})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs rounded-lg font-medium transition-all px-3",
              filterTab === "UNINVITED"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              setFilterTab("UNINVITED");
              setCurrentPage(1);
            }}
          >
            Uninvited ({Math.max(0, stats.total - stats.invited - stats.registered)})
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-xs rounded-lg font-medium transition-all px-3 gap-1.5",
              filterTab === "INVITED"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => {
              setFilterTab("INVITED");
              setCurrentPage(1);
            }}
          >
            <Mail className="h-3 w-3 text-muted-foreground" />
            Invited ({stats.invited})
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto flex-1 min-h-[420px] scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[720px] md:min-w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[34%]" />
            <col className="w-[28%]" />
            {showScores ? (
              <>
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </>
            ) : (
              <col className="w-[24%]" />
            )}
            <col className="w-[14%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className={tableHeaderClass}>Student</th>

              <th className={tableHeaderClass}>
                Course / Program
              </th>

              {showScores ? (
                <>
                  <th
                    className={cn(
                      tableHeaderClass,
                      "text-center",
                    )}
                  >
                    Match
                  </th>

                  <th className={tableHeaderClass}>
                    Status
                  </th>
                </>
              ) : (
                <th className={tableHeaderClass}>
                  Verification &amp; Status
                </th>
              )}

              <th
                className={cn(
                  tableHeaderClass,
                  "text-right",
                )}
              >
                Actions
              </th>
            </tr>
          </thead>

          <AnimatePresence mode="wait" initial={false}>
            <motion.tbody
              key={`${filterTab}-${safeCurrentPage}-${pageSize}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="divide-y divide-border"
            >
              {paginatedRows.length > 0 ? (
                paginatedRows.map((row, index) => {
                  const hasMatch = resultMap.has(
                    row.candidateId,
                  );

                  const isEligible =
                    row.eligibility.eligible;

                  return (
                    <motion.tr
                      key={row.candidateId}
                      layout="position"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.2,
                        delay: Math.min(index * 0.025, 0.25),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={cn(
                        "group relative transition-colors duration-150",
                        "hover:bg-muted/30",
                        showScores &&
                          !isEligible &&
                          "bg-muted/10 opacity-65",
                      )}
                    >
                    {/* Student */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <motion.div
                          className={cn(
                            "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            "bg-primary/10 ring-1 ring-primary/10",
                            "transition-colors duration-150",
                            "group-hover:bg-primary/15",
                          )}
                          whileHover={{
                            scale: 1.06,
                          }}
                          transition={{
                            duration: 0.15,
                          }}
                        >
                          <span className="text-xs font-bold text-primary">
                            {row.studentName
                              .charAt(0)
                              .toUpperCase()}
                          </span>

                          {row.isRegistered && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-2 ring-background">
                              <Zap className="h-2 w-2 text-primary-foreground" />
                            </span>
                          )}
                        </motion.div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate font-medium leading-tight text-foreground">
                              {row.studentName}
                            </p>

                            {hasMatch && showScores && (
                              <motion.div
                                initial={{
                                  opacity: 0,
                                  scale: 0.7,
                                }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                }}
                                transition={{
                                  delay: 0.15,
                                }}
                              >
                                
                              </motion.div>
                            )}
                          </div>

                          <p className="mt-0.5 max-w-[240px] truncate text-xs text-muted-foreground">
                            {row.email}
                          </p>

                          {row.studentNumber && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground/70 font-mono">
                              ID: {row.studentNumber}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Course / Program */}
                    <td className="px-4 py-3.5">
                      <p className="max-w-[260px] truncate font-medium text-foreground">
                        {row.courseName ?? (
                          <span className="font-normal italic text-muted-foreground">
                            General Academic Curriculum
                          </span>
                        )}
                      </p>

                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {row.schoolYear || "Current Year"}
                        </span>

                        {row.gpa !== null && (
                          <>
                            <span className="text-muted-foreground/40">
                              •
                            </span>

                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border">
                              GPA {row.gpa.toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Skills Preview Badges */}
                      {((row.evidence.technicalSkills && row.evidence.technicalSkills.length > 0) ||
                        (row.evidence.softSkills && row.evidence.softSkills.length > 0)) && (
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          {row.evidence.technicalSkills && row.evidence.technicalSkills.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              <Code2 className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {row.evidence.technicalSkills.slice(0, 2).map((s) => s.label).join(", ")}
                              </span>
                              {row.evidence.technicalSkills.length > 2 && (
                                <span className="opacity-75">+{row.evidence.technicalSkills.length - 2}</span>
                              )}
                            </span>
                          )}
                          {row.evidence.softSkills && row.evidence.softSkills.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                              <Sparkles className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate max-w-[120px]">
                                {row.evidence.softSkills.slice(0, 1).map((s) => s.label).join(", ")}
                              </span>
                              {row.evidence.softSkills.length > 1 && (
                                <span className="opacity-75">+{row.evidence.softSkills.length - 1}</span>
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Score View: Score Column */}
                    {showScores && (
                      <>
                        <td className="px-4 py-3.5">
                          {isEligible ? (
                            <div className="flex flex-col items-center gap-1.5">
                              <motion.div
                                className={cn(
                                  "relative flex h-11 w-11 items-center justify-center rounded-full border-2",
                                  "font-bold tabular-nums",
                                  getScoreBg(row.score),
                                  getScoreColor(row.score),
                                )}
                                initial={{
                                  opacity: 0,
                                  scale: 0.75,
                                }}
                                animate={{
                                  opacity: 1,
                                  scale: 1,
                                }}
                                transition={{
                                  duration: 0.3,
                                  delay: 0.08,
                                  type: "spring",
                                  stiffness: 400,
                                  damping: 24,
                                }}
                                whileHover={{
                                  scale: 1.08,
                                }}
                              >
                                {row.score}

                                <span className="absolute inset-[-4px] rounded-full border border-transparent transition-colors group-hover:border-primary/10" />
                              </motion.div>

                              <div className="text-center">
                                <p
                                  className={cn(
                                    "text-[10px] font-medium",
                                    getScoreColor(row.score),
                                  )}
                                >
                                  {getScoreLabel(row.score)}
                                </p>

                                <p className="text-[10px] text-muted-foreground">
                                  {row.matchModel}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <motion.div
                              className="flex flex-col items-center gap-1.5"
                              initial={{
                                opacity: 0,
                                scale: 0.8,
                              }}
                              animate={{
                                opacity: 1,
                                scale: 1,
                              }}
                            >
                              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-destructive/20 bg-destructive/5">
                                <XCircle className="h-5 w-5 text-destructive" />
                              </div>

                              <span className="text-[10px] font-medium text-destructive">
                                Ineligible
                              </span>
                            </motion.div>
                          )}
                        </td>

                        {/* Status for score view */}
                        <td className="px-4 py-3.5">
                          <div className="max-w-[260px] space-y-1.5">
                            {!isEligible &&
                              row.eligibility.reasons.length >
                                0 && (
                                <div className="flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/5 px-2.5 py-2">
                                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />

                                  <p className="line-clamp-2 text-[11px] leading-relaxed text-destructive">
                                    {
                                      row.eligibility
                                        .reasons[0]
                                    }
                                  </p>
                                </div>
                              )}

                            {isEligible && (
                              <>
                                <InvitationBadge
                                  status={
                                    row.invitationStatus
                                  }
                                />

                                {row.evidence.curriculum
                                  .length > 0 && (
                                  <motion.div
                                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                                    initial={{
                                      opacity: 0,
                                      x: -4,
                                    }}
                                    animate={{
                                      opacity: 1,
                                      x: 0,
                                    }}
                                    transition={{
                                      delay: 0.12,
                                    }}
                                  >
                                    <GraduationCap className="h-3.5 w-3.5 shrink-0" />

                                    <span>
                                      {
                                        row.evidence
                                          .curriculum
                                          .length
                                      }{" "}
                                      inferred competencies
                                    </span>
                                  </motion.div>
                                )}

                                {row.evidence
                                  .verifiedSkills.length >
                                  0 && (
                                  <motion.div
                                    className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400"
                                    initial={{
                                      opacity: 0,
                                      x: -4,
                                    }}
                                    animate={{
                                      opacity: 1,
                                      x: 0,
                                    }}
                                    transition={{
                                      delay: 0.17,
                                    }}
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />

                                    <span>
                                      {
                                        row.evidence
                                          .verifiedSkills
                                          .length
                                      }{" "}
                                      verified skills
                                    </span>
                                  </motion.div>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </>
                    )}

                    {/* Non-Score View: Status & Verification Column */}
                    {!showScores && (
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1.5 max-w-[220px]">
                          <div className="flex items-center gap-2">
                            {row.isRegistered ? (
                              <Badge
                                variant="secondary"
                                className="h-5 gap-1 rounded-md px-2 text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                              >
                                <Zap className="h-2.5 w-2.5" />
                                Registered on VOS
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="h-5 gap-1 rounded-md px-2 text-[10px] font-medium text-muted-foreground"
                              >
                                <ShieldCheck className="h-2.5 w-2.5" />
                                School Roster
                              </Badge>
                            )}
                          </div>
                          <div>
                            <InvitationBadge status={row.invitationStatus} />
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Actions */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.96 }}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-8 gap-1.5 rounded-lg px-2.5 text-xs",
                              "text-muted-foreground",
                              "hover:bg-muted hover:text-foreground",
                            )}
                            onClick={() =>
                              onViewDetails(row)
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span className="hidden lg:inline">
                              Details
                            </span>
                          </Button>
                        </motion.div>

                        {isEligible &&
                          row.invitationStatus !==
                            "Invited" &&
                          row.invitationStatus !==
                            "Registered" && (
                            <motion.div
                              whileHover={{
                                scale: 1.03,
                              }}
                              whileTap={{
                                scale: 0.96,
                              }}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className={cn(
                                  "h-8 gap-1.5 rounded-lg px-2.5 text-xs",
                                  "border-primary/20",
                                  "hover:border-primary/40 hover:bg-primary/5",
                                )}
                                onClick={() =>
                                  onInvite(row)
                                }
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">
                                  Invite
                                </span>
                              </Button>
                            </motion.div>
                          )}
                      </div>
                    </td>
                  </motion.tr>
                    );
                  })
                ) : (
                  <motion.tr
                    key="empty-row"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <td
                      colSpan={showScores ? 5 : 4}
                      className="h-72 text-center text-xs text-muted-foreground py-12"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col items-center justify-center gap-2"
                      >
                        <Users className="h-6 w-6 text-muted-foreground/50" />
                        <span className="font-medium text-foreground/80">No students found in this category</span>
                        <p className="text-[11px] text-muted-foreground">
                          Try switching to another filter or clearing your search.
                        </p>
                      </motion.div>
                    </td>
                  </motion.tr>
                )}
            </motion.tbody>
          </AnimatePresence>
        </table>
      </div>

      {/* ── Table Pagination Footer ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-3">
        <div className="text-xs text-muted-foreground">
          Showing <strong className="text-foreground font-semibold">{startItem}</strong> to{" "}
          <strong className="text-foreground font-semibold">{endItem}</strong> of{" "}
          <strong className="text-foreground font-semibold">{totalCount}</strong> students
          {totalCount < rows.length && (
            <span className="ml-1 text-[11px] text-muted-foreground/80">
              (filtered from {rows.length} total)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span>Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => {
                setPageSize(Number(val));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-16 text-xs rounded-lg border-border bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="10" className="text-xs">
                  10
                </SelectItem>
                <SelectItem value="25" className="text-xs">
                  25
                </SelectItem>
                <SelectItem value="50" className="text-xs">
                  50
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2.5 text-xs font-semibold text-foreground">
              {safeCurrentPage} / {totalPages}
            </span>
            <Button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
 
