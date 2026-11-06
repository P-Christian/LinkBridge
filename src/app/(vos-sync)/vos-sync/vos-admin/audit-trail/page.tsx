// src/app/(vos-sync)/vos-sync/vos-admin/audit-trail/page.tsx
import React from "react";
import { AuditTrailPage } from "@/modules/vos-admin/audit-trail";

export const metadata = {
  title: "Audit Trail | LinkBridge Admin",
  description: "Centralized immutable audit trail for security and governance monitoring.",
};

export default function AuditTrailRoute() {
  return <AuditTrailPage />;
}
