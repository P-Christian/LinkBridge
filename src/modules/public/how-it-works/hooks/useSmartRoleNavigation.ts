// src/modules/public/how-it-works/hooks/useSmartRoleNavigation.ts
"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { MismatchState } from "../components/RoleMismatchModal";

export type TargetedRole = "employee" | "employer" | "school";

const INITIAL_MISMATCH: MismatchState = {
  isOpen: false,
  currentRoleLabel: "",
  targetRoleLabel: "",
  targetRoute: "",
};

export function useSmartRoleNavigation() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mismatchState, setMismatchState] = useState<MismatchState>(INITIAL_MISMATCH);

  const navigateSmart = useCallback(
    async (targetRoute: string, targetRole?: TargetedRole) => {
      let role: TargetedRole = targetRole || "employee";
      if (!targetRole) {
        if (targetRoute.includes("employer")) role = "employer";
        else if (targetRoute.includes("school")) role = "school";
        else if (targetRoute.includes("employee")) role = "employee";
      }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            const userRole = data.role as string;
            const isMatch =
              (role === "employee" && (userRole === "employee" || userRole === "freelancer")) ||
              (role === "employer" && (userRole === "employer" || userRole === "client")) ||
              (role === "school" && (userRole === "school" || userRole === "school_admin"));

            if (isMatch && data.dashboard) {
              router.push(data.dashboard);
              setLoading(false);
              return;
            }

            // Role Mismatch detected! Prompt user to sign out
            let currentRoleDisplay = "User";
            if (userRole === "employer" || userRole === "client") currentRoleDisplay = "an Employer";
            else if (userRole === "employee" || userRole === "freelancer") currentRoleDisplay = "an Employee";
            else if (userRole === "school" || userRole === "school_admin") currentRoleDisplay = "a School Admin";
            else if (userRole === "admin") currentRoleDisplay = "a Admin Portal";

            let targetDisplay = "School";
            if (role === "employer") targetDisplay = "Employer";
            else if (role === "employee") targetDisplay = "Employee";
            else if (role === "school") targetDisplay = "School";

            setMismatchState({
              isOpen: true,
              currentRoleLabel: currentRoleDisplay,
              targetRoleLabel: targetDisplay,
              targetRoute,
            });
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to route
      } finally {
        setLoading(false);
      }

      router.push(targetRoute);
    },
    [router]
  );

  const closeModal = useCallback(() => {
    setMismatchState(INITIAL_MISMATCH);
  }, []);

  const confirmSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // PRIV-017: no client-side cookie expire - /api/auth/logout already
      // cleared the HttpOnly auth cookie and JS cannot overwrite it.
    } catch {
      // Ignore logout errors
    } finally {
      const route = mismatchState.targetRoute;
      setMismatchState(INITIAL_MISMATCH);
      setLoading(false);
      if (route) {
        window.location.href = route;
      }
    }
  }, [mismatchState.targetRoute]);

  return {
    navigateSmart,
    loading,
    mismatchState,
    closeModal,
    confirmSignOut,
  };
}
