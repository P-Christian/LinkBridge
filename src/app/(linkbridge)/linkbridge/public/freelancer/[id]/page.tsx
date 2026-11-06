import { notFound } from "next/navigation";
import { getPublicFreelancerProfile } from "@/modules/public/public-profile/services/public-profile.service";
import { PublicProfileRender } from "@/modules/public/public-profile/components/PublicProfileRender";
import { PortalPageHeader } from "@/components/shared/layout/PortalPageHeader";
import { authenticateCookieSession } from "@/lib/authenticated-session";

const DIRECTUS_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export default async function PublicFreelancerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = parseInt(id, 10);

  if (isNaN(userId)) {
    notFound();
  }

  // Determine caller role
  const session = await authenticateCookieSession();
  let callerUser = { name: "Guest", email: "guest@example.com", avatar: "" };
  let callerRole = session?.roleId || 0;
  
  if (session?.userId) {
    const callerId = Number(session.userId);
    if (callerId) {
      const callerRes = await fetch(`${DIRECTUS_BASE}/items/vs_user/${callerId}?fields=role_id,user_fname,user_lname,user_email`, {
        headers: { "Authorization": `Bearer ${process.env.DIRECTUS_STATIC_TOKEN}` }
      });
      if (callerRes.ok) {
        const callerJson = await callerRes.json();
        callerRole = callerJson.data?.role_id || callerRole;
        callerUser = {
          name: `${callerJson.data?.user_fname || ""} ${callerJson.data?.user_lname || ""}`.trim() || "Guest",
          email: callerJson.data?.user_email || "guest@example.com",
          avatar: "",
        };
      }
    }
  }

  const profile = await getPublicFreelancerProfile(
    userId,
    callerRole,
    session ? Number(session.userId) : undefined
  );

  if (!profile) {
    notFound();
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <PortalPageHeader user={callerUser} />

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-8">
        <PublicProfileRender profile={profile} />
      </main>
    </div>
  );
}
