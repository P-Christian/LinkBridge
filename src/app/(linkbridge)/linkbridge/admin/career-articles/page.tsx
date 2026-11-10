// src/app/(vos-sync)/linkbridge/admin/career-articles/page.tsx
import { Metadata } from "next";
import { CareerAdviceManagementPage } from "@/modules/vos-admin/career-advice-management";

export const metadata: Metadata = {
  title: "Career Advice Articles | Admin Portal",
  description: "Manage, create, and publish career advice articles for LinkBridge.",
};

export default function CareerArticlesPage() {
  return <CareerAdviceManagementPage />;
}
