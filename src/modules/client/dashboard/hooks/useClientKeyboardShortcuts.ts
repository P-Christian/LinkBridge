"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useClientKeyboardShortcuts() {
  const router = useRouter();
  const leaderKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if user is currently typing inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.getAttribute("role") === "textbox")
      ) {
        return;
      }

      // Ignore if modifier keys are pressed
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      const key = e.key.toLowerCase();

      // Check for two-key sequences starting with 'g' (Go to...)
      if (leaderKeyRef.current === "g") {
        leaderKeyRef.current = null;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);

        if (key === "d") {
          e.preventDefault();
          router.push("/linkbridge/client/dashboard");
          return;
        }
        if (key === "j") {
          e.preventDefault();
          router.push("/linkbridge/client/jobs");
          return;
        }
      }

      if (key === "g") {
        leaderKeyRef.current = "g";
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          leaderKeyRef.current = null;
        }, 1000);
        return;
      }

      // Single key: 'n' for new job
      if (key === "n") {
        e.preventDefault();
        router.push("/linkbridge/client/jobs");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [router]);
}
