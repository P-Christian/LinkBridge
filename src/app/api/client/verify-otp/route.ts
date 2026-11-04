import { NextRequest, NextResponse } from "next/server";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth-bypass";
import { legacyRegistrationRetiredResponse } from "@/modules/auth/registration";
import bcrypt from "bcrypt";
import { getPHTimeString } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const retired = legacyRegistrationRetiredResponse();
  if (retired) return retired;
  try {
    const body = await req.json().catch(() => null);
    const email = String(body?.email ?? "").trim();
    const otpCode = String(body?.otpCode ?? "").trim();

    if (!email || !otpCode) {
      return NextResponse.json(
        { error: "Both 'email' and 'otpCode' are required." },
        { status: 400 }
      );
    }

    const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
    const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!DIRECTUS_BASE) {
      return NextResponse.json(
        { error: "Directus API base URL is not configured." },
        { status: 500 }
      );
    }

    const getHeaders = () => {
      const h: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (DIRECTUS_TOKEN) {
        h["Authorization"] = `Bearer ${DIRECTUS_TOKEN}`;
      }
      return h;
    };

    // 1. Fetch user from Directus by email
    const lookupUrl = `${DIRECTUS_BASE}/items/vs_user?filter[user_email][_eq]=${encodeURIComponent(email)}&fields=*`;
    const lookupRes = await fetch(lookupUrl, {
      method: "GET",
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!lookupRes.ok) {
      return NextResponse.json(
        { error: "Failed to look up user." },
        { status: lookupRes.status }
      );
    }

    const lookupJson = await lookupRes.json();
    const users = lookupJson.data;

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: "No account found with this email." },
        { status: 404 }
      );
    }

    const user = users[0];
    const userId = user.user_id;

    // Check failed attempts lockout
    const MAX_FAILED_ATTEMPTS = 5;
    const currentAttempts = Number(user.failed_attempts || 0);
    if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
      return NextResponse.json(
        { error: "Too many failed attempts. Please request a new verification code." },
        { status: 429 }
      );
    }

    // Skip OTP check in local development only
    const authDisabled = isDevAuthBypassEnabled();

    if (!authDisabled) {
      // Check if OTP is already verified
      if (user.otp_verified == 1 || user.otp_verified === true) {
        return NextResponse.json(
          { error: "Email is already verified." },
          { status: 409 }
        );
      }

      // Check OTP expiry
      const otpExpiry = user.otp_expiry ? new Date(user.otp_expiry.replace(" ", "T") + "Z") : null;
      const nowPH = new Date(Date.now() + 8 * 60 * 60 * 1000);
      if (!otpExpiry || otpExpiry < nowPH) {
        return NextResponse.json(
          { error: "OTP has expired. Please request a new code." },
          { status: 400 }
        );
      }

      const hashedOtp = user.otp_code;
      if (!hashedOtp) {
        return NextResponse.json(
          { error: "No OTP found for this account." },
          { status: 400 }
        );
      }

      // Secure comparison: support bcrypt hash or fallback to exact match if legacy plain
      let isMatch = false;
      try {
        if (typeof hashedOtp === "string" && (hashedOtp.startsWith("$2a$") || hashedOtp.startsWith("$2b$") || hashedOtp.startsWith("$2y$"))) {
          isMatch = await bcrypt.compare(otpCode, hashedOtp);
        } else {
          isMatch = otpCode === hashedOtp;
        }
      } catch {
        isMatch = false;
      }

      if (!isMatch) {
        const nextAttempts = currentAttempts + 1;
        await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}`, {
          method: "PATCH",
          headers: getHeaders(),
          body: JSON.stringify({ failed_attempts: nextAttempts }),
        }).catch(() => null);

        return NextResponse.json(
          { error: nextAttempts >= MAX_FAILED_ATTEMPTS ? "Too many failed attempts. Please request a new verification code." : "Invalid OTP code." },
          { status: 400 }
        );
      }
    }

    // 5. Mark user as OTP-verified in Directus and clear OTP fields + reset failed_attempts
    // Record PH timestamp of verification (UTC+8, naive datetime)
    const nowPHStr = getPHTimeString();

    const patchRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({
        otp_verified: 1,
        otp_verified_at: nowPHStr,
        otp_code: null,
        otp_expiry: null,
        failed_attempts: 0,
      }),
    });

    if (!patchRes.ok) {
      const patchText = await patchRes.text();
      console.error("Failed to update otp_verified in Directus:", patchText);
      return NextResponse.json(
        { error: "OTP verified but failed to update account status." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "OTP verified successfully.",
      otp_verified: true,
    });
  } catch (error: unknown) {
    console.error("API Route OTP Verification Error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error, "Internal server error") },
      { status: 500 }
    );
  }
}

