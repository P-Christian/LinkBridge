"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

/**
 * Top loading bar for Next.js App Router.
 * - Starts when an internal link is clicked, trickles toward ~75%.
 * - Completes (100%) and fades out when the route changes.
 * - Plays a 0 -> 100% sweep on first load.
 *
 * Mount once in the root layout:  <TopProgressBar />
 */
function ProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams?.toString() ?? ""}`;

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  const clearTimers = () => {
    if (trickleRef.current) clearInterval(trickleRef.current);
    if (hideRef.current) clearTimeout(hideRef.current);
    trickleRef.current = null;
    hideRef.current = null;
  };

  const start = useCallback(() => {
    clearTimers();
    setVisible(true);
    setProgress(8);
    trickleRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 75) return p;
        // Slow down as it approaches 75%
        return p + Math.max(0.5, (75 - p) * 0.12);
      });
    }, 180);
  }, []);

  const done = useCallback(() => {
    clearTimers();
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 400);
  }, []);

  // Route committed -> finish the bar (and play the first-load sweep).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      start();
      const t = setTimeout(done, 300);
      return () => clearTimeout(t);
    }
    done();
  }, [routeKey, start, done]);

  // Start on internal link clicks or manual trigger.
  useEffect(() => {
    const onNavStart = () => {
      start();
    };

    const onClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      start();
    };

    window.addEventListener("navigation-start", onNavStart);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("navigation-start", onNavStart);
      document.removeEventListener("click", onClick, true);
      clearTimers();
    };
  }, [start]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="top-progress"
          className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-[2.5px]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          role="progressbar"
          aria-hidden="true"
        >
          <motion.div
            className="relative h-full bg-gradient-to-r from-primary via-info to-sky-400 shadow-[0_0_10px_2px_rgba(56,189,248,0.55)]"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: "easeOut", duration: progress === 100 ? 0.2 : 0.35 }}
          >
            {/* Glowing tip */}
            <span className="absolute right-0 top-1/2 h-3 w-16 -translate-y-1/2 rounded-full bg-sky-400/70 blur-md" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Programmatically triggers the top progress bar for router navigation.
 */
export function triggerTopProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("navigation-start"));
  }
}

// useSearchParams requires a Suspense boundary in the App Router.
export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  );
}
