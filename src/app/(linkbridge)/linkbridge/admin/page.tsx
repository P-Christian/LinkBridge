import React from "react";
import { SchoolAdminDashboard } from "../../../../modules/vos-admin";

export const metadata = {
    title: "Admin Portal - LinkBridge",
    description: "Dedicated portal for managing post-graduates and school tasks.",
};

export default function SchoolAdminPage() {
    return (
        <div className="flex-1 overflow-y-auto min-h-0">
            <main className="w-full">
                <SchoolAdminDashboard />
            </main>
        </div>
    );
}
