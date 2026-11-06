"use client";

// src/app/(vos-sync)/linkbridge/admin/job-roles/approval-queue/page.tsx

import React from "react";
import { ApprovalQueuePanel } from "@/modules/vos-admin/role-matching";

export default function ApprovalQueuePage() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-24">
      <ApprovalQueuePanel />
    </main>
  );
}
