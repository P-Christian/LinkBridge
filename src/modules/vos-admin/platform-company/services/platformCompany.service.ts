import { PlatformCompany, PlatformCompanyFormData } from "../types/platformCompany.types";

const BASE_URL = "/api/vos-admin/platform-company";

export async function fetchPlatformCompanies(): Promise<{ data: PlatformCompany[] }> {
  const res = await fetch(BASE_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to fetch platform companies");
  }
  return res.json();
}

export async function createPlatformCompany(
  payload: PlatformCompanyFormData
): Promise<{ data: PlatformCompany }> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to create platform company");
  }
  return res.json();
}

export async function updatePlatformCompany(
  param1: number | Partial<PlatformCompanyFormData>,
  param2?: Partial<PlatformCompanyFormData> | number
): Promise<{ data: PlatformCompany; warnings?: string[] }> {
  let payload: Partial<PlatformCompanyFormData>;
  let companyId: number | undefined;

  if (typeof param1 === "number") {
    companyId = param1;
    payload = (param2 as Partial<PlatformCompanyFormData>) || {};
  } else {
    payload = param1 || {};
    companyId = typeof param2 === "number" ? param2 : undefined;
  }

  // Directly PATCH /api/vos-admin/platform-company (singleton entity endpoint)
  const res = await fetch(BASE_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, ...(companyId ? { company_id: companyId } : {}) }),
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to update platform company");
  }
  return res.json();
}

export async function setPrimaryPlatformCompany(
  companyId: number
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE_URL}/${companyId}/set-primary`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to set company as primary");
  }
  return res.json();
}
