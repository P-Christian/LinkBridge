import React from 'react';
import { PortalPageHeader } from '@/components/shared/layout/PortalPageHeader';

import { StudentRosterPage } from '@/modules/school-admin/student-roster/StudentRosterPage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Student Roster | School Admin',
  description: 'Manage school student roster and track referral registrations.',
};

export default async function Page() {


  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <PortalPageHeader />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
        <StudentRosterPage />
      </main>
    </div>
  );
}

