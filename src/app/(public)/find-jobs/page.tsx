// src/app/(public)/find-jobs/page.tsx
import { Suspense } from "react";
import FindJobsModule from "@/modules/public/find-jobs";
import { getPublicJobs } from "@/app/api/public/find-jobs/route";
import type { PublicJobPosting, PopularPreset } from "@/modules/public/find-jobs/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Find Jobs & Career Opportunities",
  description:
    "Explore open job listings, remote positions, and career opportunities across verified companies in the Philippines.",
};

export default async function FindJobsPage() {
  let initialJobs: PublicJobPosting[] = [];
  let initialTotal = 0;
  let initialTotalPages = 1;
  let initialPopularPresets: PopularPreset[] = [];

  try {
    const res = await getPublicJobs({ limit: 12, page: 1 });
    initialJobs = res.data || [];
    initialTotal = res.meta?.total || 0;
    initialTotalPages = res.meta?.totalPages || 1;
    initialPopularPresets = res.meta?.popularPresets || [];
  } catch (err) {
    console.error("Error loading server jobs:", err);
  }

  return (
    <Suspense fallback={null}>
      <FindJobsModule
        initialJobs={initialJobs}
        initialTotal={initialTotal}
        initialTotalPages={initialTotalPages}
        initialPopularPresets={initialPopularPresets}
      />
    </Suspense>
  );
}
