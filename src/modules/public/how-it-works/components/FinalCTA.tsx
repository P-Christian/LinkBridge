// src/modules/public/how-it-works/components/FinalCTA.tsx
"use client";

import type { RoleGuide } from "../types";
import { ActionButton } from "./ActionButton";

interface Props {
  guide: RoleGuide;
}

export function FinalCTA({ guide }: Props) {
  const { title, subtitle, secondary } = guide.finalCta;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 rounded-3xl p-8 sm:p-14 text-center text-white relative overflow-hidden border border-slate-700/50 space-y-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <h2 className="relative text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">{title}</h2>
        <p className="relative text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>

        <div className="relative pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
          <ActionButton
            action={guide.register}
            role={guide.roleKey}
            size="lg"
            className="rounded-full px-8 py-6 text-sm shadow-lg bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900"
          />
          {secondary && (
            <ActionButton
              action={secondary}
              role={guide.roleKey}
              size="lg"
              variant="outline"
              className="rounded-full px-8 py-6 text-sm border-slate-600 text-white bg-transparent hover:bg-white/10 hover:text-white"
            />
          )}
        </div>
      </div>
    </section>
  );
}