"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Copy,
  Building,
  Calendar,
 
  Shield,
  Trash2,
  Save,
  MessageSquare,
  Clock,
 
} from "lucide-react";
import { toast } from "sonner";
import { formatWallClock } from "@/lib/utils";
import type {
  ContactMessage,
  ContactMessageStatus,
} from "../types/contact-message.types";

interface ContactMessageDetailModalProps {
  message: ContactMessage | null;
  isOpen: boolean;
  /** The detail read is still in flight: the dialog has to say so, or a row
   *  click looks like a dead control. */
  loading?: boolean;
  onClose: () => void;
  onUpdate: (
    id: number,
    patch: { status?: ContactMessageStatus; internal_note?: string }
  ) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
  updating?: boolean;
}

const STATUS_CONFIG: Record<
  ContactMessageStatus,
  { label: string; tone: string; desc: string }
> = {
  new: {
    label: "New",
    tone: "bg-info/15 text-info border-info/30",
    desc: "Unreviewed incoming submission",
  },
  read: {
    label: "Read",
    tone: "bg-primary/10 text-primary border-primary/25",
    desc: "Opened and viewed by an administrator",
  },
  resolved: {
    label: "Resolved",
    tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    desc: "Inquiry answered or action completed",
  },
  archived: {
    label: "Archived",
    tone: "bg-muted text-muted-foreground border-border",
    desc: "Saved for record-keeping; no further action needed",
  },
};

export function ContactMessageDetailModal({
  message,
  isOpen,
  loading = false,
  onClose,
  onUpdate,
  onDelete,
  updating = false,
}: ContactMessageDetailModalProps) {
  const [prevMessageId, setPrevMessageId] = useState<number | null>(message?.id ?? null);
  const [internalNote, setInternalNote] = useState(message?.internal_note || "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (message && message.id !== prevMessageId) {
    setPrevMessageId(message.id);
    setInternalNote(message.internal_note || "");
    setConfirmDelete(false);
  }

  if (!message) {
    if (!isOpen || !loading) return null;
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-[94vw] sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border border-primary/15 bg-card/95 backdrop-blur-2xl shadow-2xl">
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-1/2 rounded" />
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(message.email);
      toast.success("Email copied to clipboard");
    } catch {
      // No clipboard (insecure context, or permission refused): say so instead
      // of leaving the admin thinking the button is broken.
      toast.error("Copy blocked — select the address and copy it manually");
    }
  };

  const handleStatusChange = async (newStatus: ContactMessageStatus) => {
    // Re-clicking the current status must not fire a PATCH: it would restamp
    // reviewed_by/reviewed_at and toast a successful update of nothing.
    if (newStatus === message.status) return;
    await onUpdate(message.id, { status: newStatus });
  };

  const noteDirty = internalNote.trim() !== (message.internal_note || "").trim();

  const handleSaveNote = async () => {
    await onUpdate(message.id, { internal_note: internalNote.trim() });
  };

  const handleDelete = async () => {
    await onDelete(message.id);
  };

  const statusMeta = STATUS_CONFIG[message.status] || STATUS_CONFIG.read;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-3xl border border-primary/15 bg-card/95 backdrop-blur-2xl shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border/80 bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <DialogHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Contact Inquiry</span>
              </div>
              <Badge variant="outline" className={`rounded-full px-3 py-0.5 text-xs font-semibold border ${statusMeta.tone}`}>
                {statusMeta.label}
              </Badge>
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              {message.subject}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              Received on {formatWallClock(message.created_at)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Sender Info Card */}
          <div className="rounded-2xl border border-primary/10 bg-background/50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm">
                  {message.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                    {message.name}
                    {message.user_role && (
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider rounded-md border-primary/20 bg-primary/5 text-primary">
                        {message.user_role}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{message.email}</span>
                    <button
                      type="button"
                      onClick={handleCopyEmail}
                      title="Copy sender email"
                      className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors p-1 rounded-md hover:bg-primary/10 cursor-pointer text-xs"
                    >
                      <Copy className="h-3 w-3" />
                      <span className="text-[11px] font-medium">Copy</span>
                    </button>
                  </div>
                </div>
              </div>

              {message.company && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-xl border border-border/60">
                  <Building className="h-3.5 w-3.5 text-primary/70" />
                  <span className="font-medium text-foreground">{message.company}</span>
                </div>
              )}
            </div>
          </div>

          {/* Message Body */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Message Content
            </h4>
            <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words min-h-[100px]">
              {message.message}
            </div>
          </div>

          {/* Workflow & Status Controls */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Update Status
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["new", "read", "resolved", "archived"] as ContactMessageStatus[]).map((st) => {
                const conf = STATUS_CONFIG[st];
                const active = message.status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleStatusChange(st)}
                    disabled={updating}
                    aria-pressed={active}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all border text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-[1.02]"
                        : "border-border/70 bg-card/60 hover:bg-card/90 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>{conf.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">{statusMeta.desc}</p>
          </div>

          {/* Admin Internal Note */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label htmlFor="admin-note" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Internal Note (Staff Only)
              </label>
              {message.reviewed_at && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Reviewed: {formatWallClock(message.reviewed_at)}
                </span>
              )}
            </div>
            <Textarea
              id="admin-note"
              rows={3}
              maxLength={2000}
              placeholder="Add review notes, follow-up status, or customer context here..."
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
              className="rounded-xl resize-none text-sm border-border/80 bg-background/60 focus-visible:ring-primary/20"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSaveNote}
                disabled={updating || !noteDirty}
                className="rounded-full h-8 px-4 text-xs bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                Save Note
              </Button>
            </div>
          </div>

          {/* Danger Zone: Soft Delete */}
          <div className="pt-4 border-t border-border/60 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Soft-delete hides this message from the active inbox.
            </p>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full h-8 text-xs px-3"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={updating}
                  className="rounded-full h-8 text-xs px-3 bg-destructive hover:bg-destructive/90 text-destructive-foreground cursor-pointer"
                >
                  Confirm Delete
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full h-8 px-3 gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete message
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
