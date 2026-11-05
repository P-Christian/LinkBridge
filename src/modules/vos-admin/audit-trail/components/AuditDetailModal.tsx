// src/modules/vos-admin/audit-trail/components/AuditDetailModal.tsx
"use client";

import React, { useState } from 'react';
import { AuditRecord } from '../types/audit.types';
import { AuditActionBadge } from './AuditActionBadge';
import { AuditStatusBadge } from './AuditStatusBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Calendar,
  User,
  Shield,
  Server,
  ArrowRight,
  Building2,
  Briefcase,
  FileText,
  Bot,
  Globe,
  Laptop,
  Sparkles,
} from 'lucide-react';

interface AuditDetailModalProps {
  record: AuditRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditDetailModal({ record, isOpen, onClose }: AuditDetailModalProps) {
  const [activeTab, setActiveTab] = useState<string>("overview");

  if (!record) return null;

  const formatDate = (isoStr: string) => {
    if (!isoStr) return "N/A";
    try {
      const cleaned = isoStr.replace(" ", "T");
      const d = new Date(cleaned);
      if (isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  // Compute diff object from old_values vs new_values
  const oldVals = record.old_values || {};
  const newVals = record.new_values || {};
  const allKeys = Array.from(new Set([...Object.keys(oldVals), ...Object.keys(newVals)]));

  const diffItems = allKeys
    .map((key) => {
      const oldV = oldVals[key];
      const newV = newVals[key];
      let status: 'added' | 'removed' | 'changed' | 'unchanged' = 'unchanged';

      if (oldV === undefined && newV !== undefined) status = 'added';
      else if (oldV !== undefined && newV === undefined) status = 'removed';
      else if (JSON.stringify(oldV) !== JSON.stringify(newV)) status = 'changed';

      // Normalize string display
      const formatVal = (val: unknown) => {
        if (val === undefined || val === null) return null;
        if (Array.isArray(val)) return val.join(", ");
        if (typeof val === "object") return JSON.stringify(val);
        return String(val);
      };

      return {
        key,
        oldVal: formatVal(oldV),
        newVal: formatVal(newV),
        status,
      };
    })
    .filter((item) => {
      if (item.status === 'unchanged') return false;
      // Filter out redundant empty-to-null additions
      if ((item.oldVal === null || item.oldVal === "<none>") && (item.newVal === null || item.newVal === "null")) {
        return false;
      }
      return true;
    });

  // Dynamic Actor Information
  const actorType = (record.actor_type || 'USER').toUpperCase();
  const isSystemActor = actorType === 'SYSTEM' || actorType === 'SERVICE';
  const isAdminActor = actorType === 'ADMIN';

  const actorName = isSystemActor
    ? (actorType === 'SERVICE' ? 'Background Service' : 'System Automation')
    : (record.actor_name || record.actor_email || (record.actor_user_id ? `User #${record.actor_user_id}` : 'Platform User'));

  // Dynamic Target / Resource Information
  const resourceType = (record.resource_type || record.event_category || 'RESOURCE').toUpperCase();
  const isCompanyTarget = resourceType === 'COMPANY' || resourceType === 'VERIFICATION';
  const isJobTarget = resourceType === 'JOB';
  const isUserTarget = resourceType === 'USER' || resourceType === 'EMPLOYEE' || resourceType === 'AUTHENTICATION';
  const isAppTarget = resourceType === 'APPLICATION';

  const targetTitle = record.resource_name || (record.resource_id ? `${record.resource_type || 'Target'} #${record.resource_id}` : 'Platform System');

  const getTargetIcon = () => {
    if (isCompanyTarget) return <Building2 className="h-4 w-4 text-amber-500" />;
    if (isJobTarget) return <Briefcase className="h-4 w-4 text-blue-500" />;
    if (isUserTarget) return <User className="h-4 w-4 text-emerald-500" />;
    if (isAppTarget) return <FileText className="h-4 w-4 text-violet-500" />;
    return <Shield className="h-4 w-4 text-primary" />;
  };

  const getActorIcon = () => {
    if (isSystemActor) return <Bot className="h-4 w-4 text-cyan-500" />;
    if (isAdminActor) return <Shield className="h-4 w-4 text-primary" />;
    return <User className="h-4 w-4 text-blue-500" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => { if (!val) onClose(); }}>
      <DialogContent className="!max-w-5xl w-[92vw] max-h-[88vh] overflow-y-auto border border-border bg-background p-6 rounded-2xl">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-[11px] font-semibold">
                  {record.event_category}
                </Badge>
                <AuditActionBadge action={record.action} />
                <AuditStatusBadge status={record.status} />
              </div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                {record.event_type}
              </DialogTitle>
            </div>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
              Audit #{record.audit_id}
            </span>
          </div>
          <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <Calendar className="h-3.5 w-3.5" />
            Occurred on {formatDate(record.created_at)}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-2 w-full bg-muted">
            <TabsTrigger value="overview" className="text-xs font-medium">Overview</TabsTrigger>
            <TabsTrigger value="diff" className="text-xs font-medium">State Diff</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Dynamic Actor Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    {getActorIcon()} Actor Details
                  </h4>
                  <Badge variant="secondary" className="text-[10px] font-semibold uppercase">
                    {actorType}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Initiator Name:</span>
                    <p className="font-semibold text-sm text-foreground">{actorName}</p>
                    {record.actor_email && (
                      <span className="text-muted-foreground text-[11px] font-mono">{record.actor_email}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                    {record.actor_user_id && (
                      <div>
                        <span className="text-muted-foreground text-[11px]">User Account ID:</span>
                        <p className="font-mono font-medium text-foreground">#{record.actor_user_id}</p>
                      </div>
                    )}
                    {record.actor_company_id && (
                      <div>
                        <span className="text-muted-foreground text-[11px]">Affiliated Company:</span>
                        <p className="font-mono font-medium text-foreground">Company #{record.actor_company_id}</p>
                      </div>
                    )}
                    {isAdminActor && !record.actor_company_id && (
                      <div>
                        <span className="text-muted-foreground text-[11px]">Authority Scope:</span>
                        <p className="font-medium text-primary">System Administrator</p>
                      </div>
                    )}
                    {isSystemActor && (
                      <div>
                        <span className="text-muted-foreground text-[11px]">Execution Mode:</span>
                        <p className="font-medium text-cyan-600 dark:text-cyan-400">Automated Pipeline</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic Target Resource Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    {getTargetIcon()} Target Entity
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                    {record.resource_type || record.event_category}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {isCompanyTarget ? "Target Company:" : isJobTarget ? "Target Job Posting:" : isUserTarget ? "Target User / Candidate:" : "Target Resource:"}
                    </span>
                    <p className="font-semibold text-sm text-foreground">{targetTitle}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                    {record.resource_id && (
                      <div>
                        <span className="text-muted-foreground text-[11px]">
                          {isCompanyTarget ? "Company ID:" : isJobTarget ? "Job ID:" : isUserTarget ? "User ID:" : "Resource ID:"}
                        </span>
                        <p className="font-mono font-medium text-foreground">#{record.resource_id}</p>
                      </div>
                    )}
                    {record.organization_type && (
                      <div>
                        <span className="text-muted-foreground text-[11px]">Organization Type:</span>
                        <p className="font-medium text-foreground">{record.organization_type}</p>
                      </div>
                    )}
                    {record.organization_id && (
                      <div>
                        <span className="text-muted-foreground text-[11px]">Org Account ID:</span>
                        <p className="font-mono font-medium text-foreground">#{record.organization_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Security & Audit Telemetry Card */}
            {(record.ip_address || record.user_agent || record.correlation_id) && (
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" /> Security & Network Telemetry
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                  {record.ip_address && (
                    <div>
                      <span className="text-muted-foreground text-[11px]">IP Address:</span>
                      <p className="font-mono font-medium text-foreground">{record.ip_address}</p>
                    </div>
                  )}
                  {record.correlation_id && (
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground text-[11px]">Correlation ID:</span>
                      <p className="font-mono text-xs text-foreground truncate">{record.correlation_id}</p>
                    </div>
                  )}
                </div>
                {record.user_agent && (
                  <div className="pt-2 border-t border-border/40 text-xs">
                    <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                      <Laptop className="h-3 w-3" /> Client User Agent:
                    </span>
                    <p className="font-mono text-[11px] text-muted-foreground break-all">{record.user_agent}</p>
                  </div>
                )}
              </div>
            )}

            {/* Reason / Operational Notes Card */}
            {record.reason && (
              <div className="p-4 rounded-xl border bg-amber-500/10 border-amber-500/20 space-y-1">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Reason Remarks
                </h4>
                <p className="text-xs text-foreground leading-relaxed">{record.reason}</p>
              </div>
            )}
          </TabsContent>

          {/* Diff Tab */}
          <TabsContent value="diff" className="pt-4">
            {diffItems.length === 0 ? (
              <div className="p-8 text-center border border-border rounded-xl bg-muted/30">
                <Server className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">No state changes recorded for this event.</p>
              </div>
            ) : (
              <div className="border border-border rounded-xl bg-card overflow-hidden shadow-xs">
                <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Entity State Modifications
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {diffItems.length} field{diffItems.length === 1 ? "" : "s"} updated
                  </span>
                </div>
                <div className="divide-y divide-border/60 max-h-[420px] overflow-y-auto">
                  {diffItems.map((item) => {
                    let badgeColor = "bg-muted text-muted-foreground";
                    let statusLabel = item.status.toUpperCase();

                    if (item.status === 'added') {
                      badgeColor = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
                      statusLabel = "SET";
                    } else if (item.status === 'removed') {
                      badgeColor = "bg-destructive/15 text-destructive";
                      statusLabel = "CLEARED";
                    } else if (item.status === 'changed') {
                      badgeColor = "bg-amber-500/15 text-amber-700 dark:text-amber-400";
                      statusLabel = "MODIFIED";
                    }

                    // Format human-friendly key label
                    const formatKey = (rawKey: string) => {
                      const mapping: Record<string, string> = {
                        account_status: "Account Status",
                        reason_code: "Policy Reason Code",
                        duration: "Restriction Duration",
                        expires_at: "Expiration Timestamp",
                        restrictions: "Prohibited Capabilities",
                        verification_status: "Verification Status",
                        school_status: "School Status",
                        internal_notes: "Internal Notes",
                      };
                      return mapping[rawKey] || rawKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                    };

                    return (
                      <div key={item.key} className="p-3.5 hover:bg-muted/15 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground">
                            {formatKey(item.key)}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${badgeColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs bg-muted/20 p-2.5 rounded-lg border border-border/50">
                          <div className="space-y-0.5">
                            <span className="text-[10px] text-muted-foreground uppercase font-sans">Previous State</span>
                            <p className="text-destructive font-medium break-all">
                              {item.oldVal ?? "<none>"}
                            </p>
                          </div>
                          <div className="space-y-0.5 sm:border-l sm:border-border sm:pl-3">
                            <span className="text-[10px] text-muted-foreground uppercase font-sans flex items-center gap-1">
                              <ArrowRight className="h-3 w-3 text-muted-foreground" /> New State
                            </span>
                            <p className="text-emerald-600 dark:text-emerald-400 font-semibold break-all">
                              {item.newVal ?? "<none>"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
