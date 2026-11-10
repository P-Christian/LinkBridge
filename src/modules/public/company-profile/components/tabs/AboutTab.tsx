import { useState, useEffect } from "react";
import {
  Globe,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Building,
  Users,
  Facebook,
  Linkedin,
  Instagram,
  Youtube,
  Briefcase,
  DollarSign,
  Star,
  MessageSquare,
  ArrowRight,
 
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { PublicCompanyProfile, CompanyJob, CompanyReview } from "../../types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { safeUrl } from "@/lib/safe-url";

interface AboutTabProps {
  company: PublicCompanyProfile;
  onTabChange?: (tabId: string) => void;
}

export function AboutTab({ company, onTabChange }: AboutTabProps) {
  const {
    company_description,
    company_mission,
    company_vision,
    company_culture,
    industry_name,
    company_size_name,
    year_established,
    company_website,
    company_email,
    company_contact,
    company_address,
    company_benefits,
    company_tags,
    company_facebook,
    company_linkedin,
    company_instagram,
    company_x,
    company_youtube,
    activeJobsCount,
    company_code,
  } = company;

  const websiteHref = safeUrl(company_website);

  // Social Links List builder
  const socialLinks = [
    { url: company_facebook, icon: <Facebook className="w-5 h-5" />, label: "Facebook" },
    { url: company_linkedin, icon: <Linkedin className="w-5 h-5" />, label: "LinkedIn" },
    { url: company_instagram, icon: <Instagram className="w-5 h-5" />, label: "Instagram" },
    { url: company_youtube, icon: <Youtube className="w-5 h-5" />, label: "YouTube" },
    {
      url: company_x,
      icon: (
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      label: "X",
    },
  ].flatMap((link) => {
    // Scheme allowlist: a stored javascript:/data: value must not become an href.
    const href = safeUrl(link.url);
    return href ? [{ ...link, href }] : [];
  });

  // Parse tags (CSV or spaces)
  const tagsList = company_tags
    ? company_tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // Jobs state for preview
  const [jobs, setJobs] = useState<CompanyJob[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);

  useEffect(() => {
    const fetchPreviewJobs = async () => {
      setIsLoadingJobs(true);
      try {
        const res = await fetch(`/api/public/companies/${company_code}/jobs?limit=3`);
        if (res.ok) {
          const json = await res.json();
          setJobs(json.jobs || []);
        }
      } catch (err) {
        console.error("Error fetching preview jobs:", err);
      } finally {
        setIsLoadingJobs(false);
      }
    };
    fetchPreviewJobs();
  }, [company_code]);

  const [reviews, setReviews] = useState<CompanyReview[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/public/companies/${company_code}/reviews?limit=2`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active) {
          setReviews(data || []);
          setIsLoadingReviews(false);
        }
      })
      .catch((err) => {
        console.error("Error fetching preview reviews:", err);
        if (active) setIsLoadingReviews(false);
      });
    return () => {
      active = false;
    };
  }, [company_code]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-sans">
      {/* Narrative Section (Left 2/3) */}
      <div className="lg:col-span-2 space-y-8 max-md:contents max-md:space-y-0">
        
        {/* 1. About / Description */}
        {company_description && (
          <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 max-md:order-1">
            <h2 className="text-xl font-bold text-foreground mb-4">About the Company</h2>
            <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
              {company_description}
            </p>
          </div>
        )}

        {/* Mission & Vision */}
        {(company_mission || company_vision) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-md:order-2 max-md:hidden">
            {company_mission && (
              <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-3">Our Mission</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {company_mission}
                  </p>
                </div>
              </div>
            )}

            {company_vision && (
              <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-foreground mb-3">Our Vision</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {company_vision}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Life & Culture Summary */}
        <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 max-md:order-3 max-md:hidden">
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            Life & Culture
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6 whitespace-pre-line">
            {company_culture ||
              "We believe that our team's success starts with a healthy, collaborative, and inclusive environment. We cultivate a workplace of collaboration, inclusivity, and continuous learning, offering flexibility to support career growth alongside personal well-being."}
          </p>

          {/* Benefits List */}
          {company_benefits && (
            <div className="pt-4 border-t border-border/80">
              <h3 className="text-sm font-semibold text-foreground mb-3">Benefits & Perks</h3>
              <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">
                {company_benefits}
              </p>
            </div>
          )}
        </div>

        {/* 3. Featured Open Jobs Preview */}
        <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 max-md:order-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-500" />
              Open Opportunities
            </h2>
            {activeJobsCount > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
                {activeJobsCount} Active {activeJobsCount === 1 ? "Job" : "Jobs"}
              </span>
            )}
          </div>

          {isLoadingJobs ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Loading preview jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No active jobs posted at this time. Check back later!
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 rounded-xl border border-border/70 hover:border-primary/40 transition-all bg-card/60 hover:bg-card/90 hover:shadow-sm flex flex-col justify-between gap-3 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors cursor-pointer">
                        {job.title}
                      </h4>
                      {job.department && (
                        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider block mt-0.5">
                          {job.department}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                      <Badge variant="outline" className="rounded-lg text-[10px] px-2 py-0">
                        {job.type.replace("_", " ")}
                      </Badge>
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none rounded-lg text-[10px] px-2 py-0 dark:bg-blue-950/40 dark:text-blue-400">
                        {job.work_arrangement}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {job.location}
                      </span>
                      <span className="flex items-center gap-1 text-foreground font-medium">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                        {job.salary}
                      </span>
                    </div>
                    <span className="text-[10px]">{job.posted}</span>
                  </div>
                </div>
              ))}

              {onTabChange && activeJobsCount > 0 && (
                <div className="pt-2 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onTabChange("jobs")}
                    className="rounded-full border-primary/20 bg-background/80 hover:bg-primary hover:text-white dark:hover:text-white text-xs font-semibold px-4 py-2 transition-all duration-200 hover:scale-[1.03] shadow-sm flex items-center gap-1.5 mx-auto cursor-pointer h-10 md:h-9 group"
                  >
                    View all {activeJobsCount} open positions
                    <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Recent Employee Reviews Preview */}
        <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 max-md:order-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-amber-500" />
              Recent Reviews
            </h2>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Verified Ratings
            </span>
          </div>

          <div className="space-y-4">
            {isLoadingReviews ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No employee reviews posted yet.
              </p>
            ) : (
              reviews.map((rev) => {
                const reviewerRole = rev.is_anonymous ? "Anonymous Employee" : (rev.job_title || "Employee");
                const statusLabel = rev.employment_status === "CURRENT_EMPLOYEE" ? "Current Employee" : "Former Employee";
                return (
                  <div key={rev.review_id} className="p-4 rounded-xl border border-border/70 bg-card/60 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold px-2 py-0.5 rounded-lg text-xs">
                        <Star className="w-3 h-3 fill-current" />
                        {Number(rev.overall_rating || 0).toFixed(1)}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(rev.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div>
                      {rev.review_title && (
                        <h4 className="font-bold text-foreground text-sm">&ldquo;{rev.review_title}&rdquo;</h4>
                      )}
                      <span className="text-xs text-muted-foreground block mt-0.5">
                        {reviewerRole} &bull; {statusLabel}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs leading-relaxed border-t border-border/40 pt-3">
                      {rev.pros && (
                        <div className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-foreground">Pros:</span>{" "}
                            <span className="text-muted-foreground">{rev.pros}</span>
                          </div>
                        </div>
                      )}
                      {rev.cons && (
                        <div className="flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-foreground">Cons:</span>{" "}
                            <span className="text-muted-foreground">{rev.cons}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {onTabChange && (
              <div className="pt-2 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTabChange("reviews")}
                  className="rounded-full border-primary/20 bg-background/80 hover:bg-primary hover:text-white dark:hover:text-white text-xs font-semibold px-4 py-2 transition-all duration-200 hover:scale-[1.03] shadow-sm flex items-center gap-1.5 mx-auto cursor-pointer h-10 md:h-9 group"
                >
                  Read all employee insights & reviews
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
                </Button>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Corporate Metadata & Directory (Right 1/3) */}
      <div className="space-y-6 max-md:contents max-md:space-y-0">
        <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 max-md:order-4">
          <h2 className="text-lg font-bold text-foreground mb-6">Company Information</h2>

          <div className="space-y-5">
            {/* Industry */}
            <div className="flex items-start gap-3">
              <Building className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Industry
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {industry_name || "General Business"}
                </span>
              </div>
            </div>

            {/* Size */}
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Company Size
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {company_size_name || "Unknown size"}
                </span>
              </div>
            </div>

            {/* Established */}
            {year_established && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Founded Year
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {year_established}
                  </span>
                </div>
              </div>
            )}

            {/* Headquarters address */}
            {company_address && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                    Headquarters
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {company_address}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contacts & Social links */}
        <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 max-md:order-7">
          <h2 className="text-lg font-bold text-foreground mb-4">Contact & Media</h2>

          <div className="space-y-4 mb-6">
            {company_website && (
              <a
                href={websiteHref ?? undefined}
                target={websiteHref ? "_blank" : undefined}
                rel={websiteHref ? "noopener noreferrer" : undefined}
                className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <Globe className="w-4 h-4 shrink-0" />
                <span className="truncate">{company_website.replace(/^https?:\/\//i, "")}</span>
              </a>
            )}

            {company_email && (
              <a
                href={`mailto:${company_email}`}
                className="flex items-center gap-3 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate">{company_email}</span>
              </a>
            )}

            {company_contact && (
              <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                <Phone className="w-4 h-4 shrink-0" />
                <span>{company_contact}</span>
              </div>
            )}
          </div>

          {/* Social icons row */}
          {socialLinks.length > 0 && (
            <div className="pt-4 border-t border-border/80 flex items-center gap-3">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 md:w-9 md:h-9 rounded-xl bg-muted/60 text-muted-foreground hover:text-primary hover:bg-muted transition-all flex items-center justify-center border border-border/80"
                  title={link.label}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        {tagsList.length > 0 && (
          <div className="bg-white/85 dark:bg-card/75 backdrop-blur-xl border border-border/80 shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] rounded-2xl p-6 max-md:order-8">
            <h2 className="text-lg font-bold text-foreground mb-4">Keywords</h2>
            <div className="flex flex-wrap gap-2">
              {tagsList.map((tag) => (
                <Badge key={tag} variant="secondary" className="px-2.5 py-1 rounded-xl text-xs font-medium">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
