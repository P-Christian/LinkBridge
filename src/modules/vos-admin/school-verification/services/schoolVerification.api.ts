// src/modules/vos-admin/school-verification/services/schoolVerification.api.ts
// Browser-side callers for /api/vos-admin/school-verification. Kept apart from
// schoolVerification.service.ts, which is server-only and transitively imports
// @/lib/server (guarded to throw when evaluated in a browser bundle).
import {
  SchoolVerificationRecord,
  VerificationDecisionPayload,
} from "../types";

export async function fetchSchoolVerifications(
  status?: string,
  search?: string
): Promise<SchoolVerificationRecord[]> {
  const params = new URLSearchParams();
  if (status && status !== "ALL") params.append("status", status);
  if (search && search.trim()) params.append("search", search.trim());

  const queryString = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`/api/vos-admin/school-verification${queryString}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = "Failed to fetch school verifications";
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error) errMsg = parsed.error;
    } catch {
      /* ignore */
    }
    throw new Error(errMsg);
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as SchoolVerificationRecord[]) : [];
}

export async function submitSchoolVerificationDecision(
  payload: VerificationDecisionPayload
): Promise<{ success: boolean; message?: string; warnings: string[] }> {
  const response = await fetch("/api/vos-admin/school-verification", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to submit verification decision");
  }

  const result = await response.json();

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("vos:verification-updated", {
        detail: { entity: "school", schoolId: payload.schoolId, action: payload.action },
      })
    );
  }

  return {
    success: true,
    message: result.message,
    warnings: Array.isArray(result.warnings) ? (result.warnings as string[]) : [],
  };
}
