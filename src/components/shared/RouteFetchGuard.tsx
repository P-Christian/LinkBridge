"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { abortSupersededReads, ensureRouteFetchAbort } from "@/lib/route-fetch";

export default function RouteFetchGuard() {
  const pathname = usePathname();

  useEffect(() => {
    ensureRouteFetchAbort();
    abortSupersededReads();
  }, [pathname]);

  return null;
}
