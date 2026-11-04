import { NextRequest, NextResponse } from "next/server";
import { getUserList, getUserDetail } from "@/modules/vos-admin/user-management";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";
import { safeErrorMessage } from "@/lib/api-error";

function toPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateRequest(req);
    if (!session || !isAdministratorSession(session)) {
      return NextResponse.json(
        { error: session ? "Forbidden: Admin access required" : "Unauthorized" },
        { status: session ? 403 : 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const userIdStr = searchParams.get("userId");

    if (userIdStr) {
      const userId = toPositiveId(userIdStr);
      if (!userId) return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
      const user = await getUserDetail(userId);
      if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      return NextResponse.json({ user });
    }

    const roleId = toPositiveId(searchParams.get("roleId")) ?? undefined;
    const search = searchParams.get("search") || undefined;
    const page = toPositiveId(searchParams.get("page")) ?? 1;
    const limit = toPositiveId(searchParams.get("limit")) ?? 10;

    const result = await getUserList(roleId, search, page, limit);
    return NextResponse.json({ users: result.users, total: result.total });
  } catch (error: unknown) {
    return NextResponse.json({ error: safeErrorMessage(error, "Internal server error.")}, { status: 500 });
  }
}
