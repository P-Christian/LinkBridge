"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Clock, CheckCircle2, XCircle, FileWarning, FileQuestion } from "lucide-react";
import { CompanyVerificationKPIs } from "../types";
import { motion, Variants } from "framer-motion";
import { KpiValue } from "@/components/shared/KpiValue";

interface CompanyVerificationKpisProps {
  kpis: CompanyVerificationKPIs;
  onFilterSelect?: (status: string) => void;
  currentFilter?: string;
  loading?: boolean;
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

export const CompanyVerificationKpis: React.FC<CompanyVerificationKpisProps> = ({
  kpis,
  onFilterSelect,
  currentFilter,
  loading,
}) => {
  const cards = [
    {
      id: "ALL",
      title: "Total Companies",
      value: kpis.totalCount,
      icon: Building2,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      activeRing: currentFilter === "ALL" ? "ring-2 ring-blue-500/50 shadow-sm" : "",
      borderColor: currentFilter === "ALL" ? "border-blue-500/50" : "border-border/60",
    },
    {
      id: "PENDING_VERIFICATION",
      title: "Pending Review",
      value: kpis.pendingCount,
      icon: Clock,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      activeRing: currentFilter === "PENDING_VERIFICATION" ? "ring-2 ring-amber-500/50 shadow-sm" : "",
      borderColor: currentFilter === "PENDING_VERIFICATION" ? "border-amber-500/50" : "border-border/60",
    },
    {
      id: "NEEDS_REVISION",
      title: "Needs Revision",
      value: kpis.needsRevisionCount,
      icon: FileWarning,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      activeRing: currentFilter === "NEEDS_REVISION" ? "ring-2 ring-orange-500/50 shadow-sm" : "",
      borderColor: currentFilter === "NEEDS_REVISION" ? "border-orange-500/50" : "border-border/60",
    },
    {
      id: "VERIFIED",
      title: "Verified",
      value: kpis.verifiedCount,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      activeRing: currentFilter === "VERIFIED" ? "ring-2 ring-emerald-500/50 shadow-sm" : "",
      borderColor: currentFilter === "VERIFIED" ? "border-emerald-500/50" : "border-border/60",
    },
    {
      id: "REJECTED_OR_SUSPENDED",
      title: "Rejected / Suspended",
      value: kpis.rejectedCount,
      icon: XCircle,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      activeRing: currentFilter === "REJECTED_OR_SUSPENDED" ? "ring-2 ring-rose-500/50 shadow-sm" : "",
      borderColor: currentFilter === "REJECTED_OR_SUSPENDED" ? "border-rose-500/50" : "border-border/60",
    },
    {
      id: "DRAFT",
      title: "Drafts / Incomplete",
      value: kpis.draftCount,
      icon: FileQuestion,
      color: "text-slate-400",
      bgColor: "bg-slate-400/10",
      activeRing: currentFilter === "DRAFT" ? "ring-2 ring-slate-400/50 shadow-sm" : "",
      borderColor: currentFilter === "DRAFT" ? "border-slate-400/50" : "border-border/60",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = currentFilter === card.id;

        return (
          <motion.div
            key={card.id}
            variants={itemVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              onClick={() => onFilterSelect && onFilterSelect(card.id)}
              className={`cursor-pointer transition-all hover:shadow-md border bg-card/80 backdrop-blur-xs rounded-xl ${card.borderColor} ${card.activeRing}`}
            >
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {card.title}
                  </p>
                  <motion.h3
                    key={loading ? "pending" : card.value}
                    initial={{ scale: 0.9, opacity: 0.6 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 450, damping: 26 }}
                    className="text-2xl font-bold mt-1 text-foreground"
                  >
                    <KpiValue value={card.value} loading={loading} />
                  </motion.h3>
                </div>
                <div
                  className={`p-3 rounded-xl ${card.bgColor} ${card.color} transition-transform ${
                    isSelected ? "scale-110" : ""
                  }`}
                >
                  <Icon className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
};
