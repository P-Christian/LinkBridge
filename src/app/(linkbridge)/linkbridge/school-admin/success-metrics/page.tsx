// src/app/(vos-sync)/linkbridge/school-admin/success-metrics/page.tsx
import React from 'react';
import { PortalPageHeader } from '@/components/shared/layout/PortalPageHeader';

import { SuccessMetricsPage } from '@/modules/school-admin/success-metrics/SuccessMetricsPage';
import { fetchSchoolByUserIdRepo } from '@/modules/school-admin/services/school-admin.repo';
import { authenticateCookieSession } from '@/lib/authenticated-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Graduate Success & Placement Metrics | School Admin',
  description: 'View student employment success metrics, recruitment pipelines, and hiring trends.',
};

export default async function Page() {

  const session = await authenticateCookieSession();

  let schoolId = 1;
  let schoolName = 'Institution';

  if (session?.userId) {
    const userId = Number(session.userId);
    if (userId) {
      const school = await fetchSchoolByUserIdRepo(userId);
      if (school) {
        schoolId = school.school_id;
        schoolName = school.school_name || 'Institution';
      }
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <PortalPageHeader />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
        <SuccessMetricsPage initialSchoolId={schoolId} initialSchoolName={schoolName} />
      </main>
    </div>
  );
}

