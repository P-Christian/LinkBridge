// src/modules/public/how-it-works/components/HeroSection.tsx
import { Layers } from "lucide-react";
import { BRAND, PAGE_COPY } from "../config";

export function HeroSection() {
  return (
    <header className="border-b pt-20 pb-12 px-4 sm:px-6 lg:px-8 text-center">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
          <Layers className="h-3.5 w-3.5" />
          {PAGE_COPY.hero.badge}
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
          How {BRAND} works
        </h1>

        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          {PAGE_COPY.hero.subtitle}
        </p>
      </div>
    </header>
  );
}