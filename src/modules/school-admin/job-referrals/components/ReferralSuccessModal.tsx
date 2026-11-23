// src/modules/school-admin/job-referrals/components/ReferralSuccessModal.tsx
"use client";

import React, { useState } from 'react';
import { useJobReferralsContext } from '../providers/JobReferralsProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Copy,
  Check,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';

export function ReferralSuccessModal() {
  const { isSuccessModalOpen, setIsSuccessModalOpen, createdResults } = useJobReferralsContext();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const sentCount = createdResults.filter((r) => r.email_sent).length;
  const allSent = sentCount === createdResults.length;

  const handleCopySingle = (id: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Referral link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const text = createdResults
      .map((r) => `${r.student_name}: ${r.referral_url}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success('All referral links copied to clipboard!');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-3xl">
        <DialogHeader className="text-center sm:text-left space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground">
                Referrals Successfully Dispatched!
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {allSent
                  ? `Generated ${createdResults.length} trackable invitation link(s) and dispatched official notification email(s) to the student(s).`
                  : `${sentCount} of ${createdResults.length} emails were sent. Resend the failed ones from Referral History.`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* List of generated links */}
        <div className="space-y-3 py-2 max-h-[340px] overflow-y-auto">
          {createdResults.map((item) => {
            const isCopied = copiedId === item.referral_id;
            return (
              <div
                key={item.referral_id}
                className="p-3 rounded-lg border bg-card/60 hover:bg-card transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {item.student_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({item.email})
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Active Token
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={
                        item.email_sent
                          ? 'text-[10px] bg-success/10 text-success'
                          : 'text-[10px] bg-destructive/10 text-destructive'
                      }
                    >
                      {item.email_sent ? 'Email sent' : 'Email not sent'}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={item.referral_url}
                    className="text-xs font-mono bg-muted/40 h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopySingle(item.referral_id, item.referral_url)}
                    className="h-8 px-2.5 shrink-0 gap-1 text-xs"
                  >
                    {isCopied ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {isCopied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            className="w-full sm:w-auto text-xs gap-1.5"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            {copiedAll ? 'All Copied' : 'Copy All Referral Links'}
          </Button>
          <Button
            type="button"
            onClick={() => setIsSuccessModalOpen(false)}
            className="w-full sm:w-auto text-xs"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
