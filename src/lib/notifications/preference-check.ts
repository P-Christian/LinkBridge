// src/lib/notifications/preference-check.ts
import { directusItems } from "@/lib/server/directus";

/**
 * Whether the user has in-app notifications on for this category. Uses
 * vs_notification_preference, shared across employer and freelancer.
 *
 * `null` means the preference could not be read; callers should skip the delivery
 * and report it rather than treat an outage as "enabled".
 */
export async function isInAppEnabledForUser(
  userId: number | null | undefined,
  category: string
): Promise<boolean | null> {
  if (!userId) {
    return category !== "MARKETING_UPDATES";
  }

  try {
    const records = await directusItems<{ in_app_enabled?: unknown }>(
      "vs_notification_preference",
      {
        query: `filter[user_id][_eq]=${userId}&filter[category][_eq]=${encodeURIComponent(
          category
        )}&fields=in_app_enabled&limit=1`,
      }
    );

    if (records.length === 0) {
      // Default: disable for marketing categories, enable for all others
      if (category === "MARKETING_UPDATES") return false;
      return true;
    }

    const rec = records[0];
    return rec.in_app_enabled === 1 || rec.in_app_enabled === true;
  } catch (err) {
    console.error(
      `[NOTIFICATION PREFERENCE ERROR] Could not read in-app preference for user ${userId}, category ${category}:`,
      err
    );
    return null;
  }
}
