// src/modules/freelancer/freelancer-applications/components/application-table/formatters.ts

export function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatJobType(jobType?: string | null): string {
  if (!jobType) return "";
  const mapping: Record<string, string> = {
    FULL_TIME: "Full Time",
    PART_TIME: "Part Time",
    CONTRACT: "Contract",
    FREELANCE: "Freelance",
    INTERNSHIP: "Internship",
  };
  return mapping[jobType] || jobType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
