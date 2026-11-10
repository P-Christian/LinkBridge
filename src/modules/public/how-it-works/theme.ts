// src/modules/public/how-it-works/theme.ts
import { User, Building2, GraduationCap, type LucideIcon } from "lucide-react";
import type { RoleKey } from "./types";

interface RoleTheme {
  icon: LucideIcon;
  text: string; // icon / accent text
  badge: string; // pill used above the heading
  tabActive: string; // selected segmented-control item
  cardIdle: string;
  cardActive: string;
  panel: string; // illustration background
}

// Full class strings on purpose: Tailwind can only see static class names.
export const ROLE_THEME: Record<RoleKey, RoleTheme> = {
  employee: {
    icon: User,
    text: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800",
    tabActive: "bg-blue-600 text-white shadow-md",
    cardIdle: "hover:border-blue-500/50 hover:bg-blue-50/30 dark:hover:bg-blue-950/20",
    cardActive: "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-md",
    panel: "from-blue-50/80 to-indigo-100/50 border-blue-200 dark:from-blue-950/20 dark:to-indigo-900/20 dark:border-blue-800",
  },
  employer: {
    icon: Building2,
    text: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
    tabActive: "bg-emerald-600 text-white shadow-md",
    cardIdle: "hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20",
    cardActive: "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-md",
    panel: "from-emerald-50/80 to-teal-100/50 border-emerald-200 dark:from-emerald-950/20 dark:to-teal-900/20 dark:border-emerald-800",
  },
  school: {
    icon: GraduationCap,
    text: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800",
    tabActive: "bg-amber-600 text-white shadow-md",
    cardIdle: "hover:border-amber-500/50 hover:bg-amber-50/30 dark:hover:bg-amber-950/20",
    cardActive: "border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 shadow-md",
    panel: "from-amber-50/80 to-orange-100/50 border-amber-200 dark:from-amber-950/20 dark:to-orange-900/20 dark:border-amber-800",
  },
};
