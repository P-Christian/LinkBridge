import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import * as jose from "jose";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth-bypass";
import { getJwtVerificationSecret } from "@/modules/auth/registration/registration.session";

async function verifySchoolAdminRole() {
    if (isDevAuthBypassEnabled()) {
        return { isAdmin: true, user: { name: "Local Admin", email: "admin@localhost", avatar: "" } };
    }
    const cookieStore = await cookies();
    const token = cookieStore.get("vos_sync_access_token")?.value;
    if (!token) return { isAdmin: false, user: null };
    
    try {
        const { payload } = await jose.jwtVerify(token, getJwtVerificationSecret());
        
        // Ensure role_name is SCHOOL_ADMIN for School Admin
        if (typeof payload.role_name !== 'string' || payload.role_name.toUpperCase() !== "SCHOOL_ADMIN") {
            return { isAdmin: false, user: null };
        }

        return { 
            isAdmin: true, 
            user: {
                name: payload.user_fname && payload.user_lname ? `${payload.user_fname} ${payload.user_lname}` : "School Admin",
                email: (payload.user_email as string) || "admin@school.com",
                avatar: (payload.user_image as string) || ""
            } 
        }; 
    } catch {
        return { isAdmin: false, user: null };
    }
}

export default async function SchoolAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { isAdmin } = await verifySchoolAdminRole();
    
    if (!isAdmin) {
        redirect("/main-dashboard");
    }

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
            {children}
        </div>
    );
}
