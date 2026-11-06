import React from "react";
import { ContactMessagesModule } from "@/modules/vos-admin/contact-messages";

export const metadata = {
  title: "Contact Messages | LinkBridge Admin",
  description: "Review and manage incoming inquiries from the public Contact Us page.",
};

export default function ContactMessagesPage() {
  return <ContactMessagesModule />;
}
