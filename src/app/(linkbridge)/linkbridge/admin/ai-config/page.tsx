"use client";

// src/app/(vos-sync)/linkbridge/admin/ai-config/page.tsx

import React from "react";
import { AiModelConfigModule } from "@/modules/vos-admin/ai-config";

export default function AiModelConfigPage() {
  return (
    <div className="h-full flex-1 overflow-y-auto p-4 sm:p-8 bg-secondary/10 space-y-6">
      <AiModelConfigModule />
    </div>
  );
}
