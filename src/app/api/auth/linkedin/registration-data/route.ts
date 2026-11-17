// src/app/api/auth/linkedin/registration-data/route.ts
import { NextRequest, NextResponse } from "next/server";
import { decryptLinkedInRegistration } from "@/modules/auth/linkedin/linkedin.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const regCookie = req.cookies.get("vos_sync_linkedin_reg")?.value;

  if (!regCookie) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const payload = await decryptLinkedInRegistration(regCookie);
  if (!payload) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    data: {
      email: payload.email,
      name: payload.name || "",
      given_name: payload.given_name || "",
      family_name: payload.family_name || "",
      picture: payload.picture || "",
      locale: payload.locale || "",
    },
  });
}
