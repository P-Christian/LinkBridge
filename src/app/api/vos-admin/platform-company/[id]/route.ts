import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import { demoteOtherPrimaries, resolveCompanyId } from "../_primary";
import { mapValueRow, syncCompanyValues } from "../_values";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
  .split("#")[0]
  .trim()
  .replace(/\/$/, "");
const DIRECTUS_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "")
  .split("#")[0]
  .trim();

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function getHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (DIRECTUS_TOKEN) h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
  return h;
}

function getPHDateTimeString(): string {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  return dtf.format(now);
}

function normalizePlatformCompany(raw: Record<string, unknown> | null) {
  if (!raw) return null;
  const meta =
    typeof raw.metadata === "string"
      ? (() => {
        try {
          return JSON.parse(raw.metadata as string);
        } catch {
          return {};
        }
      })()
      : (raw.metadata as Record<string, unknown> | null) || {};

  return {
    ...raw,
    metadata: meta,
    platform_name: (raw.platform_name as string) || (meta.platform_name as string) || (raw.company_name as string) || "LinkBridge",
    platform_icon: (raw.platform_icon as string) || (meta.platform_icon as string) || "Briefcase",
    support_hours_days: (raw.support_hours_days as string) || (meta.support_hours_days as string) || "Mon–Fri",
    support_hours_time: (raw.support_hours_time as string) || (meta.support_hours_time as string) || "8am–5pm",
    support_hours_timezone: (raw.support_hours_timezone as string) || (meta.support_hours_timezone as string) || "Philippine Time (PHT)",
    values: Array.isArray(meta.values) ? meta.values.slice(0, 4) : [],
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const resolved = await resolveCompanyId(id);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const resolvedId = resolved.companyId;

    const res = await fetch(`${DIRECTUS_BASE}/items/vs_platform_company/${resolvedId}`, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Platform company not found" }, { status: res.status });
    }

    const json = await res.json();
    const normalized = normalizePlatformCompany(json.data);
    if (normalized) {
      try {
        const valRes = await fetch(
          `${DIRECTUS_BASE}/items/vs_platform_company_value?filter[company_id][_eq]=${resolvedId}&sort=display_order&limit=4`,
          { headers: getHeaders(), cache: "no-store" }
        );
        if (valRes.ok) {
          const valJson = await valRes.json();
          if (Array.isArray(valJson.data) && valJson.data.length > 0) {
            normalized.values = valJson.data.map((v: Record<string, unknown>) => mapValueRow(v));
          }
        }
      } catch (e) {
        console.warn("Could not fetch vs_platform_company_value:", e);
      }
    }
    return NextResponse.json({ data: normalized });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const resolved = await resolveCompanyId(id);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const resolvedId = resolved.companyId;
    const body = await req.json();

    const isPrimary =
      body.is_primary !== undefined
        ? Number(body.is_primary) === 1 || body.is_primary === true
          ? 1
          : 0
        : undefined;

    // If setting this record to primary, unset all other records to 0
    if (isPrimary === 1) {
      const demotionError = await demoteOtherPrimaries(resolvedId);
      if (demotionError) {
        return NextResponse.json({ error: demotionError }, { status: 502 });
      }
    }

    const now = getPHDateTimeString();
    const existingMetadata =
      typeof body.metadata === "string"
        ? (() => {
          try {
            return JSON.parse(body.metadata);
          } catch {
            return {};
          }
        })()
        : (body.metadata as Record<string, unknown> | null) || {};

    const updatedMetadata = {
      ...existingMetadata,
      ...(body.platform_name !== undefined ? { platform_name: body.platform_name } : {}),
      ...(body.platform_icon !== undefined ? { platform_icon: body.platform_icon } : {}),
      ...(body.support_hours_days !== undefined ? { support_hours_days: body.support_hours_days } : {}),
      ...(body.support_hours_time !== undefined ? { support_hours_time: body.support_hours_time } : {}),
      ...(body.support_hours_timezone !== undefined ? { support_hours_timezone: body.support_hours_timezone } : {}),
      ...(body.values !== undefined ? { values: Array.isArray(body.values) ? body.values.slice(0, 4) : [] } : {}),
    };

    const ALLOWED_FIELDS = [
      "slug",
      "company_code",
      "company_name",
      "platform_name",
      "company_legal_name",
      "company_tagline",
      "year_established",
      "organization_type_id",
      "industry_id",
      "company_size_id",
      "company_address",
      "company_brgy",
      "company_city",
      "company_province",
      "company_country",
      "company_zipCode",
      "map_embed_url",
      "registration_no",
      "company_tin",
      "company_contact",
      "company_email",
      "support_email",
      "support_hours_days",
      "support_hours_time",
      "support_hours_timezone",
      "company_website",
      "company_logo",
      "platform_icon",
      "company_cover",
      "company_facebook",
      "company_linkedin",
      "company_instagram",
      "company_x",
      "company_youtube",
      "company_short_description",
      "company_description",
      "company_mission",
      "company_vision",
      "company_culture",
      "company_benefits",
      "company_tags",
    ];

    const updatePayload: Record<string, unknown> = {
      metadata: updatedMetadata,
      updated_at: now,
      updated_by_user_id: auth.adminId,
    };

    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        updatePayload[field] = body[field];
      }
    }

    if (isPrimary !== undefined) {
      updatePayload.is_primary = isPrimary;
    }
    if (body.is_active !== undefined) {
      updatePayload.is_active = Number(body.is_active) === 1 || body.is_active === true ? 1 : 0;
    }
    if (body.display_order !== undefined) {
      updatePayload.display_order = Number(body.display_order) || 0;
    }

    const updateRes = await fetch(`${DIRECTUS_BASE}/items/vs_platform_company/${resolvedId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(updatePayload),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.errors?.[0]?.message || "Failed to update platform company" },
        { status: updateRes.status }
      );
    }

    const updatedJson = await updateRes.json();
    const normalized = normalizePlatformCompany(updatedJson.data);

    // Synchronize vs_platform_company_value table
    const valueWarnings: string[] = [];
    if (Array.isArray(body.values)) {
      try {
        const synced = await syncCompanyValues(
          resolvedId,
          body.values as Array<Record<string, unknown>>,
          now
        );
        valueWarnings.push(...synced.warnings);
        if (normalized && synced.values.length > 0) {
          normalized.values = synced.values;
        }
      } catch (err) {
        console.error("Error syncing vs_platform_company_value:", err);
        valueWarnings.push("The company values could not be saved.");
      }
    }

    return NextResponse.json({
      data: normalized,
      ...(valueWarnings.length > 0 ? { warnings: valueWarnings } : {}),
    });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const companyId = toPositiveId(id);
    if (!companyId) {
      return NextResponse.json({ error: "Invalid company id" }, { status: 400 });
    }

    const deleteRes = await fetch(`${DIRECTUS_BASE}/items/vs_platform_company/${companyId}`, {
      method: "DELETE",
      headers: getHeaders(),
    });

    if (!deleteRes.ok) {
      const err = await deleteRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.errors?.[0]?.message || "Failed to delete platform company" },
        { status: deleteRes.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
