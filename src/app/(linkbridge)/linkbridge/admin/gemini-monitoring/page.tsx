"use client";

// src/app/(vos-sync)/linkbridge/admin/gemini-monitoring/page.tsx

import React from "react";
import { GeminiMonitoringDashboard } from "@/modules/vos-admin/gemini-monitoring";

export default function GeminiMonitoringPage() {
  return (
    <div className="h-full flex-1 overflow-y-auto p-4 sm:p-8 bg-secondary/10 space-y-6">
      <GeminiMonitoringDashboard />
    </div>
  );
}
