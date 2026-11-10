"use client";

import { toast, type ExternalToast } from "sonner";

/**
 * Options extending Sonner's ExternalToast with custom deduplication and cancellation behavior.
 */
export interface ToastFeedbackOptions extends ExternalToast {
  /**
   * Whether to suppress identical notifications within the 2-second window.
   * Defaults to `true` for error toasts and `false` for success toasts.
   */
  dedupe?: boolean;

  /**
   * Whether to ignore AbortError / intentional request cancellation.
   * Defaults to `true` (silent suppression).
   * Set to `false` if a specific workflow requires visual cancellation feedback.
   */
  ignoreAbort?: boolean;
}

const DEDUPE_WINDOW_MS = 2000;
const DEFAULT_ERROR_DURATION = 4500;
const DEFAULT_SUCCESS_DURATION = 3000;
const DEFAULT_ERROR_FALLBACK = "An unexpected error occurred. Please try again.";

const SENSITIVE_STATUS_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Please log in again.",
  403: "You do not have permission to perform this action.",
  429: "Too many requests. Please wait a moment and try again.",
};

const STANDARD_STATUS_MESSAGES: Record<number, string> = {
  404: "The requested resource could not be found.",
  500: "A server error occurred. Please try again later.",
};

const dedupeCache = new Map<string, number>();

/**
 * Checks if a message has already been displayed within the suppression window.
 * Expired entries are automatically pruned on each invocation.
 */
function isDeduplicated(message: string, dedupe: boolean): boolean {
  if (!dedupe) {
    return false;
  }

  const now = Date.now();

  for (const [key, timestamp] of dedupeCache.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      dedupeCache.delete(key);
    }
  }

  const lastSeen = dedupeCache.get(message);
  if (lastSeen !== undefined && now - lastSeen <= DEDUPE_WINDOW_MS) {
    return true;
  }

  dedupeCache.set(message, now);
  return false;
}

/**
 * Identifies whether an error originates from an aborted or cancelled request.
 */
function isAbortError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  const record = error as Record<string, unknown>;
  return record.name === "AbortError" || record.code === 20;
}

/**
 * Distinguishes true network connectivity failures from unrelated JavaScript TypeErrors.
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("failed to fetch") ||
      msg.includes("network error") ||
      msg.includes("networkrequestfailed") ||
      msg.includes("network request failed") ||
      msg.includes("load failed") ||
      msg.includes("fetch failed")
    );
  }
  return false;
}

/**
 * Extracts readable error messages from Directus or standard JSON API error payloads.
 */
function extractStructuredErrorMessage(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const record = data as Record<string, unknown>;

  // Directus error format: { errors: [{ message: "..." }] }
  if (Array.isArray(record.errors) && record.errors.length > 0) {
    const first = record.errors[0];
    if (typeof first === "object" && first !== null) {
      const errObj = first as Record<string, unknown>;
      if (typeof errObj.message === "string" && errObj.message.trim().length > 0) {
        return errObj.message.trim();
      }
    } else if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
  }

  // Standard API format: { error: "..." }
  if (typeof record.error === "string" && record.error.trim().length > 0) {
    return record.error.trim();
  }

  // Generic message format: { message: "..." }
  if (typeof record.message === "string" && record.message.trim().length > 0) {
    return record.message.trim();
  }

  return null;
}

/**
 * Extracts a readable error message from a Fetch Response object asynchronously
 * without consuming the original response body stream.
 */
async function parseResponseError(
  response: Response,
  fallback?: string
): Promise<string> {
  // Sensitive and authentication errors always use standardized messages
  if (response.status in SENSITIVE_STATUS_MESSAGES) {
    return SENSITIVE_STATUS_MESSAGES[response.status];
  }

  // Server errors (500+) prefer module-specific fallback over generic server error,
  // preventing internal implementation leakage.
  if (response.status >= 500) {
    return fallback ?? STANDARD_STATUS_MESSAGES[500];
  }

  // Resource not found
  if (response.status === 404) {
    return fallback ?? STANDARD_STATUS_MESSAGES[404];
  }

  // For client errors (400, 422, etc.), inspect the cloned response body
  try {
    const clone = response.clone();
    const text = (await clone.text()).trim();

    if (text) {
      try {
        const json: unknown = JSON.parse(text);
        const extracted = extractStructuredErrorMessage(json);
        if (extracted) {
          return extracted;
        }
      } catch {
        // Not valid JSON: check if plain text is non-HTML and reasonably concise
        if (!text.startsWith("<") && text.length < 300) {
          return text;
        }
      }
    }
  } catch {
    // Response stream reading or cloning failed
  }

  return fallback ?? DEFAULT_ERROR_FALLBACK;
}

/**
 * Synchronously extracts a user-readable error message from an unknown error.
 *
 * Precedence:
 * 1. Intentional cancellation message ("Request was cancelled.")
 * 2. Genuine network connectivity failure
 * 3. Directus or structured API message
 * 4. Plain string error
 * 5. Generic Error message (unrelated TypeErrors fall through to fallback to prevent leaking JS stack details)
 * 6. Module-specific fallback
 * 7. Default unexpected error message
 */
export function parseErrorMessage(error: unknown, fallback?: string): string {
  if (isAbortError(error)) {
    return "Request was cancelled.";
  }

  if (isNetworkError(error)) {
    return "Unable to connect to the server. Please check your internet connection.";
  }

  if (typeof Response !== "undefined" && error instanceof Response) {
    if (error.status in SENSITIVE_STATUS_MESSAGES) {
      return SENSITIVE_STATUS_MESSAGES[error.status];
    }
    if (error.status >= 500) {
      return fallback ?? STANDARD_STATUS_MESSAGES[500];
    }
    if (error.status === 404) {
      return fallback ?? STANDARD_STATUS_MESSAGES[404];
    }
    return fallback ?? DEFAULT_ERROR_FALLBACK;
  }

  const structured = extractStructuredErrorMessage(error);
  if (structured) {
    return structured;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error.trim();
  }

  // Non-network TypeErrors (e.g. TypeError: Cannot read property of undefined)
  // should never be displayed raw to users.
  if (error instanceof TypeError) {
    return fallback ?? DEFAULT_ERROR_FALLBACK;
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return fallback ?? DEFAULT_ERROR_FALLBACK;
}

/**
 * Normalizes an error, applies fallback logic, and displays a deduplicated Sonner error toast.
 * Safely handles Fetch Response objects asynchronously using response.clone().
 *
 * @param error - The caught error, unknown object, or Fetch Response.
 * @param fallback - Optional module-specific fallback message.
 * @param options - Custom Sonner toast options, deduplication, and cancellation settings.
 * @returns A Promise resolving to the Sonner toast ID, or undefined if suppressed.
 */
export async function showErrorToast(
  error: unknown,
  fallback?: string,
  options?: ToastFeedbackOptions
): Promise<string | number | undefined> {
  // 1. Silent cancellation handling by default
  if (isAbortError(error) && options?.ignoreAbort !== false) {
    return undefined;
  }

  // 2. Extract normalized error message
  let message: string;
  if (typeof Response !== "undefined" && error instanceof Response) {
    message = await parseResponseError(error, fallback);
  } else {
    message = parseErrorMessage(error, fallback);
  }

  // 3. Deduplication check (enabled by default for errors)
  const dedupe = options?.dedupe ?? true;
  if (isDeduplicated(message, dedupe)) {
    return undefined;
  }

  // 4. Dispatch error toast via Sonner
  const sonnerOptions: ExternalToast = {
    duration: options?.duration ?? DEFAULT_ERROR_DURATION,
    ...options,
  };
  delete (sonnerOptions as { dedupe?: boolean }).dedupe;
  delete (sonnerOptions as { ignoreAbort?: boolean }).ignoreAbort;

  return toast.error(message, sonnerOptions);
}

/**
 * Displays a Sonner success toast with consistent defaults.
 *
 * @param message - The success message to display.
 * @param options - Custom Sonner toast options and deduplication settings.
 * @returns The Sonner toast ID, or undefined if suppressed by explicit deduplication.
 */
export function showSuccessToast(
  message: string,
  options?: ToastFeedbackOptions
): string | number | undefined {
  const dedupe = options?.dedupe ?? false;
  if (isDeduplicated(message, dedupe)) {
    return undefined;
  }

  const sonnerOptions: ExternalToast = {
    duration: options?.duration ?? DEFAULT_SUCCESS_DURATION,
    ...options,
  };
  delete (sonnerOptions as { dedupe?: boolean }).dedupe;
  delete (sonnerOptions as { ignoreAbort?: boolean }).ignoreAbort;

  return toast.success(message, sonnerOptions);
}

export { toast, type ExternalToast };
