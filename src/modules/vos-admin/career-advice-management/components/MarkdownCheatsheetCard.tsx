// src/modules/vos-admin/career-advice-management/components/MarkdownCheatsheetCard.tsx
"use client";

import React from "react";
import { Keyboard, Sparkles } from "lucide-react";

export function MarkdownCheatsheetCard() {
  const shortcuts = [
    { syntax: "> quote", desc: "Callout / Quote Box", example: "Cyan accent card" },
    { syntax: "**text**", desc: "Bold Text", example: "Strong emphasis" },
    { syntax: "*text*", desc: "Italic Text", example: "Emphasis" },
    { syntax: "## text", desc: "Heading 2", example: "Major Section" },
    { syntax: "### text", desc: "Heading 3", example: "Subsection" },
    { syntax: "- item", desc: "Bullet List", example: "Unordered list" },
    { syntax: "1. item", desc: "Numbered List", example: "Ordered steps" },
    { syntax: "---", desc: "Divider Line", example: "Horizontal rule" },
    { syntax: "```", desc: "Code Block", example: "Monospace block" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Keyboard className="h-3.5 w-3.5 text-primary" /> Markdown & Typing Shortcuts
        </h4>
        <span className="text-[10px] text-muted-foreground font-mono">Live Formatting</span>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Type these shortcuts anywhere inside the article canvas to instantly format text without clicking buttons:
      </p>

      <div className="space-y-1.5 pt-1">
        {shortcuts.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between text-xs py-1 px-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <code className="text-[11px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
              {item.syntax}
            </code>
            <span className="text-[11px] text-muted-foreground font-medium text-right">
              {item.desc}
            </span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-border/50 flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-cyan-500 shrink-0 mt-0.5" />
        <span>
          Tip: Type <code className="text-primary font-mono">&gt; </code> at the start of any line to create the highlighted callout quote box.
        </span>
      </div>
    </div>
  );
}
