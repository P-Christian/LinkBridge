export function normalizeSchoolIdentity(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function schoolIdentitiesMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeSchoolIdentity(left);
  return (
    normalizedLeft.length > 0 &&
    normalizedLeft === normalizeSchoolIdentity(right)
  );
  
}

/**
 * Canonical identity key: strips diacritics, apostrophes, and every
 * non-letter/non-digit separator. "St. Mary's College" and
 * "st marys college" share one key.
 */
export function schoolIdentityKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/['\u2019]/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function schoolIdentityKeysMatch(left: string, right: string): boolean {
  const key = schoolIdentityKey(left);
  return key.length > 0 && key === schoolIdentityKey(right);
}
