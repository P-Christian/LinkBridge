// src/modules/client/notifications/types.ts

export interface Notification {
  notification_id: number;
  user_id: number;
  event_id: number;
  category: string;
  title: string;
  message: string;
  action_url?: string | null;
  is_read: boolean;
  is_starred: boolean;
  created_at: string;
  // from vs_notification_event join
  event_type?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
}

export interface NotificationPreference {
  preference_id?: number;
  user_id: number;
  category: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  updated_at?: string | null;
}

export type NotificationChannel = "EMAIL" | "IN_APP";
export type NotificationDeliveryStatus = "SENT" | "FAILED" | "PENDING";

// Standardized Notification Category Constants
export const NOTIFICATION_CATEGORIES = {
  APPLICATION_RECEIVED: "APPLICATION_RECEIVED",
  APPLICATION_WITHDRAWN: "APPLICATION_WITHDRAWN",
  APPLICATION_STATUS_UPDATED: "APPLICATION_STATUS_UPDATED",
  INVITATION_RECEIVED: "INVITATION_RECEIVED",
  MESSAGE_RECEIVED: "MESSAGE_RECEIVED",
  UNREAD_MESSAGE_REMINDER: "UNREAD_MESSAGE_REMINDER",
  INTERVIEW_SCHEDULED: "INTERVIEW_SCHEDULED",
  INTERVIEW_RESCHEDULED: "INTERVIEW_RESCHEDULED",
  INTERVIEW_CANCELLED: "INTERVIEW_CANCELLED",
  INTERVIEW_REMINDER: "INTERVIEW_REMINDER",
  JOB_APPROVED: "JOB_APPROVED",
  JOB_REJECTED: "JOB_REJECTED",
  JOB_EXPIRED: "JOB_EXPIRED",
  MARKETING_UPDATES: "MARKETING_UPDATES",
  PRODUCT_UPDATES: "PRODUCT_UPDATES",
} as const;

// Category labels for display
export const NOTIFICATION_CATEGORY_LABELS: Record<string, string> = {
  // Applications
  APPLICATION_RECEIVED: "New application received",
  APPLICATION_WITHDRAWN: "Candidate withdrew application",
  APPLICATION_STATUS_UPDATED: "Application status updated",
  INVITATION_RECEIVED: "Received invitation from company",
  // Messages
  MESSAGE_RECEIVED: "New message received",
  UNREAD_MESSAGE_REMINDER: "Unread message reminder",
  // Interviews
  INTERVIEW_SCHEDULED: "Interview scheduled",
  INTERVIEW_RESCHEDULED: "Interview rescheduled",
  INTERVIEW_CANCELLED: "Interview cancelled",
  INTERVIEW_REMINDER: "Send interview reminder emails automatically",
  // Team Activity
  JOB_APPROVED: "Job posting approved",
  JOB_REJECTED: "Job posting rejected",
  JOB_EXPIRED: "Job posting expired",

  // Marketing & Updates
  MARKETING_UPDATES: "Promotional emails",
  PRODUCT_UPDATES: "Product announcements & feature releases",
  // Fallbacks / Existing
  JOB_APPLICATION: "Job Applications",
  INTERVIEW: "Interviews",
  JOB_POSTING: "Job Postings",
  SYSTEM: "System Alerts",
  COMPANY: "Company Updates",
};

// Icons mapped to categories (lucide icon names)
export const NOTIFICATION_CATEGORY_ICONS: Record<string, string> = {
  APPLICATION_RECEIVED: "FileText",
  APPLICATION_WITHDRAWN: "FileX",
  APPLICATION_STATUS_UPDATED: "RefreshCw",
  INVITATION_RECEIVED: "Send",
  MESSAGE_RECEIVED: "MessageSquare",
  UNREAD_MESSAGE_REMINDER: "Clock",
  INTERVIEW_SCHEDULED: "Calendar",
  INTERVIEW_RESCHEDULED: "CalendarClock",
  INTERVIEW_CANCELLED: "CalendarX",
  INTERVIEW_REMINDER: "Bell",
  JOB_APPROVED: "CheckCircle",
  JOB_REJECTED: "XCircle",
  JOB_EXPIRED: "AlertTriangle",

  MARKETING_UPDATES: "Sparkles",
  PRODUCT_UPDATES: "Zap",
  JOB_APPLICATION: "Users",
  INTERVIEW: "Calendar",
  JOB_POSTING: "Briefcase",
  SYSTEM: "Bell",
  COMPANY: "Building2",
};

export interface NotificationCategoryGroup {
  title: string;
  description: string;
  categories: {
    category: string;
    label: string;
    description?: string;
    defaultEmail: boolean;
    defaultInApp: boolean;
  }[];
}

export const NOTIFICATION_CATEGORIES_BY_GROUP: NotificationCategoryGroup[] = [
  {
    title: "Applications",
    description: "Notifications regarding job applications and candidate progress.",
    categories: [
      { category: "APPLICATION_RECEIVED", label: "New application received", defaultEmail: true, defaultInApp: true },
      { category: "APPLICATION_WITHDRAWN", label: "Candidate withdrew application", defaultEmail: true, defaultInApp: true },
      { category: "APPLICATION_STATUS_UPDATED", label: "Application status updated", defaultEmail: true, defaultInApp: true },
    ],
  },
  {
    title: "Messages",
    description: "Notifications for applicant communications and chat messages.",
    categories: [
      { category: "MESSAGE_RECEIVED", label: "New message received", defaultEmail: true, defaultInApp: true },
      { category: "UNREAD_MESSAGE_REMINDER", label: "Unread message reminder", defaultEmail: true, defaultInApp: true },
    ],
  },
  {
    title: "Interviews",
    description: "Notifications for scheduling and managing candidate interviews.",
    categories: [
      { category: "INTERVIEW_SCHEDULED", label: "Interview scheduled", defaultEmail: true, defaultInApp: true },
      { category: "INTERVIEW_RESCHEDULED", label: "Interview rescheduled", defaultEmail: true, defaultInApp: true },
      { category: "INTERVIEW_CANCELLED", label: "Interview cancelled", defaultEmail: true, defaultInApp: true },
      { category: "INTERVIEW_REMINDER", label: "Send interview reminder emails automatically", defaultEmail: true, defaultInApp: true },
    ],
  },
  {
    title: "Team Activity",
    description: "Updates on team member job posts and hiring actions.",
    categories: [
      { category: "JOB_APPROVED", label: "Job posting approved", defaultEmail: true, defaultInApp: true },
      { category: "JOB_REJECTED", label: "Job posting rejected", defaultEmail: true, defaultInApp: true },
      { category: "JOB_EXPIRED", label: "Job posting expired", defaultEmail: true, defaultInApp: true },
      { category: "TEAM_ACTIVITY", label: "Team member activity", defaultEmail: true, defaultInApp: true },
    ],
  },
  {
    title: "Marketing & Updates",
    description: "Product feature announcements and promotional emails.",
    categories: [
      { category: "PRODUCT_UPDATES", label: "Product announcements & feature releases", defaultEmail: false, defaultInApp: true },
      { category: "MARKETING_UPDATES", label: "Promotional emails", defaultEmail: false, defaultInApp: false },
    ],
  },
];
