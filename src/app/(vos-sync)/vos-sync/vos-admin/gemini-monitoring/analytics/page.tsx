// src/app/(vos-sync)/vos-sync/vos-admin/gemini-monitoring/analytics/page.tsx

import React from "react";
import { PeakUsageAnalyticsPage } from "@/modules/vos-admin/gemini-monitoring";

export const metadata = {
  title: "Peak Usage & Analytics | LinkBridge Admin",
  description: "AI invocation surge analytics, peak throughput, and hourly load distributions.",
};

export default function GeminiAnalyticsRoute() {
  return (
    <div className="h-full flex-1 overflow-y-auto p-4 sm:p-8 bg-secondary/10 space-y-6">
      <PeakUsageAnalyticsPage />
    </div>
  );
}
