import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, isAdministratorSession } from "@/lib/authenticated-session";

export async function GET(req: NextRequest) {
  const session = await authenticateRequest(req);
  if (!session || !isAdministratorSession(session)) {
    return NextResponse.json(
      { error: session ? "Forbidden: Admin access required." : "Unauthorized. Admin access required." },
      { status: session ? 403 : 401 }
    );
  }

  return NextResponse.json({
    message: "Welcome to the Admin Portal API",
    data: {
      status: "online",
      post_graduates: 0,
      tasks: 0,
    },
  });
}
