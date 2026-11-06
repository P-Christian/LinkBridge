import * as React from "react";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";
 
import { SchoolAdminProfileClient } from "@/modules/school-admin/components/SchoolAdminProfileClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SchoolAdminProfileRoute() {


  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <PortalPageHeader />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
        <SchoolAdminProfileClient />
      </main>
    </div>
  );
}
