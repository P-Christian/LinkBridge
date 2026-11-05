"use client";

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Eye,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { VsUser } from "../types/user.types";
import { UserStatusBadge } from "./UserStatusBadge";
import { formatAssetUrl } from "@/lib/utils";
 
interface UserManagementTableProps {
  users: VsUser[];
  loading: boolean;
  onSelectUser: (user: VsUser) => void;
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}
 
export const UserManagementTable: React.FC<UserManagementTableProps> = ({
  users,
  loading,
  onSelectUser,
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onPageSizeChange: _onPageSizeChange,
}) => {
  const getImageUrl = (uuid: string) => formatAssetUrl(uuid) || "";

  if (loading) {
    return (
      <div className="rounded-xl border bg-card/60 backdrop-blur-sm p-16 text-center text-muted-foreground shadow-sm">
        <div className="inline-block animate-spin rounded-full h-9 w-9 border-3 border-primary/30 border-t-primary mb-4"></div>
        <p className="text-sm font-semibold text-foreground">Synchronizing user queue...</p>
        <p className="text-xs text-muted-foreground mt-1">Fetching latest user accounts & details</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-16 text-center text-muted-foreground shadow-sm">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mb-4 text-muted-foreground/60">
          <Users className="h-7 w-7" />
        </div>
        <h4 className="text-base font-bold text-foreground">No user records found</h4>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
          There are currently no user accounts matching your search or filter criteria.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);

  const getRoleLabel = (roleId: number | null) => {
    switch (roleId) {
      case 1: return "Freelancer";
      case 2: return "Client";
      case 3: return "Admin";
      case 4: return "School Admin";
      default: return "Unknown";
    }
  };

  const getVerificationStatus = (user: VsUser): 'pending' | 'approved' | 'rejected' | 'not_submitted' => {
    const verifs = user.verifications || [];
    if (verifs.length === 0) return 'not_submitted';
    if (verifs.some(v => v.status === 'pending')) return 'pending';
    if (verifs.some(v => v.status === 'rejected')) return 'rejected';
    
    const typesPresent = new Set(verifs.filter(v => v.status === 'approved').map(v => v.type));
    if (typesPresent.has('gov_id') && typesPresent.has('address') && typesPresent.has('mobile_number')) {
      return 'approved';
    }
    
    if (typesPresent.size > 0) {
      return 'pending';
    }
    
    return 'not_submitted';
  };

  const getJobSeekerProfile = (user: VsUser) => {
    const profile = user.job_seeker_profile || user.vs_job_seeker_profile;
    return (Array.isArray(profile) ? profile[0] : profile) as Record<string, string | number | null | undefined>;
  };

  const getUserAvatarUrl = (user: VsUser) => {
    const img = user.profile_image_url || user.user_image;
    if (!img) return null;
    if (img.startsWith("http") || img.startsWith("/")) return img;
    return getImageUrl(img);
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm transition-all w-full overflow-hidden flex flex-col">
      <div className="max-h-[560px] overflow-auto w-full relative">
        <Table className="min-w-[900px] w-full border-collapse">
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md shadow-xs">
            <TableRow className="bg-muted/80 hover:bg-muted/80 border-b">
              <TableHead className="py-3.5 pl-6 pr-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[240px]">
                User Details
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[150px]">
                Role
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[120px]">
                Completion
              </TableHead>
              <TableHead className="py-3.5 px-4 text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[180px]">
                Verification Status
              </TableHead>
              <TableHead className="py-3.5 pr-6 pl-4 text-right text-xs font-bold tracking-wider text-muted-foreground uppercase min-w-[130px]">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const initials = `${user.user_fname?.[0] || ""}${user.user_lname?.[0] || ""}`.toUpperCase() || "US";
              const status = getVerificationStatus(user);

              const profileObj = getJobSeekerProfile(user);

              // Calculate completion percent; if user has submitted verification documents pending review, ensure progress reflects pending submissions (minimum 10% per pending doc) so 0% does not contradict 'Pending Review'
              const rawCompletion = user.role_id === 1 && profileObj
                ? Number(profileObj.profile_completion_percent || 0)
                : null;
              const pendingDocsCount = (user.verifications || []).filter(v => v.status === 'pending').length;
              const completionPercent = rawCompletion !== null && rawCompletion === 0 && pendingDocsCount > 0
                ? Math.min(30, pendingDocsCount * 10)
                : rawCompletion;

              const completionColor =
                completionPercent !== null && completionPercent >= 90
                  ? "bg-emerald-500"
                  : completionPercent !== null && completionPercent >= 50
                  ? "bg-amber-500"
                  : "bg-rose-500";

              const avatarUrl = getUserAvatarUrl(user);

              return (
                <TableRow
                  key={user.user_id}
                  className="hover:bg-accent/40 transition-colors group border-b last:border-0"
                >
                  {/* User Details */}
                  <TableCell className="py-4 pl-6 pr-4 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 text-primary border border-primary/20 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarUrl}
                            alt={`${user.user_fname} ${user.user_lname}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials
                        )}
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="font-bold text-foreground text-sm flex items-center gap-2">
                          <span className="truncate max-w-[200px]" title={`${user.user_fname} ${user.user_lname}`}>
                            {user.user_fname} {user.user_lname}
                          </span>
                          {user.is_blocked ? (
                            <Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 border-rose-500/20 px-1.5 py-0">
                              Blocked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-1.5 py-0">
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate max-w-[200px]" title={user.user_email}>
                            {user.user_email}
                          </span>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="font-mono text-[11px] text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded">
                            ID: #{user.user_id}
                          </span>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Role */}
                  <TableCell className="py-4 px-4">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                      {getRoleLabel(user.role_id)}
                    </span>
                  </TableCell>

                  {/* Completion */}
                  <TableCell className="py-4 px-4">
                    {completionPercent !== null ? (
                      <div className="space-y-1 w-24">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-semibold text-foreground">{completionPercent}%</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${completionColor}`}
                            style={{ width: `${Math.min(100, completionPercent)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>

                  {/* Verification Status */}
                  <TableCell className="py-4 px-4">
                    <UserStatusBadge status={status} />
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-4 pr-6 pl-4 text-right">
                    {(() => {
                      const hasPendingDocuments = (user.verifications || []).some(v => v.status === 'pending');
                      const isActionableReview = status === 'pending' || hasPendingDocuments;

                      return (
                        <Button
                          variant={isActionableReview ? "default" : "outline"}
                          size="sm"
                          onClick={() => onSelectUser(user)}
                          className="h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs transition-all hover:scale-102 active:scale-98 relative"
                        >
                          {hasPendingDocuments && (
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                            </span>
                          )}
                          <Eye className="h-3.5 w-3.5" />
                          {isActionableReview ? "Review & Verify" : "View Details"}
                        </Button>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-3 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
        <div>
          <span>
            Showing <strong>{startIndex + 1}</strong> - <strong>{endIndex}</strong> of <strong>{totalCount}</strong> users
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium mr-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="h-7 w-7 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="h-7 w-7 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
