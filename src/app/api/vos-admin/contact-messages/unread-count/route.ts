// src/app/api/vos-admin/contact-messages/unread-count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { countContactMessagesByStatusRepo } from "@/modules/vos-admin/contact-messages";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await authenticateRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdministratorSession(session)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // `unreadCount` is what the sidebar badge has always read; `counts` lets the
    // queue show a real figure per status instead of arithmetic on the two.
    const counts = await countContactMessagesByStatusRepo();
    return NextResponse.json({ unreadCount: counts.new, counts });
  } catch (error: unknown) {
    console.error("[GET /api/vos-admin/contact-messages/unread-count]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
