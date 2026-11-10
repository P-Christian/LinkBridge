import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pause, Play, ShieldCheck } from "lucide-react";
import { TrustedCompany } from "../types";

interface MarqueeProps {
  companies: TrustedCompany[];
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

function CompanyLogoWithFallback({
  logoUrl,
  companyName,
}: {
  logoUrl?: string | null;
  companyName: string;
}) {
  const [imgError, setImgError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!logoUrl || imgError) {
    return (
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-muted text-primary flex items-center justify-center font-bold text-sm border border-primary/20 shrink-0 select-none group-hover:scale-105 group-hover:border-primary/40 transition-all duration-300">
        {getInitials(companyName)}
      </div>
    );
  }

  return (
    <div className="relative w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center overflow-hidden border border-border shrink-0 group-hover:scale-105 group-hover:border-primary/40 transition-all duration-300">
      {!isLoaded && (
        <span className="absolute inset-0 flex items-center justify-center font-bold text-xs text-muted-foreground select-none">
          {getInitials(companyName)}
        </span>
      )}
      <Image
        src={logoUrl}
        alt={companyName}
        width={48}
        height={48}
        decoding="async"
        unoptimized
        onLoad={() => setIsLoaded(true)}
        onError={() => setImgError(true)}
        className={`object-cover w-full h-full transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}

export function TrustedEmployersMarquee({ companies }: MarqueeProps) {
  // Auto-scroll control (WCAG 2.2 SC 2.2.2 Pause, Stop, Hide):
  // the strip pauses while the user holds it, and the pause/play button lets the motion be left stopped.
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPaused = isManuallyPaused || isInteracting;

  const holdStart = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = null;
    setIsInteracting(true);
  };

  const holdEnd = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setIsInteracting(false), 1000);
  };

  if (!companies || companies.length === 0) {
    return (
      <div className="w-full py-8 text-center border border-dashed rounded-xl bg-muted/20">
        <p className="text-sm text-muted-foreground">Join hundreds of growing companies hiring on LinkBridge.</p>
      </div>
    );
  }

  // Ensure marquee has enough cards to scroll seamlessly without overloading the DOM with 40+ simultaneous decodes
  const baseCompanies = companies.slice(0, 10);
  const repeatCount = Math.max(2, Math.ceil(12 / Math.max(baseCompanies.length, 1)));
  const repeatedCompanies = Array(repeatCount).fill(baseCompanies).flat().slice(0, 14);
  const row1 = repeatedCompanies;
  const row2 = [...repeatedCompanies].reverse();

  return (
    <div className="w-full overflow-hidden py-6 bg-muted/10 border-y border-border">
      <div className="max-w-7xl mx-auto px-4 text-center mb-6">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          Companies Hiring Through LinkBridge
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl mx-auto">
          From startups to enterprise organizations, employers use LinkBridge to connect with qualified professionals.
        </p>
        <button
          type="button"
          onClick={() => setIsManuallyPaused((v) => !v)}
          aria-label={isManuallyPaused ? "Resume the employer marquee" : "Pause the employer marquee"}
          aria-pressed={isManuallyPaused}
          className="mt-3 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-border bg-background/80 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer"
        >
          {isManuallyPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
          {isManuallyPaused ? "Play" : "Pause"}
        </button>
      </div>

      {/* Marquee viewport container */}
      <div
        className="relative w-screen left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] flex flex-col gap-1 py-1 overflow-x-clip"
        onPointerDown={holdStart}
        onPointerUp={holdEnd}
        onPointerCancel={holdEnd}
        onPointerLeave={holdEnd}
      >
        {/* Left & Right gradient edge fades */}
        <div className="absolute inset-y-0 left-0 w-16 md:w-32 bg-gradient-to-r from-background to-transparent z-20 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 md:w-32 bg-gradient-to-l from-background to-transparent z-20 pointer-events-none" />

        {/* Row 1: Scrolling LTR */}
        <div className="company-marquee-row flex w-max max-sm:w-full max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:overscroll-x-contain py-0.5 overflow-visible">
          <div className="company-marquee-track flex gap-4 py-1 px-2 animate-marquee-ltr focus-within:[animation-play-state:paused] hover:[animation-play-state:paused]" style={isPaused ? { animationPlayState: "paused" } : undefined}>
            {row1.map((company, index) => (
              <Link
                key={`row1-${company.companyId}-${index}`}
                href={`/companies/${company.companyCode}`}
                className="company-marquee-item relative z-0 hover:z-30 flex items-center gap-3.5 bg-card border border-border/80 rounded-2xl py-3 px-5 shadow-xs hover:shadow-xl hover:border-primary/50 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 w-64 max-sm:snap-start select-none shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <CompanyLogoWithFallback logoUrl={company.companyLogo} companyName={company.companyName} />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {company.companyName}
                    </span>
                    {company.verified && (
                      <span title="Verified Employer" className="inline-flex shrink-0">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {company.industryName || "General Business"}
                  </span>
                  {/* <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
                    {company.activeJobs} active {company.activeJobs === 1 ? "job" : "jobs"}
                  </span> */}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Row 2: Scrolling RTL */}
        <div className="company-marquee-row flex w-max max-sm:w-full max-sm:overflow-x-auto max-sm:snap-x max-sm:snap-mandatory max-sm:overscroll-x-contain py-0.5 overflow-visible">
          <div className="company-marquee-track flex gap-4 py-1 px-2 animate-marquee-rtl focus-within:[animation-play-state:paused] hover:[animation-play-state:paused]" style={isPaused ? { animationPlayState: "paused" } : undefined}>
            {row2.map((company, index) => (
              <Link
                key={`row2-${company.companyId}-${index}`}
                href={`/companies/${company.companyCode}`}
                className="company-marquee-item relative z-0 hover:z-30 flex items-center gap-3.5 bg-card border border-border/80 rounded-2xl py-3 px-5 shadow-xs hover:shadow-xl hover:border-primary/50 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 w-64 max-sm:snap-start select-none shrink-0 group focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <CompanyLogoWithFallback logoUrl={company.companyLogo} companyName={company.companyName} />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                      {company.companyName}
                    </span>
                    {company.verified && (
                      <span title="Verified Employer" className="inline-flex shrink-0">
                        <ShieldCheck className="h-3.5 w-3.5 text-blue-500" />
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate">
                    {company.industryName || "General Business"}
                  </span>
                  {/* <span className="text-[10px] text-zinc-500 font-medium mt-0.5">
                    {company.activeJobs} active {company.activeJobs === 1 ? "job" : "jobs"}
                  </span> */}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>


    </div>
  );
}
