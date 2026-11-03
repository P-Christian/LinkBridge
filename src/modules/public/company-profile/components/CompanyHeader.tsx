"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Globe, MapPin, Share2, CheckCircle2, Check, Maximize2, Building2 } from "lucide-react";
import { PublicCompanyProfile } from "../types";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/hooks/useAuthSession";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/utils";
import { safeUrl } from "@/lib/safe-url";

interface HeaderProps {
  company: PublicCompanyProfile;
  onTabChange?: (tab: string) => void;
}

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CompanyHeader({ company, onTabChange }: HeaderProps) {
  const {
    company_name,
    industry_name,
    company_size_name,
    company_logo,
    company_cover,
    company_website,
    company_address,
    verification_status,
    activeJobsCount,
  } = company;

  const [copied, setCopied] = useState(false);
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [coverError, setCoverError] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    title: string;
    type: "cover" | "logo";
  } | null>(null);

  const verified = verification_status === "VERIFIED";
  const websiteHref = safeUrl(company_website);

  const session = useAuthSession();
  const isOwnCompany = Boolean(
    session.isEmployer &&
    session.companyId &&
    company.company_id &&
    Number(session.companyId) === Number(company.company_id)
  );

  const handleShare = async () => {
    const url = window.location.href;
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      toast.success("Company profile link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Failed to copy link to clipboard.");
    }
  };

  return (
    <div className="w-full bg-card/85 dark:bg-card/75 backdrop-blur-xl border-b border-border/80 font-sans">
      {/* Cover Image Banner */}
      <div
        className={`relative h-72 sm:h-80 md:h-[380px] w-full bg-muted/60 overflow-hidden ${company_cover && !coverError ? "cursor-pointer group" : ""
          }`}
        onClick={() =>
          company_cover &&
          !coverError &&
          setPreviewImage({
            src: company_cover,
            title: `${company_name} Cover Photo`,
            type: "cover",
          })
        }
      >
        {/* Top Vignette Scrim for Navigation Bar Contrast */}
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background/80 via-background/30 to-transparent pointer-events-none z-10" />

        {company_cover && !coverError ? (
          <>
            <Image
              src={company_cover}
              alt={`${company_name} cover`}
              fill
              decoding="async"
              className={`object-cover transition-all duration-500 group-hover:scale-[1.015] ${coverLoaded ? "opacity-100" : "opacity-0"}`}
              priority
              unoptimized
              onLoad={() => setCoverLoaded(true)}
              onError={() => setCoverError(true)}
            />
            <div className="absolute inset-0 z-20 bg-background/0 group-hover:bg-background/20 transition-colors duration-300 flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-background/80 text-foreground text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-xs border border-border shadow-md">
                <Maximize2 className="w-3.5 h-3.5" /> Click to view cover photo
              </span>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-sky-500/10 to-primary/5" />
        )}
      </div>

      {/* Main Stats Overlay Header Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 relative z-10 -mt-16 md:-mt-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          {/* Logo overlay & details */}
          <div className="flex flex-col md:flex-row items-start md:items-end gap-5">
            {/* Logo box */}
            <div
              className={`w-24 h-24 md:w-36 md:h-36 rounded-3xl bg-card border-4 border-card shadow-lg flex items-center justify-center text-4xl font-bold overflow-hidden shrink-0 relative select-none ${company_logo && !logoError ? "cursor-pointer group" : ""
                }`}
              onClick={() =>
                company_logo &&
                !logoError &&
                setPreviewImage({
                  src: company_logo,
                  title: `${company_name} Logo`,
                  type: "logo",
                })
              }
            >
              {company_logo && !logoError ? (
                <>
                  {!logoLoaded && (
                    <span className="absolute inset-0 flex items-center justify-center text-muted-foreground text-2xl md:text-3xl font-bold">
                      {getInitials(company_name)}
                    </span>
                  )}
                  <Image
                    src={company_logo}
                    alt={company_name}
                    width={144}
                    height={144}
                    decoding="async"
                    className={`object-cover w-full h-full transition-all duration-300 group-hover:scale-105 ${logoLoaded ? "opacity-100" : "opacity-0"}`}
                    priority
                    unoptimized
                    onLoad={() => setLogoLoaded(true)}
                    onError={() => setLogoError(true)}
                  />
                  <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-colors duration-300 flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-background/80 text-foreground p-2 rounded-full backdrop-blur-xs border border-border shadow-md">
                      <Maximize2 className="w-4 h-4" />
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-muted-foreground text-2xl md:text-3xl font-bold">
                  {getInitials(company_name)}
                </span>
              )}
            </div>

            {/* Title & Stats description */}
            <div className="md:mb-2">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-2xl md:text-4xl font-extrabold text-foreground tracking-tight">
                  {company_name}
                </h1>
                {verified && (
                  <span title="Verified Employer">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-y-1 text-sm md:text-base text-muted-foreground font-medium">
                {/* Row 1: Industry and Size */}
                <div className="flex flex-wrap items-center gap-x-3">
                  <span>{industry_name || "General Business"}</span>
                  <span>•</span>
                  <span>{company_size_name || "Unknown Size"}</span>
                </div>

                {/* Row 2: Address */}
                {company_address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    {company_address.split(",")[0]}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 md:mb-2 w-full md:w-auto shrink-0">
            {/* Share action */}
            <Button
              variant="outline"
              size="default"
              onClick={handleShare}
              className="rounded-xl flex items-center gap-2 font-semibold cursor-pointer shrink-0 h-11 md:h-9"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              {copied ? "Copied" : "Share"}
            </Button>

            {/* Visit Website action */}
            {websiteHref && (
              <Button
                variant="outline"
                size="default"
                className="rounded-xl font-semibold cursor-pointer shrink-0 h-11 md:h-9"
                asChild
              >
                <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Website
                </a>
              </Button>
            )}

            {/* View Open Jobs primary action */}
            {activeJobsCount > 0 ? (
              <Button
                size="default"
                className="rounded-xl font-semibold shadow-sm cursor-pointer h-11 md:h-9 w-full md:w-auto"
                onClick={() => onTabChange?.("jobs")}
              >
                View {activeJobsCount} Open Jobs
              </Button>
            ) : (
              <Button
                size="default"
                variant="outline"
                className="rounded-xl font-semibold opacity-60 cursor-not-allowed h-11 md:h-9 w-full md:w-auto"
                disabled
              >
                No Open Positions
              </Button>
            )}

            {/* Owner action: Go to Client Portal */}
            {isOwnCompany && (
              <Button
                size="default"
                className="rounded-xl font-semibold shadow-sm cursor-pointer h-11 md:h-9 w-full md:w-auto"
                asChild
              >
                <Link href="/vos-sync/client/jobs" className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Go to Client Portal
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>


      {/* Full View Lightbox Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent
          className={`p-4 sm:p-6 bg-background border-border shadow-2xl transition-all duration-200 w-full ${previewImage?.type === "cover"
              ? "max-w-[95vw] sm:max-w-5xl"
              : "max-w-md sm:max-w-lg"
            }`}
        >
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
              {previewImage?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full size view of {previewImage?.title}
            </DialogDescription>
          </DialogHeader>

          {previewImage && (
            <div className="relative flex items-center justify-center rounded-xl overflow-hidden bg-muted/40 border border-border/50">
              <Image
                src={previewImage.src}
                alt={previewImage.title}
                width={0}
                height={0}
                sizes="100vw"
                className="w-full h-auto max-h-[70vh] object-contain"
                unoptimized
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>

  );
}


