"use client";

import React from "react";
import {
  Mail,
  Smartphone,
  MapPin,
  Clock,
  MessageSquare,
  ArrowRight,
  LayoutDashboard,
  UserCheck,
  Briefcase,
  Building2,
  Check,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { SlideUp, HoverScale, StaggerContainer, StaggerChild } from "@/components/shared/MotionContainer";
import { useAuthSession } from "@/hooks/useAuthSession";
import { usePrimaryPlatformCompany } from "@/hooks/usePrimaryPlatformCompany";

// ==========================================
// CONSTANTS
// ==========================================

const CONTACT_API_ENDPOINT = "/api/contact";
const PRIVACY_POLICY_HREF = "/privacy-policy"; // verify this route exists

// "/vos-sync/freelancer" 404s. Prefer the dashboard supplied by the session and
// fall back to these. Verify the fallbacks against your app directory.
const JOB_SEEKER_PORTAL_FALLBACK = "/vos-sync/freelancer/dashboard";
const EMPLOYER_PORTAL_FALLBACK = "/vos-sync/client/dashboard";

// Keep in sync with the server-side validation / database limits.
const LIMITS = { name: 100, email: 254, company: 150, subject: 150, message: 5000 } as const;

const FAQS = [
  {
    q: "How quickly do you respond?",
    a: "Our team typically responds within one business day. For urgent matters, please call us directly.",
  },
  {
    q: "Can I post a job as a company?",
    a: "Yes! Reach out to our employer team or create a company account to start posting jobs immediately.",
  },
];

type ContactFormData = {
  name: string;
  email: string;
  company: string;
  subject: string;
  message: string;
};

const EMPTY_FORM: ContactFormData = { name: "", email: "", company: "", subject: "", message: "" };

type ContactCard = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  desc: string;
  href?: string;
};

const FIELD_BASE =
  "rounded-xl border-border/80 bg-white/70 dark:bg-card/60 backdrop-blur-md focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/15 transition-all";

const fieldClass = (hasError: boolean) =>
  `${FIELD_BASE}${hasError ? " border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20" : ""}`;

function trackPointer(e: React.PointerEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

// Display-only: 09451232521 -> 0945 123 2521. Anything else is shown as stored.
function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^09\d{9}$/.test(value.trim()) || /^09\d{9}$/.test(digits)
    ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
    : value;
}

// Gives emails a clean line-break point after the "@" instead of splitting mid-word.
function SoftBreakValue({ value }: { value: string }) {
  const parts = value.split("@");
  if (parts.length !== 2) return <>{value}</>;
  return (
    <>
      {parts[0]}@<wbr />
      {parts[1]}
    </>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs text-destructive mt-1">
      {message}
    </p>
  );
}

// ==========================================
// COMPONENT
// ==========================================

export default function Contact() {
  const session = useAuthSession();
  const { company } = usePrimaryPlatformCompany();

  const email = company?.support_email || company?.company_email || "vertextechcorpofficial@gmail.com";
  // No fake fallback: if the platform company has no contact number, the Mobile card is hidden.
  const mobile = company?.company_contact || "";

  const addressParts = [
    company?.company_address,
    company?.company_brgy,
    company?.company_city,
    company?.company_province,
  ].filter(Boolean);
  const officeAddress = addressParts.join(", ") || "Gonzales Street, Bonuan Boquig, Dagupan City, Philippines";
  const officeRegion = company?.company_province || company?.company_country || "Pangasinan";
  const mapUrl = company?.map_embed_url || "https://www.google.com/maps/place/Vertex+Technologies+Corporation/@16.0811488,120.3628013,806m/data=!3m1!1e3!4m6!3m5!1s0x3391690070819183:0xa97974ead9f524e!8m2!3d16.082358!4d120.360837!16s%2Fg%2F11ms89t5n8?hl=en&entry=ttu";

  const [formData, setFormData] = React.useState<ContactFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  // Honeypot: never shown to real users; bots fill this in
  const [honeypot, setHoneypot] = React.useState("");
  const successTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  // Prefill name and email when the user is logged in (still editable)
  const [syncedSession, setSyncedSession] = React.useState(false);
  if (!syncedSession && session.authenticated && !session.loading) {
    setSyncedSession(true);
    const user = session as unknown as { name?: string; email?: string };
    setFormData((prev) => ({
      ...prev,
      name: prev.name || user.name || "",
      email: prev.email || user.email || "",
    }));
  }

  // Update a field and clear its server error as soon as the user edits it
  const updateField =
    (key: keyof ContactFormData) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = e.target.value;
        setFormData((prev) => ({ ...prev, [key]: value }));
        setFieldErrors((prev) => {
          if (!prev[key]) return prev;
          const next = { ...prev };
          delete next[key];
          return next;
        });
      };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const res = await fetch(CONTACT_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          company: formData.company.trim(),
          subject: formData.subject.trim(),
          message: formData.message.trim(),
          website: honeypot, // honeypot
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        fieldErrors?: Record<string, string>;
      };

      if (res.status === 429) {
        toast.error(data.message ?? "Too many submissions. Please wait a few minutes and try again.");
        return;
      }

      if (res.status === 400) {
        if (data.fieldErrors && Object.keys(data.fieldErrors).length > 0) {
          setFieldErrors(data.fieldErrors);
        }
        toast.error(data.message ?? "Please fix the errors below.");
        return;
      }

      if (!res.ok) {
        toast.error(data.message ?? "Something went wrong. Please try again.");
        return;
      }

      toast.success("Message sent successfully!", {
        description: "Thank you for contacting us. We'll get back to you within one business day.",
      });
      setIsSuccess(true);
      if (successTimer.current) clearTimeout(successTimer.current);
      successTimer.current = setTimeout(() => setIsSuccess(false), 4000);
      setFormData(EMPTY_FORM);
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toTelHref = (value: string) => `tel:${value.replace(/[^\d+]/g, "")}`;

  // Business hours live ONLY in the Support Hours card (single source of truth).
  const supportDays =
    company?.support_hours_days ||
    ((company?.metadata as Record<string, unknown> | null)?.support_hours_days as string) ||
    "Mon–Fri";
  const supportTime =
    company?.support_hours_time ||
    ((company?.metadata as Record<string, unknown> | null)?.support_hours_time as string) ||
    "8am–5pm";
  const supportTimezone =
    company?.support_hours_timezone ||
    ((company?.metadata as Record<string, unknown> | null)?.support_hours_timezone as string) ||
    "Philippine Time (PHT)";
  const supportHoursValue = `${supportDays}, ${supportTime}`;

  const contactCards: ContactCard[] = [
    { icon: MapPin, label: "Office", value: officeAddress, desc: "Visit Us" , href: mapUrl },
    { icon: Mail, label: "Email us", value: email, desc: "We reply within 24 hours.", href: `mailto:${email}` },
    ...(mobile
      ? [{ icon: Smartphone, label: "Mobile", value: formatPhone(mobile), desc: "Mobile hotline", href: toTelHref(mobile) }]
      : []),
    { icon: Clock, label: "Support hours", value: supportHoursValue, desc: supportTimezone },
  ];

  const cardClass =
    "group/card relative overflow-hidden min-w-0 border border-border/80 rounded-2xl p-4 sm:p-6 bg-white/85 dark:bg-card/75 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-300 block h-full";

  const cardInner = (item: ContactCard) => (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/card:opacity-100"
        style={{
          background:
            "radial-gradient(400px circle at var(--mx, 50%) var(--my, 50%), hsl(var(--info) / 0.12), transparent 60%)",
        }}
      />
      <div className="relative z-10 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover/card:bg-primary group-hover/card:text-white transition-colors">
          <item.icon className="w-5 h-5 text-primary group-hover/card:text-white transition-colors" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">{item.label}</p>
        {/* overflow-wrap:anywhere keeps long emails/addresses inside the card padding */}
        <p className="text-base font-semibold text-foreground mb-1 break-words [overflow-wrap:anywhere]">
          <SoftBreakValue value={item.value} />
        </p>
        <p className="text-sm text-muted-foreground break-words">{item.desc}</p>
      </div>
    </>
  );

  return (
    <div className="text-foreground font-sans md:pt-16">
      {/* HERO */}
      <section className="relative overflow-hidden pt-20 pb-16 md:pt-15 md:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <StaggerContainer className="max-w-2xl">

            <StaggerChild>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase shadow-2xs mb-5">
                <MessageSquare className="w-3.5 h-3.5" />
                <span>
                  {session.isJobSeeker
                    ? "Job Seeker Support"
                    : session.isEmployer
                      ? "Employer Support"
                      : session.isAdmin || session.isSchool
                        ? "Organization Support"
                        : "Get in touch"}
                </span>
              </div>
            </StaggerChild>
            <StaggerChild>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
                Let&apos;s start a{" "}
                <span className="text-primary underline decoration-primary/30 underline-offset-8">
                  conversation.
                </span>
              </h1>
            </StaggerChild>
            <StaggerChild>
              <p className="text-lg text-muted-foreground leading-relaxed">
                {session.isJobSeeker
                  ? "Signed in as Job Seeker. Have questions about job applications, profile verification, or scheduled interviews? We're here to assist."
                  : session.isEmployer
                    ? "Signed in as Employer. Need help with company verification, job postings, or talent search? Send us a message anytime."
                    : session.isAdmin || session.isSchool
                      ? "Signed in to your administrative account. Need help with platform operations, student records, or partner support? We're here for you."
                      : "Whether you're a job seeker, employer, or just have a question — we're here to help. Fill out the form and we'll get back to you soon."}
              </p>
            </StaggerChild>
          </StaggerContainer>
        </div>
      </section>

  {/* CONTACT INFO CARDS: only items backed by real data are shown */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* key: cards that mount after the entrance animation (e.g. Mobile, once company data
              loads) would stay stuck at their hidden state, so replay the animation when the set changes. */}
          <StaggerContainer
            key={contactCards.map((c) => c.label).join("|")}
            className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:[&>*:last-child:nth-child(odd)]:col-span-2"
          >
            {contactCards.map((item) => (
              <StaggerChild key={item.label}>
                <HoverScale className="h-full">
                  {item.href ? (
                    <a
                      href={item.href}
                      {...(item.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      onPointerMove={trackPointer}
                      className={`${cardClass} hover:border-primary/40 hover:shadow-[0_12px_35px_rgba(37,99,235,0.14)] focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20`}
                    >
                      {cardInner(item)}
                    </a>
                  ) : (
                    <div onPointerMove={trackPointer} className={cardClass}>
                      {cardInner(item)}
                    </div>
                  )}
                </HoverScale>
              </StaggerChild>
            ))}
          </StaggerContainer>
        </div>
      </section>
 

      {/* FORM + FAQ */}
      <section className="py-16 border-y border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 md:gap-12 items-start">
            {/* FORM */}
            <SlideUp className="lg:col-span-3">
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Send us a message</h2>
              <p className="text-muted-foreground mb-8 text-sm">We&apos;ll respond within one business day with next steps.</p>

              <div
                onPointerMove={trackPointer}
                className="group/form relative overflow-hidden bg-white/85 dark:bg-card/75 border border-border/80 rounded-3xl p-5 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/form:opacity-100"
                  style={{
                    background:
                      "radial-gradient(500px circle at var(--mx, 50%) var(--my, 50%), hsl(var(--primary) / 0.08), transparent 60%)",
                  }}
                />

                <form onSubmit={handleSubmit} className="relative z-10 space-y-5" aria-busy={isSubmitting}>
                  {/* Honeypot: hidden from real users, bots fill it in */}
                  <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: 0, height: 0, overflow: "hidden" }}>
                    <label htmlFor="contact-website">Leave this blank</label>
                    <input
                      id="contact-website"
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name" className="text-sm font-medium text-foreground">
                        Full name <span aria-hidden="true" className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-name"
                        name="name"
                        autoComplete="name"
                        required
                        maxLength={LIMITS.name}
                        disabled={isSubmitting}
                        value={formData.name}
                        onChange={updateField("name")}
                        placeholder="Your name"
                        aria-invalid={!!fieldErrors.name}
                        aria-describedby={fieldErrors.name ? "contact-name-error" : undefined}
                        className={`h-11 ${fieldClass(!!fieldErrors.name)}`}
                      />
                      <FieldError id="contact-name-error" message={fieldErrors.name} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email" className="text-sm font-medium text-foreground">
                        Email <span aria-hidden="true" className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={LIMITS.email}
                        disabled={isSubmitting}
                        value={formData.email}
                        onChange={updateField("email")}
                        placeholder="you@company.com"
                        aria-invalid={!!fieldErrors.email}
                        aria-describedby={fieldErrors.email ? "contact-email-error" : undefined}
                        className={`h-11 ${fieldClass(!!fieldErrors.email)}`}
                      />
                      <FieldError id="contact-email-error" message={fieldErrors.email} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <Label htmlFor="contact-company" className="text-sm font-medium text-foreground">
                        Company <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Input
                        id="contact-company"
                        name="company"
                        autoComplete="organization"
                        maxLength={LIMITS.company}
                        disabled={isSubmitting}
                        value={formData.company}
                        onChange={updateField("company")}
                        placeholder="Company / Organization"
                        aria-invalid={!!fieldErrors.company}
                        aria-describedby={fieldErrors.company ? "contact-company-error" : undefined}
                        className={`h-11 ${fieldClass(!!fieldErrors.company)}`}
                      />
                      <FieldError id="contact-company-error" message={fieldErrors.company} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-subject" className="text-sm font-medium text-foreground">
                        Subject <span aria-hidden="true" className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-subject"
                        name="subject"
                        required
                        maxLength={LIMITS.subject}
                        disabled={isSubmitting}
                        value={formData.subject}
                        onChange={updateField("subject")}
                        placeholder="e.g. Hiring inquiry"
                        aria-invalid={!!fieldErrors.subject}
                        aria-describedby={fieldErrors.subject ? "contact-subject-error" : undefined}
                        className={`h-11 ${fieldClass(!!fieldErrors.subject)}`}
                      />
                      <FieldError id="contact-subject-error" message={fieldErrors.subject} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <Label htmlFor="contact-message" className="text-sm font-medium text-foreground">
                        Message <span aria-hidden="true" className="text-destructive">*</span>
                      </Label>
                      <span aria-hidden="true" className="text-xs tabular-nums text-muted-foreground">
                        {formData.message.length}/{LIMITS.message}
                      </span>
                    </div>
                    <Textarea
                      id="contact-message"
                      name="message"
                      required
                      maxLength={LIMITS.message}
                      disabled={isSubmitting}
                      value={formData.message}
                      onChange={updateField("message")}
                      placeholder="Tell us more about what you need..."
                      aria-invalid={!!fieldErrors.message}
                      aria-describedby={fieldErrors.message ? "contact-message-error" : undefined}
                      className={`min-h-[140px] resize-none ${fieldClass(!!fieldErrors.message)}`}
                    />
                    <FieldError id="contact-message-error" message={fieldErrors.message} />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-1">
                    <p className="text-xs text-muted-foreground leading-relaxed sm:max-w-sm">
                      By sending this message you agree that we may store it to respond to your inquiry.{" "}
                      <Link
                        href={PRIVACY_POLICY_HREF}
                        className="underline underline-offset-2 hover:text-primary focus-visible:text-primary transition-colors"
                      >
                        Privacy Policy
                      </Link>
                    </p>
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-full px-7 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:cursor-not-allowed bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white h-11 md:h-9 w-full sm:w-auto"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…
                        </>
                      ) : isSuccess ? (
                        <span className="flex items-center gap-1.5 font-medium">
                          <Check className="w-4 h-4 text-emerald-300" /> Message sent!
                        </span>
                      ) : (
                        <>
                          Send message <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </SlideUp>

            {/* FAQ - Interactive Accordion */}
            <SlideUp className="lg:col-span-2" delay={0.2}>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">Common questions</h2>
              <p className="text-muted-foreground mb-8 text-sm">Quick answers to things we get asked often.</p>

              <Accordion type="single" collapsible defaultValue="item-0" className="space-y-3">
                {FAQS.map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`item-${i}`}
                    className="border border-border/80 rounded-2xl px-5 bg-white/85 dark:bg-card/75 backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:border-primary/40 transition-colors"
                  >
                    <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-4 text-left">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed pt-1 pb-4">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </SlideUp>
          </div>
        </div>
      </section>

      {/* DYNAMIC CTA STRIP */}
      <section className="py-14 md:py-20">
        <SlideUp className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white/85 dark:bg-card/75 border border-border/80 rounded-3xl px-6 py-10 md:px-16 md:py-14 text-center relative overflow-hidden backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

            {session.isJobSeeker ? (
              /* Logged in Job Seeker View */
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">Ready to find your next opportunity?</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                  Browse open listings and track your job applications directly.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white rounded-full px-8 cursor-pointer shadow-sm hover:shadow-md transition-all h-11 md:h-10">
                    <Link href={session.dashboard || JOB_SEEKER_PORTAL_FALLBACK} className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Go to Job Seeker Portal
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/80 hover:bg-muted text-foreground rounded-full px-8 cursor-pointer h-11 md:h-10">
                    <Link href="/find-jobs" className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Find Jobs
                    </Link>
                  </Button>
                </div>
              </div>
            ) : session.isEmployer ? (
              /* Logged in Employer View */
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">Looking to hire top talent?</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                  Manage your active job postings, review applicants, and source verified candidates.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white rounded-full px-8 cursor-pointer shadow-sm hover:shadow-md transition-all h-11 md:h-10">
                    <Link href={session.dashboard || EMPLOYER_PORTAL_FALLBACK} className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Go to Client Portal
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/80 hover:bg-muted text-foreground rounded-full px-8 cursor-pointer h-11 md:h-10">
                    <Link href="/vos-sync/client/talent-search" className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4" />
                      Find Talent
                    </Link>
                  </Button>
                </div>
              </div>
            ) : session.isAdmin || session.isSchool ? (
              /* Logged in Admin / School View */
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">Need administrative support?</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                  Access your management dashboard or reach out to our dedicated platform support team.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white rounded-full px-8 cursor-pointer shadow-sm hover:shadow-md transition-all h-11 md:h-10">
                    <Link href={session.dashboard || "/vos-sync/admin"} className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Go to Dashboard
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/80 hover:bg-muted text-foreground rounded-full px-8 cursor-pointer h-11 md:h-10">
                    <Link href="/find-jobs">Browse Jobs</Link>
                  </Button>
                </div>
              </div>
            ) : (
              /* Guest / Unauthenticated View */
              <div className="relative z-10">
                <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">Ready to find your next opportunity?</h2>
                <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-lg">
                  Explore verified career opportunities and connect directly with hiring organizations.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button asChild size="lg" className="bg-gradient-to-r from-primary to-sky-600 hover:brightness-110 text-white rounded-full px-8 cursor-pointer shadow-sm hover:shadow-md transition-all h-11 md:h-10">
                    <Link href="/signup">Create Free Account</Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-border/80 bg-background/80 hover:bg-muted text-foreground rounded-full px-8 cursor-pointer h-11 md:h-10">
                    <Link href="/find-jobs">Browse Jobs</Link>
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