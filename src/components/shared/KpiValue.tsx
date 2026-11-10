// src/components/shared/KpiValue.tsx
"use client";

import React from "react";

interface KpiValueProps {
  /** `null` when the count could not be read. */
  value: number | null;
  /**
   * Set this only while the source list has never been fetched
   * (`loading && rows.length === 0`). A refetch keeps the previous rows in
   * state, so passing bare `loading` would blank cards that already hold
   * correct numbers on every manual refresh.
   */
  loading?: boolean;
}

/** The `---` shown in place of a KPI number that has not been derived yet. */
export function KpiPending() {
  return <span className="animate-pulse text-muted-foreground">---</span>;
}

/** The marker shown for a KPI whose read failed. */
export function KpiUnavailable() {
  return <span className="text-muted-foreground">Unavailable</span>;
}

/** A KPI number that never renders a fabricated 0 before its data has arrived. */
export function KpiValue({ value, loading }: KpiValueProps) {
  if (loading) {
    return <KpiPending />;
  }
  if (value === null) {
    return <KpiUnavailable />;
  }
  return <>{value.toLocaleString()}</>;
}
