// src/modules/school-admin/job-referrals/components/ShareLinkSuccessDialog.tsx
"use client";

import React, { useState } from 'react';
import { useJobReferralsContext } from '../providers/JobReferralsProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarDays, Check, Copy, Link2 } from 'lucide-react';

function formatExpiryDate(value: string): string {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ShareLinkSuccessDialog() {
  const { createdShareLink, closeShareLinkSuccess } = useJobReferralsContext();
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (!createdShareLink) return null;

  const isCopied = copiedUrl === createdShareLink.referral_url;

  const handleCopy = () => {
    navigator.clipboard.writeText(createdShareLink.referral_url);
    setCopiedUrl(createdShareLink.referral_url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && closeShareLinkSuccess()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-lg font-bold text-foreground">
                {createdShareLink.reused ? 'Share link reused' : 'Share link created'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Copy this link and share it with your students.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={createdShareLink.referral_url}
              onFocus={(event) => event.currentTarget.select()}
              className="text-xs font-mono bg-muted/40 h-9"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="h-9 px-3 shrink-0 gap-1.5 text-xs"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-success" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 shrink-0" />
            Expires on {formatExpiryDate(createdShareLink.expires_at)}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" onClick={closeShareLinkSuccess} className="text-xs">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
