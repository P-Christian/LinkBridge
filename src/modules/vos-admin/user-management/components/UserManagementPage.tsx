// src/modules/vos-admin/user-management/components/UserManagementPage.tsx
"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useUsers } from "../hooks/useUsers";
import { VsUser, UserManagementKPIs } from "../types/user.types";
import { UserDetailModal } from "./UserDetailModal";
import { UserManagementKpis } from "./UserManagementKpis";
import { UserManagementFilters } from "./UserManagementFilters";
import { UserManagementTable } from "./UserManagementTable";
import { Users, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Must stay <= the /api/vos-admin/users server-side page cap.
const USER_QUEUE_WINDOW = 200;

export function UserManagementPage() {
  const { users, total, loading, error, fetchUsers, reviewIdentity } = useUsers();
  
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [verificationFilter, setVerificationFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);
  
  const [selectedUser, setSelectedUser] = useState<VsUser | null>(null);
  const [detailOpen, setDetailOpen] = useState<boolean>(false);

  const loadData = useCallback(() => {
    const roleId = roleFilter === "ALL" ? undefined : Number(roleFilter);
    // The API paginates server-side and caps a page at USER_QUEUE_WINDOW accounts.
    fetchUsers(roleId, searchQuery, 1, USER_QUEUE_WINDOW);
  }, [fetchUsers, roleFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleViewDetails = (user: VsUser) => {
    setSelectedUser(user);
    setDetailOpen(true);
  };

  const handleReviewDocument = async (verificationId: number, status: 'approved' | 'rejected', rejectionNote?: string) => {
    const success = await reviewIdentity(verificationId, status, rejectionNote);
    if (success) {
      loadData();
    }
    return success;
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

  // Safe client-side exclusion of client accounts (role_id = 2) and school admin accounts (role_id = 4)
  const activeUsers = useMemo(() => {
    return users.filter(u => u.role_id !== 2 && u.role_id !== 4);
  }, [users]);

  // Filter users by verification status client-side globally
  const filteredUsers = useMemo(() => {
    if (verificationFilter === "ALL") return activeUsers;
    return activeUsers.filter(u => getVerificationStatus(u) === verificationFilter);
  }, [activeUsers, verificationFilter]);

  // Paginated slice for the table view
  const paginatedUsers = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredUsers.slice(startIndex, startIndex + limit);
  }, [filteredUsers, page, limit]);

  // Derive client-side count metrics globally for the KPI section
  const kpiData = useMemo<UserManagementKPIs>(() => {
    const counts = { totalCount: activeUsers.length, pendingCount: 0, approvedCount: 0, rejectedCount: 0 };
    activeUsers.forEach(u => {
      const status = getVerificationStatus(u);
      if (status === 'pending') counts.pendingCount++;
      else if (status === 'approved') counts.approvedCount++;
      else if (status === 'rejected') counts.rejectedCount++;
    });
    return counts;
  }, [activeUsers]);

  return (
    <div className="flex flex-col p-6 md:p-8 max-w-[1600px] mx-auto w-full overflow-y-auto h-full min-h-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
            <span>Admin Governance & Users</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            User Account Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review user accounts, view complete information, and approve/reject identity documents.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()} className="gap-2 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Queue
          </Button>
        </div>
      </div>

      {/* Error alert banner */}
      {error && (
        <div className="p-4 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
          {error}
        </div>
      )}

      {/* Bounded queue window notice */}
      {total > users.length && (
        <div className="p-4 mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm font-medium">
          Showing the {users.length} newest matching accounts of {total}. Narrow the role filter or search
          to reach the rest.
        </div>
      )}

      {/* KPI Stat Cards */}
      <UserManagementKpis
        kpis={kpiData}
        loading={loading && users.length === 0}
        currentFilter={verificationFilter}
        onFilterSelect={(status) => { setVerificationFilter(status); setPage(1); }}
      />

      {/* Filter Bar */}
      <UserManagementFilters
        roleFilter={roleFilter}
        onRoleChange={(r) => { setRoleFilter(r); setPage(1); }}
        searchQuery={searchQuery}
        onSearchChange={(q) => { setSearchQuery(q); setPage(1); }}
      />

      {/* Table List */}
      <UserManagementTable
        users={paginatedUsers}
        loading={loading}
        onSelectUser={handleViewDetails}
        currentPage={page}
        pageSize={limit}
        totalCount={filteredUsers.length}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(s) => setLimit(s)}
      />

      <UserDetailModal
        user={selectedUser}
        isOpen={detailOpen}
        onClose={() => { setDetailOpen(false); setSelectedUser(null); }}
        onReview={handleReviewDocument}
      />
    </div>
  );
}

export default UserManagementPage;
