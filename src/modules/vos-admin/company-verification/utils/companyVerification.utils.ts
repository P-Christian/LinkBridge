import { CompanyVerificationRecord, CompanyVerificationKPIs, VerificationStatus } from "../types";

/**
 * Mutually exclusive lifecycle buckets derived from the dual status columns.
 * Every record lands in exactly one bucket, so the KPI cards always sum to the
 * total company count.
 */
export type CompanyStatusBucket =
  | "VERIFIED"
  | "REJECTED"
  | "NEEDS_REVISION"
  | "PENDING_VERIFICATION"
  | "DRAFT";

export function getCompanyStatusBucket(record: CompanyVerificationRecord): CompanyStatusBucket {
  const c = (record.verification_status || "").toUpperCase();
  const w = (record.latest_verification?.status || "").toUpperCase();

  if (c === "VERIFIED" || w === "APPROVED") return "VERIFIED";
  if (c === "REJECTED" || c === "SUSPENDED" || w === "REJECTED" || w === "SUSPENDED") return "REJECTED";
  if (w === "CORRECTION_REQUIRED") return "NEEDS_REVISION";
  if (c === "PENDING_VERIFICATION" || w === "PENDING_VERIFICATION" || w === "IN_REVIEW") {
    return "PENDING_VERIFICATION";
  }
  return "DRAFT";
}

export function calculateCompanyKPIs(records: CompanyVerificationRecord[]): CompanyVerificationKPIs {
  const counts: Record<CompanyStatusBucket, number> = {
    VERIFIED: 0,
    REJECTED: 0,
    NEEDS_REVISION: 0,
    PENDING_VERIFICATION: 0,
    DRAFT: 0,
  };

  for (const record of records) {
    counts[getCompanyStatusBucket(record)]++;
  }

  return {
    totalCount: records.length,
    pendingCount: counts.PENDING_VERIFICATION,
    verifiedCount: counts.VERIFIED,
    rejectedCount: counts.REJECTED,
    needsRevisionCount: counts.NEEDS_REVISION,
    draftCount: counts.DRAFT,
  };
}

function matchesStatusFilter(record: CompanyVerificationRecord, status: string): boolean {
  const bucket = getCompanyStatusBucket(record);
  const c = (record.verification_status || "").toUpperCase();
  const w = (record.latest_verification?.status || "").toUpperCase();

  switch (status) {
    case "ALL":
      return true;
    case "REJECTED_OR_SUSPENDED":
      return bucket === "REJECTED";
    case "REJECTED":
      return c === "REJECTED" || w === "REJECTED";
    case "SUSPENDED":
      return c === "SUSPENDED" || w === "SUSPENDED";
    case "IN_REVIEW":
      return bucket === "PENDING_VERIFICATION" && w === "IN_REVIEW";
    default:
      return bucket === status.toUpperCase();
  }
}

export function filterCompanyRecords(
  records: CompanyVerificationRecord[],
  status: string,
  search: string
): CompanyVerificationRecord[] {
  return records.filter((record) => {
    if (!matchesStatusFilter(record, status)) return false;

    // Search query filter (company name, legal name, code, TIN, registration no, email)
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const matchName = record.company_name?.toLowerCase().includes(query);
      const matchLegal = record.company_legal_name?.toLowerCase().includes(query);
      const matchCode = record.company_code?.toLowerCase().includes(query);
      const matchTin = record.company_tin?.toLowerCase().includes(query);
      const matchReg = record.registration_no?.toLowerCase().includes(query);
      const matchEmail = record.company_email?.toLowerCase().includes(query);

      if (!matchName && !matchLegal && !matchCode && !matchTin && !matchReg && !matchEmail) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Derives user-friendly display labels based on dual-status lifecycle:
 *
 * vs_company.verification_status + vs_company_verifications.status -> Display
 * PENDING_VERIFICATION + PENDING_VERIFICATION -> Pending Verification
 * PENDING_VERIFICATION + IN_REVIEW            -> Pending: Under Review
 * PENDING_VERIFICATION + CORRECTION_REQUIRED  -> Needs Revision
 * VERIFIED             + APPROVED             -> Verified
 * REJECTED             + REJECTED             -> Rejected
 * SUSPENDED            + SUSPENDED            -> Suspended
 */
export function formatDualStatusLabel(
  companyStatus: VerificationStatus | string,
  workflowStatus?: string | null
): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
} {
  const cStatus = (companyStatus || "").toUpperCase();
  const wStatus = (workflowStatus || "").toUpperCase();

  // 1. Final States
  if (cStatus === "VERIFIED" || wStatus === "APPROVED") {
    return { label: "Verified", variant: "success" };
  }
  if (cStatus === "REJECTED" || wStatus === "REJECTED") {
    return { label: "Rejected", variant: "destructive" };
  }
  if (cStatus === "SUSPENDED" || wStatus === "SUSPENDED") {
    return { label: "Suspended", variant: "destructive" };
  }

  // 2. Pending Workflow States
  if (wStatus === "CORRECTION_REQUIRED") {
    return { label: "Needs Revision", variant: "warning" };
  }
  if (wStatus === "IN_REVIEW") {
    return { label: "Pending: Under Review", variant: "secondary" };
  }
  if (cStatus === "PENDING_VERIFICATION" || wStatus === "PENDING_VERIFICATION") {
    return { label: "Pending Verification", variant: "warning" };
  }

  if (cStatus === "INACTIVE") {
    return { label: "Inactive", variant: "outline" };
  }

  return { label: "Draft", variant: "outline" };
}

export function getStatusBadgeVariant(status: VerificationStatus | string): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
} {
  return formatDualStatusLabel(status);
}

/**
 * Standard 4 company verification document categories:
 * - "DTI / SEC Registration"
 * - "Business Permit"
 * - "TIN Document"
 * - "Other Supporting Documents"
 */
export function formatDocumentTypeLabel(documentType?: string | null): string {
  const key = (documentType || "").toUpperCase().trim();
  if (!key) return "Other Supporting Documents";

  if (
    key === "DTI_SEC_REGISTRATION" ||
    key === "DTI_REGISTRATION" ||
    key === "SEC_REGISTRATION" ||
    key === "CDA_REGISTRATION" ||
    key.includes("DTI") ||
    key.includes("SEC") ||
    key.includes("CDA")
  ) {
    return "DTI / SEC Registration";
  }

  if (
    key === "BUSINESS_PERMIT" ||
    key === "MAYORS_PERMIT" ||
    key.includes("PERMIT")
  ) {
    return "Business Permit";
  }

  if (
    key === "TIN_DOCUMENT" ||
    key === "BIR_2303" ||
    key.includes("TIN") ||
    key.includes("BIR")
  ) {
    return "TIN Document";
  }

  return "Other Supporting Documents";
}

export function getDocumentCategoryBadgeStyle(category: string): string {
  switch (category) {
    case "DTI / SEC Registration":
      return "bg-primary/10 text-primary border-primary/25";
    case "Business Permit":
      return "bg-info/10 text-info border-info/25";
    case "TIN Document":
      return "bg-warning/10 text-warning border-warning/25";
    case "Other Supporting Documents":
    default:
      return "bg-muted/70 text-muted-foreground border-border";
  }
}

/**
 * Priority rank for sorting verification documents:
 * 1. DTI / SEC Registration
 * 2. Business Permit
 * 3. TIN Document
 * 4. Other Supporting Documents
 */
export function getDocumentCategoryPriority(documentType?: string | null): number {
  const label = formatDocumentTypeLabel(documentType);
  switch (label) {
    case "DTI / SEC Registration":
      return 1;
    case "Business Permit":
      return 2;
    case "TIN Document":
      return 3;
    case "Other Supporting Documents":
    default:
      return 4;
  }
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return "N/A";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
}
