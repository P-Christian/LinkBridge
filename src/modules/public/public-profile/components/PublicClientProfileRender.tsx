/* eslint-disable @next/next/no-img-element */
import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  Facebook,
  Linkedin,
  Instagram,
  Youtube,
  Users,
  Briefcase,
  CalendarDays,
  Target,
  Compass,
  HeartHandshake,
  Gift,
  ExternalLink,
} from "lucide-react";
import { PublicClientProfile } from "../services/public-profile.service";
import { safeUrl } from "@/lib/safe-url";

interface Props {
  profile: PublicClientProfile;
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
  href?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0 h-7 w-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs md:text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-0.5">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 truncate"
          >
            <span className="truncate">{value}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 break-words">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}

export function PublicClientProfileRender({ profile }: Props) {
  const comp = profile.company;
  const displayName = comp?.company_name || `${profile.user_fname} ${profile.user_lname}`;
  const legalName = comp?.company_legal_name;
  const coverUrl = comp?.company_cover;
  const logoUrl = comp?.company_logo || profile.avatar_url;

  // Employer-supplied URLs only become hrefs when their scheme is allowlisted.
  const facebookHref = safeUrl(comp?.social_links?.facebook);
  const linkedinHref = safeUrl(comp?.social_links?.linkedin);
  const instagramHref = safeUrl(comp?.social_links?.instagram);
  const youtubeHref = safeUrl(comp?.social_links?.youtube);
  const xHref = safeUrl(comp?.social_links?.x);

  const hasSocials = Boolean(facebookHref || linkedinHref || instagramHref || youtubeHref || xHref);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Cover + Logo Header Card */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        {/* Cover */}
        <div className="relative h-44 sm:h-52 w-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 overflow-hidden">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="Company Cover"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xs text-zinc-400">No cover photo</span>
            </div>
          )}
          <div className="absolute top-4 right-4 z-20">
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-0 text-xs font-semibold">
              Public Profile
            </Badge>
          </div>
        </div>

        {/* Header Content */}
        <div className="px-6 pb-6 pt-0 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 mb-4">
            <div className="h-20 w-20 rounded-2xl border-4 border-white dark:border-zinc-900 bg-white dark:bg-zinc-900 shadow-md overflow-hidden flex items-center justify-center shrink-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Building2 className="h-9 w-9 text-zinc-400" />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 leading-tight">
              {displayName}
            </h1>
            {legalName && legalName !== displayName && (
              <p className="text-sm text-zinc-500">
                {legalName}
              </p>
            )}
            {comp?.industry && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider pt-0.5">
                {comp.industry}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column (Overview, Mission/Vision, Culture, Benefits) */}
        <div className="md:col-span-2 space-y-6">
          {/* About */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              About
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {comp?.company_description ||
                "This client has not added a detailed description yet."}
            </p>
          </div>

          {/* Mission & Vision */}
          {(comp?.company_mission || comp?.company_vision) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {comp?.company_mission && (
                <div className="space-y-1.5 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-blue-600" />
                    Mission
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {comp.company_mission}
                  </p>
                </div>
              )}
              {comp?.company_vision && (
                <div className="space-y-1.5 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Compass className="h-3.5 w-3.5 text-purple-600" />
                    Vision
                  </p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {comp.company_vision}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Culture & Work Environment */}
          {comp?.company_culture && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <HeartHandshake className="h-4 w-4 text-rose-500" />
                Culture & Values
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {comp.company_culture}
              </p>
            </div>
          )}

          {/* Perks & Benefits */}
          {comp?.company_benefits && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Gift className="h-4 w-4 text-amber-500" />
                Perks & Benefits
              </h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {comp.company_benefits}
              </p>
            </div>
          )}
        </div>

        {/* Right Column (Company Details, Contact, Socials) */}
        <div className="space-y-6">
          {/* Company Details */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Company Details
            </h3>
            <div className="space-y-3">
              {comp?.industry && (
                <InfoRow icon={Briefcase} label="Industry" value={comp.industry} />
              )}
              {comp?.organization_type && (
                <InfoRow
                  icon={Building2}
                  label="Organization Type"
                  value={comp.organization_type}
                />
              )}
              {comp?.company_size && (
                <InfoRow icon={Users} label="Company Size" value={comp.company_size} />
              )}
              {comp?.year_established && (
                <InfoRow
                  icon={CalendarDays}
                  label="Year Established"
                  value={String(comp.year_established)}
                />
              )}
              {comp?.company_address && (
                <InfoRow icon={MapPin} label="Address" value={comp.company_address} />
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              Contact Information
            </h3>
            <div className="space-y-3">
              <InfoRow
                icon={Mail}
                label="Email"
                value={comp?.company_email || profile.user_email}
                href={`mailto:${comp?.company_email || profile.user_email}`}
              />
              {comp?.company_contact && (
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={comp.company_contact}
                  href={`tel:${comp.company_contact}`}
                />
              )}
              {comp?.company_website && (
                <InfoRow
                  icon={Globe}
                  label="Website"
                  value={comp.company_website.replace(/^https?:\/\/(www\.)?/, "")}
                  href={safeUrl(comp.company_website)}
                />
              )}
            </div>
          </div>

          {/* Social Links */}
          {hasSocials && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                Social Media
              </h3>
              <div className="flex flex-wrap gap-2">
                {facebookHref && (
                  <a
                    href={facebookHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 transition-colors"
                  >
                    <Facebook className="h-3.5 w-3.5 text-blue-600" />
                    Facebook
                  </a>
                )}
                {linkedinHref && (
                  <a
                    href={linkedinHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:border-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Linkedin className="h-3.5 w-3.5 text-blue-700" />
                    LinkedIn
                  </a>
                )}
                {instagramHref && (
                  <a
                    href={instagramHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:border-pink-500 hover:text-pink-600 transition-colors"
                  >
                    <Instagram className="h-3.5 w-3.5 text-pink-600" />
                    Instagram
                  </a>
                )}
                {youtubeHref && (
                  <a
                    href={youtubeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:border-red-500 hover:text-red-600 transition-colors"
                  >
                    <Youtube className="h-3.5 w-3.5 text-red-600" />
                    YouTube
                  </a>
                )}
                {xHref && (
                  <a
                    href={xHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  >
                    <span className="h-3.5 w-3.5 flex items-center justify-center font-bold text-zinc-900 dark:text-zinc-100 text-xs select-none">
                      𝕏
                    </span>
                    X (Twitter)
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
