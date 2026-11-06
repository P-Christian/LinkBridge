import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Users,
  Calendar,
  FileText,
  PlusCircle,
  LayoutDashboard,
  Building,
  Settings,
  Search,
  GraduationCap,
  MessageSquare,
  UserCircle,
  Bell,
  ShieldCheck,
  Workflow,
  School,
} from "lucide-react";

export type Portal = "client" | "freelancer" | "school-admin" | "admin";
export type EntityType = "freelancer" | "client" | "school-admin";

export interface SearchLink {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon */
  iconClass?: string;
  /** Small right-aligned hint, e.g. "G then D" */
  hint?: string;
  /** Extra words so cmdk can match on them */
  keywords?: string;
}

export interface PortalSearchConfig {
  barPlaceholder: string;
  inputPlaceholder: string;
  emptyText: string;
  quickActions: SearchLink[];
  pagesHeading: string;
  pages: SearchLink[];
  peopleHeading: string;
  /** Which entity types show up when the user types a name */
  peopleEntityTypes: EntityType[];
  /** Live data groups (need the matching API routes) */
  liveJobs: boolean;
  liveApplicants: boolean;
  /** Log a profile view when opening a freelancer profile */
  logProfileViews: boolean;
}

/**
 * NOTE: only the /linkbridge/client/* routes below are copied from your existing code.
 * Every route marked TODO(verify) is a guess — fix it to match your real routes.
 */
export const PORTAL_SEARCH_CONFIG: Record<Portal, PortalSearchConfig> = {
  client: {
    barPlaceholder: "Search candidates, jobs, or quick actions...",
    inputPlaceholder: "Type a candidate name, job title, or command...",
    emptyText: "No matching candidates, jobs, or pages found.",
    peopleHeading: "Talent Pool",
    peopleEntityTypes: ["freelancer"],
    liveJobs: true,
    liveApplicants: true,
    logProfileViews: true,
    quickActions: [
      {
        label: "Post a job",
        href: "/linkbridge/client/jobs",
        icon: PlusCircle,
        iconClass: "text-primary",
        hint: "Create new listing",
        keywords: "create new listing hiring",
      },
      {
        label: "Schedule interview",
        href: "/linkbridge/client/interviews",
        icon: Calendar,
        iconClass: "text-blue-500",
        hint: "Book candidate session",
        keywords: "book candidate session",
      },
    ],
    pagesHeading: "Client Portal Pages",
    pages: [
      { label: "Dashboard", href: "/linkbridge/client/dashboard", icon: LayoutDashboard, iconClass: "text-primary", hint: "G then D" },
      { label: "Manage Jobs", href: "/linkbridge/client/jobs", icon: Briefcase, iconClass: "text-blue-500", hint: "G then J" },
      { label: "Review All Applicants", href: "/linkbridge/client/applicants", icon: FileText, iconClass: "text-amber-500", keywords: "pipeline candidates" },
      { label: "Shortlisted Candidates", href: "/linkbridge/client/applicants?status=SHORTLISTED", icon: Users, iconClass: "text-emerald-500" },
      { label: "Talent Search Directory", href: "/linkbridge/client/talent-search", icon: Search, iconClass: "text-indigo-500" },
      { label: "Interview Calendar", href: "/linkbridge/client/interviews", icon: Calendar, iconClass: "text-muted-foreground", keywords: "schedule" },
      { label: "ATS Pipeline", href: "/linkbridge/client/ats-pipeline", icon: Workflow, iconClass: "text-muted-foreground", keywords: "stages configuration" },
      { label: "Company Profile", href: "/linkbridge/client/company-profile", icon: Building, iconClass: "text-muted-foreground" },
      { label: "Configuration & Team", href: "/linkbridge/client/settings", icon: Settings, iconClass: "text-muted-foreground", keywords: "team settings" },
    ],
  },

  freelancer: {
    barPlaceholder: "Search companies, schools, or quick actions...",
    inputPlaceholder: "Type a company, school, or command...",
    emptyText: "No matching profiles or pages found.",
    peopleHeading: "Companies & Schools",
    peopleEntityTypes: ["client", "school-admin"],
    liveJobs: false,
    liveApplicants: false,
    logProfileViews: false,
    quickActions: [
      // TODO(verify) all freelancer routes
      { label: "Browse jobs", href: "/linkbridge/freelancer/jobs", icon: Briefcase, iconClass: "text-blue-500", hint: "Find work", keywords: "find opportunities" },
      { label: "My applications", href: "/linkbridge/freelancer/applications", icon: FileText, iconClass: "text-amber-500", hint: "Track status" },
    ],
    pagesHeading: "Freelancer Pages",
    pages: [
      { label: "Dashboard", href: "/linkbridge/freelancer/dashboard", icon: LayoutDashboard, iconClass: "text-primary" },
      { label: "My Profile", href: "/linkbridge/freelancer/profile", icon: UserCircle, iconClass: "text-muted-foreground", keywords: "resume portfolio" },
      { label: "Interviews", href: "/linkbridge/freelancer/interviews", icon: Calendar, iconClass: "text-muted-foreground" },
      { label: "Messages", href: "/linkbridge/freelancer/messages", icon: MessageSquare, iconClass: "text-muted-foreground" },
      { label: "Notifications", href: "/linkbridge/freelancer/notifications", icon: Bell, iconClass: "text-muted-foreground" },
      { label: "Settings", href: "/linkbridge/freelancer/settings", icon: Settings, iconClass: "text-muted-foreground" },
    ],
  },

  "school-admin": {
    barPlaceholder: "Search students, companies, or quick actions...",
    inputPlaceholder: "Type a student, company, or command...",
    emptyText: "No matching students, companies, or pages found.",
    peopleHeading: "Students & Companies",
    peopleEntityTypes: ["freelancer", "client"],
    liveJobs: false,
    liveApplicants: false,
    logProfileViews: false,
    quickActions: [
      // TODO(verify) all school-admin routes
      { label: "View students", href: "/linkbridge/school-admin/students", icon: GraduationCap, iconClass: "text-emerald-500", hint: "Manage roster" },
      { label: "Partner companies", href: "/linkbridge/school-admin/partners", icon: Building, iconClass: "text-violet-500", hint: "Hiring partners" },
    ],
    pagesHeading: "School Portal Pages",
    pages: [
      { label: "Dashboard", href: "/linkbridge/school-admin/dashboard", icon: LayoutDashboard, iconClass: "text-primary" },
      { label: "School Profile", href: "/linkbridge/school-admin/school-profile", icon: School, iconClass: "text-muted-foreground" },
      { label: "Students", href: "/linkbridge/school-admin/students", icon: Users, iconClass: "text-emerald-500" },
      { label: "Messages", href: "/linkbridge/school-admin/messages", icon: MessageSquare, iconClass: "text-muted-foreground" },
      { label: "Notifications", href: "/linkbridge/school-admin/notifications", icon: Bell, iconClass: "text-muted-foreground" },
      { label: "Settings", href: "/linkbridge/school-admin/settings", icon: Settings, iconClass: "text-muted-foreground" },
    ],
  },

  admin: {
    barPlaceholder: "Search any user, company, school, or page...",
    inputPlaceholder: "Type a name, email, or command...",
    emptyText: "No matching accounts or pages found.",
    peopleHeading: "Accounts",
    peopleEntityTypes: ["freelancer", "client", "school-admin"],
    liveJobs: false,
    liveApplicants: false,
    logProfileViews: false,
    quickActions: [
      // TODO(verify) all admin routes
      { label: "Review verifications", href: "/linkbridge/admin/verifications", icon: ShieldCheck, iconClass: "text-emerald-500", hint: "Pending accounts" },
    ],
    pagesHeading: "Admin Pages",
    pages: [
      { label: "Dashboard", href: "/linkbridge/admin/dashboard", icon: LayoutDashboard, iconClass: "text-primary" },
      { label: "Users", href: "/linkbridge/admin/users", icon: Users, iconClass: "text-blue-500" },
      { label: "Companies", href: "/linkbridge/admin/companies", icon: Building, iconClass: "text-violet-500" },
      { label: "Schools", href: "/linkbridge/admin/schools", icon: GraduationCap, iconClass: "text-emerald-500" },
      { label: "Settings", href: "/linkbridge/admin/settings", icon: Settings, iconClass: "text-muted-foreground" },
    ],
  },
};

/**
 * Work out which portal we're in. Public profile pages live outside any portal
 * (/linkbridge/public/...) and carry ?portal=... so the sidebar stays consistent;
 * we honour that too.
 */
export function resolvePortal(pathname?: string | null, portalParam?: string | null): Portal {
  const p = pathname ?? "";
  if (p.startsWith("/linkbridge/client")) return "client";
  if (p.startsWith("/linkbridge/school-admin")) return "school-admin";
  if (p.startsWith("/linkbridge/admin")) return "admin";
  if (p.startsWith("/linkbridge/freelancer")) return "freelancer";

  if (portalParam === "client" || portalParam === "school-admin" || portalParam === "admin" || portalParam === "freelancer") {
    return portalParam;
  }
  return "freelancer";
}

export function publicProfileHref(portal: Portal, entityType: EntityType, userId: number): string {
  return `/linkbridge/public/${entityType}/${userId}?portal=${portal}`;
}
