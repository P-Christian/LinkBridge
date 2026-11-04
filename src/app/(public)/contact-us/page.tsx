import type { Metadata } from "next";
import Contact from "@/modules/contact";
import { getContactCompany } from "@/modules/contact/server/getContactCompany";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Contact Us | VOS Sync",
  description: "Get in touch with the VOS Sync team. We're here to help with hiring, job searching, and any questions you have.",
};

export default async function ContactPage() {
  const company = await getContactCompany();
  return <Contact initialCompany={company} />;
}
