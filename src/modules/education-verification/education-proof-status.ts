// src/modules/education-verification/education-proof-status.ts
//
// Pure opt-in promotion mapping: a matched claim whose school classifies as
// DIRECT_REVIEW routes straight to the school; every other outcome stays Pending
// for the normal VOS route/group/release path. Deliberately dependency-free
// (no server-only, no path aliases) so logic tests can load it directly.

export type EducationProofPromotionStatus = "Pending" | "RoutedToSchool";

export function resolvePromotionStatus(
  classification: string | null,
): EducationProofPromotionStatus {
  return classification === "DIRECT_REVIEW" ? "RoutedToSchool" : "Pending";
}
