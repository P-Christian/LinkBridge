import React from "react";
import AdminSettingsModule from "./AdminSettingsModule";

export const metadata = {
    title: "Admin Settings - LinkBridge",
    description: "Manage your admin profile, credentials, and theme options.",
};

export default function AdminSettingsPage() {
    return (
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
            <AdminSettingsModule />
        </main>
    );
}
