"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, CheckCircle2, XCircle } from "lucide-react";
import { UserManagementKPIs } from "../types/user.types";
import { KpiValue } from "@/components/shared/KpiValue";

interface UserManagementKpisProps {
  kpis: UserManagementKPIs;
  onFilterSelect?: (status: string) => void;
  currentFilter?: string;
  loading?: boolean;
}

export const UserManagementKpis: React.FC<UserManagementKpisProps> = ({
  kpis,
  onFilterSelect,
  currentFilter,
  loading,
}) => {
  const cards = [
    {
      id: "ALL",
      title: "Total Users",
      value: kpis.totalCount,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: currentFilter === "ALL" ? "border-blue-500" : "border-border",
    },
    {
      id: "pending",
      title: "Pending Review",
      value: kpis.pendingCount,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: currentFilter === "pending" ? "border-amber-500" : "border-border",
    },
    {
      id: "approved",
      title: "Verified",
      value: kpis.approvedCount,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: currentFilter === "approved" ? "border-emerald-500" : "border-border",
    },
    {
      id: "rejected",
      title: "Rejected",
      value: kpis.rejectedCount,
      icon: XCircle,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      borderColor: currentFilter === "rejected" ? "border-rose-500" : "border-border",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card
            key={card.id}
            onClick={() => onFilterSelect && onFilterSelect(card.id)}
            className={`cursor-pointer transition-all hover:shadow-md border ${card.borderColor}`}
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {card.title}
                </p>
                <h3 className="text-2xl font-bold mt-1 text-foreground">
                  <KpiValue value={card.value} loading={loading} />
                </h3>
              </div>
              <div className={`p-3 rounded-xl ${card.bgColor} ${card.color}`}>
                <Icon className="h-6 w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
