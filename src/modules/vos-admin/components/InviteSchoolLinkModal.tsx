"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, ExternalLink, Mail, School, Sparkles } from "lucide-react";
import { toast } from "sonner";

export interface InviteSchoolLinkModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly schoolName: string;
  readonly invitedEmail: string;
  readonly invitationUrl: string;
}

export function InviteSchoolLinkModal({
  isOpen,
  onClose,
  schoolName,
  invitedEmail,
  invitationUrl,
}: InviteSchoolLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (): void => {
    if (invitationUrl === "") return;
    navigator.clipboard.writeText(invitationUrl);
    setCopied(true);
    toast.success("Invitation link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[95vw] sm:max-w-xl md:max-w-2xl"
        data-testid="school-invite-link-modal"
      >
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <School className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                School Admin Invitation Link Generated
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Share this link with the school administrator. Registration is bound to the invited
                email below — no email is sent automatically.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground">
                {schoolName === "" ? "Unnamed school" : schoolName}
              </span>
              <Badge
                variant="outline"
                className="border-amber-300/40 bg-amber-50 text-[10px] text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              >
                School admin invite
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{invitedEmail}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="school-invite-url" className="text-xs font-semibold text-foreground">
              Registration URL:
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="school-invite-url"
                readOnly
                value={invitationUrl}
                data-testid="school-invite-url"
                className="h-10 select-all bg-muted/40 font-mono text-xs"
              />
              <Button
                type="button"
                onClick={handleCopy}
                data-testid="school-invite-copy"
                className="h-10 shrink-0 gap-1.5 px-4 text-xs font-semibold"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy Link"}
              </Button>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="leading-relaxed">
              The invitee must register with the exact email above. Each generation mints a new
              link; the invitation expires after 72 hours.
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-between border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(invitationUrl, "_blank")}
            className="gap-1.5 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Test Link
          </Button>
          <Button type="button" onClick={onClose} className="text-xs">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
