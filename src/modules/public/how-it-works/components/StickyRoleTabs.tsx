// src/modules/public/how-it-works/components/StickyRoleTabs.tsx
"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ROLE_GUIDES, SECTION_IDS } from "../config";
import { ROLE_THEME } from "../theme";
import { ROLE_KEYS, type RoleKey } from "../types";

interface Props {
  activeRole: RoleKey;
  onSelectRole: (role: RoleKey) => void;
}

const NAVBAR_OFFSET_PX = 64; // keep in sync with `top-16` below

export function StickyRoleTabs({ activeRole, onSelectRole }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  // Show the tabs once the overview cards have scrolled under the navbar.
  useEffect(() => {
    const el = document.getElementById(SECTION_IDS.overview);
    if (!el) {
      queueMicrotask(() => {
        setIsVisible(true);
      });
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: `-${NAVBAR_OFFSET_PX}px 0px 0px 0px` }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed top-16 left-0 right-0 z-30 bg-background/90 backdrop-blur-md border-y py-3 px-4"
        >
          <div role="group" aria-label="Switch role" className="max-w-3xl mx-auto bg-muted/60 p-1.5 rounded-2xl grid grid-cols-3 gap-1 border">
            {ROLE_KEYS.map((role) => {
              const { icon: Icon } = ROLE_THEME[role];
              const isActive = role === activeRole;
              return (
                <button
                  key={role}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSelectRole(role)}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors duration-200 ${
                    isActive ? ROLE_THEME[role].tabActive : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {ROLE_GUIDES[role].shortLabel}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}