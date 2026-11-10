// src/modules/client/messaging/types.ts

export type ConversationType = "JOB_APPLICATION" | "DIRECT_MESSAGE" | "SUPPORT";
export type ConversationStatus = "ACTIVE" | "ARCHIVED" | "BLOCKED";
export type MessageType = "TEXT" | "IMAGE" | "FILE" | "SYSTEM";

export type HiringViewerRole = "CANDIDATE" | "CLIENT" | "FREELANCER";

export type SystemEventType =
  | "APPLICATION_SUBMITTED"
  | "APPLICATION_STATUS_CHANGED"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_UPDATED"
  | "HIRED";

export interface StageTransitionCardData {
  event_type: string;
  application_id: number;
  viewer_role?: HiringViewerRole;
  stage_history_id?: number | null;
  from_stage_name?: string | null;
  to_stage_name?: string | null;
  from_stage_type?: string | null;
  to_stage_type?: string | null;
  job_title?: string | null;
  candidate_name?: string | null;
  applicant_name?: string | null;
  has_assessment_tasks?: boolean;
  has_scheduled_interview?: boolean;
  interview_id?: number | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  interview_status?: string | null;
  created_at?: string | null;
}

export interface SystemMessageData {
  system_message_id: number;
  message_id: number;
  event_type: SystemEventType;
  application_id?: number | null;
  interview_id?: number | null;
  stage_history_id?: number | null;
}

export interface Conversation {
  conversation_id: number;
  job_id: number | null;
  client_id: number;
  freelancer_id: number;
  conversation_type: ConversationType;
  status: ConversationStatus;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  archived_by_client: boolean;
  archived_by_freelancer: boolean;
  archived_at: string | null;
  // Enriched server-side
  other_party_name?: string;
  other_party_avatar?: string | null;
  other_party_email?: string | null;
  job_title?: string | null;
  unread_count?: number;
  last_message_preview?: string;
}

export const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "🎉", "🔥", "👀", "🙏", "❓"] as const;
export type ReactionEmoji = (typeof ALLOWED_REACTIONS)[number];

export interface MessageReactionUser {
  user_id: number;
  user_name: string;
}

export interface MessageReactionGroup {
  reaction: string;
  count: number;
  users: MessageReactionUser[];
  reacted_by_me: boolean;
}

export interface QuotedMessage {
  message_id: number;
  sender_id: number;
  sender_name?: string | null;
  message_content?: string | null;
  message_type?: MessageType;
  attachments?: MessageAttachment[];
  is_deleted?: boolean;
}

export interface Message {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  message_type: MessageType;
  message_content: string | null;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
  is_deleted: boolean;
  deleted_at?: string | null;
  deleted_by?: number | null;
  reply_to_message_id?: number | null;
  reply_to?: QuotedMessage | null;
  is_pinned?: boolean;
  pinned_at?: string | null;
  pinned_by?: number | null;
  attachments: MessageAttachment[];
  system_message?: SystemMessageData | null;
  system_card_data?: unknown;
  reactions?: MessageReactionGroup[];
  delivery_status?: "sending" | "sent" | "failed";
}

export interface MessageAttachment {
  attachment_id: number;
  message_id: number;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

export interface SendMessagePayload {
  message_content?: string;
  message_type?: MessageType;
  attachments?: Omit<MessageAttachment, "attachment_id" | "message_id" | "created_at">[];
  reply_to_message_id?: number | null;
}

export type MessageReportReasonCode =
  | "SPAM"
  | "HARASSMENT"
  | "INAPPROPRIATE_CONTENT"
  | "FRAUD_OR_SCAM"
  | "OFF_PLATFORM_PAYMENT"
  | "HATE_SPEECH"
  | "OTHER";

export interface MessageReportPayload {
  message_id?: number;
  conversation_id: number;
  reported_user_id: number;
  reason_code: MessageReportReasonCode;
  report_details?: string;
}

export interface CreateConversationPayload {
  freelancer_id: number;
  job_id?: number | null;
  conversation_type?: ConversationType;
}

export const CONVERSATION_TYPE_LABELS: Record<ConversationType, string> = {
  JOB_APPLICATION: "Job Application",
  DIRECT_MESSAGE: "Direct Message",
  SUPPORT: "Support",
};
