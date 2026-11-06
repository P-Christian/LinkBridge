import React from "react";
import SchoolVerificationModule from "@/modules/vos-admin/school-verification";

export const metadata = {
  title: "School Verification | LinkBridge Admin",
  description: "Manage school accreditation requests, review legal documents, and approve educational institution accounts.",
};

export default function SchoolVerificationPage() {
  return <SchoolVerificationModule />;
}
