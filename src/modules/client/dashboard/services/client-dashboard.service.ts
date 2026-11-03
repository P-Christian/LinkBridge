// src/modules/client/dashboard/services/client-dashboard.service.ts

import { CompanyInfo, DashboardData } from "../types";
import {
  DirectusError,
  directusItems,
  directusItemsWhereIn,
  directusSettled,
} from "@/lib/server/directus";

interface JobPostingRecord {
  job_id: number;
  job_title: string;
  job_department?: string;
  job_location: string;
  status: string;
  created_at?: string;
}

interface ApplicationRecord {
  application_id: number;
  job_id: number;
  user_id: number;
  application_status: string;
  applied_at?: string;
}

interface DirectusInterviewRecord {
  interview_id: number;
  company_id: number;
  scheduled_at: string;
  interview_format?: string;
  meeting_link?: string | null;
  interview_status: string;
  created_at?: string;
}

interface DirectusInterviewAppRecord {
  interview_id: number;
  application_id: number;
}

interface VsUser {
  user_id: number;
  user_fname: string;
  user_lname: string;
  user_email: string;
  user_position?: string | null;
  profile_image_url?: string | null;
}

interface DirectusProfile {
  user_id: number;
  profile_headline?: string | null;
}

function formatAvatarUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith("/api/client/assets/")) {
    return trimmed;
  }
  if (trimmed.startsWith("data:")) {
    return trimmed;
  }
  const assetsMatch = trimmed.match(/\/assets\/([^/?#]+)/u);
  if (assetsMatch?.[1]) {
    return `/api/client/assets/${assetsMatch[1]}`;
  }
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `/api/client/assets/${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}

// Helper to generate dynamic time-series bucketing from actual timestamps in PH Local Time
function generateChartData(
  applicants: ApplicationRecord[],
  shortlisted: ApplicationRecord[],
  interviews: DirectusInterviewRecord[],
  nowPh: Date
) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const parseDate = (dStr?: string) => {
    if (!dStr) return null;
    const d = new Date(dStr.replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  };

  // 1. Last 7 Days (day by day ending today)
  const last7d = [];
  for (let i = 6; i >= 0; i--) {
    const targetDate = new Date(nowPh);
    targetDate.setDate(targetDate.getDate() - i);
    const dateKey = targetDate.toDateString();
    const dayLabel = targetDate.toLocaleDateString("en-US", { weekday: "short" });

    const appsOnDay = applicants.filter((a) => {
      const d = parseDate(a.applied_at);
      return d && d.toDateString() === dateKey;
    }).length;

    const shortlistedOnDay = shortlisted.filter((a) => {
      const d = parseDate(a.applied_at);
      return d && d.toDateString() === dateKey;
    }).length;

    const interviewsOnDay = interviews.filter((iv) => {
      const d = parseDate(iv.scheduled_at);
      return d && d.toDateString() === dateKey;
    }).length;

    last7d.push({
      label: dayLabel,
      applications: appsOnDay,
      shortlisted: shortlistedOnDay,
      interviews: interviewsOnDay,
    });
  }

  // 2. Last 30 Days (4 consecutive 7-day weekly intervals)
  const last30d = [];
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(nowPh.getTime() - (w + 1) * 7 * 24 * 60 * 60 * 1000);
    const weekEnd = new Date(nowPh.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const weekLabel = `W${4 - w}`;

    const appsInWeek = applicants.filter((a) => {
      const d = parseDate(a.applied_at);
      return d && d >= weekStart && d < weekEnd;
    }).length;

    const shortlistedInWeek = shortlisted.filter((a) => {
      const d = parseDate(a.applied_at);
      return d && d >= weekStart && d < weekEnd;
    }).length;

    const interviewsInWeek = interviews.filter((iv) => {
      const d = parseDate(iv.scheduled_at);
      return d && d >= weekStart && d < weekEnd;
    }).length;

    last30d.push({
      label: weekLabel,
      applications: appsInWeek,
      shortlisted: shortlistedInWeek,
      interviews: interviewsInWeek,
    });
  }

  // 3. Last 3 Months
  const last3m = [];
  for (let m = 2; m >= 0; m--) {
    const targetMonth = new Date(nowPh.getFullYear(), nowPh.getMonth() - m, 1);
    const nextMonth = new Date(nowPh.getFullYear(), nowPh.getMonth() - m + 1, 1);
    const monthLabel = months[targetMonth.getMonth()];

    const appsInMonth = applicants.filter((a) => {
      const d = parseDate(a.applied_at);
      return d && d >= targetMonth && d < nextMonth;
    }).length;

    const shortlistedInMonth = shortlisted.filter((a) => {
      const d = parseDate(a.applied_at);
      return d && d >= targetMonth && d < nextMonth;
    }).length;

    const interviewsInMonth = interviews.filter((iv) => {
      const d = parseDate(iv.scheduled_at);
      return d && d >= targetMonth && d < nextMonth;
    }).length;

    last3m.push({
      label: monthLabel,
      applications: appsInMonth,
      shortlisted: shortlistedInMonth,
      interviews: interviewsInMonth,
    });
  }

  // 4. Last 6 Months
  const last6m = [];
  for (let m = 5; m >= 0; m--) {
    const targetMonth = new Date(nowPh.getFullYear(), nowPh.getMonth() - m, 1);
    const nextMonth = new Date(nowPh.getFullYear(), nowPh.getMonth() - m + 1, 1);
    const monthLabel = months[targetMonth.getMonth()];

    const appsInMonth = applicants.filter((a) => {
      const d = parseDate(a.applied_at);
      return d && d >= targetMonth && d < nextMonth;
    }).length;

    const shortlistedInMonth = shortlisted.filter((a) => {
      const d = parseDate(a.applied_at);
      return d && d >= targetMonth && d < nextMonth;
    }).length;

    const interviewsInMonth = interviews.filter((iv) => {
      const d = parseDate(iv.scheduled_at);
      return d && d >= targetMonth && d < nextMonth;
    }).length;

    last6m.push({
      label: monthLabel,
      applications: appsInMonth,
      shortlisted: shortlistedInMonth,
      interviews: interviewsInMonth,
    });
  }

  return {
    "7d": last7d,
    "30d": last30d,
    "3m": last3m,
    "6m": last6m,
  };
}

export async function getClientDashboardData(userId: number): Promise<DashboardData> {
  // 1. Resolve company associated with user
  const companyLinks = await directusItems<{ company_id: number }>("vs_company_user", {
    query: `filter[user_id][_eq]=${userId}&fields=company_id&limit=1`,
  });
  const companyId = companyLinks[0]?.company_id;

  if (!companyId) {
    return {
      onboardingRequired: true,
      message: "Complete your company profile to access dashboard metrics.",
    };
  }

  // 2. Fetch vs_company record
  const VS_COMPANY_FIELDS = [
    "company_id", "company_name", "company_code",
    "company_legal_name",
    "company_address", "company_brgy", "company_city", "company_province", "company_zipCode",
    "registration_no", "company_tin",
    "company_contact", "company_email",
    "company_logo", "company_cover",
    "company_website", "company_description",
    "verification_status", "rejection_reason",
    "profile_completion_percent", "is_public", "is_active",
    "created_at", "updated_at",
  ].join(",");
  const companyRes = await directusSettled<{ data?: CompanyInfo }>(
    `/items/vs_company/${companyId}`,
    { query: `fields=${VS_COMPANY_FIELDS}` }
  );
  if (!companyRes.ok) {
    if (companyRes.status === 404) {
      return {
        onboardingRequired: true,
        message: "Complete your company profile to access dashboard metrics.",
      };
    }
    throw new DirectusError(companyRes.status, companyRes.error);
  }
  const companyData = companyRes.data?.data;
  if (!companyData) {
    return {
      onboardingRequired: true,
      message: "Complete your company profile to access dashboard metrics.",
    };
  }

  // 3. Fetch vs_job_posting records
  const jobsQuery = "sort[]=-created_at&limit=-1&fields=*";
  let jobsList = await directusItems<JobPostingRecord>("vs_job_posting", {
    query: `filter[company_id][_eq]=${companyId}&${jobsQuery}`,
  });

  if (jobsList.length === 0) {
    // Fallback: check if jobs were saved under created_by_user_id
    jobsList = await directusItems<JobPostingRecord>("vs_job_posting", {
      query: `filter[created_by_user_id][_eq]=${userId}&${jobsQuery}`,
    });
  }

  const jobIds: number[] = jobsList.map((j) => j.job_id);

  // 4. Fetch vs_job_application records
  let applicantsList = await directusItemsWhereIn<ApplicationRecord>(
    "vs_job_application",
    "job_id",
    jobIds,
    "application_id,job_id,user_id,application_status,applied_at",
    { extra: "sort[]=-applied_at" }
  );

  // 5. Fetch interviews
  const interviewsList = await directusItems<DirectusInterviewRecord>("vs_interview", {
    query: `filter[company_id][_eq]=${companyId}&sort[]=scheduled_at&limit=-1&fields=*`,
  });

  // Fetch interview application links if there are interviews
  const interviewIds = interviewsList.map((i) => i.interview_id);
  const interviewAppsMap: Record<number, number> = {}; // interview_id -> application_id
  const allInterviewAppIds: number[] = [];
  const interviewAppRows = await directusItemsWhereIn<DirectusInterviewAppRecord>(
    "vs_interview_application",
    "interview_id",
    interviewIds,
    "interview_id,application_id"
  );
  interviewAppRows.forEach((r) => {
    interviewAppsMap[r.interview_id] = r.application_id;
    if (r.application_id) allInterviewAppIds.push(r.application_id);
  });

  // Ensure all application records linked to interviews are present in applicantsList
  const missingAppIds = allInterviewAppIds.filter((appId) => !applicantsList.some((a) => a.application_id === appId));
  if (missingAppIds.length > 0) {
    const extraApps = await directusItemsWhereIn<ApplicationRecord>(
      "vs_job_application",
      "application_id",
      missingAppIds,
      "application_id,job_id,user_id,application_status,applied_at"
    );
    applicantsList = [...applicantsList, ...extraApps];
  }

  // Each batch arrives newest-first, so the flattened list is grouped by job
  // rather than ordered by date. The order is what "Recent applicants" shows.
  applicantsList.sort((a, b) =>
    String(b.applied_at ?? "").localeCompare(String(a.applied_at ?? ""))
  );

  // Current local time
  const now = new Date();
  const nowMs = now.getTime();

  const parseScheduledDate = (scheduledAt?: string): Date => {
    if (!scheduledAt) return new Date(0);
    return new Date(scheduledAt.replace(" ", "T"));
  };

  const isActiveStatus = (st?: string) => {
    if (!st) return false;
    const s = st.toUpperCase();
    return s === "ACTIVE" || s === "PUBLISHED" || s === "OPEN";
  };

  const SCHEDULED_STATUSES = new Set(["SCHEDULED", "CONFIRMED", "RESCHEDULED"]);

  // 6. Compute Stats & Deltas
  const activeJobs = jobsList.filter((j) => isActiveStatus(j.status)).length;
  const totalJobs = jobsList.length;
  const totalApplicants = applicantsList.length;
  const shortlistedApplicants = applicantsList.filter((a) => a.application_status === "SHORTLISTED");
  const shortlistedCount = shortlistedApplicants.length;
  const hiredCount = applicantsList.filter((a) => a.application_status === "HIRED").length;
  const unreviewedApplicants = applicantsList.filter((a) => a.application_status === "APPLIED");

  // Strictly FUTURE interviews: scheduled_at >= nowMs AND status in SCHEDULED/CONFIRMED/RESCHEDULED
  const upcomingInterviews = interviewsList
    .filter((i) => {
      if (!SCHEDULED_STATUSES.has((i.interview_status || "").toUpperCase())) return false;
      const d = parseScheduledDate(i.scheduled_at);
      return !isNaN(d.getTime()) && d.getTime() >= nowMs;
    })
    .sort((a, b) => parseScheduledDate(a.scheduled_at).getTime() - parseScheduledDate(b.scheduled_at).getTime());

  const upcomingInterviewsCount = upcomingInterviews.length;

  // Past unresolved interviews: scheduled_at < nowMs AND status was never marked COMPLETED/CANCELLED/NO_SHOW
  const pastUnresolvedInterviews = interviewsList
    .filter((i) => {
      if (!SCHEDULED_STATUSES.has((i.interview_status || "").toUpperCase())) return false;
      const d = parseScheduledDate(i.scheduled_at);
      return !isNaN(d.getTime()) && d.getTime() < nowMs;
    })
    .sort((a, b) => parseScheduledDate(b.scheduled_at).getTime() - parseScheduledDate(a.scheduled_at).getTime());

  // Delta calculation for active jobs (e.g. posted this month)
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const jobsCreatedThisMonth = jobsList.filter((j) => j.created_at && new Date(j.created_at) >= oneMonthAgo).length;
  const shortlistedThisWeek = shortlistedApplicants.filter((a) => a.applied_at && new Date(a.applied_at) >= oneWeekAgo).length;

  // Next interview summary text for KPI card
  let nextInterviewSummary = "No upcoming interviews";
  if (upcomingInterviews.length > 0) {
    const nextInterview = upcomingInterviews[0];
    try {
      const schedDate = parseScheduledDate(nextInterview.scheduled_at);
      const isToday = schedDate.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = schedDate.toDateString() === tomorrow.toDateString();

      const timeStr = schedDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      if (isToday) {
        nextInterviewSummary = `Today · ${timeStr}`;
      } else if (isTomorrow) {
        nextInterviewSummary = `Tomorrow · ${timeStr}`;
      } else {
        nextInterviewSummary = `Next: ${schedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${timeStr}`;
      }
    } catch {
      nextInterviewSummary = "Next: Upcoming";
    }
  }

  // Dynamic month-over-month applicant growth calculation
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
  const applicantsThisMonth = applicantsList.filter(
    (a) => a.applied_at && new Date(a.applied_at.replace(" ", "T")) >= oneMonthAgo
  ).length;
  const applicantsPrevMonth = applicantsList.filter((a) => {
    if (!a.applied_at) return false;
    const d = new Date(a.applied_at.replace(" ", "T"));
    return d >= twoMonthsAgo && d < oneMonthAgo;
  }).length;

  let applicantsGrowthPercent: number | undefined = undefined;
  if (applicantsPrevMonth > 0) {
    applicantsGrowthPercent = Math.round(((applicantsThisMonth - applicantsPrevMonth) / applicantsPrevMonth) * 100);
  }
  // A zero baseline has no percentage. Reporting +100% here would put a growth
  // badge on the dashboard for a change that never happened.

  // 7. Time-series aggregation for Hiring Overview chart (7d, 30d, 3m, 6m)
  const chartData = generateChartData(applicantsList, shortlistedApplicants, upcomingInterviews, now);

  // 8. Job Performance List — Sorted by applicant count, then created_at, limited to top 10
  const appCountByJob: Record<number, number> = {};
  for (const app of applicantsList) {
    appCountByJob[app.job_id] = (appCountByJob[app.job_id] || 0) + 1;
  }

  const sortedJobsList = [...jobsList]
    .sort((a, b) => {
      const aApps = appCountByJob[a.job_id] || 0;
      const bApps = appCountByJob[b.job_id] || 0;
      if (aApps !== bApps) return bApps - aApps;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    })
    .slice(0, 10);

  const jobPerformance = sortedJobsList.map((j) => {
    const jobApps = applicantsList.filter((a) => a.job_id === j.job_id);
    const jobShortlisted = jobApps.filter((a) => a.application_status === "SHORTLISTED");
    return {
      id: j.job_id,
      job_id: j.job_id,
      title: j.job_title || "Untitled Job",
      job_title: j.job_title || "Untitled Job",
      department: j.job_department || "General",
      job_department: j.job_department || "General",
      location: j.job_location || "",
      job_location: j.job_location || "",
      applicantsCount: jobApps.length,
      applicants_count: jobApps.length,
      shortlistedCount: jobShortlisted.length,
      status: (j.status as "ACTIVE" | "DRAFT" | "CLOSED" | "PAUSED") || "ACTIVE",
      postedAt: j.created_at || new Date().toISOString(),
      created_at: j.created_at || new Date().toISOString(),
    };
  });

  // 9. Enrich Users & Candidates (Top Recent Applicants + All Interview Attendees)
  const topRecentApps = applicantsList.slice(0, 5);
  const interviewUserIds = allInterviewAppIds
    .map((appId) => applicantsList.find((a) => a.application_id === appId)?.user_id)
    .filter((uid): uid is number => Boolean(uid));

  const userIds = [...new Set([...topRecentApps.map((a) => a.user_id), ...interviewUserIds].filter(Boolean))];
  const usersMap: Record<number, VsUser> = {};
  const profilesMap: Record<number, { headline?: string; completion: number }> = {};

  if (userIds.length > 0) {
    // A failed candidate read used to fall through to the placeholder branch, so
    // every row on "Recent applicants" and the interview widget rendered as an
    // anonymous "Candidate" with no headline and a 0% match.
    const [usersList, profilesList] = await Promise.all([
      directusItemsWhereIn<VsUser & { profile_completion_percent?: number }>(
        "vs_user",
        "user_id",
        userIds,
        "user_id,user_fname,user_lname,user_email,user_position,profile_image_url,profile_completion_percent"
      ),
      directusItemsWhereIn<DirectusProfile & { profile_completion_percent?: number }>(
        "vs_job_seeker_profile",
        "user_id",
        userIds,
        "user_id,profile_headline,profile_completion_percent"
      ),
    ]);

    usersList.forEach((u) => {
      usersMap[u.user_id] = u;
      if (u.profile_completion_percent) {
        profilesMap[u.user_id] = { completion: u.profile_completion_percent };
      }
    });
    profilesList.forEach((p) => {
      profilesMap[p.user_id] = {
        headline: p.profile_headline || profilesMap[p.user_id]?.headline,
        completion: p.profile_completion_percent ?? profilesMap[p.user_id]?.completion ?? 0,
      };
    });
  }

  const formattedRecentApplicants = topRecentApps.map((a) => {
    const u = usersMap[a.user_id];
    const name = u ? `${u.user_fname} ${u.user_lname}`.trim() : "Candidate";
    const profileInfo = profilesMap[a.user_id];
    const headline = profileInfo?.headline ?? u?.user_position ?? "Candidate Profile";
    const job = jobsList.find((j) => j.job_id === a.job_id);
    const matchScore = profileInfo?.completion && profileInfo.completion > 0 ? profileInfo.completion : 0;

    return {
      id: a.application_id,
      name,
      jobTitle: job?.job_title || "Open Position",
      email: u?.user_email || "",
      experience: headline,
      status: (a.application_status as "APPLIED" | "SHORTLISTED" | "INTERVIEWING" | "HIRED" | "REJECTED") || "APPLIED",
      appliedDate: a.applied_at || new Date().toISOString(),
      avatarUrl: formatAvatarUrl(u?.profile_image_url),
      matchScore,
    };
  });

  // 10. Format Upcoming Interviews Widget items (ONLY FUTURE INTERVIEWS)
  const formattedInterviews = upcomingInterviews.slice(0, 15).map((i) => {
    const appId = interviewAppsMap[i.interview_id];
    const app = applicantsList.find((a) => a.application_id === appId);
    const u = app ? usersMap[app.user_id] : null;
    const job = app ? jobsList.find((j) => j.job_id === app.job_id) : null;

    let displayDateGroup: "Today" | "Tomorrow" | "Upcoming" = "Upcoming";
    let dateLabel = "Upcoming";
    let dateKey = "";
    let displayTime = "TBD";

    try {
      const d = parseScheduledDate(i.scheduled_at);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dateKey = `${yyyy}-${mm}-${dd}`;

      const isToday = d.toDateString() === now.toDateString();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = d.toDateString() === tomorrow.toDateString();

      const monthName = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const weekday = d.toLocaleDateString("en-US", { weekday: "short" });

      if (isToday) {
        displayDateGroup = "Today";
        dateLabel = `Today · ${monthName}`;
      } else if (isTomorrow) {
        displayDateGroup = "Tomorrow";
        dateLabel = `Tomorrow · ${monthName}`;
      } else {
        displayDateGroup = "Upcoming";
        dateLabel = `${weekday}, ${monthName}`;
      }

      displayTime = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    } catch {
      displayTime = i.scheduled_at;
      dateKey = (i.scheduled_at || "").split("T")[0] || (i.scheduled_at || "").split(" ")[0];
      dateLabel = dateKey;
    }

    return {
      id: i.interview_id,
      candidateName: u ? `${u.user_fname} ${u.user_lname}`.trim() : "Candidate",
      candidateAvatar: formatAvatarUrl(u?.profile_image_url),
      jobTitle: job?.job_title || "Interview Session",
      scheduledAt: i.scheduled_at,
      displayDateGroup,
      dateLabel,
      dateKey,
      displayTime,
      format: ((i.interview_format || "ONLINE").toUpperCase() as "ONLINE" | "IN_PERSON" | "PHONE"),
      meetingLink: i.meeting_link,
      status: i.interview_status,
    };
  });

  // 11. Compute Action Required Items
  const isVerified = companyData.verification_status === "VERIFIED";
  const actionsRequired = [];

  // Past unresolved interviews (Awaiting Outcome)
  if (pastUnresolvedInterviews.length > 0) {
    const sampleDescriptions = pastUnresolvedInterviews.slice(0, 2).map((iv) => {
      const appId = interviewAppsMap[iv.interview_id];
      const app = applicantsList.find((a) => a.application_id === appId);
      const u = app ? usersMap[app.user_id] : null;
      const candidateName = u ? `${u.user_fname} ${u.user_lname}`.trim() : "Candidate";
      let dateStr = "";
      try {
        dateStr = parseScheduledDate(iv.scheduled_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      } catch {
        dateStr = "Past date";
      }
      return `${dateStr} · ${candidateName}`;
    }).join(", ");

    actionsRequired.push({
      id: "awaiting_interview_outcomes",
      type: "interview_outcome_pending" as const,
      title: pastUnresolvedInterviews.length === 1
        ? "1 interview outcome pending"
        : `${pastUnresolvedInterviews.length} interviews need an outcome`,
      description: sampleDescriptions ? `Requires completion or attendance status: ${sampleDescriptions}` : "Interview time has passed without recorded outcome",
      count: pastUnresolvedInterviews.length,
      severity: "urgent" as const,
      actionLabel: "Mark Outcome",
      actionUrl: "/vos-sync/client/interviews?tab=awaiting_outcome",
      dismissible: false,
    });
  }

  if (unreviewedApplicants.length > 0) {
    const topJob = jobsList.find((j) => j.job_id === unreviewedApplicants[0].job_id);
    actionsRequired.push({
      id: "unreviewed_apps",
      type: "unreviewed_applicants" as const,
      title: `${unreviewedApplicants.length} new applicant${unreviewedApplicants.length > 1 ? "s" : ""} need review`,
      description: topJob?.job_title ? `Highest volume in: ${topJob.job_title}` : "Awaiting initial screening",
      count: unreviewedApplicants.length,
      severity: "urgent" as const,
      actionLabel: "Review Applicants",
      actionUrl: "/vos-sync/client/applicants?status=APPLIED",
      dismissible: false,
    });
  }

  if (!isVerified) {
    actionsRequired.push({
      id: "profile_pending",
      type: "profile_verification" as const,
      title: "Company profile verification pending",
      description: "Submit complete documentation to unlock all hiring features",
      severity: "urgent" as const,
      actionLabel: "Complete Profile",
      actionUrl: "/vos-sync/client/company-profile",
      dismissible: false,
    });
  }

  return {
    company: companyData,
    stats: {
      totalJobs,
      activeJobs,
      activeJobsDelta: jobsCreatedThisMonth > 0 ? `↑ ${jobsCreatedThisMonth} this month` : "Steady",
      totalApplicants,
      applicantsGrowthPercent,
      shortlistedCount,
      shortlistedWeeklyGrowth: shortlistedThisWeek > 0 ? `↑ ${shortlistedThisWeek} this week` : "Steady",
      upcomingInterviewsCount,
      nextInterviewSummary,
      hiredCount,
    },
    chartData,
    jobPerformance,
    recentJobs: jobPerformance,
    recentApplicants: formattedRecentApplicants,
    upcomingInterviews: formattedInterviews,
    actionsRequired,
  };
}
