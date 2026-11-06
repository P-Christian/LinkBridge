import React from "react";
import type { Metadata } from "next";
import { ServerDownContent } from "@/components/shared/ServerDownContent";

export const metadata: Metadata = {
    title: "Server Down | LinkBridge",
    description: "Our server or database is temporarily undergoing maintenance or experiencing an outage. Please check back shortly.",
};

export default function ServerDownPage() {
    return <ServerDownContent title="Server & Database Maintenance" errorCode="503_DATABASE_DOWN" isOverlay={false} />;
}
