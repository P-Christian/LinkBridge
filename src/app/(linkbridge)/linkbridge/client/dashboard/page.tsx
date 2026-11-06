// src/app/(vos-sync)/linkbridge/client/dashboard/page.tsx
import * as React from "react";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import DashboardModule from "@/modules/client/dashboard";
import { cookies } from "next/headers";
import { getClientProfile } from "@/modules/client/settings/services/client-profile.service";
import { getClientDashboardData } from "@/modules/client/dashboard/services/client-dashboard.service";
import type { DashboardData } from "@/modules/client/dashboard/types";
import { formatAssetUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE_NAME = "vos_sync_access_token";

export default async function clientDashboardPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    const profile = token ? await getClientProfile(token) : null;

    let initialDashboardData: DashboardData | null = null;
    if (profile?.user_id) {
        try {
            initialDashboardData = await getClientDashboardData(profile.user_id);
        } catch (err) {
            console.error("Failed to pre-render client dashboard metrics:", err);
        }
    }

    const headerUser = {
        name: profile
            ? [profile.user_fname, profile.user_lname].filter(Boolean).join(" ")
            : "Client",
        email: profile?.user_email || "owner@company.com",
        avatar: formatAssetUrl(profile?.profile_image_url) || "",
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <PortalPageHeader user={headerUser} />

            <PageContainer>
                <DashboardModule userName={headerUser.name} initialData={initialDashboardData} />
            </PageContainer>
        </div>
    );
}
