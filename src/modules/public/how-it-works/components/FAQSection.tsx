// src/modules/public/how-it-works/components/FAQSection.tsx
"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ_ITEMS, PAGE_COPY } from "../config";
import type { RoleKey } from "../types";

interface Props {
  activeRole: RoleKey;
}

export function FAQSection({ activeRole }: Props) {
  // undefined = "not touched yet" → first question open; null = user closed all.
  const [openId, setOpenId] = useState<string | null | undefined>(undefined);

  const faqs = FAQ_ITEMS.filter((item) => item.category === "general" || item.category === activeRole);
  const currentId = openId === undefined ? faqs[0]?.id : openId;

  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
      <div className="text-center space-y-3 mb-10">
        <h2 className="text-2xl sm:text-4xl font-extrabold text-foreground tracking-tight">{PAGE_COPY.faq.title}</h2>
        <p className="text-sm text-muted-foreground max-w-xl mx-auto">{PAGE_COPY.faq.subtitle}</p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq) => {
          const isOpen = currentId === faq.id;
          return (
            <div key={faq.id} className="bg-card border rounded-2xl overflow-hidden">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`${faq.id}-panel`}
                onClick={() => setOpenId(isOpen ? null : faq.id)}
                className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-foreground hover:text-primary transition-colors"
              >
                <span>{faq.question}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180 text-primary" : ""}`} />
              </button>
              {isOpen && (
                <div id={`${faq.id}-panel`} className="px-5 pb-5 pt-1 text-sm text-muted-foreground leading-relaxed">
                  {faq.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}