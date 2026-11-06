// src/modules/matching-engine/campus/academicEvaluator.ts
// Scores unregistered roster candidates using academic signals only.
// Weights: Course/Degree 45% | Year 25% | Curriculum Competency 20% | GPA 10%

import { AcademicCandidate, CampusEvidenceItem, DeterministicGap } from "./types";
import { NormalizedJobRequirements } from "./types";
import { resolveCurriculumDomain, resolveJobDomain } from "./curriculumTaxonomy";
import { classifySkillNames } from "@/modules/client/campus-talent/utils/skillClassifier";

const WEIGHTS = {
  courseDegree: 45,
  yearLevel: 25,
  curriculumCompetency: 20,
  gpa: 10,
};

const YEAR_LEVEL_SCORES: Record<string, number> = {
  "1st year": 0.3,
  "2nd year": 0.5,
  "3rd year": 0.75,
  "4th year": 1.0,
  "graduating": 1.0,
  "graduate": 1.0,
};

function resolveYearScore(schoolYear: string): number {
  const norm = schoolYear.toLowerCase().trim();
  for (const [key, score] of Object.entries(YEAR_LEVEL_SCORES)) {
    if (norm.includes(key)) return score;
  }
  // Numeric parsing: "3" → 3rd year
  const num = parseInt(norm, 10);
  if (!isNaN(num) && num >= 1 && num <= 6) {
    return Math.min(num / 4, 1.0);
  }
  return 0.5; // unknown year level — neutral score
}

function resolveGpaScore(gpa: number | null): number {
  if (gpa === null) return 0.5; // unknown — neutral
  // Philippine GPA: 1.0 (best) to 5.0 (fail) OR 4.0 scale
  if (gpa <= 5.0 && gpa >= 1.0) {
    // PH scale: invert (1.0 = 100%, 5.0 = 0%)
    return Math.max(0, (5.0 - gpa) / 4.0);
  }
  // 4.0 scale
  return Math.min(gpa / 4.0, 1.0);
}

export interface AcademicEvaluationResult {
  score: number;
  curriculumItems: CampusEvidenceItem[];
  technicalItems?: CampusEvidenceItem[];
  softItems?: CampusEvidenceItem[];
  gaps: DeterministicGap[];
}

/**
 * Scores an academic-only (unregistered) candidate against a normalized job.
 * Returns a deterministic score 0–100 and inferred curriculum evidence.
 */
export function evaluateAcademicCandidate(
  candidate: AcademicCandidate,
  job: NormalizedJobRequirements
): AcademicEvaluationResult {
  const { domain: candidateDomain, competencies: curriculumCompetencies } =
    resolveCurriculumDomain(candidate.courseName);

  const jobDomain = resolveJobDomain(job.jobCategory, job.jobTitle);

  // ── Course / Degree Alignment (45%) ──────────────────────────────────────
  let courseDomainScore = 0;
  if (candidateDomain && jobDomain) {
    courseDomainScore = candidateDomain.domainKey === jobDomain.domainKey ? 1.0 : 0.3;
  } else if (candidateDomain && !jobDomain) {
    courseDomainScore = 0.5; // job domain unresolved — neutral
  }

  // Degree level bonus for entry-level jobs
  const entryLevels = ["ENTRY", "INTERNSHIP"];
  const isEntryJob = entryLevels.includes((job.experienceLevel ?? "").toUpperCase());
  if (isEntryJob && candidate.degree === "Bachelor") {
    courseDomainScore = Math.min(courseDomainScore + 0.1, 1.0);
  }

  // ── Year Level Alignment (25%) ────────────────────────────────────────────
  const yearScore = resolveYearScore(candidate.schoolYear);

  // ── Curriculum Competency Match (20%) ─────────────────────────────────────
  const skillRequirements = job.requirements
    .filter((r) => r.category === "SKILL")
    .map((r) => r.label.toLowerCase());

  let competencyOverlapCount = 0;
  if (curriculumCompetencies.length > 0 && skillRequirements.length > 0) {
    for (const comp of curriculumCompetencies) {
      const compNorm = comp.toLowerCase();
      const matched = skillRequirements.some(
        (sk) => compNorm.includes(sk) || sk.includes(compNorm.split(" ")[0])
      );
      if (matched) competencyOverlapCount++;
    }
  }
  const competencyScore =
    curriculumCompetencies.length > 0
      ? Math.min(competencyOverlapCount / Math.max(skillRequirements.length, 1), 1.0)
      : 0.4; // no curriculum resolved — low-neutral

  // ── GPA (10%) ─────────────────────────────────────────────────────────────
  const gpaScore = resolveGpaScore(candidate.gpa);

  // ── Composite Score ───────────────────────────────────────────────────────
  const raw =
    courseDomainScore * WEIGHTS.courseDegree +
    yearScore * WEIGHTS.yearLevel +
    competencyScore * WEIGHTS.curriculumCompetency +
    gpaScore * WEIGHTS.gpa;

  const score = Math.round(Math.min(Math.max(raw, 0), 100));

  // ── Curriculum Evidence Items (all inferred / not verified) ──────────────
  const curriculumItems: CampusEvidenceItem[] = curriculumCompetencies.map((comp) => ({
    label: comp,
    source: "CURRICULUM",
    verified: false,
  }));

  const { technicalSkills: techCompetencies, softSkills: softCompetencies } =
    classifySkillNames(curriculumCompetencies);

  const technicalItems: CampusEvidenceItem[] = techCompetencies.map((comp) => ({
    label: comp,
    source: "CURRICULUM",
    verified: false,
  }));

  const softItems: CampusEvidenceItem[] = softCompetencies.map((comp) => ({
    label: comp,
    source: "CURRICULUM",
    verified: false,
  }));

  // ── Deterministic Gaps (PREFERRED & REQUIRED skills from job) ─────────────
  const gaps: DeterministicGap[] = job.requirements
    .filter((r) => r.category === "SKILL")
    .map((r) => ({
      requirementLabel: r.label,
      type: r.type,
      // Unregistered student: absence of evidence ≠ missing — use NOT_EVIDENCED
      status: "NOT_EVIDENCED" as const,
      reason: `${r.label} experience cannot be verified — student has not registered on LinkBridge.`,
    }));

  return { score, curriculumItems, technicalItems, softItems, gaps };
}
