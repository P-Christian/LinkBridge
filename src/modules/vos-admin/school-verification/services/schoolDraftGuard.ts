import {
  normalizeSchoolIdentity,
  schoolIdentityKey,
  schoolIdentityKeysMatch,
} from "../../../school-identity";

export interface SchoolIdentityRow {
  readonly school_id: number;
  readonly school_name: string;
  readonly city_municipality: string | null;
  readonly province: string | null;
}

export interface SchoolDraftInput {
  readonly school_name: string;
  readonly city_municipality: string | null;
  readonly province: string | null;
}

export type SchoolDraftDecision =
  | { readonly kind: "create" }
  | { readonly kind: "reuse"; readonly row: SchoolIdentityRow }
  | { readonly kind: "location-conflict"; readonly row: SchoolIdentityRow }
  | {
      readonly kind: "ambiguous";
      readonly code: "AMBIGUOUS_NAME" | "SIMILAR_NAME";
      readonly rows: readonly SchoolIdentityRow[];
    }
  | { readonly kind: "invalid-name" };

function locationPart(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : normalizeSchoolIdentity(trimmed);
}

export function decideSchoolDraft(
  schools: readonly SchoolIdentityRow[],
  input: SchoolDraftInput,
): SchoolDraftDecision {
  const inputKey = schoolIdentityKey(input.school_name);
  if (inputKey.length === 0) return { kind: "invalid-name" };

  const nameMatches = schools.filter((s) =>
    schoolIdentityKeysMatch(s.school_name, input.school_name),
  );

  const cityKey = locationPart(input.city_municipality);
  const provinceKey = locationPart(input.province);
  const hasLocation = cityKey !== null || provinceKey !== null;
  const locationMatches = (row: SchoolIdentityRow): boolean =>
    (cityKey === null ||
      normalizeSchoolIdentity(row.city_municipality ?? "") === cityKey) &&
    (provinceKey === null ||
      normalizeSchoolIdentity(row.province ?? "") === provinceKey);

  if (nameMatches.length === 0) {
    const similar = schools.filter((s) => {
      const key = schoolIdentityKey(s.school_name);
      if (key.length === 0 || inputKey.length === 0) return false;
      const shorter = key.length <= inputKey.length ? key : inputKey;
      if (shorter.length < 6) return false;
      return key.includes(inputKey) || inputKey.includes(key);
    });
    if (similar.length > 0)
      return { kind: "ambiguous", code: "SIMILAR_NAME", rows: similar };
    return { kind: "create" };
  }

  if (nameMatches.length === 1) {
    const only = nameMatches[0] as SchoolIdentityRow;
    if (hasLocation && !locationMatches(only))
      return { kind: "location-conflict", row: only };
    return { kind: "reuse", row: only };
  }

  const narrowed = hasLocation
    ? nameMatches.filter(locationMatches)
    : nameMatches;
  if (narrowed.length === 1)
    return { kind: "reuse", row: narrowed[0] as SchoolIdentityRow };
  return {
    kind: "ambiguous",
    code: "AMBIGUOUS_NAME",
    rows: narrowed.length > 0 ? narrowed : nameMatches,
  };
}
