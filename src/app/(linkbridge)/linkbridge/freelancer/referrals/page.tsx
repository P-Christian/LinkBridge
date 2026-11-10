/* eslint-disable react-hooks/set-state-in-effect */
// src/app/(vos-sync)/linkbridge/freelancer/referrals/page.tsx
"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Ban, Copy, Check, Link2, Search, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { FreelancerPageHeader } from "@/components/shared/layout/FreelancerPageHeader";
import { formatAssetUrl } from "@/lib/utils";

interface ReferralItem {
  referral_id: number;
  job_id?: {
    job_id: number;
    job_title: string;
  };
  display_hint?: string;
  status: string;
  created_at: string;
  expires_at: string;
  token_hash: string;
  referral_type?: "CLOSED" | "OPEN";
  application_count?: number;
  claimant_name?: string | null;
}

export default function MyReferralsPage() {
  const [referrals, setReferrals] = React.useState<ReferralItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [copiedId, setCopiedId] = React.useState<number | null>(null);
  const [userProfile, setUserProfile] = React.useState<{
    name: string;
    email: string;
    avatar: string;
  } | null>(null);

  // Filter & Pagination states
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [typeFilter, setTypeFilter] = React.useState<string>("ALL");
  const [sortBy, setSortBy] = React.useState<"newest" | "oldest" | "expiry">("newest");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [now] = React.useState(() => Date.now());

  React.useEffect(() => {
    fetch("/api/freelancer/profile", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load profile");
        return res.json();
      })
      .then((data) => {
        const profile = data?.data || data?.profile || data?.user || data;
        const fname = profile?.user_fname || profile?.first_name || "";
        const lname = profile?.user_lname || profile?.last_name || "";
        const name = `${fname} ${lname}`.trim() || "Freelancer";
        const email = profile?.user_email || profile?.email || "";
        const avatar = formatAssetUrl(profile?.profile_image_url || profile?.avatar) || "";

        setUserProfile({ name, email, avatar });
      })
      .catch((err) => console.error("Error loading user profile", err));
  }, []);

  const fetchReferrals = React.useCallback(async () => {
    try {
      const res = await fetch("/api/freelancer/referrals");
      if (!res.ok) throw new Error("Failed to load referrals");
      const data = await res.json();
      setReferrals(data.referrals || []);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      toast.error("Error loading referrals", { description: errorMsg });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleCopyLink = (referralId: number, tokenHash: string) => {
    // Note: Since plain token is not stored, we generate/use a share link.
    // If user creates a referral without email, the API returns the plain token.
    // For already created ones, we store the sharing structure or token hash lookup path.
    // However, to keep it simple, we redirect to landing which handles token lookup.
    // If the token is hashed, we can fetch or let the user click copy when they create it.
    // We can also let users copy the existing public landing URL.
    const url = `${window.location.origin}/referral/${tokenHash}`;
    navigator.clipboard.writeText(url);
    setCopiedId(referralId);
    toast.success("Link copied", { description: "Referral URL copied to clipboard." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = async (id: number) => {
    if (!confirm("Are you sure you want to revoke this referral invite?")) return;

    try {
      const res = await fetch(`/api/freelancer/referrals/${id}/revoke`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke referral");

      toast.success("Referral Revoked");
      fetchReferrals();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      toast.error("Revocation failed", { description: errorMsg });
    }
  };

  const getEffectiveStatus = React.useCallback((ref: ReferralItem): string => {
    if (ref.status === "REVOKED" || ref.status === "INVALIDATED") return "REVOKED";
    if (ref.status === "DECLINED") return "DECLINED";
    if (ref.status === "APPLIED") return "APPLIED";
    if (ref.status === "CLAIMED") return "CLAIMED";
    const isExpired = new Date(ref.expires_at).getTime() < now;
    if (isExpired) return "EXPIRED";
    return ref.status;
  }, [now]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPLIED":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600">Applied</Badge>;
      case "CLAIMED":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Claimed</Badge>;
      case "SENT":
      case "SHARED":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Sent</Badge>;
      case "DECLINED":
        return <Badge variant="secondary" className="bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300">Declined</Badge>;
      case "REVOKED":
        return <Badge variant="destructive">Revoked</Badge>;
      case "EXPIRED":
        return <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Filter & Sort computation
  const filteredReferrals = React.useMemo(() => {
    return referrals
      .filter((ref) => {
        // Search matching
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = (ref.job_id?.job_title || "").toLowerCase().includes(q);
          const matchHint = (ref.display_hint || "").toLowerCase().includes(q);
          const matchClaimant = (ref.claimant_name || "").toLowerCase().includes(q);
          if (!matchTitle && !matchHint && !matchClaimant) return false;
        }

        // Status Filter
        if (statusFilter !== "ALL") {
          const effective = getEffectiveStatus(ref);
          if (statusFilter === "ACTIVE") {
            if (!["CREATED", "SENT", "OPENED"].includes(effective)) return false;
          } else if (statusFilter === "CLAIMED") {
            if (!["CLAIMED", "APPLIED"].includes(effective)) return false;
          } else if (statusFilter === "EXPIRED") {
            if (effective !== "EXPIRED") return false;
          } else if (statusFilter === "REVOKED") {
            if (effective !== "REVOKED") return false;
          }
        }

        // Type Filter
        if (typeFilter !== "ALL") {
          const refType = ref.referral_type || (ref.display_hint === "Public share link" ? "OPEN" : "CLOSED");
          if (typeFilter !== refType) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "oldest") {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }
        if (sortBy === "expiry") {
          return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
        }
        // default newest
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [referrals, searchQuery, statusFilter, typeFilter, sortBy, getEffectiveStatus]);

  // Pagination calculation
  const totalItems = filteredReferrals.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedReferrals = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredReferrals.slice(start, start + pageSize);
  }, [filteredReferrals, currentPage, pageSize]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter, sortBy, pageSize]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <FreelancerPageHeader
        label="Referrals"
        user={userProfile ?? { name: "Guest", email: "guest@example.com", avatar: "" }}
      />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-8">
        <div className="w-full max-w-[80%] max-md:max-w-none mx-auto space-y-4 md:space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-br from-emerald-950 via-zinc-900 to-teal-950 dark:from-black dark:via-zinc-950 dark:to-zinc-900 text-white p-6 sm:p-8 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 h-40 w-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="p-3 bg-white/10 backdrop-blur rounded-2xl border border-white/20">
                <Link2 className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Referrals</h1>
                <p className="text-sm text-zinc-300 mt-1">
                  Invite friends and candidates to view open vacancies and track their application progress.
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>My Shared Links</CardTitle>
              <CardDescription>
                A list of referrals you have created. You can revoke invitations that haven&apos;t been claimed yet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pb-2 border-b">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by job title, email, or candidate..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-9 text-xs w-[130px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Statuses</SelectItem>
                      <SelectItem value="ACTIVE">Created / Active</SelectItem>
                      <SelectItem value="CLAIMED">Claimed / Applied</SelectItem>
                      <SelectItem value="EXPIRED">Expired</SelectItem>
                      <SelectItem value="REVOKED">Revoked</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Type Filter */}
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9 text-xs w-[125px]">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Types</SelectItem>
                      <SelectItem value="CLOSED">Closed (1:1)</SelectItem>
                      <SelectItem value="OPEN">Open (1:N)</SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Sort Filter */}
                  <Select value={sortBy} onValueChange={(val) => setSortBy(val as "newest" | "oldest" | "expiry")}>
                    <SelectTrigger className="h-9 text-xs w-[135px]">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        <SelectValue placeholder="Sort by" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Sent (Newest)</SelectItem>
                      <SelectItem value="oldest">Sent (Oldest)</SelectItem>
                      <SelectItem value="expiry">Expiration Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="py-12 text-center text-muted-foreground">Loading referrals...</div>
              ) : filteredReferrals.length === 0 ? (
                <div className="py-16 text-center border rounded-xl border-dashed flex flex-col items-center justify-center space-y-3">
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-lg">
                    🔗
                  </div>
                  <h3 className="font-semibold text-lg">
                    {referrals.length === 0 ? "No referrals yet" : "No matching referrals found"}
                  </h3>
                  <p className="text-muted-foreground max-w-sm text-xs">
                    {referrals.length === 0
                      ? "Go to the jobs page to refer candidates and friends to active vacancies."
                      : "Try adjusting your search query, status, or type filters above."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Job Title</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Recipient / Usage</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Date Sent</TableHead>
                          <TableHead>Expires</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedReferrals.map((ref) => {
                          const effectiveStatus = getEffectiveStatus(ref);
                          const isClaimed = effectiveStatus === "CLAIMED" || effectiveStatus === "APPLIED" || Boolean(ref.claimant_name);
                          const isRevoked = effectiveStatus === "REVOKED";
                          const isExpired = effectiveStatus === "EXPIRED";
                          const isDeclined = effectiveStatus === "DECLINED";
                          const isInactive = isRevoked || isExpired || isDeclined;
                          const isOpen = ref.referral_type === "OPEN";

                          return (
                            <TableRow key={ref.referral_id}>
                              <TableCell className="font-medium">
                                {ref.job_id?.job_title || "Unknown position"}
                              </TableCell>
                              <TableCell>
                                {isOpen ? (
                                  <Badge variant="secondary" className="font-normal text-xs">
                                    Open (1:N)
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="font-normal text-xs">
                                    Closed (1:1)
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {isOpen ? (
                                  <span className="font-medium text-foreground">
                                    {ref.application_count ?? 0} Applied
                                  </span>
                                ) : ref.claimant_name ? (
                                  <span className="font-medium text-foreground">
                                    {ref.claimant_name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    {ref.display_hint || "Direct invite"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(effectiveStatus)}</TableCell>
                              <TableCell className="text-sm">
                                {new Date(ref.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {new Date(ref.expires_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {/* Copy Link Button */}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => !isInactive && handleCopyLink(ref.referral_id, ref.token_hash)}
                                    disabled={isInactive}
                                    title={isInactive ? `Link is ${effectiveStatus.toLowerCase()}` : "Copy referral link"}
                                    className={`h-8 gap-1 max-md:min-h-11 ${
                                      isInactive ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""
                                    }`}
                                  >
                                    {copiedId === ref.referral_id ? (
                                      <>
                                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3.5 w-3.5" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </Button>

                                  {/* Revoke Button */}
                                  {isRevoked ? null : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        if (isClaimed || isExpired || isDeclined) return;
                                        handleRevoke(ref.referral_id);
                                      }}
                                      disabled={isClaimed || isExpired || isDeclined}
                                      title={
                                        isClaimed
                                          ? "Cannot revoke a link that has already been claimed"
                                          : isExpired
                                          ? "Cannot revoke an expired link"
                                          : isDeclined
                                          ? "Cannot revoke a declined invitation"
                                          : "Revoke invitation"
                                      }
                                      className={`h-8 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 max-md:min-h-11 ${
                                        isClaimed || isExpired || isDeclined
                                          ? "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-destructive"
                                          : ""
                                      }`}
                                    >
                                      <Ban className="h-3.5 w-3.5" />
                                      <span>Revoke</span>
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        Showing <strong className="text-foreground">{(currentPage - 1) * pageSize + 1}</strong> to{" "}
                        <strong className="text-foreground">{Math.min(currentPage * pageSize, totalItems)}</strong> of{" "}
                        <strong className="text-foreground">{totalItems}</strong> referrals
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Page Size Selector */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>Show:</span>
                        <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                          <SelectTrigger className="h-8 w-[70px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Navigation buttons */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                          <span>Prev</span>
                        </Button>
                        <span className="text-xs px-2 text-muted-foreground">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage >= totalPages}
                          className="h-8 px-2.5 text-xs gap-1"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
