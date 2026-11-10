// src/modules/public/how-it-works/components/StepCard.tsx
"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { illustrationPath, PAGE_COPY, stepAnchor } from "../config";
import type { RoleKey, StepItem } from "../types";
import { ActionButton } from "./ActionButton";
import { StepIllustration } from "./StepIllustration";

interface Props {
  step: StepItem;
  number: number;
  roleKey: RoleKey;
  reversed: boolean; // illustration on the right (large screens)
}

export function StepCard({ step, number, roleKey, reversed }: Props) {
  return (
    <article id={stepAnchor(number)} className="py-12 border-b last:border-b-0 scroll-mt-28">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className={`lg:col-span-6 ${reversed ? "lg:order-2" : "lg:order-1"}`}>
          <StepIllustration src={illustrationPath(roleKey, step.illustration)} alt={step.illustrationAlt} roleKey={roleKey} />
        </div>

        <div className={`lg:col-span-6 space-y-5 ${reversed ? "lg:order-1" : "lg:order-2"}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              Step {number}
            </span>
            <Badge variant="outline" className="text-xs font-semibold">{step.statusChip}</Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {step.estimatedTime}
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{step.title}</h3>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{step.description}</p>

          <div className="p-4 rounded-xl border bg-muted/30 space-y-1">
            <h4 className="text-xs font-bold text-muted-foreground">{PAGE_COPY.step.why}</h4>
            <p className="text-sm font-medium text-foreground leading-relaxed">{step.outcome}</p>
          </div>

          {step.requirements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground">{PAGE_COPY.step.checklist}</h4>
              <ul className="space-y-1.5 text-sm text-foreground">
                {step.requirements.map((req) => (
                  <li key={req} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step.action && (
            <div className="pt-2">
              <ActionButton action={step.action} role={roleKey} className="h-11 md:h-9" />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}