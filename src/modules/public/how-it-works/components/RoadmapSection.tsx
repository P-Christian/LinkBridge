// src/modules/public/how-it-works/components/RoadmapSection.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { stepAnchor } from "../config";
import { ROLE_THEME } from "../theme";
import type { RoleGuide } from "../types";
import { StepCard } from "./StepCard";

interface Props {
  guide: RoleGuide;
}

export function RoadmapSection({ guide }: Props) {
  const scrollToStep = (e: React.MouseEvent<HTMLAnchorElement>, n: number) => {
    e.preventDefault();
    document.getElementById(stepAnchor(n))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-10 text-center space-y-3">
        <span className={`inline-block text-xs font-bold px-3.5 py-1 rounded-full border ${ROLE_THEME[guide.roleKey].badge}`}>
          {guide.badgeText}
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">{guide.heading}</h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">{guide.introduction}</p>

        <nav aria-label="Jump to step" className="pt-4 flex items-center justify-center gap-2">
          {guide.steps.map((s, i) => (
            <a
              key={s.title}
              href={`#${stepAnchor(i + 1)}`}
              onClick={(e) => scrollToStep(e, i + 1)}
              title={`Step ${i + 1}: ${s.title}`}
              className="group flex flex-col items-center gap-1 max-md:h-11 max-md:min-w-11 max-md:justify-center"
            >
              <span className="h-2.5 w-8 rounded-full bg-primary/20 group-hover:bg-primary transition-colors" />
              <span className="text-xs font-semibold text-muted-foreground group-hover:text-primary">{i + 1}</span>
            </a>
          ))}
        </nav>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={guide.roleKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          {guide.steps.map((step, i) => (
            <StepCard key={step.title} step={step} number={i + 1} roleKey={guide.roleKey} reversed={i % 2 === 1} />
          ))}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}