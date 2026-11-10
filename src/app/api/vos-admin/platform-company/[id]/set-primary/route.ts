import { NextRequest, NextResponse } from "next/server";
import { requireAdministrator } from "@/lib/authenticated-session";
import { demoteOtherPrimaries } from "../../_primary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "")
  .split("#")[0]
  .trim()
  .replace(/\/$/, "");
const DIRECTUS_TOKEN = (process.env.DIRECTUS_STATIC_TOKEN || "")
  .split("#")[0]
  .trim();

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

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function POST(
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
    const now = getPHDateTimeString();

    // 1. Demote all existing companies
    const demotionError = await demoteOtherPrimaries(companyId);
    if (demotionError) {
      return NextResponse.json({ error: demotionError }, { status: 502 });
    }

    // 2. Promote target company to primary
    const updateRes = await fetch(`${DIRECTUS_BASE}/items/vs_platform_company/${companyId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        is_primary: 1,
        updated_at: now,
        updated_by_user_id: auth.adminId,
      }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: err?.errors?.[0]?.message || "Failed to set company as primary" },
        { status: updateRes.status }
      );
    }

    return NextResponse.json({ success: true, message: "Company set as primary successfully" });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
