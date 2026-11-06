"use client";

// src/modules/client/talent-search/components/TalentCard.tsx

import React from "react";
import Image from "next/image";
import { MapPin, Briefcase, BookmarkPlus, BookmarkCheck, GraduationCap, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TalentCard as TalentCardType } from "../types";
import { getInitials, matchScoreColor, formatExperienceYears, truncate, getImageUrl } from "../utils/talentUtils";

interface TalentCardProps {
  talent: TalentCardType;
  onViewProfile: (talent: TalentCardType) => void;
  onToggleSave: (talent: TalentCardType) => void;
  saving: boolean;
}

// Matched to the results grid's staggerChildren so a new query lifts the cards in order.
const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] as const } },
};

export default function TalentCardComponent({ talent, onViewProfile, onToggleSave, saving }: TalentCardProps) {
  const initials = getInitials(talent.name);
  const scoreClass = matchScoreColor(talent.match_score);
  const avatarSrc = getImageUrl(talent.profile_image_url);

  // const isAvailable =
  //   talent.availability_status === "AVAILABLE" || talent.availability_status === "IMMEDIATELY_AVAILABLE";

  const hasScore = talent.match_score !== null && talent.match_score !== undefined;
  const relevantYears = talent.relevant_experience_years ?? talent.experience_years;
  const showExperience = talent.experience_years > 0 || (talent.relevant_experience_years ?? 0) > 0;
  const latestJob = talent.work_experience[0];
  const educationCount = talent.education_count ?? talent.education.length;

  return (
    <motion.article
      layout="position"
      variants={cardVariants}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "group relative flex flex-col gap-4 rounded-2xl border border-border/80 p-5",
        "bg-card/90 shadow-2xs backdrop-blur-sm transition-colors hover:border-primary/40 hover:shadow-md"
      )}
    >
      {/* Header: identity (opens profile) + match score */}
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onViewProfile(talent)}
          aria-label={`View profile of ${talent.name}`}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <span className="shrink-0">
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl border border-border object-cover shadow-2xs"
                unoptimized
              />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-base font-bold text-primary shadow-2xs">
                {initials}
              </span>
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary">
              {talent.name}
            </span>
            {talent.headline && (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">{talent.headline}</span>
            )}
            {talent.location && (
              <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{talent.location}</span>
              </span>
            )}
          </span>
        </button>

        {hasScore && (
          <span
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs",
              scoreClass
            )}
            title="How well this profile matches your search"
          >
            {talent.match_score}% match
          </span>
        )}
      </div>

      {/* Experience */}
      {showExperience && (
        <div className="space-y-0.5 text-xs text-muted-foreground">
          <p className="flex flex-wrap items-center gap-x-1.5">
            <Briefcase className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="font-semibold text-foreground">
              {formatExperienceYears(relevantYears)} relevant exp
            </span>
            {talent.experience_years > relevantYears && (
              <span className="text-[11px] text-muted-foreground/75">
                ({formatExperienceYears(talent.experience_years)} total)
              </span>
            )}
          </p>
          {latestJob && (
            <p className="truncate pl-5">
              {latestJob.is_current_role ? "Currently at " : "Previously at "}
              <span className="text-foreground/80">{latestJob.company_name}</span>
            </p>
          )}
        </div>
      )}

      {/* Skills */}
      {talent.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {talent.skills.slice(0, 5).map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-border/80 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30"
            >
              {skill}
            </span>
          ))}
          {talent.skills.length > 5 && (
            <span
              className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground"
              title={talent.skills.slice(5).join(", ")}
            >
              +{talent.skills.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Education preview */}
      {talent.education.length > 0 && (
        <div className="flex flex-col gap-1">
          {talent.education.slice(0, 2).map((edu, idx) => (
            <p
              key={edu.id ?? `edu-${idx}`}
              className="flex items-center gap-1.5 truncate text-xs text-muted-foreground"
            >
              <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">
                {edu.school_name ?? "—"}
                {edu.course_name ? ` · ${edu.course_name}` : ""}
              </span>
            </p>
          ))}
          {educationCount > 2 && (
            <span className="w-fit rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
              +{educationCount - 2} more
            </span>
          )}
        </div>
      )}

      {/* Summary */}
      {talent.summary && (
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {truncate(talent.summary, 140)}
        </p>
      )}

      {/* Footer: availability + actions */}
      <div className="mt-auto flex items-center justify-end gap-2 border-t border-border/60 pt-3">
        <div className="flex gap-1.5">
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              id={`talent-save-${talent.user_id}`}
              variant="outline"
              size="sm"
              onClick={() => onToggleSave(talent)}
              disabled={saving}
              title={talent.is_saved ? "Remove from saved" : "Save candidate"}
              className={cn(
                "h-8 gap-1.5 rounded-lg px-2.5 text-xs shadow-2xs transition-all max-md:min-h-10",
                talent.is_saved
                  ? "border-primary/40 bg-primary/10 text-primary hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {talent.is_saved ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <BookmarkPlus className="h-3.5 w-3.5" />
              )}
              {talent.is_saved ? "Saved" : "Save"}
            </Button>
          </motion.div>

          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              id={`talent-view-${talent.user_id}`}
              size="sm"
              onClick={() => onViewProfile(talent)}
              className="h-8 gap-1.5 rounded-lg px-3 text-xs font-medium shadow-2xs max-md:min-h-10"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.article>
  );
}