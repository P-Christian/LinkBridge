"use client";

// src/modules/shared/messaging/components/SystemMessageRenderer.tsx

import React from "react";
import SystemPill from "./SystemPill";
import ApplicationCard from "./ApplicationCard";
import InterviewCard from "./InterviewCard";
import StageTransitionCard from "./StageTransitionCard";
import HiredCard from "./HiredCard";
import { Message, SystemEventType } from "@/modules/client/messaging/types";

// ── Registry ────────────────────────────────────────────────────────────────
// Add new event types here as the platform grows (offers, contracts, payments…)
const SYSTEM_MESSAGE_RENDERERS: Partial<
  Record<SystemEventType, React.ComponentType<{ message: Message }>>
> = {
  APPLICATION_SUBMITTED:      ApplicationCard,
  APPLICATION_STATUS_CHANGED: StageTransitionCard,
  HIRED:                      HiredCard,
  INTERVIEW_SCHEDULED:        InterviewCard,
  INTERVIEW_UPDATED:          InterviewCard,
};

interface Props {
  message: Message;
}

export default function SystemMessageRenderer({ message }: Props) {
  const sm = message.system_message;

  // Intercept HIRED events whether structured or fallback content text
  const contentLower = (message.message_content || "").toLowerCase();
  const isHiredEvent =
    sm?.event_type === "HIRED" ||
    contentLower.includes("client hired you") ||
    contentLower.includes("you were hired") ||
    contentLower.includes("candidate was hired");

  if (isHiredEvent) {
    return <HiredCard message={message} />;
  }

  // Permanent fallback — never remove.
  // Handles: legacy messages, unknown event types, missing vs_system_message row.
  if (!sm) {
    return <SystemPill text={message.message_content} />;
  }

  const Component = SYSTEM_MESSAGE_RENDERERS[sm.event_type];

  return Component ? (
    <Component message={message} />
  ) : (
    <SystemPill text={message.message_content} />
  );
}
