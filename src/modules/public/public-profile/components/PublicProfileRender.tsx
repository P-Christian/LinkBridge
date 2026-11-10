import React from "react";
import { User, Globe, Briefcase, Mail, GraduationCap, Award, MapPin, Calendar, ExternalLink, Link2 } from "lucide-react";
import { PublicFreelancerProfile } from "../services/public-profile.service";
import { safeUrl } from "@/lib/safe-url";

interface Props {
  profile: PublicFreelancerProfile;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatSalary(amount?: number | string | null) {
  if (amount == null || amount === "") return "";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return String(amount);
  return num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PublicProfileRender({ profile }: Props) {
  const portfolioHref = safeUrl(profile.portfolio_url);
  return (
    <div className="mx-auto w-full max-w-[85%] 2xl:max-w-7xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-sm">
        <div className="h-32 w-full bg-gradient-to-r from-primary/40 via-primary/20 to-primary/5"></div>
        <div className="px-8 pb-8 pt-0 flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-12 relative z-10">
          <div className="h-24 w-24 rounded-full border-4 border-background bg-muted flex items-center justify-center shrink-0 overflow-hidden shadow-md">
            {profile.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">
              {profile.user_fname} {profile.user_lname}
            </h1>
            <p className="text-lg text-muted-foreground font-medium">
              {profile.headline || "Freelancer"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Column (About, Experience, Education, Certifications) */}
        <div className="md:col-span-2 space-y-8">
          {/* About Me */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 border-b pb-2">
              <User className="h-5 w-5 text-primary" /> About Me
            </h2>
            {profile.bio ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {profile.bio}
              </div>
            ) : (
              <p className="text-muted-foreground italic text-sm">No bio provided.</p>
            )}
          </section>

          {/* Skills & Expertise */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 border-b pb-2">
              <Briefcase className="h-5 w-5 text-primary" /> Skills & Expertise
            </h2>
            {profile.skills && profile.skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.skills.map((skill, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-primary/5 text-primary transition-colors"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic text-sm">No skills listed.</p>
            )}
          </section>

          {/* Work Experience */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 border-b pb-2">
              <Briefcase className="h-5 w-5 text-primary" /> Work Experience
            </h2>
            {profile.work_experience && profile.work_experience.length > 0 ? (
              <div className="space-y-6">
                {profile.work_experience.map((exp, i) => (
                  <div key={i} className="border-l-2 border-primary/20 pl-4 space-y-2 relative">
                    <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1.5" />
                    <div>
                      <h3 className="font-semibold text-base">{exp.job_title}</h3>
                      <p className="text-sm text-muted-foreground font-medium">
                        {exp.company_name} {exp.employment_type && `• ${exp.employment_type}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(exp.start_date)} - {exp.is_current_role ? "Present" : formatDate(exp.end_date)}
                      </span>
                      {exp.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {exp.location} {exp.location_type && `(${exp.location_type})`}
                        </span>
                      )}
                    </div>
                    {exp.job_description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed pt-1">
                        {exp.job_description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic text-sm">No work experience listed.</p>
            )}
          </section>

          {/* Education */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 border-b pb-2">
              <GraduationCap className="h-5.5 w-5.5 text-primary" /> Educational Background
            </h2>
            {profile.education && profile.education.length > 0 ? (
              <div className="space-y-6">
                {profile.education.map((edu, i) => (
                  <div key={i} className="border-l-2 border-primary/20 pl-4 space-y-1.5 relative">
                    <div className="absolute w-3 h-3 bg-primary rounded-full -left-[7px] top-1.5" />
                    <h3 className="font-semibold text-base">
                      {edu.course_name || edu.course_name_raw || "General Studies"}
                    </h3>
                    <p className="text-sm text-muted-foreground font-medium">
                      {edu.school_name || edu.school_name_raw || "Institution Not Specified"}
                    </p>
                    {(edu.start_date || edu.end_date) && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(edu.start_date) || "N/A"} - {formatDate(edu.end_date) || "N/A"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground italic text-sm">No education listed.</p>
            )}
          </section>

          {/* Certifications */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 border-b pb-2">
              <Award className="h-5.5 w-5.5 text-primary" /> Certifications
            </h2>
            {profile.certifications && profile.certifications.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {profile.certifications.map((cert, i) => {
                  const credentialHref = safeUrl(cert.credential_url);
                  return (
                  <div key={i} className="p-4 rounded-xl border bg-card/50 space-y-2">
                    <div>
                      <h3 className="font-semibold text-sm leading-snug">{cert.certificate_name}</h3>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">{cert.issuing_organization}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {cert.issue_date && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Issued {formatDate(cert.issue_date)}
                        </span>
                      )}
                      {credentialHref ? (
                        <a
                          href={credentialHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium ml-auto"
                        >
                          Credential <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        cert.credential_url && (
                          <span className="text-[11px] text-muted-foreground break-all ml-auto">
                            {cert.credential_url}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground italic text-sm">No certifications listed.</p>
            )}
          </section>
        </div>

        {/* Right Column (Contact, Job Preferences, Social Links) */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
            <h3 className="font-semibold text-lg border-b pb-2">Details</h3>
            
            <div className="space-y-4 text-sm">
              {profile.user_email && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Mail className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{profile.user_email}</span>
                </div>
              )}
              
              {profile.portfolio_url && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Globe className="h-4 w-4 shrink-0 text-primary" />
                  {portfolioHref ? (
                    <a 
                      href={portfolioHref} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="truncate hover:text-primary hover:underline transition-colors flex items-center gap-1"
                    >
                      Portfolio <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <span className="truncate">Portfolio</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Job Preferences Card */}
          {profile.job_preferences && (
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
              <h3 className="font-semibold text-lg border-b pb-2">Job Preferences</h3>
              
              <div className="space-y-4 text-sm">
                {profile.job_preferences.job_type && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Job Type</span>
                    <span className="font-medium text-foreground">{profile.job_preferences.job_type}</span>
                  </div>
                )}
                
                {profile.job_preferences.work_setup && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Work Setup</span>
                    <span className="font-medium text-foreground">{profile.job_preferences.work_setup}</span>
                  </div>
                )}
                
                {profile.job_preferences.preferred_location && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Preferred Location</span>
                    <span className="font-medium text-foreground">{profile.job_preferences.preferred_location}</span>
                  </div>
                )}

                {(profile.job_preferences.salary_range_min != null || profile.job_preferences.salary_range_max != null) && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Expected Salary Range</span>
                    <span className="font-medium text-foreground">
                      {profile.job_preferences.currency || "PHP"}{" "}
                      {formatSalary(profile.job_preferences.salary_range_min)} -{" "}
                      {formatSalary(profile.job_preferences.salary_range_max)}
                    </span>
                  </div>
                )}

                {profile.job_preferences.availability && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Availability</span>
                    <span className="font-medium text-foreground">{profile.job_preferences.availability}</span>
                  </div>
                )}

                {profile.job_preferences.preferred_industry && (
                  <div>
                    <span className="text-xs text-muted-foreground block">Preferred Industry</span>
                    <span className="font-medium text-foreground">{profile.job_preferences.preferred_industry}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Social Links Card */}
          {profile.social_links && profile.social_links.length > 0 && (
            <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 space-y-6">
              <h3 className="font-semibold text-lg border-b pb-2">Social Profiles</h3>
              
              <div className="space-y-3">
                {profile.social_links.map((link, i) => {
                  const profileHref = safeUrl(link.profile_url);
                  return (
                  <a
                    key={i}
                    href={profileHref ?? undefined}
                    target={profileHref ? "_blank" : undefined}
                    rel={profileHref ? "noopener noreferrer" : undefined}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Link2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">{link.platform_name}</span>
                    {profileHref && <ExternalLink className="h-3 w-3 ml-auto opacity-50" />}
                  </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
