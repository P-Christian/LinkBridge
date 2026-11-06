// src/modules/freelancer/freelancer-applications/components/assessment-submission/ExternalTaskField.tsx
"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  taskId: number;
  url: string;
  value: string;
  disabled?: boolean;
  onChange: (responseText: string) => void;
}

export function ExternalTaskField({ taskId, url, value, disabled, onChange }: Props) {
  return (
    <div className="space-y-3">
      <Button asChild variant="outline" size="sm" className="rounded-lg">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          Open external task
        </a>
      </Button>
      <div className="space-y-1.5">
        <Label
          htmlFor={`assessment-external-${taskId}`}
          className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Completion note or result link
        </Label>
        <Textarea
          id={`assessment-external-${taskId}`}
          value={value}
          rows={3}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste the link to your finished work or briefly describe how you completed the task."
        />
      </div>
      <p className="text-xs text-muted-foreground">
        The task opens in a new browser tab. LinkBridge never opens, reads, or previews the linked
        page.
      </p>
    </div>
  );
}
