// src/app/(vos-sync)/linkbridge/client/company-profile/page.tsx
import * as React from "react";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";
import { PageContainer } from "@/components/shared/layout/PageContainer";
import CompanyProfileModule from "@/modules/client/company-profile";
import { cookies } from "next/headers";
import { getClientProfile } from "@/modules/client/settings/services/client-profile.service";
import { getClientCompanyProfileData, ClientCompanyProfileData } from "@/modules/client/company-profile/services/client-company-profile.service";
import { formatAssetUrl } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Company Profile | LinkBridge Client Portal",
  description: "View and manage your company profile on the LinkBridge Client Portal.",
};

const COOKIE_NAME = "vos_sync_access_token";

export default async function CompanyProfilePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  const profile = token ? await getClientProfile(token) : null;

  let initialCompanyData: ClientCompanyProfileData | null = null;
  if (profile?.user_id) {
    try {
      initialCompanyData = await getClientCompanyProfileData(profile.user_id);
    } catch (err) {
      console.error("Failed to pre-render company profile data:", err);
    }
  }

  const headerUser = {
    name: profile
      ? [profile.user_fname, profile.user_lname].filter(Boolean).join(" ")
      : "Client Owner",
    email: profile?.user_email || "owner@company.com",
    avatar: formatAssetUrl(profile?.profile_image_url) || "",
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PortalPageHeader user={headerUser} />

      <PageContainer>
        <CompanyProfileModule
          initialCompany={initialCompanyData?.company ?? null}
          initialMeta={initialCompanyData?.meta ?? null}
          initialError={initialCompanyData?.error ?? ""}
        />
      </PageContainer>
    </div>
  );
}
