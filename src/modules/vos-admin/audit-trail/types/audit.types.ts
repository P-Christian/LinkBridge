// src/modules/vos-admin/audit-trail/types/audit.types.ts

export type AuditStatus = 'SUCCESS' | 'FAILED' | 'DENIED';

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'FAILED_LOGIN'
  | 'OTP_VERIFY'
  | 'PASSWORD_RESET'
  | 'ACCOUNT_RECOVERY'
  | 'LOCKOUT'
  | 'ROLE_ASSIGN'
  | 'ROLE_REVOKE'
  | 'PERMISSION_CHANGE'
  | 'SUBMIT'
  | 'VERIFY'
  | 'REJECT'
  | 'DOC_UPLOAD'
  | 'DOC_DELETE'
  | 'OVERRIDE'
  | 'PUBLISH'
  | 'POST'
  | 'EDIT'
  | 'CLOSE'
  | 'SCHEDULE'
  | 'OFFER_SENT'
  | 'EXPORT'
  | 'SEARCH'
  | 'VIEW_AUDIT'
  | 'RETENTION_CHANGE'
  | 'LEGAL_HOLD'
  | 'CONFIG_CHANGE'
  | 'REGISTER'
  | 'COURSES_MODIFIED'
  | 'STATUS_CHANGE';

export type AuditActorType = 'USER' | 'ADMIN' | 'SERVICE' | 'SYSTEM';

export type AuditCategory = 
  | 'AUTHENTICATION' 
  | 'USER' 
  | 'COMPANY' 
  | 'EMPLOYEE'
  | 'SCHOOL' 
  | 'JOB' 
  | 'APPLICATION' 
  | 'MESSAGE' 
  | 'NOTIFICATION' 
  | 'ADMIN' 
  | 'SYSTEM';

export type OrgType = 'EMPLOYER' | 'FREELANCER' | 'SCHOOL' | 'PLATFORM';

export interface AuditRecord {
  audit_id: number;
  event_type: string;
  event_category: AuditCategory;
  action: AuditAction | string;
  status: AuditStatus;
  actor_type: AuditActorType;
  actor_user_id: number | null;
  actor_company_id: number | null;
  // Dynamic resolved actor info
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  resource_type: string | null;
  resource_id: string | null;
  resource_name?: string | null;
  organization_type: OrgType | null;
  organization_id: number | null;
  reason: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  created_at: string;
}

export interface AuditFilters {
  search?: string;
  event_category?: string;
  action?: string;
  status?: string;
  actor_type?: string;
  organization_type?: string;
  resource_type?: string;
  actor_user_id?: number;
  date_from?: string;
  date_to?: string;
  page: number;
  limit: number;
}

export interface AuditKPIData {
  // null means the count could not be read, which the cards must not render as 0.
  todayEvents: number | null;
  failedEvents: number | null;
  deniedAccess: number | null;
  adminActions: number | null;
}

export interface AuditConfigRow {
  audit_config_id?: number;
  event_category: string;
  event_type: string;
  is_enabled: boolean | number;
  description?: string | null;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: string;
  updated_at?: string;
}

export type AuditCategoryActionsMap = Record<string, Record<string, boolean>>;

export interface AuditCategoryConfig {
  categories: Record<string, boolean>;
  actions: AuditCategoryActionsMap;
}

export const DEFAULT_GRANULAR_AUDIT_CONFIG: AuditCategoryConfig = {
  categories: {
    AUTHENTICATION: true,
    USER: true,
    COMPANY: true,
    EMPLOYEE: true,
    SCHOOL: true,
    JOB: true,
    APPLICATION: true,
    MESSAGE: true,
    NOTIFICATION: true,
    ADMIN: true,
    SYSTEM: true,
  },
  actions: {
    AUTHENTICATION: {
      LOGIN: true,
      LOGOUT: true,
      OTP_VERIFY: true,
      PASSWORD_RESET: true,
      ACCOUNT_RECOVERY: true,
      FAILED_LOGIN: true,
      LOCKOUT: true,
    },
    USER: {
      CREATE: true,
      UPDATE: true,
      DELETE: true,
      ROLE_ASSIGN: true,
      ROLE_REVOKE: true,
      PERMISSION_CHANGE: true,
    },
    COMPANY: {
      SUBMIT: true,
      VERIFY: true,
      REJECT: true,
      DOC_UPLOAD: true,
      DOC_DELETE: true,
      OVERRIDE: true,
    },
    EMPLOYEE: {
      CREATE: true,
      UPDATE: true,
      DELETE: true,
      PUBLISH: true,
    },
    SCHOOL: {
      REGISTER: true,
      VERIFY: true,
      COURSES_MODIFIED: true,
    },
    JOB: {
      POST: true,
      EDIT: true,
      CLOSE: true,
      DELETE: true,
    },
    APPLICATION: {
      SUBMIT: true,
      STATUS_CHANGE: true,
      SCHEDULE: true,
      OFFER_SENT: true,
      REJECT: true,
    },
    ADMIN: {
      EXPORT: true,
      SEARCH: true,
      VIEW_AUDIT: true,
      RETENTION_CHANGE: true,
      LEGAL_HOLD: true,
      CONFIG_CHANGE: true,
    },
    MESSAGE: {
      CREATE: true,
      DELETE: true,
    },
    NOTIFICATION: {
      SUBMIT: true,
    },
    SYSTEM: {
      CONFIG_CHANGE: true,
    },
  },
};

export const DEFAULT_AUDIT_CONFIG = DEFAULT_GRANULAR_AUDIT_CONFIG;
