// src/modules/matching-engine/evaluators/skillEvaluator.ts

import { NormalizedProfile } from "../types/profileTypes";
import { MatchContext, MatchMode } from "../types/matchTypes";
import { EvaluatorResult, EvidenceItem } from "../types/evaluatorTypes";

/**
 * Normalizes and compares two skill names with tolerance for common variants
 * like "React" vs "React.js", "Node" vs "Node.js", "Vue" vs "Vue.js", etc.
 */
function matchesSkill(skillA: string, skillB: string): boolean {
  const a = skillA.toLowerCase().trim();
  const b = skillB.toLowerCase().trim();
  if (a === b) return true;

  const strip = (s: string) => s.replace(/\.js$/i, "").replace(/js$/i, "").replace(/5$/i, "").trim();
  const sa = strip(a);
  const sb = strip(b);
  if (sa.length >= 3 && sa === sb) return true;

  if (a.includes(b) || b.includes(a)) {
    const shorter = a.length < b.length ? a : b;
    if (shorter.length >= 3) return true;
  }
  return false;
}

export function evaluateSkills(profile: NormalizedProfile, context: MatchContext, weight: number): EvaluatorResult {
  const candidateSkillsLower = profile.skills.map((s) => s.toLowerCase());

  // ── SKILL_MATCH & JOB_MATCH MODE: Explicit Checklist Evaluation ──
  if (context.mode === MatchMode.SKILL_MATCH || context.mode === MatchMode.JOB_MATCH) {
    const maxScore = 45;
    const explicitSkills = context.requestedSkills ?? [];
    const matchedSkills = explicitSkills.filter((s) =>
      candidateSkillsLower.some((cand) => matchesSkill(s, cand))
    );
    const missingSkills = explicitSkills.filter((s) =>
      !candidateSkillsLower.some((cand) => matchesSkill(s, cand))
    );

    const matchRatio = explicitSkills.length > 0 ? matchedSkills.length / explicitSkills.length : 1.0;
    const rawScore = Math.round(matchRatio * maxScore);

    const evidence: EvidenceItem[] = matchedSkills.map((s) => ({
      type: "SKILL",
      label: "Matched Skill",
      value: s,
      scoreContribution: explicitSkills.length > 0 ? Math.round(maxScore / explicitSkills.length) : 0,
    }));

    const strengths = matchedSkills.length > 0 ? [`Matched skills: ${matchedSkills.join(", ")}`] : [];
    const weaknesses = missingSkills.length > 0 ? [`Missing requested skills: ${missingSkills.join(", ")}`] : [];

    return {
      factor: "SKILLS",
      label: "Skills Coverage",
      score: rawScore,
      maxScore,
      weight,
      evidence,
      strengths,
      weaknesses,
      explanationCode: "SKILLS_CHECKLIST",
      explanationMessage: `Matched ${matchedSkills.length} of ${explicitSkills.length} requested skills.`,
    };
  }

  // ── ROLE_SIMILARITY MODE: Evaluate against taxonomy / inferred role skills ──
  if (context.mode === MatchMode.ROLE_SIMILARITY) {
    const roleSkills = context.effectiveSkills ?? context.requestedSkills ?? [];

    if (roleSkills.length > 0) {
      const maxScore = 15;
      const matchedSkills = roleSkills.filter((s) =>
        candidateSkillsLower.some((cand) => matchesSkill(s, cand))
      );
      const missingSkills = roleSkills.filter((s) =>
        !candidateSkillsLower.some((cand) => matchesSkill(s, cand))
      );

      const matchRatio = matchedSkills.length / roleSkills.length;
      const rawScore = Math.round(matchRatio * maxScore);

      const evidence: EvidenceItem[] = matchedSkills.map((s) => ({
        type: "SKILL",
        label: "Relevant Skill",
        value: s,
        scoreContribution: Number((maxScore / roleSkills.length).toFixed(1)),
      }));

      const strengths = matchedSkills.length > 0 ? [`Role-relevant skills: ${matchedSkills.join(", ")}`] : [];
      const weaknesses = missingSkills.length > 0 ? [`Unmatched role skills: ${missingSkills.slice(0, 5).join(", ")}`] : [];

      return {
        factor: "SKILLS",
        label: "Skill Relevance",
        score: rawScore,
        maxScore,
        weight,
        evidence,
        strengths,
        weaknesses,
        explanationCode: "SKILLS_ROLE_RELEVANCE",
        explanationMessage: `Matched ${matchedSkills.length} of ${roleSkills.length} role-relevant skills.`,
      };
    }
  }

  // ── BROWSE MODE or ROLE_SIMILARITY with no taxonomy skills: Reward-Only Skills Bonus ──
  let bonusScore = 0;
  if (profile.skills.length >= 5) {
    bonusScore = 15;
  } else if (profile.skills.length >= 3) {
    bonusScore = 12;
  } else if (profile.skills.length >= 1) {
    bonusScore = 8;
  } else {
    bonusScore = 0;
  }

  const evidence: EvidenceItem[] = profile.skills.slice(0, 4).map((s) => ({
    type: "SKILL",
    label: "Known Skill",
    value: s,
    scoreContribution: Number((bonusScore / Math.max(1, profile.skills.length)).toFixed(1)),
  }));

  return {
    factor: "SKILLS",
    label: context.mode === MatchMode.ROLE_SIMILARITY ? "Skill Relevance" : "Skills Bonus",
    score: bonusScore,
    maxScore: 15,
    weight,
    evidence,
    strengths: profile.skills.length > 0 ? [`Strong skill profile (${profile.skills.slice(0, 5).join(", ")})`] : [],
    weaknesses: profile.skills.length === 0 ? ["No skills listed in profile"] : [],
    explanationCode: "SKILLS_BONUS",
    explanationMessage: `Earned ${bonusScore}/15 skills bonus for ${profile.skills.length} skills.`,
  };
}
