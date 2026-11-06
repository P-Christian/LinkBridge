"use client";

// src/app/(vos-sync)/linkbridge/admin/job-roles/skills/page.tsx

import React from "react";
import { RoleSkillManager } from "@/modules/vos-admin/role-matching";

export default function RoleSkillsPage() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 pb-24">
      <RoleSkillManager />
    </main>
  );
}
