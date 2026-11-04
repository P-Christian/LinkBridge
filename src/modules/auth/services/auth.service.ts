// src/modules/auth/services/auth.service.ts
import { randomInt, randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { getUserByEmail, createUser, updateUserOTP, getUserById, markOTPVerified, updateFailedAttempts, resetFailedAttempts, saveResetToken, clearResetToken } from "./auth.repo";
import { sendOTP, sendPasswordResetOTP } from "./email.service";
import { createAuditRecordRepo } from "@/modules/vos-admin/audit-trail";
import { validatePasswordStrict } from "@/lib/password-validation";
import { sendEmployerAccountCreationEmail } from "@/lib/mail";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { issueAuthSession } from "../registration/registration.session";
import { canAuthenticate } from "@/lib/status-validator";
import { createUserSession } from "../sessions/session.repo";

// SEC-007: five consecutive failures now cost 15 minutes, not the 60 seconds
// left behind for testing.
const LOCK_DURATION_MS = 15 * 60 * 1000;
const RESET_OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

// SEC-023: every credential this module compares (password hashes, OTP hashes,
// reset-code hashes) is written with this cost factor, so the placeholder hash
// used to equalise the "no such account" path shares it. bcrypt work depends
// only on the cost factor, which is what makes the timing indistinguishable.
const BCRYPT_SALT_ROUNDS = 10;

// SEC-023: the single message every failed credential check returns.
const INVALID_CREDENTIALS = "Credentials invalid.";

let dummyCredentialHash: string | null = null;

async function getDummyCredentialHash(): Promise<string> {
    if (!dummyCredentialHash) {
        // Cached only after bcrypt resolves, so a transient failure cannot
        // poison every subsequent attempt.
        dummyCredentialHash = await bcrypt.hash(
            "vos-sync-placeholder-credential",
            BCRYPT_SALT_ROUNDS
        );
    }
    return dummyCredentialHash;
}

/**
 * SEC-023: machine-readable failure reasons so the route handlers can branch on
 * `reason` instead of the user-visible wording, which lets the credential
 * failure string stay generic.
 */
export type AuthFailureReason =
    | "invalid_input"
    | "invalid_credentials"
    | "account_blocked"
    | "account_locked"
    | "account_inactive";

export class AuthFailure extends Error {
    readonly reason: AuthFailureReason;
    readonly statusCode: number;

    constructor(message: string, reason: AuthFailureReason, statusCode: number) {
        super(message);
        this.name = "AuthFailure";
        this.reason = reason;
        this.statusCode = statusCode;
    }
}

// Format as Philippine Time (UTC+8) in YYYY-MM-DD HH:mm:ss
const getPHTimeString = (d: Date) => new Date(d.getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

export async function loginUser(
    email: string,
    hashPasswordParam: string,
    clientInfo?: {
        deploymentId?: string;
        userAgent?: string | null;
        ipAddress?: string | null;
        locationLabel?: string | null;
    }
) {
    if (!email || !hashPasswordParam) {
        throw new AuthFailure('Both "email" and "password" are required.', "invalid_input", 400);
    }

    const user = await getUserByEmail(email);
    const now = new Date();
    const lockUntilDate = user?.lock_until ? new Date(user.lock_until) : null;

    // SEC-023: the compare always runs against a same-cost hash — the account's
    // own, or a placeholder when the email is unknown — and both misses return the
    // identical string, so neither the body nor the timing separates "no such
    // account" from "wrong password". Blocked and locked are genuinely different
    // states the real owner needs a signal for, so they are only revealed once the
    // password has verified.
    const credentialHash = user?.hash_password
        ? String(user.hash_password)
        : await getDummyCredentialHash();
    const passwordMatches = await bcrypt.compare(hashPasswordParam, credentialHash);

    if (!user || !passwordMatches) {
        if (!user) {
            createAuditRecordRepo({
                event_type: "USER_LOGIN_FAILED",
                event_category: "AUTHENTICATION",
                action: "FAILED_LOGIN",
                status: "FAILED",
                actor_type: "USER",
                reason: `Login attempt failed: Email ${email} not found`,
            });
        } else {
            // The counter and the lockout still work; only the remaining-attempt
            // count stops being handed to the caller.
            const liveLock = Boolean(lockUntilDate && now < lockUntilDate);
            if (liveLock) {
                createAuditRecordRepo({
                    event_type: "USER_LOGIN_FAILED",
                    event_category: "AUTHENTICATION",
                    action: "FAILED_LOGIN",
                    status: "FAILED",
                    actor_type: "USER",
                    actor_user_id: user.user_id,
                    reason: "Invalid password submitted while an account lock is active",
                });
            } else {
                // An expired lock grants a fresh budget; there is no lock column to
                // clear, so the next failure restarts the count at one.
                const baseAttempts = lockUntilDate ? 0 : user.failed_attempts || 0;
                const newAttempts = baseAttempts + 1;
                if (newAttempts >= MAX_FAILED_ATTEMPTS) {
                    const lockUntil = new Date(now.getTime() + LOCK_DURATION_MS).toISOString();
                    await updateFailedAttempts(user.user_id, newAttempts, lockUntil);
                    createAuditRecordRepo({
                        event_type: "ACCOUNT_LOCKOUT",
                        event_category: "AUTHENTICATION",
                        action: "LOCKOUT",
                        status: "DENIED",
                        actor_type: "SYSTEM",
                        actor_user_id: user.user_id,
                        reason: `Account locked due to ${MAX_FAILED_ATTEMPTS} consecutive failed attempts`,
                    });
                } else {
                    await updateFailedAttempts(user.user_id, newAttempts);
                    createAuditRecordRepo({
                        event_type: "USER_LOGIN_FAILED",
                        event_category: "AUTHENTICATION",
                        action: "FAILED_LOGIN",
                        status: "FAILED",
                        actor_type: "USER",
                        actor_user_id: user.user_id,
                        reason: `Invalid password. ${MAX_FAILED_ATTEMPTS - newAttempts} attempt(s) remaining`,
                    });
                }
            }
        }

        throw new AuthFailure(INVALID_CREDENTIALS, "invalid_credentials", 400);
    }

    // The password is valid — safe to disclose the account state to its owner.
    if (user.is_blocked) {
        createAuditRecordRepo({
            event_type: "USER_LOGIN_BLOCKED",
            event_category: "AUTHENTICATION",
            action: "FAILED_LOGIN",
            status: "DENIED",
            actor_type: "USER",
            actor_user_id: user.user_id,
            reason: "Login denied: Account is blocked",
        });
        throw new AuthFailure("Account is blocked. Contact support.", "account_blocked", 403);
    }

    if (lockUntilDate && now < lockUntilDate) {
        createAuditRecordRepo({
            event_type: "USER_LOGIN_LOCKED",
            event_category: "AUTHENTICATION",
            action: "LOCKOUT",
            status: "DENIED",
            actor_type: "USER",
            actor_user_id: user.user_id,
            reason: `Login denied: Account locked until ${lockUntilDate.toISOString()}`,
        });
        throw new AuthFailure(`Account is locked. Try again at ${lockUntilDate.toLocaleTimeString()}.`, "account_locked", 400);
    }

    if (!canAuthenticate(user)) {
        const canonicalStatus = String(user.status ?? "").trim().toUpperCase();
        const legacyStatus = String(user.user_status ?? "").trim().toUpperCase();
        const currentStatus = canonicalStatus || legacyStatus;

        if (currentStatus === "SUSPENDED") {
            throw new AuthFailure("Your account has been suspended by administration. Please check your suspension notice or contact support.", "account_inactive", 403);
        } else if (currentStatus === "BLOCKED" || user.is_blocked) {
            throw new AuthFailure("Your account has been blocked due to administrative containment.", "account_blocked", 403);
        } else if (currentStatus === "PENDING_VERIFICATION" || currentStatus === "PENDING") {
            throw new AuthFailure("Your account is pending verification. Please wait for administrator approval.", "account_inactive", 403);
        } else if (currentStatus === "DEACTIVATED") {
            throw new AuthFailure("Your account has been deactivated.", "account_inactive", 403);
        } else if (currentStatus === "PENDING_DELETION") {
            throw new AuthFailure("Your account is currently pending deletion.", "account_inactive", 403);
        }

        throw new AuthFailure("Account is not active or verified.", "account_inactive", 403);
    }

    // Login successful
    await resetFailedAttempts(user.user_id);

    createAuditRecordRepo({
        event_type: "USER_LOGIN",
        event_category: "AUTHENTICATION",
        action: "LOGIN",
        status: "SUCCESS",
        actor_type: user.role_id === 3 ? "ADMIN" : "USER",
        actor_user_id: user.user_id,
        organization_type: user.role_id === 2 ? "EMPLOYER" : user.role_id === 4 ? "SCHOOL" : "FREELANCER",
        reason: "User logged in successfully",
    });

    let sessionId: string | undefined;
    try {
        const sessionRecord = await createUserSession({
            userId: user.user_id,
            deploymentId: clientInfo?.deploymentId || "default",
            userAgent: clientInfo?.userAgent,
            ipAddress: clientInfo?.ipAddress,
            locationLabel: clientInfo?.locationLabel,
        });
        sessionId = sessionRecord.session_id;
    } catch (sessionErr) {
        console.error("[auth.service] Failed to persist session record in vs_user_sessions:", sessionErr);
    }

    const session = await issueAuthSession({
        user_id: user.user_id,
        user_email: user.user_email,
        role: user.role,
        role_id: user.role_id,
        status: user.status,
        user_status: user.user_status,
        otp_verified: user.otp_verified,
        is_blocked: user.is_blocked,
        lock_until: user.lock_until,
        session_id: sessionId,
    });

    console.log(`[auth.service] User logged in: user_id=${user.user_id}, role_id=${user.role_id}, session_id=${sessionId}`);

    return {
        token: session.token,
        role_id: session.role_id,
        role: session.role,
        role_name: session.role_name,
        destination: session.destination,
        session_id: sessionId,
    };
}

export async function registerUser(body: unknown) {
    const { email, password, firstName, lastName, contact, role, province, city, barangay, street, jobTitle } = body as {
        email?: string;
        password?: string;
        firstName?: string;
        lastName?: string;
        contact?: string;
        role?: string;
        province?: string;
        city?: string;
        barangay?: string;
        street?: string;
        jobTitle?: string;
    };

    if (!email || !password || !firstName || !lastName || !contact || !role) {
        throw new Error("Missing required fields.");
    }

    const turnstileToken = (body as { turnstileToken?: string; "cf-turnstile-response"?: string })?.turnstileToken || (body as { "cf-turnstile-response"?: string })?.["cf-turnstile-response"];
    const turnstileResult = await verifyTurnstileToken(turnstileToken);
    if (!turnstileResult.success) {
        throw new Error(turnstileResult.message || "Security CAPTCHA verification failed.");
    }

    if (!validatePasswordStrict(password)) {
        throw new Error("Password does not meet security requirements.");
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
        throw new Error("Email is already registered.");
    }

    const saltRounds = BCRYPT_SALT_ROUNDS;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    let role_id = 1; // Default to FREELANCER
    if (String(role).toUpperCase() === 'EMPLOYER' || String(role).toUpperCase() === 'CLIENT') {
        role_id = 2;
    }

    const newUserPayload = {
        user_email: email,
        hash_password: hashedPassword,
        user_password: hashedPassword, // legacy compat
        user_fname: firstName,
        user_lname: lastName,
        user_contact: contact,
        role: String(role).toUpperCase(),
        role_id: role_id,
        status: "PENDING_VERIFICATION",
        user_province: province || null,
        user_city: city || null,
        user_brgy: street ? `${street}, ${barangay}` : (barangay || null),
        user_position: jobTitle || null,
    };

    const newUser = await createUser(newUserPayload);

    // Seed draft profile for Freelancers (role_id === 1)
    const envApiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const envToken = process.env.DIRECTUS_STATIC_TOKEN;
    if (role_id === 1 && envApiBase && envToken) {
        try {
            await fetch(`${envApiBase}/items/vs_job_seeker_profile`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${envToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user_id: newUser.user_id,
                    profile_status: "draft",
                    profile_completion_percent: 0,
                    profile_visibility: "Public"
                })
            });

            // 1. Associate Job Preferences (Employment Setup)
            interface SignupBody {
                employmentTypes?: string[];
                country?: string;
                skills?: string;
                resumeFileId?: string;
                resumeFileName?: string;
                govIdType?: string;
                govIdFrontFileId?: string;
                govIdBackFileId?: string;
            }
            const payload = body as SignupBody;

            const employmentTypes = payload.employmentTypes || [];
            const country = payload.country || "Philippines";
            const locationPref = [city, province, country].filter(Boolean).join(", ");
            await fetch(`${envApiBase}/items/vs_job_preferences`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${envToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    user_id: newUser.user_id,
                    work_setup: employmentTypes.length > 0 ? employmentTypes.join(", ") : null,
                    preferred_location: locationPref || null
                })
            });

            // 2. Associate Skills
            const skills = payload.skills || "";
            if (skills) {
                await associateSkills(newUser.user_id, skills);
            }

            // 3. Associate Resume
            const resumeFileId = payload.resumeFileId;
            const resumeFileName = payload.resumeFileName;
            if (resumeFileId) {
                await associateResume(newUser.user_id, resumeFileId, resumeFileName);
            }

            // 4. Associate Gov ID verification (optional during sign-up)
            const govIdType = payload.govIdType;
            const govIdFrontFileId = payload.govIdFrontFileId;
            const govIdBackFileId = payload.govIdBackFileId;
            if (govIdFrontFileId) {
                await associateGovId(newUser.user_id, govIdType || "", govIdFrontFileId, govIdBackFileId);
            }
        } catch (err) {
            console.error("Failed to seed job seeker profile on registration:", err);
        }
    }

    createAuditRecordRepo({
        event_type: "USER_REGISTERED",
        event_category: "USER",
        action: "CREATE",
        status: "SUCCESS",
        actor_type: "USER",
        actor_user_id: newUser.user_id,
        resource_type: "vs_user",
        resource_id: String(newUser.user_id),
        organization_type: role_id === 2 ? "EMPLOYER" : "FREELANCER",
        reason: `New user registration for ${email}`,
    });

    // Generate 6-digit OTP using CSPRNG
    const otpCode = randomInt(100000, 1000000).toString();

    const now = new Date();
    const expiry = new Date(now.getTime() + 10 * 60 * 1000);

    const otpSentAt = getPHTimeString(now);
    const otpExpiry = getPHTimeString(expiry);

    // Hash OTP before persisting to database
    const hashedOtp = await bcrypt.hash(otpCode, BCRYPT_SALT_ROUNDS);

    await updateUserOTP(newUser.user_id, hashedOtp, otpExpiry, otpSentAt);
    await sendOTP(email, otpCode);

    // SEC-023: no primary key in the response. /verify-otp is keyed by the email
    // the caller just submitted, so nothing here has to disclose the sequential
    // vs_user.user_id to drive the next step.
    return { requireOtp: true };
}

export async function confirmOTP(email: string, code: string) {
    if (!email || !code) {
        throw new Error('Email and verification code are required.');
    }

    // SEC-023: the caller now supplies an email instead of a user id, so every
    // answer that comes back before the code itself is checked has to be the same
    // one a wrong code gets — "no such account", "no pending code" and "attempts
    // exhausted" would each be an existence oracle otherwise. The server-side
    // rejection behaviour is unchanged for all of them.
    const INVALID_OTP = 'Invalid verification code.';
    const user = await getUserByEmail(email);
    const hasPendingOtp = Boolean(user?.otp_code);
    const otpHash = hasPendingOtp ? String(user.otp_code) : await getDummyCredentialHash();
    // The compare always runs so a missing account costs the same bcrypt work as
    // a wrong code; an absent code can never validate.
    const codeMatches = await bcrypt.compare(String(code), otpHash);
    const isOtpValid = hasPendingOtp && codeMatches;

    if (!user || !hasPendingOtp || !isOtpValid) {
        if (user) {
            const currentAttempts = user.failed_attempts || 0;
            // The budget stays server-side and is never pushed past its ceiling.
            if (currentAttempts < MAX_FAILED_ATTEMPTS) {
                await updateFailedAttempts(user.user_id, currentAttempts + 1);
            }
            createAuditRecordRepo({
                event_type: "OTP_VERIFY_FAILED",
                event_category: "AUTHENTICATION",
                action: "OTP_VERIFY",
                status: "FAILED",
                actor_type: "USER",
                actor_user_id: Number(user.user_id),
                reason: !hasPendingOtp
                    ? "OTP verification attempted with no pending code on the account"
                    : currentAttempts >= MAX_FAILED_ATTEMPTS
                        ? "OTP verification rejected after the attempt budget was spent"
                        : `Invalid OTP code entered (attempt ${currentAttempts + 1})`,
            });
        } else {
            createAuditRecordRepo({
                event_type: "OTP_VERIFY_FAILED",
                event_category: "AUTHENTICATION",
                action: "OTP_VERIFY",
                status: "FAILED",
                actor_type: "USER",
                reason: `OTP verification attempted for unknown email ${email}`,
            });
        }
        throw new Error(INVALID_OTP);
    }

    const userId = user.user_id;

    // Validate expiry using pure string comparison against current PH Time
    const expiryStr = String(user.otp_expiry).replace('T', ' ').substring(0, 19);
    const nowPH = new Date(new Date().getTime() + 8 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    if (expiryStr < nowPH) {
        createAuditRecordRepo({
            event_type: "OTP_VERIFY_EXPIRED",
            event_category: "AUTHENTICATION",
            action: "OTP_VERIFY",
            status: "FAILED",
            actor_type: "USER",
            actor_user_id: Number(userId),
            reason: "Expired OTP code submitted",
        });
        throw new Error('Verification code has expired.');
    }

    await markOTPVerified(userId);
    await resetFailedAttempts(userId);

    // Send Welcome Account Creation email for Client/Employer accounts
    if (user.role_id === 2 || String(user.role).toUpperCase() === 'CLIENT' || String(user.role).toUpperCase() === 'EMPLOYER') {
        try {
            const envApiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
            const envToken = process.env.DIRECTUS_STATIC_TOKEN;
            let companyName = "your organization";

            if (envApiBase) {
                const headers: Record<string, string> = { "Content-Type": "application/json" };
                if (envToken) headers["Authorization"] = `Bearer ${envToken}`;
                const compRes = await fetch(`${envApiBase}/items/vs_company_user?filter[user_id][_eq]=${user.user_id}&fields=company_id.company_name`, { headers, cache: "no-store" });
                if (compRes.ok) {
                    const compJson = await compRes.json();
                    const foundName = compJson?.data?.[0]?.company_id?.company_name;
                    if (foundName) companyName = String(foundName);
                }
            }

            await sendEmployerAccountCreationEmail({
                email: user.user_email,
                companyName,
                recipientName: user.user_fname,
            });
        } catch (e) {
            console.error("Failed to send employer account creation email upon OTP verification:", e);
        }
    }

    createAuditRecordRepo({
        event_type: "OTP_VERIFY_SUCCESS",
        event_category: "AUTHENTICATION",
        action: "OTP_VERIFY",
        status: "SUCCESS",
        actor_type: "USER",
        actor_user_id: Number(userId),
        reason: "OTP verification completed successfully",
    });

    const verifiedUser = await getUserById(userId);
    const session = await issueAuthSession({
        user_id: verifiedUser.user_id,
        user_email: verifiedUser.user_email,
        user_fname: verifiedUser.user_fname,
        user_lname: verifiedUser.user_lname,
        role: verifiedUser.role,
        role_id: verifiedUser.role_id,
        status: verifiedUser.status,
        user_status: verifiedUser.user_status,
        otp_verified: verifiedUser.otp_verified,
        is_blocked: verifiedUser.is_blocked,
        lock_until: verifiedUser.lock_until,
    });

    return {
        token: session.token,
        role_id: session.role_id,
        destination: session.destination,
    };
}

export async function requestPasswordReset(email: string) {
    const user = await getUserByEmail(email);
    if (!user) {
        // Silent success: Do not reveal if email exists
        return { ok: true };
    }

    // Generate 6-digit OTP using CSPRNG
    const otpCode = randomInt(100000, 1000000).toString();
    
    const now = new Date();
    const expiry = new Date(now.getTime() + RESET_OTP_EXPIRY_MS);
    
    const otpExpiryPH = getPHTimeString(expiry);
    
    const saltRounds = BCRYPT_SALT_ROUNDS;
    const hashedOtp = await bcrypt.hash(otpCode, saltRounds);
    const tokenId = randomUUID();
    
    await saveResetToken(user.user_id, tokenId, hashedOtp, otpExpiryPH);
    await sendPasswordResetOTP(email, otpCode);

    createAuditRecordRepo({
        event_type: "PASSWORD_RESET_REQUESTED",
        event_category: "AUTHENTICATION",
        action: "PASSWORD_RESET",
        status: "SUCCESS",
        actor_type: "USER",
        actor_user_id: user.user_id,
        reason: "Password reset OTP requested",
    });
    
    return { ok: true };
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string) {
    if (!email || !code || !newPassword) {
        throw new Error('Email, reset code, and new password are required.');
    }

    if (!validatePasswordStrict(newPassword)) {
        throw new Error('New password does not meet security requirements.');
    }

    // SEC-023: this step is now keyed only by the email the requester already
    // holds — never by vs_user.user_id — and every outcome short of a valid code
    // returns the same string, so an unknown address, an account that never asked
    // for a reset and a spent attempt budget are indistinguishable.
    const INVALID_CODE = 'Invalid or expired code.';
    const user = await getUserByEmail(email);
    const hasPendingReset = Boolean(user?.reset_token_hash);
    const tokenHash = hasPendingReset ? String(user.reset_token_hash) : await getDummyCredentialHash();
    const codeMatches = await bcrypt.compare(code, tokenHash);
    const currentAttempts = user?.failed_attempts || 0;
    const budgetExhausted = currentAttempts >= MAX_FAILED_ATTEMPTS;

    if (hasPendingReset && budgetExhausted) {
        // SEC-007: a spent budget invalidates the code even for a caller who
        // happens to hold the right one.
        await clearResetToken(user.user_id);
    }

    if (!user || !hasPendingReset || budgetExhausted || !codeMatches) {
        if (user && hasPendingReset && !budgetExhausted) {
            const nextAttempts = currentAttempts + 1;
            if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
                await clearResetToken(user.user_id);
            } else {
                await updateFailedAttempts(user.user_id, nextAttempts);
            }
            createAuditRecordRepo({
                event_type: "PASSWORD_RESET_FAILED",
                event_category: "AUTHENTICATION",
                action: "PASSWORD_RESET",
                status: "FAILED",
                actor_type: "USER",
                actor_user_id: Number(user.user_id),
                reason: `Invalid password reset code submitted (attempt ${nextAttempts})`,
            });
        } else if (user) {
            createAuditRecordRepo({
                event_type: "PASSWORD_RESET_FAILED",
                event_category: "AUTHENTICATION",
                action: "PASSWORD_RESET",
                status: "FAILED",
                actor_type: "USER",
                actor_user_id: Number(user.user_id),
                reason: budgetExhausted
                    ? "Password reset code invalidated after too many failed attempts"
                    : "Password reset code submitted with no pending reset on the account",
            });
        } else {
            createAuditRecordRepo({
                event_type: "PASSWORD_RESET_FAILED",
                event_category: "AUTHENTICATION",
                action: "PASSWORD_RESET",
                status: "FAILED",
                actor_type: "USER",
                reason: `Password reset code submitted for unknown email ${email}`,
            });
        }
        throw new Error(INVALID_CODE);
    }

    // Validate expiry — only reachable with the correct code.
    const expiryStr = String(user.reset_token_expiry).replace('T', ' ').substring(0, 19);
    const nowPH = getPHTimeString(new Date());

    if (expiryStr < nowPH) {
        createAuditRecordRepo({
            event_type: "PASSWORD_RESET_EXPIRED",
            event_category: "AUTHENTICATION",
            action: "PASSWORD_RESET",
            status: "FAILED",
            actor_type: "USER",
            actor_user_id: Number(user.user_id),
            reason: "Expired password reset code submitted",
        });
        throw new Error('Reset code has expired.');
    }
    
    const saltRounds = BCRYPT_SALT_ROUNDS;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Retain user_password column parameter as explicitly requested by user (hashed)
    await clearResetToken(user.user_id, hashedPassword);
    await resetFailedAttempts(user.user_id);

    createAuditRecordRepo({
        event_type: "PASSWORD_RESET_COMPLETED",
        event_category: "AUTHENTICATION",
        action: "PASSWORD_RESET",
        status: "SUCCESS",
        actor_type: "USER",
        actor_user_id: Number(user.user_id),
        reason: "Password reset completed successfully",
    });

    return { ok: true };
}

async function associateSkills(userId: number, skillsStr: string) {
    if (!skillsStr.trim()) return;
    const skillNames = skillsStr.split(',').map(s => s.trim()).filter(Boolean);
    const envApiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const envToken = process.env.DIRECTUS_STATIC_TOKEN;
    if (!envApiBase || !envToken) return;

    for (const name of skillNames) {
        try {
            // Check if skill exists
            const checkUrl = `${envApiBase}/items/vs_master_skills?filter[skill_name][_eq]=${encodeURIComponent(name)}&fields=id&limit=1`;
            const checkRes = await fetch(checkUrl, {
                headers: { "Authorization": `Bearer ${envToken}` }
            });
            let skillId: number | null = null;
            if (checkRes.ok) {
                const checkData = await checkRes.json();
                if (checkData.data && checkData.data.length > 0) {
                    skillId = checkData.data[0].id;
                }
            }

            // Create skill if not exists
            if (!skillId) {
                const createRes = await fetch(`${envApiBase}/items/vs_master_skills`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${envToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ skill_name: name })
                });
                if (createRes.ok) {
                    const createData = await createRes.json();
                    skillId = createData.data?.id;
                }
            }

            // Add to vs_user_skills_map
            if (skillId) {
                await fetch(`${envApiBase}/items/vs_user_skills_map`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${envToken}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({ user_id: userId, skill_id: skillId })
                });
            }
        } catch (err) {
            console.error(`Failed to associate skill "${name}":`, err);
        }
    }
}

async function associateResume(userId: number, fileId: string, fileName?: string) {
    const envApiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const envToken = process.env.DIRECTUS_STATIC_TOKEN;
    if (!envApiBase || !envToken || !fileId) return;

    try {
        await fetch(`${envApiBase}/items/vs_job_seeker_resumes`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${envToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: userId,
                file_url: `${envApiBase}/assets/${fileId}`,
                file_name: fileName || "Resume.pdf",
                is_primary: true,
                uploaded_at: new Date().toISOString()
            })
        });
    } catch (err) {
        console.error("Failed to associate resume file:", err);
    }
}

async function associateGovId(userId: number, govIdType: string, frontId: string, backId?: string) {
    const envApiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
    const envToken = process.env.DIRECTUS_STATIC_TOKEN;
    if (!envApiBase || !envToken || !frontId) return;

    try {
        await fetch(`${envApiBase}/items/vs_identity_verifications`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${envToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                user_id: userId,
                type: 'gov_id',
                status: 'pending',
                gov_id_type: govIdType,
                gov_id_front_image_uuid: frontId,
                gov_id_selfie_image_uuid: backId || null,
                submitted_at: new Date().toISOString()
            })
        });
    } catch (err) {
        console.error("Failed to associate government ID verification record:", err);
    }
}

