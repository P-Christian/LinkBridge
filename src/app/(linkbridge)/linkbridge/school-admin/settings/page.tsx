import * as React from "react";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";

import { SchoolAdminSettingsModule } from "@/modules/school-admin/components/SchoolAdminSettingsModule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Settings | LinkBridge",
  description: "Manage personal administrator account details and workspace settings.",
};

export default async function SchoolAdminSettingsRoute() {


  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <PortalPageHeader />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
        <SchoolAdminSettingsModule />
      </main>
    </div>
  );
}
