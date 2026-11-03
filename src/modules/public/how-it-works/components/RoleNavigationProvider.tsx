// src/modules/public/how-it-works/components/RoleNavigationProvider.tsx
"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_ACCOUNT_LABEL, FALLBACK_ACCOUNT_LABEL, ROLE_GUIDES } from "../config";
import { ROLE_KEYS, type RoleKey } from "../types";
import { RoleMismatchModal, type MismatchState } from "./RoleMismatchModal";

const CLOSED: MismatchState = { isOpen: false, currentRoleLabel: "", targetRoleLabel: "", targetRoute: "" };

const toGuideRole = (accountRole: string): RoleKey | undefined =>
  ROLE_KEYS.find((key) => ROLE_GUIDES[key].accountRoles.includes(accountRole));

interface Ctx {
  navigateSmart: (route: string, role: RoleKey) => Promise<void>;
  loading: boolean;
}

const RoleNavigationContext = createContext<Ctx | null>(null);

/** One provider = one modal + one auth check, shared by every CTA on the page. */
export function RoleNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mismatch, setMismatch] = useState<MismatchState>(CLOSED);

  const navigateSmart = useCallback(
    async (route: string, role: RoleKey) => {
      setLoading(true);
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            const userRole = toGuideRole(data.role);
            if (userRole === role) {
              router.push(data.dashboard ?? route);
              return;
            }
            setMismatch({
              isOpen: true,
              currentRoleLabel: userRole
                ? ROLE_GUIDES[userRole].accountLabel
                : data.role === "admin"
                  ? ADMIN_ACCOUNT_LABEL
                  : FALLBACK_ACCOUNT_LABEL,
              targetRoleLabel: ROLE_GUIDES[role].accountLabel,
              targetRoute: route,
            });
            return;
          }
        }
      } catch {
        // Not reachable: treat as signed out and continue to the route.
      } finally {
        setLoading(false);
      }
      router.push(route);
    },
    [router]
  );

  const closeModal = useCallback(() => setMismatch(CLOSED), []);

  const confirmSignOut = useCallback(async () => {
    const route = mismatch.targetRoute;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // PRIV-017: no client-side cookie expire - /api/auth/logout already
      // cleared the HttpOnly auth cookie and JS cannot overwrite it.
    } catch {
      // Ignore logout errors; the redirect below still happens.
    } finally {
      setMismatch(CLOSED);
      setLoading(false);
      if (route) window.location.href = route;
    }
  }, [mismatch.targetRoute]);

  const value = useMemo(() => ({ navigateSmart, loading }), [navigateSmart, loading]);

  return (
    <RoleNavigationContext.Provider value={value}>
      {children}
      <RoleMismatchModal state={mismatch} onClose={closeModal} onConfirmSignOut={confirmSignOut} loading={loading} />
    </RoleNavigationContext.Provider>
  );
}

export function useRoleNavigation() {
  const ctx = useContext(RoleNavigationContext);
  if (!ctx) throw new Error("useRoleNavigation must be used inside <RoleNavigationProvider>");
  return ctx;
}
