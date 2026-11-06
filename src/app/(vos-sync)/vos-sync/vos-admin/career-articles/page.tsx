// src/app/(vos-sync)/vos-sync/vos-admin/career-articles/page.tsx
import { Metadata } from "next";
import { CareerAdviceManagementPage } from "@/modules/vos-admin/career-advice-management";

export const metadata: Metadata = {
  title: "Career Advice Articles | VOS Admin",
  description: "Manage, create, and publish career advice articles for LinkBridge.",
};

export default function CareerArticlesPage() {
  return <CareerAdviceManagementPage />;
}
