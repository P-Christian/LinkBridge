import * as React from "react";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";

import { SchoolAdminCoursesClient } from "@/modules/school-admin/components/SchoolAdminCoursesClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SchoolAdminCoursesRoute() {
   

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <PortalPageHeader />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
        <SchoolAdminCoursesClient />
      </main>
    </div>
  );
}
