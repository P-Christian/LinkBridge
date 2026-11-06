"use client";

import Link from "next/link";
import Image from "next/image";
import {  Instagram, Youtube } from "lucide-react";
import { SlideUp } from "@/components/shared/MotionContainer";
import { usePrimaryPlatformCompany } from "@/hooks/usePrimaryPlatformCompany";
import { useAuthSession } from "@/hooks/useAuthSession";
import { formatAssetUrl } from "@/lib/utils";

import type { SVGProps } from "react";

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.35V9h3.414v1.561h.049c.476-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124ZM7.119 20.452H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
    </svg>
  );
}
function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.019 4.388 11.003 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.956.93-1.956 1.885v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.076 24 18.092 24 12.073Z" />
    </svg>
  );
}
export function Footer() {
  const { company } = usePrimaryPlatformCompany();
  const session = useAuthSession();

  const brandDescription =
    company?.company_short_description ||
    company?.company_tagline ||
    "Connecting top talent with verified organizations. Your next career move starts here.";
  const legalName = company?.company_legal_name || company?.company_name || "LinkBridge";

  const socialLinks = [
    {
      name: "LinkedIn",
      href: company?.company_linkedin,
      icon: LinkedInIcon,
      colorClass:
        "bg-[#0A66C2]/10 text-[#0A66C2] border-[#0A66C2]/25 hover:bg-[#0A66C2] hover:text-white hover:border-[#0A66C2] hover:shadow-md hover:shadow-[#0A66C2]/25",
    },
    {
      name: "Facebook",
      href: company?.company_facebook,
      icon: FacebookIcon,
      colorClass:
        "bg-[#1877F2]/10 text-[#1877F2] border-[#1877F2]/25 hover:bg-[#1877F2] hover:text-white hover:border-[#1877F2] hover:shadow-md hover:shadow-[#1877F2]/25",
    },
    {
      name: "Instagram",
      href: company?.company_instagram,
      icon: Instagram,
      colorClass:
        "bg-[#E4405F]/10 text-[#E4405F] border-[#E4405F]/25 hover:bg-gradient-to-tr hover:from-[#f09433] hover:via-[#dc2743] hover:to-[#bc1888] hover:text-white hover:border-transparent hover:shadow-md hover:shadow-[#E4405F]/25",
    },
    {
      name: "X",
      href: company?.company_x,
      icon: XIcon,
      colorClass:
        "bg-zinc-500/10 text-zinc-800 dark:text-zinc-100 border-zinc-500/25 hover:bg-black hover:text-white hover:border-black hover:shadow-md hover:shadow-black/20 dark:hover:bg-white dark:hover:text-black dark:hover:border-white dark:hover:shadow-white/10",
    },
    {
      name: "YouTube",
      href: company?.company_youtube,
      icon: Youtube,
      colorClass:
        "bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/25 hover:bg-[#FF0000] hover:text-white hover:border-[#FF0000] hover:shadow-md hover:shadow-[#FF0000]/25",
    },

  ].filter((s) => Boolean(s.href));

  const candidateLinks = session.isJobSeeker
    ? [
      { label: "Find Jobs", href: "/vos-sync/freelancer/jobs" },
      { label: "My Applications", href: "/vos-sync/freelancer/applications" },
      { label: "Browse Companies", href: "/companies" },
      { label: "Career Advice", href: "/career-advice" },
    ]
    : [
      { label: "Find Jobs", href: "/find-jobs" },
      { label: "Browse Companies", href: "/companies" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Career Advice", href: "/career-advice" },
    ];

  const employerLinks = session.isEmployer
    ? [
      { label: "Post a Job", href: "/vos-sync/client/jobs" },
      { label: "Applicants", href: "/vos-sync/client/applicants" },
      { label: "Talent Search", href: "/vos-sync/client/talent-search" },
      { label: "Dashboard", href: "/vos-sync/client/dashboard" },
    ]
    : [
      { label: "Post a Job", href: "/signup?role=employer" },
      { label: "Hiring Solutions", href: "/how-it-works?role=employer" },
      { label: "Employer Sign In", href: "/login" },
    ];

  return (
    <footer className="relative z-10 bg-background/50 backdrop-blur-md border-t border-border/40 pt-16 pb-8">
      <SlideUp className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 lg:col-span-2">
            <Link
              href="/"
              className="group inline-flex items-center gap-2 mb-4 transition-transform duration-300 ease-out hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
            >
              <div className="w-9 h-9 bg-none dark:bg-none rounded-lg flex items-center justify-center overflow-hidden p-1.5 transition-all duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110 group-active:scale-95 group-hover:drop-shadow-[0_4px_12px_rgba(37,99,235,0.35)]">
                {company?.platform_icon &&
                  (company.platform_icon.startsWith("/") ||
                    company.platform_icon.startsWith("http") ||
                    /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(company.platform_icon)) ? (
                  <Image
                    src={formatAssetUrl(company.platform_icon) || company.platform_icon}
                    alt={company?.platform_name || "LinkBridge"}
                    width={20}
                    height={20}
                    className="w-8 h-8 object-contain transition-transform duration-300 ease-out group-hover:scale-105"
                    unoptimized
                  />
                ) : (
                  <Image
                    src="/linkbridge.png"
                    alt={company?.platform_name || "LinkBridge"}
                    width={20}
                    height={20}
                    className="h-8 w-8 object-contain transition-transform duration-300 ease-out group-hover:scale-105"
                    unoptimized
                  />
                )}
              </div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-[#2563EB] to-[#7C3AED] bg-clip-text text-transparent transition-all duration-300 ease-out group-hover:brightness-115 group-hover:drop-shadow-[0_2px_10px_rgba(37,99,235,0.25)] motion-reduce:transition-none">
                {company?.platform_name || "LinkBridge"}
              </span>
            </Link>
            <p className="text-muted-foreground max-w-sm mb-6 text-sm leading-relaxed">
              {brandDescription}
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Candidates</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {candidateLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Employers</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              {employerLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-foreground mb-4">Company</h4>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link href="/about-us" className="hover:text-foreground transition-colors">About Us</Link></li>
              <li><Link href="/contact-us" className="hover:text-foreground transition-colors">Contact</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms-of-service" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {legalName}. All rights reserved.
          </p>
          {socialLinks.length > 0 && (
            <div className="flex gap-3">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 transform hover:-translate-y-0.5 ${social.colorClass}`}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </SlideUp>
    </footer>
  );
}
export default Footer;
