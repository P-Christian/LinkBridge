import type { Metadata } from "next";
import CareerAdvice from "@/modules/career-advice";

export const metadata: Metadata = {
  title: "Career Advice | LinkBridge",
  description: "Expert articles, step-by-step guides, and real-world strategies for every stage of your career journey — resume tips, interview prep, salary guides, and more.",
};

export default function CareerAdvicePage() {
  return <CareerAdvice />;
}
