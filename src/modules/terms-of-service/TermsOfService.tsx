"use client";

import { Clock, ArrowLeft, Mail, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideUp, StaggerContainer, StaggerChild } from "@/components/shared/MotionContainer";
import { usePrimaryPlatformCompany } from "@/hooks/usePrimaryPlatformCompany";

const SECTIONS = [
  { id: "acceptance", title: "1. Acceptance of Terms" },
  { id: "eligibility", title: "2. Account Eligibility" },
  { id: "conduct", title: "3. User Conduct Rules" },
  { id: "intellectual", title: "4. Intellectual Property" },
  { id: "termination", title: "5. Termination of Service" },
  { id: "limitation", title: "6. Limitation of Liability" },
  { id: "governing", title: "7. Governing Law" },
  { id: "contact", title: "8. Contact Us" },
];

export default function TermsOfService() {
  const { company } = usePrimaryPlatformCompany();
  const brandName = company?.company_name || "LinkBridge";
  const contactEmail = company?.support_email || company?.company_email || "vertextechcorpofficial@gmail.com";
  const addressParts = [company?.company_city, company?.company_province, company?.company_country].filter(Boolean).join(", ");
  const legalOffice = `Legal Agreements Team, ${brandName}${addressParts ? `, ${addressParts}` : ", Philippines"}`;

  return (
    <div className="bg-background text-foreground font-sans max-md:pt-2 md:pt-16">
      {/* HERO */}
      <section className="relative overflow-hidden pt-8 pb-10 md:pt-24 md:pb-20 border-b border-zinc-100 dark:border-zinc-800">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-zinc-100 dark:from-zinc-900/40 via-white dark:via-zinc-950 to-white dark:to-zinc-950" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <StaggerContainer className="max-w-3xl">
            <StaggerChild>
              <Button asChild variant="ghost" size="sm" className="mb-6 rounded-full -ml-3 max-md:min-h-11 text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 cursor-pointer">
                <Link href="/" className="inline-flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" /> Back to Home
                </Link>
              </Button>
            </StaggerChild>
            <StaggerChild>
              <div className="flex items-center gap-3 mb-4">
                <Badge variant="secondary" className="py-1 px-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-medium border-zinc-250 dark:border-zinc-700">
                  Terms
                </Badge>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Last updated: July 8, 2026
                </span>
              </div>
            </StaggerChild>
            <StaggerChild>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6 leading-tight">
                Terms of Service
              </h1>
            </StaggerChild>
            <StaggerChild>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Welcome to {brandName}. These terms govern your access to and use of our platform, services, websites, and applications. Please read them carefully.
              </p>
            </StaggerChild>
          </StaggerContainer>
        </div>
      </section>

      {/* CONTENT & SIDEBAR INDEX */}
      <section className="py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            {/* Sidebar Table of Contents */}
            <SlideUp className="lg:col-span-1 lg:sticky lg:top-28 h-fit space-y-2 hidden lg:block">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-4 px-3">On this page</p>
              <nav className="flex flex-col gap-1">
                {SECTIONS.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 px-3 py-2 rounded-xl transition-all duration-150"
                  >
                    {sec.title}
                  </a>
                ))}
              </nav>
            </SlideUp>

            {/* Document body */}
            <SlideUp className="lg:col-span-3 prose prose-zinc dark:prose-invert max-w-none text-zinc-600 dark:text-zinc-300 space-y-10 leading-relaxed" delay={0.2}>
              <div id="acceptance" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">1. Acceptance of Terms</h2>
                <p>
                  By creating an account, browsing listings, or using any services on LinkBridge, you agree to comply with and be bound by these Terms of Service, along with our Privacy Policy. If you do not agree to these terms, you must immediately cease using the platform.
                </p>
              </div>

              <div id="eligibility" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">2. Account Eligibility</h2>
                <p>
                  To register an account or use LinkBridge, you represent and warrant that:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>You are at least 18 years of age or the legal age of majority in your jurisdiction.</li>
                  <li>You have the legal capacity and authority to enter into binding agreements.</li>
                  <li>The registry details you submit are accurate, complete, and current.</li>
                  <li>Your use of the service will not violate any applicable local, national, or international labor regulations.</li>
                </ul>
              </div>

              <div id="conduct" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">3. User Conduct Rules</h2>
                <p>
                  You agree to use LinkBridge only for lawful recruitment and job search purposes. You are prohibited from:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Posting misleading, fraudulent, or outdated job opportunities.</li>
                  <li>Impersonating another person, brand, recruiter, or business entity.</li>
                  <li>Scraping candidate CVs, email contacts, or database items using automated bots or scrapers without consent.</li>
                  <li>Uploading files containing malware, viruses, or code designed to interfere with system operations.</li>
                </ul>
              </div>

              <div id="intellectual" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">4. Intellectual Property</h2>
                <p>
                  All content, branding elements, software, database matching mechanisms, site designs, and interactive layouts on LinkBridge are the exclusive property of LinkBridge and its licensors. 
                </p>
                <p>
                  You retain ownership of the data, resumes, and text descriptions you post to the service. However, by uploading materials, you grant LinkBridge a worldwide, royalty-free, non-exclusive license to host and show your profile data to matching employers or candidates.
                </p>
              </div>

              <div id="termination" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">5. Termination of Service</h2>
                <p>
                  We reserve the right to suspend or terminate your access to the platform immediately, without prior notification or liability, for reasons including:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Breach of these Terms of Service.</li>
                  <li>Unverified corporate registration details or suspected spam activities.</li>
                  <li>Actions that cause legal liability or security risks to other users or our infrastructure.</li>
                </ul>
              </div>

              <div id="limitation" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">6. Limitation of Liability</h2>
                <p>
                  To the maximum extent permitted by law, LinkBridge provides the service &quot;as is&quot; and &quot;as available.&quot; We make no warranties regarding:
                </p>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-2 text-sm text-zinc-500 dark:text-zinc-400 my-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                    <p>The accuracy or completeness of candidate resumes or recruiter listings.</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                    <p>Whether relationships made on the platform result in employment contract fulfillment.</p>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0 mt-0.5" />
                    <p>System downtime, server errors, or lost data inputs due to outages.</p>
                  </div>
                </div>
              </div>

              <div id="governing" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">7. Governing Law</h2>
                <p>
                  These Terms of Service and any dispute arising out of or related to your use of the platform shall be governed by and construed in accordance with the laws of the Republic of the Philippines, without giving effect to conflict of laws principles.
                </p>
              </div>

              <div id="contact" className="scroll-mt-28 space-y-4">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">8. Contact Us</h2>
                <p>
                  If you have queries, interpretations, or feedback concerning these Terms, please reach out:
                </p>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-zinc-500 shrink-0" />
                    <a href={`mailto:${contactEmail}`} className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-primary transition-colors">
                      {contactEmail}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-zinc-500 shrink-0" />
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{legalOffice}</span>
                  </div>
                </div>
              </div>
            </SlideUp>
          </div>
        </div>
      </section>
    </div>
  );
}
