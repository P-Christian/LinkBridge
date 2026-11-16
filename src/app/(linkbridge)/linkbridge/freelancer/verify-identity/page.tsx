import * as React from "react";
import { cookies } from "next/headers";
import { getFreelancerProfile } from "@/modules/freelancer/freelancer-profile/services/freelancer-profile.service";
import { fetchUserVerifications } from "@/modules/freelancer/freelancer-profile/services/identity-verification.repo";
import { calculateIdProofScore } from "@/modules/freelancer/freelancer-profile/services/identity-verification.service";
import { formatAssetUrl } from "@/lib/utils";
import VerifyIdentityClient from "./VerifyIdentityClient";

export const dynamic = "force-dynamic";

export default async function VerifyIdentityPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_sync_access_token")?.value;

    let profile = null;
    let initialVerifications: Awaited<ReturnType<typeof fetchUserVerifications>> = [];
    let initialScoreData: Awaited<ReturnType<typeof calculateIdProofScore>> = null;

    if (token) {
        try {
            [profile, initialScoreData] = await Promise.all([
                getFreelancerProfile(token),
                calculateIdProofScore(token),
            ]);

            if (profile?.user_id) {
                initialVerifications = await fetchUserVerifications(profile.user_id);
            }
        } catch (error) {
            console.error("Failed to prefetch verification data:", error);
        }
    }

    const user = {
        name: profile ? `${profile.user_fname || ""} ${profile.user_lname || ""}`.trim() || "Freelancer" : "Guest",
        email: profile?.user_email || "guest@example.com",
        avatar: formatAssetUrl(profile?.profile_image_url) || "",
    };

    return (
        <VerifyIdentityClient
            user={user}
            initialVerifications={initialVerifications}
            initialScoreData={initialScoreData}
        />
    );
}
