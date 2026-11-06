"use client";

// src/app/(vos-sync)/linkbridge/admin/job-roles/taxonomy/page.tsx

import React from "react";
import Link from "next/link";
import { ArrowLeft, Layers } from "lucide-react";
import { MatchingTaxonomyEditor } from "@/modules/vos-admin/role-matching";

export default function MatchingTaxonomyPage() {
  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8 pb-24">
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Back Link */}
        <div>
          <Link
            href="/linkbridge/admin/job-roles"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Matching Intelligence
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              Matching Taxonomy
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Unified governance of job categories, canonical standard roles, core skills with matching weights, and search keywords.
            </p>
          </div>
        </div>

        {/* Full Taxonomy Editor */}
        <MatchingTaxonomyEditor />
      </div>
    </main>
  );
}
