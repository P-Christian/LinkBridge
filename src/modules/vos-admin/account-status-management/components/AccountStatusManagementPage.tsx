// src/modules/vos-admin/account-status-management/components/AccountStatusManagementPage.tsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useAccountStatus } from "../hooks/useAccountStatus";
import { AccountStatusUser, AccountStatusOrUnknown, StatusTransitionPayload, AppealDecisionPayload } from "../types/account-status.types";
import { DataTable } from "../../request-management/components/new-data-table";
import { AccountStatusDetailModal } from "./AccountStatusDetailModal";
import { ColumnDef } from "@tanstack/react-table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, ShieldCheck, AlertOctagon, Eye, AlertTriangle, Search, Filter, Hourglass } from "lucide-react";

export function AccountStatusManagementPage() {
  const { users, total, loading, metrics, metricsLoading, fetchUsers, fetchMetrics, fetchUserDetail, changeStatus, resolveAppealCase } = useAccountStatus();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [appealsOnly, setAppealsOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  // Fetch summary counts on mount
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Debounce search query input to avoid repetitive network fetch calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadData = useCallback(() => {
    fetchUsers(statusFilter, debouncedSearch, page, limit, appealsOnly);
  }, [fetchUsers, statusFilter, debouncedSearch, page, limit, appealsOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleManageStatus = (userId: number) => {
    setSelectedUserId(userId);
    setDetailOpen(true);
  };

  const handleStatusChange = async (payload: StatusTransitionPayload) => {
    const success = await changeStatus(payload);
    if (success) {
      loadData();
      fetchMetrics();
    }
    return success;
  };

  const handleResolveAppeal = async (payload: AppealDecisionPayload & { userId: number }) => {
    const success = await resolveAppealCase(payload);
    if (success) {
      loadData();
      fetchMetrics();
    }
    return success;
  };

  const getStatusColor = (status: AccountStatusOrUnknown) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
      case "LIMITED": return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
      case "SUSPENDED": return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
      case "BLOCKED": return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
      case "DEACTIVATED": return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300";
      case "PENDING_DELETION": return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
      case "DELETED": return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
      default: return "bg-slate-100 text-slate-800";
    }
  };

  const columns = useMemo<ColumnDef<AccountStatusUser>[]>(() => [
    {
      id: "name",
      header: "Full Name",
      cell: ({ row }) => {
        const u = row.original;
        return `${u.user_fname} ${u.user_lname}`;
      }
    },
    {
      accessorKey: "user_email",
      header: "Email Address",
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const u = row.original;
        return (
          <span className="font-semibold text-zinc-700 dark:text-zinc-300 capitalize">
            {u.role.toLowerCase()}
          </span>
        );
      }
    },
    {
      id: "status",
      header: "Account Status",
      cell: ({ row }) => {
        const u = row.original;
        const openCase = u.cases?.find((c) => c.state === "OPEN");
        const caseLabel = openCase
          ? openCase.type === "REACTIVATION_REQUEST"
            ? "Reactivation Req ⏳"
            : openCase.type === "RESTORE_ACCOUNT"
            ? "Restoration Req ⏳"
            : "Pending Appeal ⏳"
          : null;

        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(u.status)}`}>
              {u.status.replace("_", " ")}
            </span>
            {caseLabel && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                {caseLabel}
              </span>
            )}
          </div>
        );
      }
    },
    {
      id: "restrictions",
      header: "Active Restrictions",
      cell: ({ row }) => {
        const u = row.original;
        const count = (u.status !== "ACTIVE" && u.restrictions) ? u.restrictions.length : 0;
        if (count === 0) return <span className="text-zinc-400 text-xs">None</span>;
        return (
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
            {count} Active
          </span>
        );
      }
    },
    {
      id: "actions",
      header: () => <div className="text-right">Actions</div>,
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleManageStatus(u.user_id)}
              className="flex items-center gap-1 text-primary border-primary/20 hover:bg-primary/5"
            >
              <Eye className="h-4 w-4" /> Manage Status
            </Button>
          </div>
        );
      }
    }
  ], []);

  const statusDropdownOptions = [
    { value: "ALL", label: "All Statuses" },
    { value: "ACTIVE", label: "Active" },
    { value: "LIMITED", label: "Limited" },
    { value: "SUSPENDED", label: "Suspended" },
    { value: "BLOCKED", label: "Blocked" },
    { value: "DEACTIVATED", label: "Deactivated" },
    { value: "PENDING_DELETION", label: "Pending Deletion" },
  ];

  return (
    <div className="h-full flex-1 overflow-y-auto p-4 sm:p-8 bg-secondary/10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Account Status Management</h1>
        <p className="text-muted-foreground mt-1">
          Review security containment states, restriction parameters, appeals, and deactivations.
        </p>
      </div>

      {/* Overview Metric Cards (Interactive click-to-filter with zero vertical waste) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {/* Active / Healthy */}
        <div
          onClick={() => {
            if (statusFilter === "ACTIVE" && !appealsOnly) {
              setStatusFilter("ALL");
            } else {
              setStatusFilter("ACTIVE");
              setAppealsOnly(false);
            }
            setPage(1);
          }}
          className={`cursor-pointer transition-all hover:shadow-md bg-white dark:bg-zinc-900 border rounded-xl px-3.5 py-2.5 flex items-center gap-3 ${
            statusFilter === "ACTIVE" && !appealsOnly
              ? "ring-2 ring-green-500 border-transparent dark:border-green-600 shadow-xs"
              : "border-border dark:border-zinc-800"
          }`}
        >
          <div className="p-2 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 rounded-lg shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate leading-none">Active</p>
            {metricsLoading && !metrics ? (
              <Skeleton className="h-5 w-14 mt-1" />
            ) : (
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight mt-0.5">
                {metrics?.active?.toLocaleString() ?? 0}
              </p>
            )}
          </div>
        </div>

        {/* Limited Users */}
        <div
          onClick={() => {
            if (statusFilter === "LIMITED" && !appealsOnly) {
              setStatusFilter("ALL");
            } else {
              setStatusFilter("LIMITED");
              setAppealsOnly(false);
            }
            setPage(1);
          }}
          className={`cursor-pointer transition-all hover:shadow-md bg-white dark:bg-zinc-900 border rounded-xl px-3.5 py-2.5 flex items-center gap-3 ${
            statusFilter === "LIMITED" && !appealsOnly
              ? "ring-2 ring-amber-500 border-transparent dark:border-amber-600 shadow-xs"
              : "border-border dark:border-zinc-800"
          }`}
        >
          <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate leading-none">Limited</p>
            {metricsLoading && !metrics ? (
              <Skeleton className="h-5 w-14 mt-1" />
            ) : (
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight mt-0.5">
                {metrics?.limited?.toLocaleString() ?? 0}
              </p>
            )}
          </div>
        </div>

        {/* Suspended / Blocked */}
        <div
          onClick={() => {
            if ((statusFilter === "SUSPENDED" || statusFilter === "BLOCKED") && !appealsOnly) {
              setStatusFilter("ALL");
            } else {
              setStatusFilter("SUSPENDED");
              setAppealsOnly(false);
            }
            setPage(1);
          }}
          className={`cursor-pointer transition-all hover:shadow-md bg-white dark:bg-zinc-900 border rounded-xl px-3.5 py-2.5 flex items-center gap-3 ${
            (statusFilter === "SUSPENDED" || statusFilter === "BLOCKED") && !appealsOnly
              ? "ring-2 ring-orange-500 border-transparent dark:border-orange-600 shadow-xs"
              : "border-border dark:border-zinc-800"
          }`}
        >
          <div className="p-2 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 rounded-lg shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate leading-none">Suspended</p>
            {metricsLoading && !metrics ? (
              <Skeleton className="h-5 w-14 mt-1" />
            ) : (
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight mt-0.5">
                {metrics?.suspendedBlocked?.toLocaleString() ?? 0}
              </p>
            )}
          </div>
        </div>

        {/* Deletion / Holds */}
        <div
          onClick={() => {
            if (statusFilter === "PENDING_DELETION" && !appealsOnly) {
              setStatusFilter("ALL");
            } else {
              setStatusFilter("PENDING_DELETION");
              setAppealsOnly(false);
            }
            setPage(1);
          }}
          className={`cursor-pointer transition-all hover:shadow-md bg-white dark:bg-zinc-900 border rounded-xl px-3.5 py-2.5 flex items-center gap-3 ${
            statusFilter === "PENDING_DELETION" && !appealsOnly
              ? "ring-2 ring-red-500 border-transparent dark:border-red-600 shadow-xs"
              : "border-border dark:border-zinc-800"
          }`}
        >
          <div className="p-2 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-lg shrink-0">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate leading-none">Deletion Holds</p>
            {metricsLoading && !metrics ? (
              <Skeleton className="h-5 w-14 mt-1" />
            ) : (
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 leading-tight mt-0.5">
                {metrics?.deletionHolds?.toLocaleString() ?? 0}
              </p>
            )}
          </div>
        </div>

        {/* Pending Appeals Metric */}
        <div
          onClick={() => {
            if (appealsOnly) {
              setAppealsOnly(false);
            } else {
              // When filtering pending appeals, reset status filter to ALL so non-active statuses with appeals aren't filtered out
              setStatusFilter("ALL");
              setAppealsOnly(true);
            }
            setPage(1);
          }}
          className={`cursor-pointer transition-all hover:shadow-md bg-white dark:bg-zinc-900 border rounded-xl px-3.5 py-2.5 flex items-center gap-3 ${
            appealsOnly
              ? "ring-2 ring-amber-500 border-transparent dark:border-amber-600 bg-amber-50/30 dark:bg-amber-950/20 shadow-xs"
              : "border-border dark:border-zinc-800"
          }`}
        >
          <div className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg shrink-0">
            <Hourglass className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate leading-none">Pending Appeals</p>
            {metricsLoading && !metrics ? (
              <Skeleton className="h-5 w-14 mt-1" />
            ) : (
              <p className="text-xl font-bold text-amber-700 dark:text-amber-400 leading-tight mt-0.5">
                {metrics?.pendingAppeals?.toLocaleString() ?? 0}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-zinc-900 border dark:border-zinc-800 shadow-sm rounded-xl">
        {/* Toolbar: Searchbar at the start, no table title, filters beside it with tight bottom margin */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-2">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 bg-white dark:bg-zinc-900 dark:border-zinc-800 h-10 text-sm"
              />
            </div>

            <SearchableSelect
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
              options={statusDropdownOptions}
              placeholder="Filter by Status"
              triggerClassName="w-full sm:w-[200px] bg-white dark:bg-zinc-900 dark:border-zinc-800 h-10"
            />

            <Button
              type="button"
              variant={appealsOnly ? "default" : "outline"}
              size="sm"
              onClick={() => {
                const nextAppealsOnly = !appealsOnly;
                setAppealsOnly(nextAppealsOnly);
                // When activating appealsOnly, if current status has no appeals, default status to ALL
                if (nextAppealsOnly && statusFilter !== "ALL") {
                  setStatusFilter("ALL");
                }
                setPage(1);
              }}
              className={`h-10 text-xs font-semibold transition-all flex items-center gap-1.5 w-full sm:w-auto ${
                appealsOnly
                  ? "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600"
                  : "border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40"
              }`}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Pending Appeals Only ⏳</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
              <div className="p-4 border-b bg-muted/10 grid grid-cols-6 gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
              <div className="p-4 space-y-4">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div key={idx} className="grid grid-cols-6 gap-4 items-center">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-24 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-8 w-28 ml-auto rounded-md" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between px-2 pt-2">
              <Skeleton className="h-4 w-32" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={users}
            onSearch={(val) => { setSearchInput(val); }}
            isLoading={loading}
            manualPagination={true}
            pageCount={Math.ceil(total / limit)}
            pagination={{
              pageIndex: page - 1,
              pageSize: limit,
            }}
            onPaginationChange={(newPagination) => {
              setPage(newPagination.pageIndex + 1);
              setLimit(newPagination.pageSize);
            }}
          />
        )}
      </Card>

      <AccountStatusDetailModal
        userId={selectedUserId}
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedUserId(null); }}
        onFetchDetail={fetchUserDetail}
        onChangeStatus={handleStatusChange}
        onResolveAppeal={handleResolveAppeal}
      />
    </div>
  );
}
