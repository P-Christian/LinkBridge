// src/modules/school-admin/job-referrals/components/ShareLinkDialog.tsx
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link2 } from 'lucide-react';

const EXPIRY_OPTIONS = [7, 14, 30, 60] as const;
const DEFAULT_EXPIRY_DAYS = 30;

function ShareLinkForm({
  schoolName,
  isCreating,
  onCreate,
  onCancel,
}: {
  schoolName: string;
  isCreating: boolean;
  onCreate: (expiresInDays: number) => void;
  onCancel: () => void;
}) {
  const [expiresInDays, setExpiresInDays] = useState<number>(DEFAULT_EXPIRY_DAYS);

  return (
    <>
      <div className="space-y-4 py-1">
        <div className="space-y-1.5">
          <Label htmlFor="share-link-expiry" className="text-xs font-semibold">
            Link expires in
          </Label>
          <Select
            value={String(expiresInDays)}
            onValueChange={(value) => setExpiresInDays(Number(value))}
          >
            <SelectTrigger id="share-link-expiry" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days} days
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          Only students at {schoolName} can accept this link.
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel} className="text-xs">
          Cancel
        </Button>
        <Button
          type="button"
          onClick={() => onCreate(expiresInDays)}
          disabled={isCreating}
          className="text-xs gap-2 font-semibold"
        >
          {isCreating ? 'Creating...' : 'Create'}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ShareLinkDialog() {
  const {
    activeShareJob,
    isShareLinkOpen,
    isCreatingShareLink,
    closeShareLinkDialog,
    createShareLink,
    schoolName,
  } = useJobReferralsContext();

  if (!activeShareJob) return null;

  return (
    <Dialog open={isShareLinkOpen} onOpenChange={(open) => !open && closeShareLinkDialog()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Link2 className="w-4 h-4 text-primary" />
            Create share link
          </DialogTitle>
          <DialogDescription className="text-xs">
            <span className="font-medium text-foreground">{activeShareJob.job_title}</span>
            {activeShareJob.company_name ? ` · ${activeShareJob.company_name}` : ''}
          </DialogDescription>
        </DialogHeader>

        <ShareLinkForm
          schoolName={schoolName}
          isCreating={isCreatingShareLink}
          onCreate={createShareLink}
          onCancel={closeShareLinkDialog}
        />
      </DialogContent>
    </Dialog>
  );
}
