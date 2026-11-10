import Link from "next/link";
import {
  MapPin, ChevronRight, CheckCircle2, ArrowRight,
  Megaphone, PenTool, Database, HeartPulse,
  Code2, TrendingUp, Briefcase
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SlideUp, HoverScale, StaggerContainer, StaggerChild } from "@/components/shared/MotionContainer";
import { LandingCTA } from "@/components/public/LandingCTA";
import { HomeSearchBar } from "@/components/public/HomeSearchBar";
import { formatAssetUrl, formatJobType } from "@/lib/utils";
import { getPublicJobs } from "@/app/api/public/find-jobs/route";
import type { PopularPreset } from "@/modules/public/find-jobs/types";

export const dynamic = "force-dynamic";

// ==========================================
// MOCK DATA
// ==========================================

const CATEGORIES = [
  { name: "Software Engineering", icon: <Code2 className="w-6 h-6" />, count: "Explore roles", color: "bg-blue-50 text-blue-600" },
  { name: "UI/UX Design", icon: <PenTool className="w-6 h-6" />, count: "Explore roles", color: "bg-pink-50 text-pink-600" },
  { name: "Marketing & Sales", icon: <Megaphone className="w-6 h-6" />, count: "Explore roles", color: "bg-orange-50 text-orange-600" },
  { name: "Data Science", icon: <Database className="w-6 h-6" />, count: "Explore roles", color: "bg-purple-50 text-purple-600" },
  { name: "Finance", icon: <TrendingUp className="w-6 h-6" />, count: "Explore roles", color: "bg-emerald-50 text-emerald-600" },
  { name: "Healthcare", icon: <HeartPulse className="w-6 h-6" />, count: "Explore roles", color: "bg-rose-50 text-rose-600" },
];

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function getRelativeTimeString(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface RawJob {
  job_id: number;
  company_id: number | null;
  job_title: string;
  job_type: string;
  work_arrangement: string;
  job_location: string;
  salary_type: string;
  salary_min: number | string | null;
  salary_max: number | string | null;
  salary_negotiable: boolean;
  currency: string | null;
  created_at: string;
}

interface RawCompany {
  company_id: number;
  company_name: string;
  company_logo: string | null;
}

interface RawSkillMap {
  job_id: number;
  skill_id: {
    skill_name: string;
  } | null;
}

function formatSalary(job: RawJob): string {
  if (job.salary_negotiable) return "Negotiable";
  const currency = job.currency ?? "PHP";
  if (job.salary_type === "Fixed Salary" && job.salary_min) {
    return `${currency} ${Number(job.salary_min).toLocaleString()} / mo`;
  }
  if (job.salary_min && job.salary_max) {
    return `${currency} ${Number(job.salary_min).toLocaleString()} – ${Number(job.salary_max).toLocaleString()} / mo`;
  }
  if (job.salary_min) return `${currency} ${Number(job.salary_min).toLocaleString()}+ / mo`;
  return "Salary not disclosed";
}

async function getFeaturedJobs() {
  const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
  const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (DIRECTUS_TOKEN) headers["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;

  try {
    const fields = [
      "job_id", "company_id", "job_title", "job_type", "work_arrangement",
      "job_location", "salary_type", "salary_min", "salary_max",
      "salary_negotiable", "currency", "created_at"
    ].join(",");

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_job_posting?filter[status][_eq]=ACTIVE&sort[]=-created_at&fields=${fields}&limit=6`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const rawJobs: RawJob[] = json.data ?? [];
    if (rawJobs.length === 0) return [];

    const jobIds = rawJobs.map((j) => j.job_id);
    const companyIds = Array.from(new Set(rawJobs.map((j) => j.company_id).filter((id): id is number => Boolean(id))));

    const companiesMap: Record<number, { name: string; logo: string | null }> = {};
    if (companyIds.length > 0) {
      const compRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_company?filter[company_id][_in]=${companyIds.join(",")}&fields=company_id,company_name,company_logo&limit=100`,
        { headers, cache: "no-store" }
      );
      if (compRes.ok) {
        const compJson = await compRes.json();
        (compJson.data ?? []).forEach((c: RawCompany) => {
          companiesMap[c.company_id] = {
            name: c.company_name,
            logo: c.company_logo ?? null,
          };
        });
      }
    }

    const skillsMap: Record<number, string[]> = {};
    if (jobIds.length > 0) {
      const skillsRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_job_skills_map?filter[job_id][_in]=${jobIds.join(",")}&fields=job_id,skill_id.skill_name&limit=500`,
        { headers, cache: "no-store" }
      );
      if (skillsRes.ok) {
        const skillsJson = await skillsRes.json();
        (skillsJson.data ?? []).forEach((m: RawSkillMap) => {
          const jobId = m.job_id;
          if (!skillsMap[jobId]) skillsMap[jobId] = [];
          if (m.skill_id?.skill_name) {
            skillsMap[jobId].push(m.skill_id.skill_name);
          }
        });
      }
    }

    return rawJobs.map((j) => {
      const companyId = j.company_id;
      const company = (companyId ? companiesMap[companyId] : null) || { name: "Unknown Company", logo: null };
      return {
        id: j.job_id,
        title: j.job_title,
        company: company.name,
        location: j.job_location,
        type: formatJobType(j.job_type),
        salary: formatSalary(j),
        logo: formatAssetUrl(company.logo) || getInitials(company.name),
        posted: getRelativeTimeString(j.created_at),
        tags: (skillsMap[j.job_id] ?? []).slice(0, 3),
      };
    });
  } catch (err) {
    console.error("Error loading featured jobs:", err);
    return [];
  }
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

export default async function Page() {
  const jobsPromise = getFeaturedJobs();
  const presetsPromise = getPublicJobs({ limit: 1 }).catch(() => null);

  const [jobs, publicJobsRes] = await Promise.all([jobsPromise, presetsPromise]);
  const popularPresets: PopularPreset[] = publicJobsRes?.meta?.popularPresets ?? [];

  return (
    <div className="relative isolate min-h-screen text-foreground font-sans selection:bg-muted">
      {/* Main page content layer - elevated above background */}
      <div className="relative z-10">
        {/* HERO SECTION */}
        <section className="pt-4 pb-16 md:pt-24 md:pb-32">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <StaggerContainer>
              <StaggerChild>
                <Badge variant="secondary" className="mb-6 py-1.5 px-4 rounded-full shadow-sm bg-background/50 backdrop-blur-sm text-xs sm:text-sm border-border">
                  Next-Gen Career & Hiring Ecosystem
                </Badge>
              </StaggerChild>

              <StaggerChild>
                <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl mx-auto leading-tight">
                  Find the job that fits your <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-500 to-zinc-900 dark:from-zinc-400 dark:to-zinc-100">life.</span>
                </h1>
              </StaggerChild>

              <StaggerChild>
                <p className="text-sm sm:text-base md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                  Discover verified career opportunities and connect directly with forward-thinking employers through transparent, real-time hiring workflows.
                </p>
              </StaggerChild>

              <StaggerChild>
                {/* Search Bar */}
                <HomeSearchBar />
              </StaggerChild>

              {popularPresets.length > 0 && (
                <StaggerChild>
                  <div className="mt-6 text-sm text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
                    <span>Popular searches:</span>
                    {popularPresets.map((preset) => {
                      const href =
                        preset.type === "work_setup"
                          ? `/find-jobs?work_setup=${encodeURIComponent(preset.label)}`
                          : preset.type === "job_type"
                          ? `/find-jobs?job_type=${encodeURIComponent(preset.label)}`
                          : `/find-jobs?q=${encodeURIComponent(preset.label)}`;

                      return (
                        <Link
                          key={`${preset.type}-${preset.label}`}
                          href={href}
                          className="hover:text-foreground underline underline-offset-4 transition-colors"
                        >
                          {preset.label}
                        </Link>
                      );
                    })}
                  </div>
                </StaggerChild>
              )}
            </StaggerContainer>
          </div>
        </section>


        {/* FEATURED + POPULAR — favourites lead on mobile, categories lead on md+ */}
        <div className="flex flex-col">
          {/* FEATURED JOBS */}
          <section className="py-16 md:py-24 md:order-2">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto mb-10 md:mb-16">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Featured Opportunities</h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-4">Hand-picked roles from top companies actively hiring right now.</p>
              </div>

              {jobs.length > 0 ? (
                <>
                  <StaggerContainer className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {jobs.map((job) => (
                      <StaggerChild key={job.id}>
                        <HoverScale className="h-full">
                          <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 p-6 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)] hover:border-primary/40 dark:hover:border-primary/40 transition-all duration-300 grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-4 sm:gap-x-6 items-start content-start h-full">
                            {/* Company Logo Placeholder */}
                            <div className="w-14 h-14 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl flex items-center justify-center text-xl font-bold shrink-0 overflow-hidden col-start-1 row-start-1 sm:row-end-5">
                              {typeof job.logo === "string" && (job.logo.startsWith("http") || job.logo.startsWith("/")) ? (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={job.logo} alt={job.company} className="w-full h-full object-cover" />
                              ) : (
                                job.logo
                              )}
                            </div>

                            <div className="col-start-2 row-start-1 flex justify-between items-start gap-2">
                              <h3 className="min-w-0 text-base sm:text-xl font-semibold text-foreground hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors">
                                <Link href={`/find-jobs?open_job=${job.id}`}>{job.title}</Link>
                              </h3>
                              <Badge variant="outline" className="bg-muted shrink-0 text-[10px] sm:text-xs">{job.type}</Badge>
                            </div>

                            <div className="col-start-1 col-end-3 row-start-2 sm:col-start-2 sm:col-end-3 min-w-0 mt-1 mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs sm:text-sm">
                              <span className="font-medium text-foreground">{job.company}</span>
                              <span>•</span>
                              <span className="flex items-center min-w-0 max-w-full"><MapPin className="w-3 h-3 mr-1 shrink-0" /><span className="truncate" title={job.location}>{job.location}</span></span>
                            </div>

                            <div className="col-start-1 col-end-3 row-start-3 sm:col-start-2 sm:col-end-3 min-w-0 mt-3 flex flex-wrap gap-2 mb-4 sm:mt-4 sm:mb-6">
                              {job.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="font-medium text-xs max-w-full whitespace-normal break-words sm:whitespace-nowrap">{tag}</Badge>
                              ))}
                            </div>

                            <div className="col-start-1 col-end-3 row-start-4 sm:col-start-2 sm:col-end-3 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-3 sm:flex-nowrap sm:justify-between mt-auto pt-3 sm:pt-4 border-t border-border">
                              <div className="text-sm sm:text-base font-semibold text-foreground">{job.salary}</div>
                              <span className="text-xs text-muted-foreground sm:ml-auto">{job.posted}</span>
                              <Button size="sm" variant="outline" className="text-xs sm:text-sm rounded-full shadow-sm cursor-pointer w-full sm:w-auto" asChild>
                                <Link href={`/find-jobs?open_job=${job.id}`}>View Details</Link>
                              </Button>
                            </div>
                          </div>
                        </HoverScale>
                      </StaggerChild>
                    ))}
                  </StaggerContainer>

                  <div className="mt-12 text-center">
                    <Button size="lg" className="rounded-full px-8 text-sm sm:text-base cursor-pointer" asChild>
                      <Link href="/find-jobs">Explore All Jobs</Link>
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 px-6 rounded-2xl border border-border/80 bg-white/70 dark:bg-card/60 backdrop-blur-xl max-w-xl mx-auto shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No featured roles at this moment</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    New opportunities are posted regularly by verified employers. Browse our full directory to explore all active openings.
                  </p>
                  <Button className="rounded-full px-6 cursor-pointer" asChild>
                    <Link href="/find-jobs">Browse All Jobs</Link>
                  </Button>
                </div>
              )}
            </div>
          </section>

          {/* POPULAR CATEGORIES */}
          <section className="py-12 md:py-24 md:order-1">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-end mb-6 md:mb-12">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Popular Categories</h2>
                  <p className="text-sm sm:text-base text-muted-foreground mt-2">Explore jobs across various domains and industries</p>
                </div>
                <Button variant="ghost" className="hidden md:flex group cursor-pointer" asChild>
                  <Link href="/find-jobs">
                    View all categories <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </Button>
              </div>

              <StaggerContainer className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
                {CATEGORIES.map((cat, idx) => (
                  <StaggerChild key={idx}>
                    <HoverScale className="h-full">
                      <Link href={`/find-jobs?q=${encodeURIComponent(cat.name)}`} className="block h-full">
                        <div className="group flex flex-col md:block border border-border/80 rounded-xl md:rounded-2xl p-4 md:p-6 hover:border-primary/40 dark:hover:border-primary/40 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_8px_30px_rgba(37,99,235,0.12)] transition-all duration-300 cursor-pointer bg-white/85 dark:bg-card/75 backdrop-blur-xl h-full">
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center mb-3 md:mb-4 ${cat.color} dark:bg-opacity-20`}>
                            {cat.icon}
                          </div>
                          <h3 className="text-sm sm:text-lg font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{cat.name}</h3>
                          <p className="text-muted-foreground mt-auto pt-1 md:mt-1 md:pt-0 flex items-center text-xs sm:text-sm">
                            {cat.count} <ChevronRight className="w-4 h-4 ml-1 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                          </p>
                        </div>
                      </Link>
                    </HoverScale>
                  </StaggerChild>
                ))}
              </StaggerContainer>
              <Button variant="outline" className="w-full mt-6 md:hidden cursor-pointer" asChild>
                <Link href="/find-jobs">View all categories</Link>
              </Button>
            </div>
          </section>
        </div>

        {/* HOW IT WORKS / VALUE PROP */}
        <section className="py-16 md:py-24 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center gap-10 md:gap-16">
              <SlideUp className="lg:w-1/2">
                <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground mb-6">
                  Your next career move, <br /><span className="text-muted-foreground">simplified.</span>
                </h2>
                <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-8">
                  We&apos;ve streamlined the job search process so you can focus on what matters most—preparing for your next big role.
                </p>

                <div className="space-y-6">
                  {[
                    { title: "Create your profile", desc: "Build a standout profile in minutes. Let your experience shine." },
                    { title: "Get personalized matches", desc: "Our algorithm suggests roles based on your skills and preferences." },
                    { title: "Apply with one click", desc: "Say goodbye to repetitive forms. Apply to multiple jobs instantly." }
                  ].map((step, idx) => (
                    <div key={idx} className="flex gap-4">
                      <div className="mt-1 bg-muted p-2 rounded-full h-fit">
                        <CheckCircle2 className="w-5 h-5 text-foreground" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-foreground">{step.title}</h4>
                        <p className="text-sm sm:text-base text-muted-foreground mt-1">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </SlideUp>

              <SlideUp className="lg:w-1/2 relative" delay={0.2}>
                {/* Decorative UI element representing a candidate's talent dashboard */}
                <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 rounded-3xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] relative z-10">
                  <div className="flex items-center justify-between mb-6 border-b border-border/60 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-sky-400 text-white font-bold text-sm flex items-center justify-center shadow-xs">
                        AR
                      </div>
                      <div>
                        <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                          Alex Rivera
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                        </div>
                        <div className="text-xs text-muted-foreground font-medium">Senior Full Stack Developer • Manila, PH</div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium text-xs">
                      100% Profile Complete
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {[
                      {
                        company: "FinTech Solutions",
                        role: "Senior React Engineer",
                        type: "Remote",
                        match: "98% Match",
                        status: "Interview Scheduled",
                        statusColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                        logoBg: "bg-indigo-600 text-white",
                        logoText: "FS",
                      },
                      {
                        company: "Creative Studio",
                        role: "Full Stack Developer",
                        type: "Hybrid",
                        match: "95% Match",
                        status: "Under Review",
                        statusColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                        logoBg: "bg-cyan-600 text-white",
                        logoText: "CS",
                      },
                      {
                        company: "CloudScale Systems",
                        role: "Next.js Solutions Architect",
                        type: "Remote",
                        match: "92% Match",
                        status: "Application Sent",
                        statusColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                        logoBg: "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900",
                        logoText: "CL",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border/70 bg-white/60 dark:bg-background/50 backdrop-blur-md hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-10 h-10 rounded-xl ${item.logoBg} flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}>
                            {item.logoText || item.company.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground truncate">{item.role}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                              <span>{item.company}</span>
                              <span>•</span>
                              <span>{item.type}</span>
                              <span>•</span>
                              <span className="font-semibold text-primary">{item.match}</span>
                            </div>
                          </div>
                        </div>
                        <Badge variant="outline" className={`shrink-0 ml-2 text-[11px] font-medium border ${item.statusColor}`}>
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Background decorative blobs */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-muted rounded-full blur-3xl -z-10 dark:opacity-20"></div>
              </SlideUp>
            </div>
          </div>
        </section>

        {/* DYNAMIC CTA SECTION */}
        <LandingCTA />
      </div>
    </div>
  );
}
