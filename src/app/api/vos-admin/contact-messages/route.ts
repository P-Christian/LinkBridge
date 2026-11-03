// src/app/api/vos-admin/contact-messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { clampInt } from "@/lib/server/paging";
import {
  fetchContactMessagesRepo,
  type ContactMessageListParams,
  type ContactMessageStatus,
} from "@/modules/vos-admin/contact-messages";

const VALID_STATUSES = new Set<ContactMessageStatus>(["new", "read", "resolved", "archived"]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdministratorSession(session)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawStatus = searchParams.get("status") ?? "all";
    const q = searchParams.get("q") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;
    // Math.max(1, NaN) is NaN, so a hand-typed ?page=abc used to reach Directus
    // as limit=NaN&offset=NaN and the whole inbox came back as a 500.
    const page = clampInt(searchParams.get("page"), 1, 1, Number.MAX_SAFE_INTEGER);
    const pageSize = clampInt(searchParams.get("pageSize"), 20, 1, 100);

    const params: ContactMessageListParams = {
      status:
        rawStatus === "all"
          ? "all"
          : VALID_STATUSES.has(rawStatus as ContactMessageStatus)
          ? (rawStatus as ContactMessageStatus)
          : "all",
      q,
      from,
      to,
      page,
      pageSize,
    };

    const result = await fetchContactMessagesRepo(params);
    return NextResponse.json({ items: result.items, total: result.total });
  } catch (error: unknown) {
    console.error("[GET /api/vos-admin/contact-messages]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
