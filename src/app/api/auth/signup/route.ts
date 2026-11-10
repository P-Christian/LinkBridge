// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { registerUser } from "@/modules/auth/services/auth.service";
import { legacyRegistrationRetiredResponse } from "@/modules/auth/registration";
import { safeErrorMessage } from "@/lib/api-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const retired = legacyRegistrationRetiredResponse();
    if (retired) return retired;
    const body = await req.json().catch(() => null);

    try {
        const { requireOtp } = await registerUser(body);

        // SEC-023: the numeric vs_user.user_id is no longer returned. The next
        // step (/api/auth/verify-otp) is keyed by the email this caller already
        // submitted, so nothing in the response has to name the primary key.
        return NextResponse.json(
            { 
                ok: true, 
                message: "Signup successful. OTP required.", 
                requireOtp
            },
            { status: 201 }
        );

    } catch (err: unknown) {
        console.error("[auth/signup] Signup error:", err);
        
        const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred.";
        let status = 500;
        
        if (errorMessage.includes("already registered")) {
            status = 409;
        } else if (errorMessage.includes("Missing required fields")) {
            status = 400;
        }

        return NextResponse.json(
            { ok: false, message: status === 500 ? safeErrorMessage(err, "An unexpected error occurred.") : errorMessage },
            { status }
        );
    }
}
