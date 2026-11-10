// src/app/api/client/notifications/bulk-status/route.ts

import { NextRequest } from "next/server";
import { PATCH as handlePatch } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  return handlePatch(req);
}
