// src/modules/vos-admin/audit-trail/components/AuditKPICards.tsx
"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AuditKPIData } from '../types/audit.types';
import { Activity, AlertOctagon, ShieldAlert, UserCheck } from 'lucide-react';
import { motion, Variants } from 'framer-motion';
import { KpiValue } from '@/components/shared/KpiValue';

interface AuditKPICardsProps {
  kpis: AuditKPIData;
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

export function AuditKPICards({ kpis, loading }: AuditKPICardsProps) {
  const cards = [
    {
      title: "Today's Audit Events",
      value: kpis.todayEvents,
      icon: Activity,
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      description: "Total recorded events today",
    },
    {
      title: "Failed Events",
      value: kpis.failedEvents,
      icon: AlertOctagon,
      iconBg: "bg-destructive/10 text-destructive",
      description: "System or action execution errors",
    },
    {
      title: "Denied Access",
      value: kpis.deniedAccess,
      icon: ShieldAlert,
      iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      description: "Unauthorized access attempts",
    },
    {
      title: "Admin Actions",
      value: kpis.adminActions,
      icon: UserCheck,
      iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      description: "Administrative interventions today",
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6"
    >
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={idx}
            variants={itemVariants}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            whileTap={{ scale: 0.98 }}
          >
            <Card className="shadow-xs border border-border bg-card rounded-xl hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                    {card.title}
                  </p>
                  <div className="text-2xl font-bold mt-1 tracking-tight text-foreground font-mono">
                    <KpiValue value={card.value} loading={loading} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {card.description}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.iconBg} shrink-0`}>
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
