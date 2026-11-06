"use server";

import { revalidatePath } from "next/cache";
import { createVerificationSubmission, approveMobileVerification, deleteExistingVerification, fetchUserVerifications, IdentityVerification } from "./identity-verification.repo";
import { getFreelancerProfile } from "./freelancer-profile.service";
import { checkRestriction } from "@/lib/status-validator";
import {
    authenticateCookieSession,
    isFreelancerSession,
} from "@/lib/authenticated-session";
import {
    FREELANCER_ADDRESS_UPLOAD_POLICY,
    FREELANCER_IDENTITY_IMAGE_UPLOAD_POLICY,
    getUploadedFile,
    safeFileName,
    validateUploadedFile,
} from "@/lib/file-upload";

const IDENTITY_FOLDER_ID =
    process.env.DIRECTUS_PROTECTED_FREELANCER_IDENTITY_FOLDER_ID?.trim() ||
    process.env.DIRECTUS_FREELANCER_IDENTITY_FOLDER_ID?.trim() ||
    "e81cc874-8036-4655-8bbb-1524a194866b";

const MOBILE_OTP_SIMULATION_ENABLED = process.env.NODE_ENV !== "production";

/** Philippine mobile numbers only; returns the normalized digits or null. */
function normalizeMobileNumber(value: unknown): string | null {
    const digits = String(value ?? "").replace(/\D/g, "");
    const local = digits.startsWith("63") ? digits.slice(2) : digits.replace(/^0/, "");
    return /^9\d{9}$/.test(local) ? `63${local}` : null;
}

async function requireFreelancerProfile() {
    const session = await authenticateCookieSession();
    if (!session || !isFreelancerSession(session)) throw new Error("Unauthorized");

    const profile = await getFreelancerProfile(session.token);
    if (!profile || String(profile.user_id) !== String(session.userId)) {
        throw new Error("Unauthorized");
    }
    return { session, profile };
}

function requireFileReference(value: unknown, label: string): string {
    const fileId = String(value ?? "").trim();
    if (!fileId || fileId.length > 255 || fileId.includes("/") || fileId.includes("\\")) {
        throw new Error(`${label} is invalid.`);
    }
    return fileId;
}

export async function uploadVerificationDocumentAction(_requestedUserId: number, formData: FormData) {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;

    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }

    let fileId: string | null = null;
    try {
        const { session } = await requireFreelancerProfile();
        const userId = Number(session.userId);
        if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Unauthorized");

        const isRestricted = await checkRestriction(userId, "UPLOAD_PROFILE_FILES");
        if (isRestricted) {
            throw new Error("Your profile file upload privileges are temporarily suspended.");
        }

        const file = getUploadedFile(formData);
        const documentClass = String(
            formData.get("documentClass") ?? formData.get("document_type") ?? "identity_image",
        ).toLowerCase();
        const policy = documentClass.includes("address")
            ? FREELANCER_ADDRESS_UPLOAD_POLICY
            : FREELANCER_IDENTITY_IMAGE_UPLOAD_POLICY;
        await validateUploadedFile(file, policy);

        const uploadUrl = `${NEXT_PUBLIC_API_BASE_URL}/files`;
        const directusFormData = new FormData();
        directusFormData.append("file", file, safeFileName(file.name));
        directusFormData.append("folder", IDENTITY_FOLDER_ID);
        const uploadRes = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
            body: directusFormData,
            cache: "no-store",
        });

        if (!uploadRes.ok) throw new Error(`Failed to upload media: HTTP ${uploadRes.status}`);
        const json = await uploadRes.json();
        fileId = json.data?.id || null;
        if (!fileId) throw new Error("Directus returned no uploaded file ID.");

        return { success: true, fileId };
    } catch (err: unknown) {
        if (fileId) {
            try {
                await fetch(`${NEXT_PUBLIC_API_BASE_URL}/files/${encodeURIComponent(fileId)}`, {
                    method: "DELETE",
                    headers: { "Authorization": `Bearer ${DIRECTUS_STATIC_TOKEN}` },
                    cache: "no-store",
                });
            } catch (cleanupError) {
                console.error("Failed to compensate identity document upload:", cleanupError);
            }
        }
        console.error("uploadVerificationDocumentAction Error:", err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

export async function submitIdentityVerificationAction(payload: Partial<IdentityVerification>) {
    try {
        const { profile } = await requireFreelancerProfile();
        const type = payload.type;
        if (type !== "gov_id" && type !== "address" && type !== "mobile_number") {
            throw new Error("Verification type is required");
        }

        // Only document fields are accepted from the caller. In particular,
        // user_id/status/reviewer fields can never override the session owner.
        const verificationPayload: Partial<IdentityVerification> = {
            type,
            user_id: profile.user_id,
            status: "pending",
        };
        if (type === "gov_id") {
            if (!payload.gov_id_front_image_uuid || !payload.gov_id_selfie_image_uuid) {
                throw new Error("Government ID images are required.");
            }
            const govIdType = String(payload.gov_id_type || "").trim();
            if (!govIdType) throw new Error("Government ID type is required.");
            verificationPayload.gov_id_type = govIdType.slice(0, 100);
            verificationPayload.gov_id_front_image_uuid = requireFileReference(payload.gov_id_front_image_uuid, "Government ID front image");
            verificationPayload.gov_id_selfie_image_uuid = requireFileReference(payload.gov_id_selfie_image_uuid, "Government ID selfie image");
        } else if (type === "address") {
            if (!payload.address_doc_image_uuid) throw new Error("Proof of address document is required.");
            verificationPayload.address_doc_image_uuid = requireFileReference(payload.address_doc_image_uuid, "Proof of address document");
        } else if (payload.mobile_number) {
            verificationPayload.mobile_number = String(payload.mobile_number).slice(0, 40);
        }

        // Backend Idempotency & Debounce Guard: Reject duplicate submissions if one is already pending within the last 30 seconds
        const existingVerifications = await fetchUserVerifications(profile.user_id);
        const recentPending = existingVerifications.find((v) => {
            if (v.type !== type || v.status !== "pending") return false;
            const submittedTime = new Date(v.submitted_at).getTime();
            return !isNaN(submittedTime) && Date.now() - submittedTime < 30000;
        });
        if (recentPending) {
            throw new Error("A submission for this requirement is already being processed. Please wait a moment.");
        }

        // Delete any existing verification record and associated files for this type
        await deleteExistingVerification(profile.user_id, type);

        await createVerificationSubmission(verificationPayload);

        const { recalculateAndPersistScoreForUser } = await import("./identity-verification.service");
        await recalculateAndPersistScoreForUser(profile.user_id, profile.user_email);

        revalidatePath("/linkbridge/freelancer/verify-identity");
        return { success: true };
    } catch (error) {
        console.error("submitIdentityVerificationAction Error:", error);
        const message = error instanceof Error ? error.message : "Failed to submit verification";
        return { success: false, error: message };
    }
}

export async function sendMobileOtpAction(mobileNumber: string) {
    try {
        await requireFreelancerProfile();
        if (!normalizeMobileNumber(mobileNumber)) throw new Error("Enter a valid mobile number.");

        // No SMS provider is wired up, so nothing is actually delivered. Refuse
        // the flow outside development instead of minting an unverified badge.
        if (!MOBILE_OTP_SIMULATION_ENABLED) {
            throw new Error("Mobile verification is temporarily unavailable.");
        }

        return { success: true, message: "OTP sent successfully" };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send OTP";
        return { success: false, error: message };
    }
}

export async function verifyMobileOtpAction(mobileNumber: string, otp: string) {
    try {
        const { profile } = await requireFreelancerProfile();

        const normalized = normalizeMobileNumber(mobileNumber);
        if (!normalized) throw new Error("Enter a valid mobile number.");

        if (!MOBILE_OTP_SIMULATION_ENABLED) {
            throw new Error("Mobile verification is temporarily unavailable.");
        }

        // Development-only simulated code. Never approve a mobile verification
        // here without a provider that proves the number is reachable.
        if (otp !== "123456") {
            throw new Error("Invalid OTP");
        }

        await approveMobileVerification(profile.user_id, normalized);

        const { recalculateAndPersistScoreForUser } = await import("./identity-verification.service");
        await recalculateAndPersistScoreForUser(profile.user_id, profile.user_email);

        revalidatePath("/linkbridge/freelancer/verify-identity");
        return { success: true };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to verify OTP";
        return { success: false, error: message };
    }
}
