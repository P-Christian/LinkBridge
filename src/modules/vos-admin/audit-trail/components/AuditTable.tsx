// src/modules/vos-admin/audit-trail/components/AuditTable.tsx
"use client";

import React, { useMemo } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { AuditRecord } from '../types/audit.types';
import { AuditActionBadge } from './AuditActionBadge';
import { AuditStatusBadge } from './AuditStatusBadge';
import { DataTable } from '../../request-management/components/new-data-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye } from 'lucide-react';

interface AuditTableProps {
  records: AuditRecord[];
  total: number;
  loading: boolean;
  page: number;
  limit: number;
  onPageChange: (newPage: number) => void;
  onLimitChange: (newLimit: number) => void;
  onViewRecord: (record: AuditRecord) => void;
}

export function AuditTable({
  records,
  total,
  loading,
  page,
  limit,
  onPageChange,
  onLimitChange,
  onViewRecord,
}: AuditTableProps) {
  const formatDate = (isoStr: string) => {
    if (!isoStr) return "---";
    try {
      const cleaned = isoStr.replace(" ", "T");
      const utcStr = cleaned.endsWith("Z") || cleaned.includes("+") ? cleaned : `${cleaned}Z`;
      const d = new Date(utcStr);
      if (isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  const columns = useMemo<ColumnDef<AuditRecord>[]>(() => [
    {
      accessorKey: "created_at",
      header: "Timestamp",
      cell: ({ row }) => (
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
          {formatDate(row.original.created_at)}
        </span>
      ),
    },
    {
      accessorKey: "event_category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider bg-zinc-50 dark:bg-zinc-800">
          {row.original.event_category}
        </Badge>
      ),
    },
    {
      accessorKey: "event_type",
      header: "Event",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-xs text-foreground font-mono">
            {row.original.event_type}
          </span>
          {row.original.reason && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
              {row.original.reason}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "action",
      header: "Action",
      cell: ({ row }) => <AuditActionBadge action={row.original.action} />,
    },
    {
      id: "actor",
      header: "Actor",
      cell: ({ row }) => {
        const rec = row.original;
        const name = rec.actor_name || rec.actor_email || (rec.actor_user_id ? `User #${rec.actor_user_id}` : rec.actor_type);
        const roleDisplay = rec.actor_role || rec.actor_type;
        return (
          <div className="flex flex-col">
            <span className="text-xs font-medium text-foreground">{name}</span>
            <span className="text-[10px] text-muted-foreground font-mono">{roleDisplay}</span>
          </div>
        );
      },
    },
    {
      id: "resource",
      header: "Resource",
      cell: ({ row }) => {
        const rec = row.original;
        if (!rec.resource_type && !rec.resource_id && !rec.resource_name) {
          return <span className="text-xs text-muted-foreground">---</span>;
        }
        return (
          <div className="flex flex-col max-w-[200px]">
            <span className="text-xs font-semibold text-foreground truncate" title={rec.resource_name || (rec.resource_id ? `${rec.resource_type || "Resource"} #${rec.resource_id}` : rec.resource_type || "")}>
              {rec.resource_name || (rec.resource_id ? `${rec.resource_type || "Resource"} #${rec.resource_id}` : rec.resource_type || "Resource")}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {rec.resource_type ? `${rec.resource_type}` : ""}
              {rec.resource_id ? ` #${rec.resource_id}` : ""}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AuditStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: () => <div className="text-right">Detail</div>,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewRecord(row.original)}
            className="h-8 px-2 flex items-center gap-1 text-xs text-primary hover:bg-primary/10"
          >
            <Eye className="h-3.5 w-3.5" /> View
          </Button>
        </div>
      ),
    },
  ], [onViewRecord]);

  return (
    <DataTable
      columns={columns}
      data={records}
      isLoading={loading}
      manualPagination={true}
      pageCount={Math.max(1, Math.ceil(total / limit))}
      pagination={{
        pageIndex: page - 1,
        pageSize: limit,
      }}
      onPaginationChange={(newPagination) => {
        if (newPagination.pageSize !== limit) {
          onLimitChange(newPagination.pageSize);
        } else if (newPagination.pageIndex + 1 !== page) {
          onPageChange(newPagination.pageIndex + 1);
        }
      }}
    />
  );
}
