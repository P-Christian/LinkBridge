"use client";

// src/modules/freelancer/freelancer-messaging/components/EmptyState.tsx

import React from "react";
import { MessageSquareDashed } from "lucide-react";

interface Props {
  message?: string;
  subMessage?: string;
}

export default function EmptyState({
  message = "Select a conversation",
  subMessage = "Choose a conversation from the left to view messages",
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/15 blur-2xl rounded-full" />
        <div className="relative p-6 rounded-3xl bg-primary/10 border border-primary/20">
          <MessageSquareDashed className="h-12 w-12 text-primary" />
        </div>
      </div>
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground">
          {message}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {subMessage}
        </p>
      </div>
    </div>
  );
}
