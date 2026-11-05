"use client";

// src/modules/freelancer/freelancer-messaging/components/ConversationItem.tsx

import React from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { Conversation } from "../types";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import ArchiveConversationModal from "@/modules/shared/messaging/components/ArchiveConversationModal";

interface Props {
  conversation: Conversation;
  isActive: boolean;
  currentUserId: number;
  onSelect: (conv: Conversation) => void;
  onArchive: (conversationId: number, nextArchived: boolean) => void;
}

export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";

  const [datePart, timePart = "00:00:00"] = dateStr.replace("T", " ").split(" ");

  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0] = timePart.split(":").map(Number);

  const messageDate = new Date(year, month - 1, day);
  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const diffDays = Math.floor(
    (todayDate.getTime() - messageDate.getTime()) / 86400000
  );

  // Manual 12-hour formatting
  const displayHour = hour % 12 || 12;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayTime = `${displayHour}:${minute
    .toString()
    .padStart(2, "0")} ${suffix}`;

  if (diffDays === 0) {
    return displayTime;
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    const weekdays = [
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ];

    return weekdays[messageDate.getDay()];
  }

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return `${months[month - 1]} ${day}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

/**
 * Parses raw system events or messages into concise, scannable preview text.
 * Centralized so Part 2 can easily connect structured event fields.
 */
export function formatEventPreview(raw: string): { text: string; isInterview: boolean } {
  if (!raw) return { text: "", isInterview: false };

  const trimmed = raw.trim();

  // Application moved to stage: XYZ -> Moved to XYZ
  const stageMatch = trimmed.match(/^Application moved to stage:\s*(.+)$/i);
  if (stageMatch) {
    return {
      text: `Moved to ${stageMatch[1].trim()}`,
      isInterview: false,
    };
  }

  // Interview events
  if (/^interview (scheduled|rescheduled|updated)/i.test(trimmed)) {
    return {
      text: `📅 ${trimmed.charAt(0).toUpperCase() + trimmed.slice(1)}`,
      isInterview: true,
    };
  }

  // Hired events
  if (/hired/i.test(trimmed) && trimmed.toLowerCase().includes("client hired")) {
    return {
      text: "🎉 You were hired!",
      isInterview: false,
    };
  }

  // Application submitted events
  if (/applied for/i.test(trimmed)) {
    return {
      text: "Application submitted",
      isInterview: false,
    };
  }

  return {
    text: trimmed,
    isInterview: false,
  };
}

export default function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onArchive,
}: Props) {
  const {
    conversation_id,
    other_party_name = "Unknown Employer",
    other_party_avatar,
    company_name,
    job_title,
    unread_count = 0,
    last_message_preview = "",
    last_message_at,
    archived_by_freelancer,
  } = conversation;

  const [imgError, setImgError] = React.useState(false);
  const [prevAvatar, setPrevAvatar] = React.useState(other_party_avatar);
  const [showArchiveConfirm, setShowArchiveConfirm] = React.useState(false);

  if (other_party_avatar !== prevAvatar) {
    setPrevAvatar(other_party_avatar);
    setImgError(false);
  }

  const isUnread = unread_count > 0 && !isActive;
  const hasJobTitle = Boolean(job_title && job_title.trim());

  // Line 1: Job title first. If no job title, fall back to company_name or other_party_name
  const primaryTitle = hasJobTitle
    ? job_title!.trim()
    : company_name || other_party_name;

  // Line 2: Company name in muted text. If no job title, show "Direct conversation" to avoid duplicate names
  const secondaryText = hasJobTitle
    ? company_name || other_party_name
    : "Direct conversation";

  // Line 3: Structured event formatting
  const { text: previewText, isInterview } = formatEventPreview(last_message_preview);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(conversation)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(conversation);
        }
      }}
      className={cn(
        "@container group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-border/50",
        isActive
          ? "bg-primary/[0.08]"
          : "hover:bg-accent/40"
      )}
    >
      {/* Active Accent Bar */}
      {isActive && (
        <motion.div
          layoutId="activeConversationBorderFreelancer"
          className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}

      {/* Avatar (Company Logo or Initials) */}
      <div className="relative shrink-0 mt-0.5">
        {other_party_avatar && !imgError ? (
          <Image
            src={other_party_avatar}
            alt={secondaryText}
            width={40}
            height={40}
            unoptimized
            onError={() => setImgError(true)}
            className="h-10 w-10 rounded-full object-cover ring-2 ring-primary/10 dark:ring-primary/20"
          />
        ) : (
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-primary/10 dark:ring-primary/20",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-gradient-to-br from-primary/80 to-info text-primary-foreground"
            )}
          >
            {getInitials(secondaryText || other_party_name)}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Job Title (Bold) + Unread Dot & Time */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm truncate",
              isUnread
                ? "font-bold text-foreground"
                : "font-semibold text-foreground/90 dark:text-foreground/80"
            )}
            title={primaryTitle}
          >
            {primaryTitle}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {isUnread && (
              <span
                role="status"
                aria-label="Unread message"
                className="h-2 w-2 rounded-full bg-primary shrink-0"
              />
            )}
            <span className="text-[11px] text-muted-foreground">
              {formatTime(last_message_at)}
            </span>
          </div>
        </div>

        {/* Line 2: Company Name (Muted) */}
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className="text-xs text-muted-foreground truncate"
            title={secondaryText}
          >
            {secondaryText}
          </span>
        </div>

        {/* Line 3: Message preview */}
        <p
          className={cn(
            "text-xs mt-1 truncate",
            isInterview ? "block" : "@max-xs:hidden",
            isUnread
              ? "font-medium text-foreground/90 dark:text-foreground/80"
              : "text-muted-foreground/80"
          )}
        >
          {previewText || "No messages yet"}
        </p>
      </div>

      {/* Archive button with Tooltip */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowArchiveConfirm(true);
            }}
            aria-label={archived_by_freelancer ? "Unarchive conversation" : "Archive conversation"}
            className="absolute right-3 top-3 hidden group-hover:flex items-center justify-center h-7 w-7 rounded-lg bg-card border border-border/60 shadow-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all max-md:flex max-md:min-h-11 max-md:min-w-11"
          >
            {archived_by_freelancer ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {archived_by_freelancer ? "Unarchive" : "Archive"}
        </TooltipContent>
      </Tooltip>

      <ArchiveConversationModal
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={() => {
          setShowArchiveConfirm(false);
          onArchive(conversation_id, !archived_by_freelancer);
        }}
        isArchived={Boolean(archived_by_freelancer)}
        conversationName={primaryTitle || secondaryText}
      />
    </div>
  );
}
