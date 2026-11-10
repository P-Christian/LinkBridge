"use client";

import { useState, useEffect } from "react";
import type { PlatformCompany } from "@/modules/vos-admin/platform-company/types/platformCompany.types";

export function usePrimaryPlatformCompany() {
  const [company, setCompany] = useState<PlatformCompany | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchPrimaryCompany() {
      try {
        const res = await fetch("/api/public/platform-company", {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Failed to load platform company");
        }
        const json = await res.json();
        if (isMounted) {
          setCompany(json.data ?? null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const e = err as Error;
          setError(e.message || "Failed to load company details");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchPrimaryCompany();

    return () => {
      isMounted = false;
    };
  }, []);

  return { company, loading, error };
}
