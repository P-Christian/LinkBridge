import * as React from "react";
import { FreelancerPageHeader } from "@/components/shared/layout/FreelancerPageHeader";
import { cookies } from "next/headers";
import { getFreelancerProfile } from "@/modules/freelancer/freelancer-profile/services/freelancer-profile.service";
import JobDetailPage from "@/modules/job-browse/components/JobDetailPage";


interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FreelancerJobDetailRoute({ params }: PageProps) {
    const { id } = await params;
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_sync_access_token")?.value;
    const profile = token ? await getFreelancerProfile(token) : null;

    const user = {
        name: profile ? `${profile.user_fname} ${profile.user_lname}` : "Guest",
        email: profile?.user_email || "guest@example.com",
        avatar: "",
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
            <FreelancerPageHeader label="Job Details" user={user} />

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-secondary/10">
                <JobDetailPage jobId={Number(id)} />
            </main>
        </div>
    );
}
