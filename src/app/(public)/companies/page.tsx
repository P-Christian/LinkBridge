import { Metadata } from "next";
import { Suspense } from "react";
import {
  getBrowseCompanies,
  getIndustries,
  getCompanySizes,
  getTrustedCompanies
} from "@/modules/public/company-profile/services/company-profile.service";
import { CompaniesBrowseModule } from "@/modules/public/company-profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse Companies | LinkBridge",
  description: "Find verified employers hiring qualified professionals on LinkBridge. Explore industries, company sizes, and job vacancies.",
};

export default async function CompaniesPage() {
  // Fetch lists server side for initial render load speed
  const [browseResult, industries, sizes, trustedCompanies] = await Promise.all([
    getBrowseCompanies({}, { page: 1, limit: 10 }),
    getIndustries(),
    getCompanySizes(),
    getTrustedCompanies(20)
  ]);

  return (
    <div className="min-h-screen relative z-10">
      <Suspense fallback={null}>
        <CompaniesBrowseModule
          initialCompanies={browseResult.companies}
          initialTotal={browseResult.total}
          industries={industries}
          sizes={sizes}
          trustedCompanies={trustedCompanies}
        />
      </Suspense>
    </div>
  );
}
