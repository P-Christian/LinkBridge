"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Clock, Loader2, Building2, GraduationCap, User } from "lucide-react";
import {
  PORTAL_SEARCH_CONFIG,
  publicProfileHref,
  type EntityType,
  type Portal,
  type SearchLink,
} from "./portalSearchConfig";

interface PortalCommandPaletteProps {
  portal: Portal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialQuery?: string;
}

interface SearchJob {
  job_id: number;
  job_title: string;
  job_status?: string;
  department_name?: string;
  work_setup?: string;
  employment_type?: string;
}

interface SearchApplicant {
  application_id: number;
  applicant_name: string;
  applicant_email: string;
  job_title: string;
  application_status: string;
  stage_name?: string;
  user_id?: number;
}

interface PersonResult {
  user_id: number;
  name: string;
  headline?: string;
  avatar_url?: string;
  badge_label?: string;
  entity_type?: EntityType;
}

const ENTITY_STYLES: Record<EntityType, { icon: React.ElementType; iconBg: string; badge: string }> = {
  freelancer: {
    icon: User,
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  client: {
    icon: Building2,
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  "school-admin": {
    icon: GraduationCap,
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
};

export function PortalCommandPalette({ portal, open, onOpenChange, initialQuery }: PortalCommandPaletteProps) {
  const cfg = PORTAL_SEARCH_CONFIG[portal];
  const recentKey = `vos_${portal}_recent_searches`;
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState(initialQuery || "");
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery);

  if (open !== prevOpen || initialQuery !== prevInitialQuery) {
    setPrevOpen(open);
    setPrevInitialQuery(initialQuery);
    if (open && initialQuery !== undefined) {
      setSearchQuery(initialQuery);
    }
  }

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [jobs, setJobs] = useState<SearchJob[]>([]);
  const [applicants, setApplicants] = useState<SearchApplicant[]>([]);
  const [people, setPeople] = useState<PersonResult[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Recent searches (per portal)
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(recentKey);
        setRecentSearches(stored ? JSON.parse(stored).slice(0, 5) : []);
      } catch {
        setRecentSearches([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [open, recentKey]);

  // Live jobs / applicants — client portal only
  useEffect(() => {
    if (!open || (!cfg.liveJobs && !cfg.liveApplicants)) return;
    let isMounted = true;
    const timer = setTimeout(() => {
      if (isMounted) setIsLoadingData(true);
    }, 0);

    Promise.allSettled([
      cfg.liveJobs ? fetch("/api/client/jobs").then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null),
      cfg.liveApplicants ? fetch("/api/client/applicants").then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null),
    ]).then(([jobsRes, appRes]) => {
      if (!isMounted) return;
      if (jobsRes.status === "fulfilled" && jobsRes.value?.jobs) setJobs(jobsRes.value.jobs);
      if (appRes.status === "fulfilled" && appRes.value?.applicants) setApplicants(appRes.value.applicants);
      setIsLoadingData(false);
    });

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [open, cfg.liveJobs, cfg.liveApplicants]);

  // People search — filtered to what this role should see
  useEffect(() => {
    if (!open || searchQuery.trim().length < 2) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/shared/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (!res.ok) return;
        const json = (await res.json()) as PersonResult[];
        const allowed = (json || []).filter(
          (p) => !p.entity_type || cfg.peopleEntityTypes.includes(p.entity_type)
        );
        setPeople(allowed.slice(0, 5));
      } catch {
        // ignore fetch errors
      }
    }, 220);

    return () => clearTimeout(timer);
  }, [open, searchQuery, cfg.peopleEntityTypes]);

  const visiblePeople = searchQuery.trim().length < 2 ? [] : people;

  const saveRecentSearch = useCallback(
    (term: string) => {
      if (!term.trim()) return;
      try {
        const stored = localStorage.getItem(recentKey);
        const list: string[] = stored ? JSON.parse(stored) : [];
        const updated = [term, ...list.filter((s) => s.toLowerCase() !== term.toLowerCase())].slice(0, 5);
        localStorage.setItem(recentKey, JSON.stringify(updated));
        setRecentSearches(updated);
      } catch {
        // ignore localStorage errors
      }
    },
    [recentKey]
  );

  const go = useCallback(
    (url: string, term?: string) => {
      if (term) saveRecentSearch(term);
      onOpenChange(false);
      router.push(url);
    },
    [onOpenChange, router, saveRecentSearch]
  );

  const openPerson = useCallback(
    (person: PersonResult) => {
      const entityType: EntityType = person.entity_type ?? "freelancer";
      if (cfg.logProfileViews && entityType === "freelancer") {
        // fire-and-forget; don't block navigation
        fetch("/api/freelancer/profile-views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ viewed_user_id: person.user_id }),
        }).catch((e) => console.error("Failed to log view", e));
      }
      go(publicProfileHref(portal, entityType, person.user_id), person.name);
    },
    [cfg.logProfileViews, go, portal]
  );

  const renderLink = (link: SearchLink) => {
    const Icon = link.icon;
    return (
      <CommandItem
        key={link.href + link.label}
        value={`${link.label} ${link.keywords ?? ""}`}
        onSelect={() => go(link.href, link.label)}
        className="flex items-center gap-2 cursor-pointer"
      >
        <Icon className={`h-4 w-4 ${link.iconClass ?? "text-muted-foreground"}`} />
        <span>{link.label}</span>
        {link.hint && <span className="ml-auto text-[11px] text-muted-foreground font-mono">{link.hint}</span>}
      </CommandItem>
    );
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command Palette"
      description="Quickly navigate, search, and run actions"
    >
      <CommandInput placeholder={cfg.inputPlaceholder} value={searchQuery} onValueChange={setSearchQuery} />
      <CommandList className="max-h-[380px] overflow-y-auto">
        <CommandEmpty>
          {isLoadingData ? (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Loading records...</span>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">{cfg.emptyText}</div>
          )}
        </CommandEmpty>

        {cfg.quickActions.length > 0 && (
          <>
            <CommandGroup heading="Quick Actions">{cfg.quickActions.map(renderLink)}</CommandGroup>
            <CommandSeparator />
          </>
        )}

        {!searchQuery.trim() && recentSearches.length > 0 && (
          <>
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((term) => (
                <CommandItem
                  key={term}
                  value={`recent ${term}`}
                  onSelect={() => setSearchQuery(term)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{term}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Client only: employer's own jobs */}
        {cfg.liveJobs && jobs.length > 0 && (
          <>
            <CommandGroup heading="Jobs & Listings">
              {jobs.map((job) => (
                <CommandItem
                  key={`job-${job.job_id}`}
                  value={`job ${job.job_title} ${job.department_name || ""} ${job.work_setup || ""} ${job.employment_type || ""} ${job.job_status || ""}`}
                  onSelect={() => go(`/linkbridge/client/jobs?jobId=${job.job_id}`, job.job_title)}
                  className="flex items-center gap-3 cursor-pointer py-2 px-3"
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm text-foreground truncate">{job.job_title}</span>
                    <span className="text-xs text-muted-foreground truncate">
                      {[job.department_name, job.work_setup, job.employment_type].filter(Boolean).join(" • ") || "Job Posting"}
                    </span>
                  </div>
                  {job.job_status && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 font-medium ${
                        job.job_status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {job.job_status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Client only: employer's own applicants */}
        {cfg.liveApplicants && applicants.length > 0 && (
          <>
            <CommandGroup heading="Candidates & Applicants">
              {applicants.map((app) => (
                <CommandItem
                  key={`applicant-${app.application_id}`}
                  value={`applicant candidate ${app.applicant_name} ${app.job_title} ${app.stage_name || app.application_status}`}
                  onSelect={() =>
                    go(`/linkbridge/client/applicants?search=${encodeURIComponent(app.applicant_name)}`, app.applicant_name)
                  }
                  className="flex items-center gap-3 cursor-pointer py-2 px-3"
                >
                  <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    {app.applicant_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-semibold text-sm text-foreground truncate">{app.applicant_name}</span>
                    <span className="text-xs text-muted-foreground truncate">Role: {app.job_title}</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-[10px] shrink-0 font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    {app.stage_name || app.application_status}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* People results — which types appear depends on the portal */}
        {visiblePeople.length > 0 && (
          <>
            <CommandGroup heading={cfg.peopleHeading}>
              {visiblePeople.map((person) => {
                const type: EntityType = person.entity_type ?? "freelancer";
                const styles = ENTITY_STYLES[type];
                const Icon = styles.icon;
                return (
                  <CommandItem
                    key={`${type}-${person.user_id}`}
                    value={`${type} ${person.name} ${person.headline || ""}`}
                    onSelect={() => openPerson(person)}
                    className="flex items-center gap-3 cursor-pointer py-2 px-3"
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full overflow-hidden ${
                        person.avatar_url ? "bg-muted" : styles.iconBg
                      }`}
                    >
                      {person.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Icon className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-semibold text-sm text-foreground truncate">{person.name}</span>
                      {person.headline && (
                        <span className="text-xs text-muted-foreground truncate">{person.headline}</span>
                      )}
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 font-medium ${styles.badge}`}>
                      {person.badge_label || type}
                    </Badge>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading={cfg.pagesHeading}>{cfg.pages.map(renderLink)}</CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
