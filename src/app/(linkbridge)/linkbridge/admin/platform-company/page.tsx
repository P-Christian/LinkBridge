import React from "react";
import PlatformCompanyModule from "@/modules/vos-admin/platform-company";

export const metadata = {
  title: "Platform Company | LinkBridge Admin",
  description: "Manage internal platform operating entities and public company profiles for landing pages.",
};

export default function PlatformCompanyPage() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 bg-secondary/10">
      <div className="max-w-[1600px] mx-auto w-full pb-16">
        <PlatformCompanyModule />
      </div>
    </main>
  );
}
