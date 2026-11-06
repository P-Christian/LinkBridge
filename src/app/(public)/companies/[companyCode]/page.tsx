import { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPublicCompanyByCode } from "@/modules/public/company-profile/services/company-profile.service";
import { CompanyProfileModule } from "@/modules/public/company-profile";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ companyCode: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { companyCode } = await params;
  const company = await getPublicCompanyByCode(companyCode);

  if (!company) {
    return {
      title: "Company Not Found | LinkBridge",
    };
  }

  return {
    title: `${company.company_name} Profile & Open Jobs | LinkBridge`,
    description: company.company_description
      ? `${company.company_description.slice(0, 150)}...`
      : `Learn more about working at ${company.company_name}. View active job listings and corporate information on LinkBridge.`,
  };
}

export default async function CompanyProfilePage({ params }: PageProps) {
  const { companyCode } = await params;
  const company = await getPublicCompanyByCode(companyCode);

  if (!company) {
    notFound();
  }

  return (
    <div className="min-h-screen relative z-10">
      <Suspense fallback={
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-muted-foreground animate-pulse font-sans">
          Loading company profile...
        </div>
      }>
        <CompanyProfileModule company={company} />
      </Suspense>
    </div>
  );
}
