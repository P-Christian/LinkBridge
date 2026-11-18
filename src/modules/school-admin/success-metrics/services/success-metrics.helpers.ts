// src/modules/school-admin/success-metrics/services/success-metrics.helpers.ts
import {
  CoursePlacementStat,
  DegreeType,
  FunnelStageStat,
  MetricKpiData,
  SalaryDistributionTier,
  TopHiringCompanyStat,
} from '../types/success-metrics.types';

export function calculateKpis(
  students: Record<string, unknown>[],
  applications: Record<string, unknown>[],
  courseStats: CoursePlacementStat[]
): MetricKpiData {
  const totalStudents = students.length;
  const registeredStudents = students.filter((s) => s.registered_user_id !== null && s.registered_user_id !== undefined).length;
  const totalApplications = applications.length;

  const hiredUserIds = new Set<number>();
  const activePipelineUserIds = new Set<number>();

  let totalTimeToHireDays = 0;
  let hiredTimeCount = 0;

  applications.forEach((app) => {
    const userId = Number(app.user_id);
    const status = String(app.application_status || '').toUpperCase();

    if (status === 'HIRED') {
      hiredUserIds.add(userId);

      // Compute time to hire if timestamps available
      const appliedAt = app.applied_at ? new Date(String(app.applied_at)).getTime() : null;
      const statusUpdatedAt = app.status_updated_at ? new Date(String(app.status_updated_at)).getTime() : null;
      if (appliedAt && statusUpdatedAt && statusUpdatedAt >= appliedAt) {
        const diffDays = Math.max(1, Math.round((statusUpdatedAt - appliedAt) / (1000 * 60 * 60 * 24)));
        totalTimeToHireDays += diffDays;
        hiredTimeCount++;
      }
    } else if (status === 'UNDER_REVIEW' || status === 'SHORTLISTED' || status === 'INTERVIEWING') {
      if (!hiredUserIds.has(userId)) {
        activePipelineUserIds.add(userId);
      }
    }
  });

  const hiredCount = hiredUserIds.size;
  const placementRate = registeredStudents > 0 ? Number(((hiredCount / registeredStudents) * 100).toFixed(1)) : 0;

  const activePipelineCount = activePipelineUserIds.size;
  const activePipelineRate = registeredStudents > 0 ? Number(((activePipelineCount / registeredStudents) * 100).toFixed(1)) : 0;

  const avgTimeToHireDays = hiredTimeCount > 0 ? Math.round(totalTimeToHireDays / hiredTimeCount) : 0;

  // Identify top performing course
  let topPerformingCourse: string | null = null;
  let highestPlacementRate = -1;
  courseStats.forEach((c) => {
    if (c.registeredStudents >= 1 && c.placementRate > highestPlacementRate) {
      highestPlacementRate = c.placementRate;
      if (c.courseCode && c.courseCode.trim()) {
        topPerformingCourse = c.courseCode.trim();
      } else {
        // Generate clean acronym from course name (e.g., "Bachelor of Science in Information Technology" -> "BSIT")
        const words = c.courseName.replace(/[^a-zA-Z\s]/g, '').split(/\s+/).filter(Boolean);
        if (words.length > 1) {
          const ignore = new Set(['of', 'in', 'and', '&', 'the', 'for', 'to']);
          const acronym = words
            .filter((w) => !ignore.has(w.toLowerCase()))
            .map((w) => w[0].toUpperCase())
            .join('');
          topPerformingCourse = acronym || c.courseName;
        } else {
          topPerformingCourse = c.courseName;
        }
      }
    }
  });

  return {
    totalStudents,
    registeredStudents,
    totalApplications,
    hiredCount,
    placementRate,
    activePipelineCount,
    activePipelineRate,
    avgTimeToHireDays,
    topPerformingCourse,
  };
}

export function buildCoursePlacementStats(
  courses: Record<string, unknown>[],
  students: Record<string, unknown>[],
  applications: Record<string, unknown>[]
): CoursePlacementStat[] {
  // Map of registered_user_id -> highest status
  const userHiredMap = new Set<number>();
  const userActiveMap = new Set<number>();

  applications.forEach((app) => {
    const userId = Number(app.user_id);
    const status = String(app.application_status || '').toUpperCase();
    if (status === 'HIRED') {
      userHiredMap.add(userId);
    } else if (status === 'UNDER_REVIEW' || status === 'SHORTLISTED' || status === 'INTERVIEWING') {
      userActiveMap.add(userId);
    }
  });

  const courseMap = new Map<number, CoursePlacementStat>();

  courses.forEach((c) => {
    const courseId = Number(c.school_course_id);
    courseMap.set(courseId, {
      courseId,
      courseName: String(c.course_name || 'Unnamed Course'),
      courseCode: c.course_code ? String(c.course_code) : null,
      degree: (c.degree as DegreeType) || null,
      totalStudents: 0,
      registeredStudents: 0,
      hiredCount: 0,
      placementRate: 0,
      activePipelineCount: 0,
    });
  });

  students.forEach((s) => {
    const courseId = s.school_course_id ? Number(s.school_course_id) : 0;
    let stat = courseMap.get(courseId);
    if (!stat) {
      stat = {
        courseId,
        courseName: 'General / Unassigned',
        courseCode: null,
        degree: null,
        totalStudents: 0,
        registeredStudents: 0,
        hiredCount: 0,
        placementRate: 0,
        activePipelineCount: 0,
      };
      courseMap.set(courseId, stat);
    }

    stat.totalStudents++;
    if (s.registered_user_id) {
      stat.registeredStudents++;
      const regId = Number(s.registered_user_id);
      if (userHiredMap.has(regId)) {
        stat.hiredCount++;
      } else if (userActiveMap.has(regId)) {
        stat.activePipelineCount++;
      }
    }
  });

  const results: CoursePlacementStat[] = [];
  courseMap.forEach((stat) => {
    stat.placementRate = stat.registeredStudents > 0 ? Number(((stat.hiredCount / stat.registeredStudents) * 100).toFixed(1)) : 0;
    if (stat.totalStudents > 0 || stat.registeredStudents > 0) {
      results.push(stat);
    }
  });

  return results.sort((a, b) => b.placementRate - a.placementRate);
}

export function buildFunnelStageStats(applications: Record<string, unknown>[]): FunnelStageStat[] {
  const total = applications.length;

  const counts: Record<string, number> = {
    APPLIED: 0,
    UNDER_REVIEW: 0,
    SHORTLISTED: 0,
    INTERVIEWING: 0,
    HIRED: 0,
  };

  applications.forEach((app) => {
    const status = String(app.application_status || '').toUpperCase();
    if (status in counts) {
      counts[status]++;
    }
  });

  // Cumulative funnel stages
  const appliedCount = total;
  const underReviewCount = counts.UNDER_REVIEW + counts.SHORTLISTED + counts.INTERVIEWING + counts.HIRED;
  const interviewingCount = counts.SHORTLISTED + counts.INTERVIEWING + counts.HIRED;
  const hiredCount = counts.HIRED;

  const stages: { stage: FunnelStageStat['stage']; label: string; count: number }[] = [
    { stage: 'APPLIED', label: 'Applications', count: appliedCount },
    { stage: 'UNDER_REVIEW', label: 'Reached review', count: underReviewCount },
    { stage: 'INTERVIEWING', label: 'Reached interview', count: interviewingCount },
    { stage: 'HIRED', label: 'Hired', count: hiredCount },
  ];

  return stages.map((s, index) => {
    const previousCount = index === 0 ? null : (stages[index - 1]?.count ?? 0);
    return {
      stage: s.stage,
      label: s.label,
      count: s.count,
      percentageOfTotal: total > 0 ? Number(((s.count / total) * 100).toFixed(1)) : 0,
      conversionFromPrevious:
        previousCount === null
          ? null
          : previousCount > 0
            ? Number(((s.count / previousCount) * 100).toFixed(1))
            : 0,
    };
  });
}

export function buildTopHiringCompanies(
  applications: Record<string, unknown>[]
): TopHiringCompanyStat[] {
  const compStats = new Map<string, { companyId: number; companyName: string; companyLogo: string | null; hiredKeys: Set<string>; jobTitles: Set<string> }>();

  applications.forEach((app, index) => {
    const status = String(app.application_status || '').toUpperCase();
    if (status === 'HIRED' && app.job_id && typeof app.job_id === 'object') {
      const job = app.job_id as Record<string, unknown>;
      const jobTitle = String(job.job_title || 'Role');
      let compId = 0;
      let compName = 'Independent Employer';
      let compLogo: string | null = null;

      if (job.company_id && typeof job.company_id === 'object') {
        const comp = job.company_id as Record<string, unknown>;
        compId = Number(comp.company_id || 0);
        compName = comp.company_name ? String(comp.company_name) : 'Independent Employer';
        compLogo = comp.company_logo ? String(comp.company_logo) : null;
      }

      const key = `${compId}-${compName}`;
      let item = compStats.get(key);
      if (!item) {
        item = {
          companyId: compId,
          companyName: compName,
          companyLogo: compLogo,
          hiredKeys: new Set(),
          jobTitles: new Set(),
        };
        compStats.set(key, item);
      }
      if (item.companyLogo === null && compLogo !== null) item.companyLogo = compLogo;
      const userId = Number(app.user_id);
      item.hiredKeys.add(
        Number.isSafeInteger(userId) && userId > 0 ? `user:${userId}` : `row:${index}`,
      );
      item.jobTitles.add(jobTitle);
    }
  });

  const result: TopHiringCompanyStat[] = [];
  compStats.forEach((val) => {
    result.push({
      companyId: val.companyId,
      companyName: val.companyName,
      companyLogo: val.companyLogo,
      hiredCount: val.hiredKeys.size,
      topJobTitles: Array.from(val.jobTitles).slice(0, 3),
    });
  });

  return result.sort((a, b) => b.hiredCount - a.hiredCount).slice(0, 5);
}

export function buildSalaryDistribution(
  applications: Record<string, unknown>[]
): SalaryDistributionTier[] {
  const tiers: SalaryDistributionTier[] = [
    { tier: '< ₱20,000', min: 0, max: 20000, count: 0 },
    { tier: '₱20,000 - ₱40,000', min: 20000, max: 40000, count: 0 },
    { tier: '₱40,000 - ₱60,000', min: 40000, max: 60000, count: 0 },
    { tier: '₱60,000 - ₱80,000', min: 60000, max: 80000, count: 0 },
    { tier: '₱80,000+', min: 80000, max: Infinity, count: 0 },
  ];

  applications.forEach((app) => {
    const status = String(app.application_status || '').toUpperCase();
    if (status === 'HIRED') {
      const expectedSalary = Number(app.expected_salary || 0);
      let jobSalary = 0;

      if (app.job_id && typeof app.job_id === 'object') {
        const job = app.job_id as Record<string, unknown>;
        const min = Number(job.salary_min || 0);
        const max = Number(job.salary_max || 0);
        jobSalary = max > 0 ? (min + max) / 2 : min;
      }

      const finalSalary = expectedSalary > 0 ? expectedSalary : jobSalary;

      if (finalSalary > 0) {
        for (const t of tiers) {
          if (finalSalary >= t.min && finalSalary < t.max) {
            t.count++;
            break;
          }
        }
      }
    }
  });

  return tiers;
}
