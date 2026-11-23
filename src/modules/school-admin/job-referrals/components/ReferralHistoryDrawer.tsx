// src/modules/school-admin/job-referrals/components/ReferralHistoryDrawer.tsx
"use client";

import React, { useState } from 'react';
import { useJobReferralsContext } from '../providers/JobReferralsProvider';
import { VsJobReferral } from '../types/job-referrals.types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Copy,
  Check,
  Briefcase,
  History,
  ChevronDown,
  ChevronRight,
  Users,
  Ban,
  Loader2,
  MailPlus,
} from 'lucide-react';
import { toast } from 'sonner';

const CLOSED_STATUSES = new Set<string>([
  'REVOKED',
  'INVALIDATED',
  'APPLIED',
  'CLAIMED',
  'DECLINED',
  'EXPIRED',
]);

const REVOKE_BLOCKED_STATUSES = new Set<string>([
  'REVOKED',
  'EXPIRED',
  'CLAIMED',
  'APPLIED',
]);

export function ReferralHistoryDrawer() {
  const { isHistoryOpen, setIsHistoryOpen, referrals, revokeShareLink, resendReferral } = useJobReferralsContext();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<VsJobReferral | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [now] = useState(() => Date.now());

  const handleCopyLink = (id: number, url?: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Referral link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getEffectiveStatus = (referral: VsJobReferral): string => {
    if (referral.status === 'REVOKED' || referral.status === 'INVALIDATED') {
      return 'REVOKED';
    }
    if (
      referral.status === 'APPLIED' ||
      referral.status === 'CLAIMED' ||
      referral.status === 'DECLINED'
    ) {
      return referral.status;
    }
    if (
      !CLOSED_STATUSES.has(referral.status) &&
      new Date(referral.expires_at).getTime() < now
    ) {
      return 'EXPIRED';
    }
    return referral.status;
  };

  const toggleExpanded = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const referralId = revokeTarget.referral_id;
    setRevokingId(referralId);
    try {
      await revokeShareLink(referralId);
    } finally {
      setRevokingId(null);
      setRevokeTarget(null);
    }
  };

  const handleResend = async (referralId: number) => {
    setResendingId(referralId);
    try {
      await resendReferral(referralId);
    } finally {
      setResendingId(null);
    }
  };

  const getStatusBadge = (status: string, label?: string) => {
    switch (status) {
      case 'CLAIMED':
      case 'APPLIED':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-none text-[10px]">
            {label ?? status}
          </Badge>
        );
      case 'SENT':
      case 'CREATED':
        return (
          <Badge variant="outline" className="text-primary border-primary/40 text-[10px]">
            {label ?? status}
          </Badge>
        );
      case 'DECLINED':
      case 'REVOKED':
      case 'EXPIRED':
        return (
          <Badge variant="secondary" className="text-muted-foreground text-[10px]">
            {label ?? status}
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[10px]">{label ?? status}</Badge>;
    }
  };

  return (
    <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-1 pb-4 border-b">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <SheetTitle className="text-lg font-bold">Referral History</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Track student invitations and candidate applications referred by your institution.
          </SheetDescription>
        </SheetHeader>

        <div className="py-4 space-y-3">
          {referrals.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Briefcase className="w-8 h-8 text-muted-foreground/50 mx-auto" />
              <p className="text-sm font-medium text-muted-foreground">No referrals created yet.</p>
              <p className="text-xs text-muted-foreground/70">
                Browse active job vacancies and click &ldquo;Refer Students&rdquo; to begin.
              </p>
            </div>
          ) : (
            referrals.map((r) => {
              const isCopied = copiedId === r.referral_id;
              const isExpanded = expandedId === r.referral_id;
              const claimants = r.claimants ?? [];
              const claimCount = r.claim_count ?? 0;
              const effectiveStatus = getEffectiveStatus(r);
              const canRevoke = !REVOKE_BLOCKED_STATUSES.has(effectiveStatus);
              const isRevoking = revokingId === r.referral_id;
              const canResend = !REVOKE_BLOCKED_STATUSES.has(effectiveStatus);
              const isResending = resendingId === r.referral_id;
              return (
                <div
                  key={r.referral_id}
                  className="p-3.5 rounded-lg border border-border/80 bg-card hover:border-primary/40 transition-colors"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => toggleExpanded(r.referral_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleExpanded(r.referral_id);
                      }
                    }}
                    className="space-y-2 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                        )}
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                            {r.job_title || `Job #${r.job_id}`}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {r.company_name || 'Partner Company'}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(effectiveStatus)}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(r.created_at).toLocaleDateString()}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{claimCount > 0 ? `${claimCount} accepted` : 'No accepts yet'}</span>
                        </span>
                        {r.student_id != null && r.email_status != null && (
                          <Badge
                            variant="secondary"
                            className={
                              r.email_status === 'SENT'
                                ? 'text-[10px] bg-success/10 text-success'
                                : 'text-[10px] bg-destructive/10 text-destructive'
                            }
                          >
                            {r.email_status === 'SENT' ? 'Email sent' : 'Email not sent'}
                          </Badge>
                        )}
                      </div>
                      {r.display_hint && (
                        <span className="text-[11px] shrink-0">
                          {r.display_hint === 'Public share link' ? 'Shareable link' : r.display_hint}
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-border/40 space-y-2">
                      {claimants.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No accepts yet.</p>
                      ) : (
                        claimants.map((claimant, index) => (
                          <div
                            key={`${r.referral_id}-${claimant.email}-${index}`}
                            className="space-y-0.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-foreground truncate">
                                {claimant.name}
                              </span>
                              {claimant.applied && getStatusBadge('APPLIED', 'Applied')}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {claimant.email}
                            </p>
                            <p className="text-[11px] text-muted-foreground/70">
                              Accepted {new Date(claimant.consented_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 pt-1">
                    {r.referral_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyLink(r.referral_id, r.referral_url)}
                        className="text-xs h-7 gap-1 text-primary"
                      >
                        {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        {isCopied ? 'Link Copied' : 'Copy Link'}
                      </Button>
                    )}
                    {r.student_id != null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={!canResend || isResending}
                        onClick={() => handleResend(r.referral_id)}
                        className="text-xs h-7 gap-1 text-primary"
                      >
                        {isResending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <MailPlus className="w-3 h-3" />
                        )}
                        Resend
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canRevoke || isRevoking}
                      onClick={() => setRevokeTarget(r)}
                      className="text-xs h-7 gap-1 text-destructive hover:text-destructive"
                    >
                      {isRevoking ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Ban className="w-3 h-3" />
                      )}
                      Revoke
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this link?</AlertDialogTitle>
            <AlertDialogDescription>
              The link will stop working for everyone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={revokingId !== null}
              onClick={handleRevoke}
            >
              Revoke link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
