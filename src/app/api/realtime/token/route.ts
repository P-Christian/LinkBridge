// src/app/api/realtime/token/route.ts

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      error: "This endpoint has been deprecated and retired. Realtime updates are provided via /api/realtime/stream.",
      status: 410,
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}
