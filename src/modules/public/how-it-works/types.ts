// src/modules/public/how-it-works/types.ts

export const ROLE_KEYS = ["employee", "employer", "school"] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

export const isRoleKey = (value: unknown): value is RoleKey =>
  ROLE_KEYS.includes(value as RoleKey);

/**
 * "register" actions go through role-aware navigation (they can be blocked
 * when the visitor is signed in under a different role).
 * "link" actions are plain public links.
 */
export interface StepAction {
  kind: "register" | "link";
  label: string;
  route: string;
}

export interface StepItem {
  title: string;
  statusChip: string;
  estimatedTime: string; // plain text, the UI renders the clock icon
  description: string;
  outcome: string;
  requirements: string[];
  /** File name (no extension) under /illustrations/how-it-works/<role>/ */
  illustration: string;
  illustrationAlt: string;
  action?: StepAction;
}

export interface RoleGuide {
  roleKey: RoleKey;
  tabLabel: string; // "Employee / Job seeker"
  shortLabel: string; // "Employee"
  accountLabel: string; // "an Employee" (used in sentences)
  accountRoles: string[]; // backend roles that map to this guide
  badgeText: string;
  heading: string;
  introduction: string;
  totalOnboardingTime: string;
  summary: string;
  register: StepAction; // single source for sign-up label + route
  steps: StepItem[];
  finalCta: {
    title: string;
    subtitle: string;
    secondary?: StepAction;
  };
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: RoleKey | "general";
}