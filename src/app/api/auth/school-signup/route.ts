import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import {
    legacyRegistrationRetiredResponse,
    parseDirectusUtcDateTime,
} from '@/modules/auth/registration';
import { sendOTP } from '@/modules/auth/services/email.service';
import { getClientIp, rateLimitRetryAfterMs, tooManyRequestsResponse } from '@/lib/rate-limit';
import bcrypt from 'bcrypt';

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

// SEC-007: unauthenticated account creation that also sends mail. The IP budget
// is wide enough for a school office sharing one egress address.
const SCHOOL_SIGNUP_WINDOW_MS = 60 * 60_000;
const SCHOOL_SIGNUP_EMAIL_REQUESTS = 3;
const SCHOOL_SIGNUP_IP_REQUESTS = 20;

function getHeaders() {
    const h: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };
    if (DIRECTUS_TOKEN) h['Authorization'] = `Bearer ${DIRECTUS_TOKEN}`;
    return h;
}

export async function POST(req: Request) {
    const retired = legacyRegistrationRetiredResponse();
    if (retired) return retired;
    try {
        const body = await req.json();
        const {
            token,
            user_fname,
            user_lname,
            user_contact,
            user_email,
            password,
            school_name,
            school_type,
            city_municipality,
            province
        } = body;

        // 1. Basic validation
        if (!user_fname || !user_lname || !user_contact || !user_email || !password || !school_name || !school_type || !city_municipality || !province) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const retryAfterMs =
            rateLimitRetryAfterMs("auth:school-signup:email", String(user_email), SCHOOL_SIGNUP_EMAIL_REQUESTS, SCHOOL_SIGNUP_WINDOW_MS) ||
            rateLimitRetryAfterMs("auth:school-signup:ip", getClientIp(req), SCHOOL_SIGNUP_IP_REQUESTS, SCHOOL_SIGNUP_WINDOW_MS);
        if (retryAfterMs) return tooManyRequestsResponse(retryAfterMs);

        // 2. Validate token if present (Invite flow redirecting to signup)
        let invitedSchoolId: number | null = null;
        let inviteTokenId: string | null = null;
        if (token) {
            const tokenQuery = new URLSearchParams({ 'filter[token][_eq]': String(token) });
            const tokenUrl = `${DIRECTUS_BASE}/items/vs_invite_token?${tokenQuery}`;
            const tokenRes = await fetch(tokenUrl, { headers: getHeaders(), cache: 'no-store' });
            const tokenJson = await tokenRes.json();

            const invite = (tokenJson.data || []).find(
                (row: { token?: string }) => String(row?.token ?? '') === String(token)
            );

            if (!tokenRes.ok || !invite) {
                return NextResponse.json({ error: "Invalid invitation token" }, { status: 400 });
            }

            const expiresAt = parseDirectusUtcDateTime(invite.expires_at);
            if (invite.is_used || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
                return NextResponse.json({ error: "Token is expired or already used" }, { status: 400 });
            }
            invitedSchoolId = invite.school_id;
            inviteTokenId = invite.token_id || invite.id;
        }

        // 3. Duplicate User Check
        const existingUserQuery = new URLSearchParams({ 'filter[user_email][_eq]': String(user_email) });
        const existingUserRes = await fetch(`${DIRECTUS_BASE}/items/vs_user?${existingUserQuery}`, {
            headers: getHeaders(),
            cache: 'no-store'
        });
        const existingUserJson = await existingUserRes.json();
        const existingUser = existingUserJson.data?.[0];

        if (existingUser) {
            return NextResponse.json({ error: "An account with this email address already exists. Please log in." }, { status: 400 });
        }

        // 4. Duplicate School Check (Only for self-signup since invites link to an existing school)
        if (!token) {
            const schoolCheckUrl = `${DIRECTUS_BASE}/items/vs_school?filter[school_name][_eq]=${encodeURIComponent(school_name)}&filter[city_municipality][_eq]=${encodeURIComponent(city_municipality)}`;
            const schoolCheckRes = await fetch(schoolCheckUrl, { headers: getHeaders(), cache: 'no-store' });
            const schoolCheckJson = await schoolCheckRes.json();
            if (schoolCheckJson.data && schoolCheckJson.data.length > 0) {
                return NextResponse.json({ 
                    error: `A school named "${school_name}" is already registered in "${city_municipality}". If this is your school, please contact LinkBridge support.` 
                }, { status: 409 });
            }
        }

        // 5. Create or reuse school record
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        let schoolId = invitedSchoolId;

        // Create Admin User
        const roleId = 4; // School Admin
        const createUserRes = await fetch(`${DIRECTUS_BASE}/items/vs_user`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                user_email,
                hash_password: passwordHash,
                user_password: passwordHash, // legacy compat
                user_fname,
                user_lname,
                user_contact,
                role_id: roleId,
                role: 'SCH_ADMIN',
                status: 'PENDING_VERIFICATION' // Stays pending until admin verification
            })
        });

        const userJson = await createUserRes.json();
        if (!createUserRes.ok) {
            return NextResponse.json({ error: userJson.errors?.[0]?.message || "Failed to create user account." }, { status: 400 });
        }
        const userId = userJson.data.user_id || userJson.data.id;

        // If self-signup, create the new school
        if (!schoolId) {
            // Calculate base completion (10% name, 10% type, 10% email, 5% city, 5% province = 40%)
            const baseCompletion = 40;
            const submittedAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
            const createSchoolRes = await fetch(`${DIRECTUS_BASE}/items/vs_school`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({
                    school_name,
                    school_type,
                    school_email: user_email,
                    city_municipality,
                    province,
                    school_status: 'Pending',
                    verification_status: 'PENDING_VERIFICATION',
                    submitted_at: submittedAt,
                    profile_completion_percent: baseCompletion,
                    created_by: userId
                })
            });

            const schoolJson = await createSchoolRes.json();
            if (!createSchoolRes.ok) {
                // Cleanup created user on failure
                await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}`, { method: 'DELETE', headers: getHeaders() });
                return NextResponse.json({ error: schoolJson.errors?.[0]?.message || "Failed to create school profile." }, { status: 400 });
            }
            schoolId = schoolJson.data.school_id || schoolJson.data.id;
        } else {
            const invitedSubmittedAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
            await fetch(`${DIRECTUS_BASE}/items/vs_school/${schoolId}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ school_status: 'Pending', verification_status: 'PENDING_VERIFICATION', submitted_at: invitedSubmittedAt })
            });
        }

        // Link User to School
        await fetch(`${DIRECTUS_BASE}/items/vs_school_admin`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                school_id: schoolId,
                user_id: userId,
                is_active: true
            })
        });

        // 6. Mark invitation token used if invite flow
        if (inviteTokenId) {
            await fetch(`${DIRECTUS_BASE}/items/vs_invite_token/${inviteTokenId}`, {
                method: 'PATCH',
                headers: getHeaders(),
                body: JSON.stringify({ is_used: true })
            });
        }

        // 7. Dispatch OTP
        const otpCode = randomInt(100000, 1000000).toString();
        const getPHTimeString = (d: Date) => new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        const now = new Date();
        const expiry = new Date(now.getTime() + 10 * 60 * 1000);
        const hashedOtp = await bcrypt.hash(otpCode, 10);

        await fetch(`${DIRECTUS_BASE}/items/vs_user/${userId}`, {
            method: 'PATCH',
            headers: getHeaders(),
            body: JSON.stringify({
                otp_code: hashedOtp,
                otp_expiry: getPHTimeString(expiry),
                otp_sent_at: getPHTimeString(now),
                otp_verified: 0
            })
        });

        await sendOTP(user_email, otpCode);

        return NextResponse.json({
            message: "Registration completed. Verification required.",
            // SEC-023: no user_id in the response — OTP verification is keyed by
            // the email this caller just submitted.
            requireOtp: true
        });

    } catch (error: unknown) {
        console.error("School signup endpoint error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
