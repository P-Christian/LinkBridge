import * as React from "react";
import { FreelancerProfileProvider } from "@/modules/freelancer/freelancer-profile/providers/FreelancerProfileProvider";

export default function FreelancerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <FreelancerProfileProvider>
            {children}
        </FreelancerProfileProvider>
    );
}
