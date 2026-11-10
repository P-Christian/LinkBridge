import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import { demoteOtherPrimaries, resolveCompanyId } from "./_primary";
import { mapValueRow, syncCompanyValues } from "./_values";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
  .split("#")[0]
  .trim()
  .replace(/\/$/, "");
const DIRECTUS_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "")
  .split("#")[0]
  .trim();

const COMPANY_COLUMNS = [
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

function pickCompanyColumns(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of COMPANY_COLUMNS) {
    if (body[col] !== undefined) out[col] = body[col];
  }
  return out;
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json({ error: "Directus API base URL not configured" }, { status: 500 });
    }

    const res = await fetch(
      `${DIRECTUS_BASE}/items/vs_platform_company?sort[]=display_order&sort[]=-is_primary&limit=-1`,
      {
        headers: getHeaders(),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.errors?.[0]?.message || "Failed to fetch platform companies" },
        { status: res.status }
      );
    }

    const json = await res.json();
    const companies = (json.data || []).map(normalizePlatformCompany);

    // Hydrate relational company values from vs_platform_company_value
    try {
      const valuesRes = await fetch(
        `${DIRECTUS_BASE}/items/vs_platform_company_value?sort=display_order&limit=-1`,
        { headers: getHeaders(), cache: "no-store" }
      );
      if (valuesRes.ok) {
        const valJson = await valuesRes.json();
        const allValues = valJson.data || [];
        const valuesByCompanyId = new Map<number, Array<Record<string, unknown>>>();
        for (const v of allValues) {
          const cid = Number(v.company_id);
          if (!valuesByCompanyId.has(cid)) {
            valuesByCompanyId.set(cid, []);
          }
          valuesByCompanyId.get(cid)!.push(mapValueRow(v));
        }

        for (const company of companies) {
          if (company && company.company_id) {
            const dbVals = valuesByCompanyId.get(Number(company.company_id));
            if (dbVals && dbVals.length > 0) {
              company.values = dbVals.slice(0, 4);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch vs_platform_company_value:", e);
    }

    return NextResponse.json({ data: companies });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleUpdateCompanyRecord(
  companyId: number,
  body: Record<string, unknown>,
  auth: { adminId: number }
) {
  const isPrimary =
    body.is_primary !== undefined
      ? Number(body.is_primary) === 1 || body.is_primary === true
        ? 1
        : 0
      : undefined;

  // If setting this record to primary, unset all other records to 0
  if (isPrimary === 1) {
    const demotionError = await demoteOtherPrimaries(companyId);
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

  const updatePayload: Record<string, unknown> = {
    metadata: updatedMetadata,
    updated_at: now,
    updated_by_user_id: auth.adminId,
  };

  for (const field of COMPANY_COLUMNS) {
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

  const updateRes = await fetch(`${DIRECTUS_BASE}/items/vs_platform_company/${companyId}`, {
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
        companyId,
        body.values as Array<Record<string, unknown>>,
        now
      );
      valueWarnings.push(...synced.warnings);
      if (synced.values.length > 0 && normalized) {
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
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json({ error: "Directus API base URL not configured" }, { status: 500 });
    }

    const body = await req.json();

    // In a singleton table, check if a company row already exists
    const resolved = await resolveCompanyId(body.company_id);
    if (resolved.ok) {
      // Delegate to update handler to avoid unique constraint violations
      return await handleUpdateCompanyRecord(resolved.companyId, body, auth);
    }
    // Creating is only legitimate when the named row genuinely does not exist
    // (or the table is empty). A rejected id or an unreadable Directus must not
    // add a second row to what the editor treats as a singleton table.
    if (resolved.status !== 404) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    if (!body.company_name?.trim() || !body.company_legal_name?.trim() || !body.company_code?.trim()) {
      return NextResponse.json(
        { error: "Company name, legal name, and company code are required" },
        { status: 400 }
      );
    }

    const isPrimary = Number(body.is_primary) === 1 || body.is_primary === true ? 1 : 0;
    const now = getPHDateTimeString();
    const payload: Record<string, unknown> = {
      ...pickCompanyColumns(body),
      is_primary: isPrimary,
      is_active: Number(body.is_active) === 1 || body.is_active === true ? 1 : 0,
      display_order: Number(body.display_order) || 0,
      created_by_user_id: auth.adminId,
      updated_by_user_id: auth.adminId,
      created_at: now,
      updated_at: now,
    };

    if (body.metadata !== undefined) payload.metadata = body.metadata;

    const createRes = await fetch(`${DIRECTUS_BASE}/items/vs_platform_company`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.errors?.[0]?.message || "Failed to create platform company" },
        { status: createRes.status }
      );
    }

    const createdJson = await createRes.json();
    const newCompanyId = createdJson.data?.company_id;

    // Insert relational values if provided
    const valueWarnings: string[] = [];
    if (newCompanyId && Array.isArray(body.values) && body.values.length > 0) {
      const synced = await syncCompanyValues(
        Number(newCompanyId),
        body.values as Array<Record<string, unknown>>,
        now
      );
      valueWarnings.push(...synced.warnings);
    }

    return NextResponse.json(
      { data: createdJson.data, ...(valueWarnings.length > 0 ? { warnings: valueWarnings } : {}) },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdministrator(req);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!DIRECTUS_BASE) {
      return NextResponse.json({ error: "Directus API base URL not configured" }, { status: 500 });
    }

    const body = await req.json();

    const resolved = await resolveCompanyId(body.company_id);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    return await handleUpdateCompanyRecord(resolved.companyId, body, auth);
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
