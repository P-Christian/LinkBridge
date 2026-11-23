export const INACTIVE_APPLICATION_STATUSES = ["DRAFT", "WITHDRAWN", "REJECTED"] as const;

export function isActiveApplicationStatus(status: string | null | undefined): boolean {
  const normalized = String(status ?? "").toUpperCase();
  if (!normalized) return false;
  return !(INACTIVE_APPLICATION_STATUSES as readonly string[]).includes(normalized);
}
