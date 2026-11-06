"use client";

import React from "react";
import {
  Briefcase, Globe, Users, TrendingUp,
  HeartHandshake, Shield, ShieldCheck, Zap, Star, Award, Target, Sparkles,
  ArrowRight, CheckCircle2, UserCheck, Building2, LayoutDashboard
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideUp, HoverScale, StaggerContainer, StaggerChild } from "@/components/shared/MotionContainer";
import { useAuthSession } from "@/hooks/useAuthSession";
import { usePrimaryPlatformCompany } from "@/hooks/usePrimaryPlatformCompany";
import Image from "next/image";
import { formatAssetUrl } from "@/lib/utils";

// ==========================================
// COMPONENT
// ==========================================

export default function AboutUs() {
  const session = useAuthSession();
  const { company, loading } = usePrimaryPlatformCompany();

  const heroTagline = company?.company_tagline;
  const heroDescription =
    company?.company_short_description ||
    company?.company_description ||
    "LinkBridge was built to bridge the gap between ambitious professionals and the companies building tomorrow. We're not just a job board — we're a career partner.";

  const missionStatement =
    company?.company_mission || "Connecting talent with opportunity at the speed of ambition.";
  const missionNarrative =
    company?.company_description ||
    "Traditional hiring is broken — slow processes, opaque requirements, and endless black holes. We built LinkBridge to make hiring transparent, fast, and human again.";
  const stats =
    Array.isArray(company?.metadata?.stats) &&
      company.metadata.stats.length > 0
      ? (company.metadata.stats as Array<{
        value: string;
        label: string;
      }>)
      : [
        { value: "100%", label: "Verified Employers" },
        { value: "Real-Time", label: "Direct Communication" },
        { value: "0%", label: "Application Fees" },
        { value: "24/7", label: "Platform Availability" },
      ];
  const teamHighlights = (() => {
    if (
      Array.isArray(company?.metadata?.team_highlights) &&
      company.metadata.team_highlights.length > 0
    ) {
      return company.metadata.team_highlights as Array<{
        icon?: React.ComponentType<{ className?: string }>;
        title: string;
        desc: string;
      }>;
    }

    const locationText = [
      company?.company_address,
      company?.company_city,
      company?.company_province,
      company?.company_country,
    ]
      .filter(Boolean)
      .join(", ");

    return [
      {
        icon: Globe,
        title: "Our Culture",
        desc:
          company?.company_culture ||
          "A collaborative, transparent environment where talent thrives and creates real impact.",
      },
      {
        icon: TrendingUp,
        title: "Our Vision",
        desc:
          company?.company_vision ||
          "Pioneering the future of work through smart role matching and seamless recruitment.",
      },
      {
        icon: Briefcase,
        title: "Platform Benefits",
        desc:
          company?.company_benefits ||
          "Verified profiles, transparent compensation ranges, and direct communication with employers.",
      },
      {
        icon: Users,
        title: "Headquarters & Reach",
        desc:
          locationText ||
          "Operating from the Philippines, connecting regional talent with leading organizations nationwide.",
      },
    ];
  })();
  const missionCheckpoints = (() => {
    const parsed = company?.company_tags
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    return parsed?.length
      ? parsed
      : [
        "Verified employers and authentic job listings",
        "AI-assisted talent matching tailored to your skills",
        "Transparent salary ranges on every listing",
        "Direct communication with hiring managers",
      ];
  })();

  const ICON_MAP: Record<string, React.ElementType> = {
    Users,
    Shield,
    ShieldCheck,
    Zap,
    Award,
    HeartHandshake,
    Star,
    Globe,
    Target,
    Sparkles,
    Briefcase,
    Building2,
  };

  const resolveValueIcon = (icon: unknown): React.ElementType => {
    if (typeof icon === "string" && ICON_MAP[icon]) {
      return ICON_MAP[icon];
    }
    if (typeof icon === "function") {
      return icon as React.ElementType;
    }
    return HeartHandshake;
  };

  const valuesList = (() => {
    const rawValues =
      (company as unknown as { values?: unknown[] })?.values ||
      (company?.metadata as unknown as { values?: unknown[] })?.values;

    if (Array.isArray(rawValues) && rawValues.length > 0) {
      return rawValues
        .filter((val: unknown) => {
          if (!val || typeof val !== "object") return false;
          const v = val as { is_active?: unknown };
          return v.is_active !== false && v.is_active !== 0;
        })
        .sort((a: unknown, b: unknown) => {
          const aOrder = (a as { display_order?: number })?.display_order ?? 0;
          const bOrder = (b as { display_order?: number })?.display_order ?? 0;
          return aOrder - bOrder;
        })
        .slice(0, 4)
        .map((value: unknown) => {
          const v = value as {
            icon?: unknown;
            icon_name?: string;
            title?: string;
            desc?: string;
            description?: string;
            color?: string;
          };
          const rawIcon = (v.icon_name || v.icon) as string | undefined;
          const isImg =
            typeof rawIcon === "string" &&
            (rawIcon.startsWith("http://") ||
              rawIcon.startsWith("https://") ||
              rawIcon.startsWith("/api/assets/") ||
              rawIcon.startsWith("/") ||
              rawIcon.startsWith("data:") ||
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(rawIcon));

          return {
            title: v.title || "Core Value",
            desc: v.description || v.desc || "",
            color: v.color || "bg-primary/10 text-primary",
            icon: resolveValueIcon(rawIcon),
            icon_url: isImg ? (formatAssetUrl(rawIcon) || rawIcon) : null,
          };
        });
    }

    return [];
  })();

  return (
    <div className="text-foreground font-sans md:pt-16">
      {/* HERO */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <StaggerContainer>
            <StaggerChild>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase shadow-2xs mb-5">
                <HeartHandshake className="w-3.5 h-3.5" />
                <span>Our Story</span>
              </div>
            </StaggerChild>
            <StaggerChild>
              <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl mx-auto leading-tight">
                {heroTagline ? (
                  heroTagline
                ) : (
                  <>
                    We believe everyone deserves{" "}
                    <span className="text-primary underline decoration-primary/30 underline-offset-8">
                      meaningful work.
                    </span>
                  </>
                )}
              </h1>
            </StaggerChild>
            <StaggerChild>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {heroDescription}
              </p>
            </StaggerChild>
          </StaggerContainer>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-border/60 py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 text-center">
            {stats.map((stat) => (
              <StaggerChild key={stat.label}>
                <p className="text-2xl md:text-5xl font-extrabold text-foreground tracking-tight mb-1">{stat.value}</p>
                <p className="text-xs md:text-sm font-medium text-muted-foreground">{stat.label}</p>
              </StaggerChild>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* MISSION & VISION */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 items-stretch">
            <SlideUp>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Our Mission</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6 leading-tight">
                {missionStatement}
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-lg leading-relaxed mb-6">
                {missionNarrative}
              </p>
              <div className="space-y-3">
                {missionCheckpoints.map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{point}</span>
                  </div>
                ))}
              </div>
            </SlideUp>

            <SlideUp delay={0.2} className="h-full">
              <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
                {teamHighlights.map((th) => {
                  const Icon = th.icon || Globe;
                  return (
                    <div
                      key={th.title}
                      className="border border-border/80 rounded-2xl p-4 sm:p-6 bg-white/85 dark:bg-card/75 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_10px_30px_rgba(37,99,235,0.12)] hover:border-primary/40 transition-all duration-300 h-full flex flex-col"
                    >
                      <Icon className="w-6 h-6 text-primary mb-3" />
                      <h3 className="text-sm font-bold text-foreground mb-1">{th.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed break-words">{th.desc}</p>
                    </div>
                  );
                })}
              </div>
            </SlideUp>
          </div>
        </div>
      </section>

      {/* CORE VALUES (DYNAMIC DATABASE VALUES) */}
      {loading ? (
        <section className="py-16 md:py-24" role="status" aria-busy="true">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 md:mb-16 space-y-2">
              <Skeleton className="h-4 w-24 mx-auto rounded-full" />
              <Skeleton className="h-8 w-64 mx-auto rounded-xl" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border border-border/80 rounded-2xl p-6 bg-card/70 space-y-3">
                  <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                  <Skeleton className="h-5 w-3/4 rounded-lg" />
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-5/6 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : valuesList.length > 0 ? (
        <section className="py-16 md:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10 md:mb-16">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">Our Values</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">What guides our work</h2>
            </div>

            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {valuesList.map((val) => {
                const IconComp = (val.icon || HeartHandshake) as React.ElementType;
                return (
                  <StaggerChild key={val.title}>
                    <HoverScale className="h-full">
                      <div
                        onPointerMove={(e) => {
                          const r = e.currentTarget.getBoundingClientRect();
                          e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                          e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                        }}
                        className="group/card relative overflow-hidden border border-border/80 rounded-2xl p-6 bg-white/85 dark:bg-card/75 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_35px_rgba(37,99,235,0.14)] hover:border-primary/40 transition-all duration-300 h-full flex flex-col justify-between"
                      >
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
                          style={{
                            background:
                              "radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), hsl(var(--info) / 0.12), transparent 60%)",
                          }}
                        />
                        <div className="relative z-10">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 overflow-hidden p-1.5 ${val.color || "bg-primary/10 text-primary"}`}>
                            {val.icon_url ? (
                              <Image
                                src={val.icon_url}
                                alt={val.title}
                                width={28}
                                height={28}
                                className="w-7 h-7 object-contain"
                                unoptimized
                              />
                            ) : (
                              <IconComp className="w-6 h-6" />
                            )}
                          </div>
                          <h3 className="text-base font-bold text-foreground mb-2 group-hover/card:text-primary transition-colors">{val.title}</h3>
                          <p className="text-base md:text-sm text-muted-foreground leading-relaxed">{val.desc}</p>
                        </div>
                      </div>
                    </HoverScale>
                  </StaggerChild>
                );
              })}
            </StaggerContainer>
          </div>
        </section>
      ) : null}


      {/* DYNAMIC CTA STRIP */}
      <section className="py-14 md:py-20">
        <SlideUp className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/85 dark:bg-card/75 border border-border/80 rounded-3xl px-6 py-10 md:px-16 md:py-14 text-center relative overflow-hidden backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

            {session.isJobSeeker ? (
              /* Logged in Job Seeker */
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">Join us in building the future of work</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                  Browse verified opportunities and connect directly with top companies.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white rounded-full px-8 cursor-pointer shadow-sm hover:shadow-md transition-all h-11 md:h-10">
                    <Link href="/vos-sync/freelancer" className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Go to Job Seeker Portal
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/80 hover:bg-muted text-foreground rounded-full px-8 cursor-pointer h-11 md:h-10">
                    <Link href="/contact-us">Contact Support <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                </div>
              </div>
            ) : session.isEmployer ? (
              /* Logged in Employer */
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">Join us in building the future of work</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                  Scale your team with verified professionals and seamless hiring workflows.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white rounded-full px-8 cursor-pointer shadow-sm hover:shadow-md transition-all h-11 md:h-10">
                    <Link href="/vos-sync/client/dashboard" className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Go to Client Portal
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/80 hover:bg-muted text-foreground rounded-full px-8 cursor-pointer h-11 md:h-10">
                    <Link href="/contact-us">Contact Us <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                </div>
              </div>
            ) : session.isAdmin || session.isSchool ? (
              /* Logged in School / Admin */
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">Join us in building the future of work</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                  Access your management tools, student records, and platform controls.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white rounded-full px-8 cursor-pointer shadow-sm hover:shadow-md transition-all h-11 md:h-10">
                    <Link href={session.dashboard || "/vos-sync/admin"} className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Go to Dashboard
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/80 hover:bg-muted text-foreground rounded-full px-8 cursor-pointer h-11 md:h-10">
                    <Link href="/contact-us">Contact Us <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                </div>
              </div>
            ) : (
              /* Guest / Unauthenticated */
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">Join us in building the future of work</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                  Whether you&apos;re hiring or being hired — LinkBridge is built for you.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white rounded-full px-8 cursor-pointer shadow-sm hover:shadow-md transition-all h-11 md:h-10">
                    <Link href="/signup">Get Started Free</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/80 hover:bg-muted text-foreground rounded-full px-8 cursor-pointer h-11 md:h-10">
                    <Link href="/contact-us">Contact Us <ArrowRight className="ml-2 w-4 h-4" /></Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </SlideUp>
      </section>
    </div>
  );
}
