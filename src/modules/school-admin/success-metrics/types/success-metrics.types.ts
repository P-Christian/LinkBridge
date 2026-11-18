// src/modules/school-admin/success-metrics/types/success-metrics.types.ts

export type DegreeType = 'Associate' | 'Bachelor' | 'Master' | 'Doctorate';

export interface SuccessMetricsFilter {
  school_id: number;
  school_year?: string;
  school_course_id?: number | string;
  is_alumni?: boolean | string;
  start_date?: string;
  end_date?: string;
}

export interface MetricKpiData {
  totalStudents: number;
  registeredStudents: number;
  totalApplications: number;
  hiredCount: number;
  placementRate: number; // percentage (0 - 100)
  activePipelineCount: number; // UNDER_REVIEW + SHORTLISTED + INTERVIEWING
  activePipelineRate: number; // percentage (0 - 100)
  avgTimeToHireDays: number;
  topPerformingCourse: string | null;
}

export interface CoursePlacementStat {
  courseId: number;
  courseName: string;
  courseCode: string | null;
  degree: DegreeType | null;
  totalStudents: number;
  registeredStudents: number;
  hiredCount: number;
  placementRate: number; // percentage
  activePipelineCount: number;
}

export interface FunnelStageStat {
  stage: 'APPLIED' | 'UNDER_REVIEW' | 'SHORTLISTED' | 'INTERVIEWING' | 'HIRED';
  label: string;
  count: number;
  /** Share of all applications, not the previous stage. */
  percentageOfTotal: number;
  /** Share of the previous stage that reached this stage; null for the first stage. */
  conversionFromPrevious: number | null;
}

export interface TopHiringCompanyStat {
  companyId: number;
  companyName: string;
  companyLogo: string | null;
  /** Unique graduates hired at this company. */
  hiredCount: number;
  topJobTitles: string[];
}

export interface SalaryDistributionTier {
  tier: string;
  min: number;
  max: number;
  count: number;
}

export interface SuccessMetricsResponse {
  kpis: MetricKpiData;
  courseStats: CoursePlacementStat[];
  funnelStages: FunnelStageStat[];
  topCompanies: TopHiringCompanyStat[];
  salaryDistribution: SalaryDistributionTier[];
  availableSchoolYears: string[];
}

export interface AiMetricsInsightRequest {
  schoolName?: string;
  totalStudents: number;
  registeredStudents: number;
  hiredCount: number;
  placementRate: number;
  activePipelineCount: number;
  avgTimeToHireDays: number;
  topCourse?: string | null;
  courseStatsSummary: { courseName: string; placementRate: number; hiredCount: number }[];
  topCompaniesSummary: { companyName: string; hiredCount: number }[];
}

export interface AiMetricsInsightResponse {
  executiveSummary: string;
  keyStrengths: string[];
  growthOpportunities: string[];
  actionableRecommendations: string[];
  generatedAt: string;
}
