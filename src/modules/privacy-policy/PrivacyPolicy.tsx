"use client";

import { Shield, Clock, ArrowLeft, Mail, Globe, Lock } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlideUp, StaggerContainer, StaggerChild } from "@/components/shared/MotionContainer";
import { usePrimaryPlatformCompany } from "@/hooks/usePrimaryPlatformCompany";

const SECTIONS = [
  { id: "collection", title: "1. Information We Collect" },
  { id: "usage", title: "2. How We Use Information" },
  { id: "sharing", title: "3. Information Sharing" },
  { id: "retention", title: "4. Data Retention & Deletion" },
  { id: "security", title: "5. Security Measures" },
  { id: "rights", title: "6. Your Privacy Rights" },
  { id: "updates", title: "7. Policy Updates" },
  { id: "contact", title: "8. Contact Us" },
];

export default function PrivacyPolicy() {
  const { company } = usePrimaryPlatformCompany();
  const brandName = company?.company_name || "LinkBridge";
  const contactEmail = company?.support_email || company?.company_email || "vertextechcorpofficial@gmail.com";
  const addressParts = [company?.company_city, company?.company_province, company?.company_country].filter(Boolean).join(", ");
  const complianceOffice = `${brandName} Legal Compliance Team${addressParts ? `, ${addressParts}` : ", Philippines"}`;

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
                  Legal
                </Badge>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Last updated: July 8, 2026
                </span>
              </div>
            </StaggerChild>
            <StaggerChild>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 mb-6 leading-tight">
                Privacy Policy
              </h1>
            </StaggerChild>
            <StaggerChild>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 leading-relaxed">
                At {brandName}, we are committed to protecting your privacy. This policy describes how we collect, use, process, and share your personal data when you use our platform.
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
              <div id="collection" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">1. Information We Collect</h2>
                <p>
                  We collect information to provide better services to our users. The categories of information we collect include:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong className="text-zinc-800 dark:text-zinc-200">Account Credentials:</strong> Full name, email address, password, and registration data.
                  </li>
                  <li>
                    <strong className="text-zinc-800 dark:text-zinc-200">Profile Information:</strong> Resume data, work history, skills, educational background, portfolio links, and optional photos.
                  </li>
                  <li>
                    <strong className="text-zinc-800 dark:text-zinc-200">Usage Data:</strong> Pages visited, searches performed, applications submitted, and interaction timestamps.
                  </li>
                  <li>
                    <strong className="text-zinc-800 dark:text-zinc-200">Device Information:</strong> IP address, browser type, operating system details, and device identifiers.
                  </li>
                </ul>
              </div>

              <div id="usage" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">2. How We Use Information</h2>
                <p>
                  We process your data based on legitimate business purposes, the fulfillment of our contract with you, and compliance with our legal obligations. We use it to:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Match candidates with job opportunities and verified employers.</li>
                  <li>Maintain, optimize, secure, and personalize our platform and matching algorithms.</li>
                  <li>Communicate system notifications, application updates, and career advice newsletters (if subscribed).</li>
                  <li>Identify and prevent fraudulent activities or security threats.</li>
                </ul>
              </div>

              <div id="sharing" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">3. Information Sharing</h2>
                <p>
                  We do not sell your personal data. We only share information in the following circumstances:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>
                    <strong className="text-zinc-800 dark:text-zinc-200">With Employers:</strong> When you actively apply to a job posting, the employer gains access to your profile and resume materials.
                  </li>
                  <li>
                    <strong className="text-zinc-800 dark:text-zinc-200">With Service Providers:</strong> Trusted third-party vendors helping us operate our cloud infrastructure and analytics.
                  </li>
                  <li>
                    <strong className="text-zinc-800 dark:text-zinc-200">For Legal Reasons:</strong> If required to comply with regulatory audits, court subpoenas, or user safety standards.
                  </li>
                </ul>
              </div>

              <div id="retention" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">4. Data Retention & Deletion</h2>
                <p>
                  We retain personal data for as long as your account is active or needed to provide services. You can delete or deactivate your account at any time in your Settings panel.
                </p>
                <p>
                  Once requested, your account profile materials are permanently purged from our primary databases within 30 days, unless required to be kept for legal compliance.
                </p>
              </div>

              <div id="security" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">5. Security Measures</h2>
                <p>
                  We implement industry-standard administrative, technical, and physical security measures to safeguard your personal data:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900/60 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Encrypted Storage</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Data is encrypted in transit using SSL/TLS and at rest using AES-256 standard protocols.</p>
                    </div>
                  </div>
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 bg-white dark:bg-zinc-900/60 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Shield className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Verified Access</h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Role-based controls prevent unauthorized internal access to user database nodes.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div id="rights" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">6. Your Privacy Rights</h2>
                <p>
                  Depending on your jurisdiction, you have certain rights regarding your personal information:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>The right to access and receive a copy of your personal data.</li>
                  <li>The right to request rectification of inaccurate or outdated information.</li>
                  <li>The right to withdraw consent (e.g., opting out of marketing emails).</li>
                  <li>The right to object to the processing of your data.</li>
                </ul>
              </div>

              <div id="updates" className="scroll-mt-28 space-y-3">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">7. Policy Updates</h2>
                <p>
                  We may modify this policy periodically to reflect changing regulatory environments or product improvements. We will post notification of changes on this page and, for significant revisions, send account-holder email alerts.
                </p>
              </div>

              <div id="contact" className="scroll-mt-28 space-y-4">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800 pb-2">8. Contact Us</h2>
                <p>
                  If you have queries, concerns, or requests regarding this Privacy Policy or your data protection rights, please contact our Compliance Officer:
                </p>
                <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-2xl p-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-zinc-500 shrink-0" />
                    <a href={`mailto:${contactEmail}`} className="text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:text-primary transition-colors">
                      {contactEmail}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-zinc-500 shrink-0" />
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{complianceOffice}</span>
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
