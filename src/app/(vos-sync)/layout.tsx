import * as React from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { UserProfileProvider } from "@/components/shared/providers/UserProfileProvider";
import { getFreelancerProfile } from "@/modules/freelancer/freelancer-profile/services/freelancer-profile.service";
import {
  lookupAccountAuthenticationState,
  type AccountLookup,
} from "@/lib/status-validator";

import { AppSidebar } from "@/app/(vos-sync)/vos-sync/_components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { BfCacheBuster } from "@/components/shared/BfCacheBuster";

import { formatAssetUrl } from "@/lib/utils";

function decodeJwtPayload(token: string): Record<string, string> | null {
    try {
        const parts = token.split(".");
        if (parts.length < 2) return null;
        const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
        const json = Buffer.from(padded, "base64").toString("utf8");
        return JSON.parse(json) as Record<string, string>;
    } catch {
        return null;
    }
}

function getAvatarUrl(imageField: string | undefined): string {
    return formatAssetUrl(imageField) || "";
}

export default async function DashboardLayout({
                                            children,
                                        }: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_sync_access_token")?.value;
    const payload = token ? decodeJwtPayload(token) : null;
    
    // Fetch live user authentication and verification state from DB
    const userId = payload?.user_id || payload?.sub;
    const lookup: AccountLookup = userId
        ? await lookupAccountAuthenticationState(userId)
        : { outcome: "missing" };
    const liveUser = lookup.outcome === "found" ? lookup.user : null;

    // Fetch the real freelancer profile from the DB to get the avatar image
    const profile = token ? await getFreelancerProfile(token) : null;

    const firstName = liveUser?.user_fname || profile?.user_fname || payload?.user_fname || payload?.Firstname || payload?.firstName || "";
    const lastName = liveUser?.user_lname || profile?.user_lname || payload?.user_lname || payload?.Lastname || payload?.lastName || "";
    const email = liveUser?.user_email || profile?.user_email || payload?.user_email || payload?.email || "guest@example.com";
    const name = [firstName, lastName].filter(Boolean).join(" ") || email;
    
    // Check profile_image_url (Freelancer DB style) and user_image (Admin style)
    const rawImage = profile?.profile_image_url || payload?.user_image;

    // Resolve user role
    const roleId = liveUser?.role_id || profile?.role_id || (payload?.role_id ? Number(payload.role_id) : undefined);
    let role: string | undefined = undefined;
    if (roleId === 1) role = "FREELANCER";
    else if (roleId === 2) role = "CLIENT";
    else if (roleId === 4) role = "SCHOOL_ADMIN";
    else if (roleId === 3 || roleId === 5) role = "ADMIN";

        // Derive verification status from the account row. The token's own
        // `status` claim is only consulted when Directus could not answer at
        // all; a row that does not exist has no status to advertise, and an
        // unsigned payload must not vouch for a row we did read.
    const effectiveStatus =
        lookup.outcome === "unavailable"
            ? String(payload?.status || "").toUpperCase()
            : String(liveUser?.status || "").toUpperCase();
    const isAdmin = roleId === 3 || roleId === 5 || role === "ADMIN";

    // Denials are tested before the administrator exemption so a suspended or
    // blocked admin cannot read as verified; the exemption still covers the
    // legacy admin rows that were created before `status` had a value.
    const deniedStatuses: Record<string, string> = {
        SUSPENDED: "SUSPENDED",
        BLOCKED: "SUSPENDED",
        DEACTIVATED: "SUSPENDED",
        PENDING_DELETION: "SUSPENDED",
        LIMITED: "LIMITED",
    };
    // `otp_verified` arrives as a numeric column from the row but as a string
    // from the JWT, where a raw "0" is truthy — so only an affirmative value
    // counts.
    const otpClaim = liveUser ? liveUser.otp_verified : payload?.otp_verified;
    const adminOtpVerified =
        isAdmin && (otpClaim === 1 || otpClaim === true || otpClaim === "1");

    let verificationStatus = "UNVERIFIED";
    if (deniedStatuses[effectiveStatus]) {
        verificationStatus = deniedStatuses[effectiveStatus];
    } else if (
        effectiveStatus === "ACTIVE" ||
        effectiveStatus === "VERIFIED" ||
        adminOtpVerified
    ) {
        verificationStatus = "VERIFIED";
    } else if (effectiveStatus === "PENDING_VERIFICATION" || effectiveStatus === "PENDING") {
        verificationStatus = "PENDING";
    }
const userProfile = {
        name,
        email,
        avatar: getAvatarUrl(rawImage as string),
        role,
        role_id: roleId,
        verification_status: verificationStatus,
        status: liveUser?.status || undefined,
        status_version: liveUser?.status_version || undefined,
    };

    return (
        <UserProfileProvider user={userProfile}>
            <BfCacheBuster />
            <SidebarProvider>
            <Suspense fallback={<div className="group peer text-sidebar-foreground hidden md:block w-64 border-r border-sidebar-border/60 bg-sidebar h-full" />}>
                <AppSidebar />
            </Suspense>

            {/* ? RIGHT column should be part of the body (NOT floating/inset card) */}
            <SidebarInset className="min-w-0 flex h-[100dvh] flex-col overflow-hidden bg-background p-0 m-0 rounded-none border-0 shadow-none">
                {children}
            </SidebarInset>
        </SidebarProvider>
        </UserProfileProvider>
    );
}
