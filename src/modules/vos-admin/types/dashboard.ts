// src/modules/vos-admin/types/dashboard.ts

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'NO_DATA' | 'STANDBY';

export interface AdminDashboardKPIs {
  // null means the read failed, which the panels render as an em dash. A real
  // zero and an unknown zero must stay distinguishable.
  totalUsers: number | null;
  activeUsers: number | null;
  pendingVerifications: number;
  pendingCompanyVerifications: number;
  pendingSchoolVerifications: number;
  totalVerifiedSchools: number;
  totalVerifiedCompanies: number;
  geminiHealthStatus: HealthStatus;
  geminiSuccessRate: number | null;
  geminiAvgLatencyMs: number | null;
}

export interface VerificationVelocityPoint {
  month: string;
  companies: number | null;
  schools: number | null;
}

export interface StatusDistributionItem {
  name: string;
  value: number;
  fill: string;
}

export interface PendingActionItem {
  id: string | number;
  type: 'COMPANY' | 'SCHOOL';
  name: string;
  submittedAt: string | null;
  detail: string;
  reviewUrl: string;
}

export interface AdminDashboardOverviewData {
  kpis: AdminDashboardKPIs;
  velocity: VerificationVelocityPoint[];
  distribution: StatusDistributionItem[];
  pendingActions: PendingActionItem[];
  /** Sources that could not be read; the figures they feed come back as null. */
  errors: string[];
  lastUpdated: string;
}
