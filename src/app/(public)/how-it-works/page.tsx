// src/app/(public)/how-it-works/page.tsx
import { Suspense } from "react";
import HowItWorksModule from "@/modules/public/how-it-works";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "How LinkBridge Works — Role-Based Process Roadmap",
  description:
    "Explore the step-by-step onboarding, verification, and activity roadmaps for Employees, Employers, and Schools on LinkBridge.",
  openGraph: {
    title: "How LinkBridge Works | Step-by-Step Platform Roadmap",
    description:
      "Discover how LinkBridge connects verified employees, hiring companies, and academic institutions in a secure ecosystem.",
    url: "https://linkbridge.com/how-it-works",
    siteName: "LinkBridge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How LinkBridge Works — Process Roadmap",
    description: "Learn how to register, verify credentials, and connect on LinkBridge.",
  },
  alternates: {
    canonical: "/how-it-works",
  },
};

export default function HowItWorksPage() {
  return (
    <Suspense>
      <HowItWorksModule />
    </Suspense>
  );
}
