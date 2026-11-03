// src/lib/mail/preference-check.ts
import { directusItems } from "@/lib/server/directus";

/**
 * Whether the user has email on for this category.
 *
 * `null` means the preference could not be read. Callers must not treat that as
 * "enabled": a mail the user switched off cannot be unsent, while a confirmation
 * they missed is recoverable, so an unknown preference skips the send and is
 * reported instead.
 */
export async function isEmailEnabledForUser(
  userId: number | null | undefined,
  category: string
): Promise<boolean | null> {
  if (!userId) {
    // No user to look a preference up for, so the default applies.
    return category !== "MARKETING_UPDATES" && category !== "PRODUCT_UPDATES";
  }

  try {
    const records = await directusItems<{ email_enabled?: unknown }>(
      "vs_notification_preference",
      {
        query: `filter[user_id][_eq]=${userId}&filter[category][_eq]=${encodeURIComponent(
          category
        )}&fields=email_enabled&limit=1`,
      }
    );

    if (records.length === 0) {
      // Default preferences for categories not yet saved in DB
      if (category === "MARKETING_UPDATES" || category === "PRODUCT_UPDATES") {
        return false;
      }
      return true;
    }

    const rec = records[0];
    return rec.email_enabled === 1 || rec.email_enabled === true;
  } catch (err) {
    console.error(
      `[MAIL PREFERENCE ERROR] Could not read email preference for user ${userId}, category ${category}:`,
      err
    );
    return null;
  }
}
