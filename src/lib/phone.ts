// src/lib/phone.ts

// Philippine numbering plan: mobile 9XX XXX XXXX, or landline with a
// 2-digit area code (7 digits, 8 for Metro Manila's area code "2").
const PH_CONTACT_REGEX = /^(?:\+63|0)(?:9\d{9}|2\d{8}|\d{2}\d{7})$/;

// Longest sensible input: +63 + 11 digits. Beyond that the extra digits stay
// visible (grouped into an overflow tail) so validation can flag the number.
const MAX_CONTACT_DIGITS = 14;

// A valid formatted number is at most "+63 912 345 6789" (16 chars); the cap
// stays above that so an over-long legacy value can still be edited in place.
export const CONTACT_MAX_LENGTH = 24;

/** Returns an error message for an invalid contact number, or null when valid/empty. */
export function validatePhContact(value: string): string | null {
  const digits = value.replace(/[\s()-]/g, "");
  if (!digits) return null;
  if (!PH_CONTACT_REGEX.test(digits)) {
    return "Enter a valid PH contact number, e.g. +63 912 345 6789 or 0912 345 6789.";
  }
  return null;
}

function groupDigits(digits: string, sizes: number[]): string {
  const parts: string[] = [];
  let i = 0;
  for (const size of sizes) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  // Overflow stays visible (appended to the last group) so validation can flag it.
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(" ");
}

/**
 * Formats raw typing into the PH phone mask, e.g. "+63 912 345 6789",
 * "0912 345 6789", "+63 2 8123 4567", "+63 33 123 4567".
 */
export function formatContactInput(raw: string): string {
  const hasPlus = raw.trimStart().startsWith("+");
  let digits = raw.replace(/\D/g, "").slice(0, MAX_CONTACT_DIGITS);
  if (!digits) return hasPlus ? "+" : "";

  let head: string;
  if (hasPlus && digits.startsWith("63")) {
    head = "+63 ";
    digits = digits.slice(2);
  } else if (hasPlus) {
    // Keep the "+" while the country code is still being typed ("+6", "+63").
    head = "+";
  } else if (digits.startsWith("63") && digits.length > 11) {
    head = "+63 ";
    digits = digits.slice(2);
  } else if (digits.startsWith("0")) {
    head = "0";
    digits = digits.slice(1);
  } else {
    head = "";
  }

  if (!digits) return head.trimEnd();
  if (digits.startsWith("9")) {
    // Mobile: 9XX XXX XXXX
    return head + groupDigits(digits, [3, 3, 4]);
  }
  if (digits.startsWith("2")) {
    // Metro Manila landline: (0)2 8XXX XXXX
    return head + groupDigits(digits, [1, 4, 4]);
  }
  // Provincial landline: XX XXX XXXX
  return head + groupDigits(digits, [2, 3, 4]);
}

/** Caret offset in `formatted` that keeps `digitCount` typed digits before it. */
export function caretForDigitCount(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}
