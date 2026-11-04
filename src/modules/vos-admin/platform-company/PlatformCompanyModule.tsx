"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { usePlatformCompany } from "./hooks/usePlatformCompany";
import { SinglePlatformCompanyEditor } from "./components/SinglePlatformCompanyEditor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Building2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

export function PlatformCompanyModule() {
  const {
    companies,
    loading,
    saving,
    loadCompanies,
    saveCompany,
  } = usePlatformCompany();

  const primaryCompany = useMemo(
    () => companies.find((c) => Number(c.is_primary) === 1 || c.is_primary === true) || companies[0],
    [companies]
  );

  return (
    <div className="space-y-6 w-full admin-page-transition">
      <style>{`
        @keyframes page-entry {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .admin-page-transition {
          animation: page-entry 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Header Banner - Transparent Glassmorphic Card */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background/40 dark:bg-card/25 backdrop-blur-xl text-foreground p-6 sm:p-8 rounded-3xl border border-primary/15 shadow-sm relative overflow-hidden"
      >
        <div className="flex items-center gap-4 relative z-10">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 2 }}
            whileTap={{ scale: 0.95 }}
            className="p-3.5 bg-primary/10 rounded-2xl border border-primary/20 text-primary transition-colors shrink-0"
          >
            <Building2 className="h-7 w-7" />
          </motion.div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Platform Company Profile</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-3 w-3" /> Single Entity
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Internal operating profile powering brand identity, customer support hours, values, and marketing copy across VOS Sync public pages.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 shrink-0">
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                await loadCompanies();
                toast.info("Refreshed platform company profile.");
              }}
              disabled={loading || saving}
              className="rounded-full bg-background/60 hover:bg-accent border-border/70 text-foreground text-xs h-10 px-4 transition-all shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* Editor Content */}
      {loading ? (
        <div className="p-6 rounded-3xl border border-primary/10 bg-card/70 space-y-6" role="status" aria-busy="true">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-10 rounded-xl" />
            ))}
          </div>
          <div className="space-y-4 pt-4">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      ) : primaryCompany ? (
        <SinglePlatformCompanyEditor
          company={primaryCompany}
          onSave={async (data) => {
            await saveCompany(data, primaryCompany.company_id);
          }}
          saving={saving}
        />
      ) : (
        <div className="p-12 rounded-3xl border border-dashed border-primary/20 bg-card/40 backdrop-blur-md text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-base text-foreground">No platform company record found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Directus could not find any platform company record. Please refresh or verify the Directus connection.
          </p>
        </div>
      )}
    </div>
  );
}

export default PlatformCompanyModule;
