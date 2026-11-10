// src/modules/public/how-it-works/components/QuickOverview.tsx
"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_COPY, SECTION_IDS } from "../config";
import { ROLE_KEYS, type RoleKey } from "../types";
import { RoleCard } from "./RoleCard";

interface Props {
  activeRole: RoleKey;
  onSelectRole: (role: RoleKey) => void;
}

export function QuickOverview({ activeRole, onSelectRole }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIndex = ROLE_KEYS.indexOf(activeRole);

  // Slide width + gap, measured from the first card.
  const measure = () => {
    const el = trackRef.current;
    const slide = el?.firstElementChild as HTMLElement | null;
    if (!el || !slide) return null;
    const width = slide.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
    return { el, width, step: width + gap };
  };

  const scrollBySlide = (direction: number) => {
    const m = measure();
    m?.el.scrollBy({ left: direction * m.step, behavior: "smooth" });
  };

  // Mobile: swiping the carousel selects the role it settles on.
  const handleTrackScroll = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      const m = measure();
      if (!m) return;
      const idx = Math.min(ROLE_KEYS.length - 1, Math.max(0, Math.round(m.el.scrollLeft / m.step)));
      if (ROLE_KEYS[idx] !== activeRole) onSelectRole(ROLE_KEYS[idx]);
    }, 60);
  };

  useEffect(() => () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

  // Keep the active card centered when the role changes elsewhere (tabs, URL).
  useEffect(() => {
    const m = measure();
    if (!m || m.el.scrollWidth <= m.el.clientWidth) return; // desktop grid: nothing to scroll
    m.el.scrollLeft = activeIndex * m.step - (m.el.clientWidth - m.width) / 2;
  }, [activeIndex]);

  return (
    <section id={SECTION_IDS.overview} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-center text-sm font-semibold text-muted-foreground mb-6">
        {PAGE_COPY.overviewTitle}
      </h2>

      {/* One markup: swipeable carousel on mobile, 3-column grid from md up. */}
      <div
        ref={trackRef}
        onScroll={handleTrackScroll}
        role="group"
        aria-label={PAGE_COPY.overviewTitle}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory overscroll-x-contain scrollbar-none pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:snap-none"
      >
        {ROLE_KEYS.map((role) => (
          <RoleCard
            key={role}
            role={role}
            active={role === activeRole}
            onSelect={onSelectRole}
            className="snap-center snap-always shrink-0 w-[85%] md:w-auto"
          />
        ))}
      </div>

      <div className="md:hidden flex items-center justify-center gap-3 pt-3">
        <button
          type="button"
          aria-label="Previous role"
          onClick={() => scrollBySlide(-1)}
          disabled={activeIndex === 0}
          className="h-11 w-11 flex items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1.5" aria-hidden>
          {ROLE_KEYS.map((role) => (
            <span
              key={role}
              className={`h-1.5 rounded-full transition-all ${role === activeRole ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label="Next role"
          onClick={() => scrollBySlide(1)}
          disabled={activeIndex === ROLE_KEYS.length - 1}
          className="h-11 w-11 flex items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}