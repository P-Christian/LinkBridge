/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
    Users,
    Bot,
    ClipboardList,
    ShoppingCart,
    Bell,
    Settings2,
    MessageSquare,
    HelpCircle,
} from "lucide-react";

import { NavMain } from "./nav-main";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { usePathname, useSearchParams } from "next/navigation";
import { DashboardSidebar, type SidebarConfig } from "@/components/shared/layout/DashboardSidebar";
import { LayoutDashboard, Briefcase, FileText, User, CalendarDays, GraduationCap, ClipboardCheck, LogOut, ShieldCheck, Building2, Building, Share2, ShieldAlert, Search, Cpu, Target, TrendingUp, GitFork } from "lucide-react";
import { useUserProfile } from "@/components/shared/providers/UserProfileProvider";

const data = {
    navMain: [
        {
            title: "Attendance Report",
            url: "/employee-relations/attendance-report",
            icon: Users,
        },
        {
            title: "Application",
            url: "#",
            icon: Bot,
            items: [
                {
                    title: "Overtime",
                    url: "/employee-relations/application/overtime",
                    icon: ClipboardList,
                },
                {
                    title: "Undertime",
                    url: "/employee-relations/application/undertime",
                    icon: ClipboardList,
                },
                {
                    title: "Leave",
                    url: "/employee-relations/application/leave",
                    icon: ShoppingCart,
                },
            ],
        },
        { title: "Memo", url: "/employee-relations/memo", icon: Users },
        { title: "Announcement", url: "/employee-relations/announcement", icon: Users },
    ],
};

// Module scope keeps `config.navItems` reference-stable; defined inside the
// render body it was a fresh object each render, which re-ran DashboardSidebar's
// unread-count effect and re-issued its fetches on every unrelated re-render.
const FREELANCER_SIDEBAR_CONFIG: SidebarConfig = {
    title: "LinkBridge",
    subtitle: "FREELANCER PORTAL",
    homeUrl: "/vos-sync/freelancer/dashboard",
    navItems: [
        { label: "Dashboard", href: "/vos-sync/freelancer/dashboard", icon: LayoutDashboard, group: "Overview" },
        { label: "My Profile", href: "/vos-sync/freelancer/profile", icon: User },
        { label: "Find Work", href: "/vos-sync/freelancer/jobs", icon: Briefcase, group: "Work" },
        { label: "My Applications", href: "/vos-sync/freelancer/applications", icon: FileText },
        { label: "Messages", href: "/vos-sync/freelancer/messaging", icon: MessageSquare, group: "Inbox" },
        { label: "Referrals", href: "/vos-sync/freelancer/referrals", icon: Share2 },
        { label: "Notifications", href: "/vos-sync/freelancer/notifications", icon: Bell },
        // { label: "How It Works", href: "/vos-sync/freelancer/how-it-works", icon: HelpCircle },
        { label: "Settings", href: "/vos-sync/freelancer/settings", icon: Settings2, group: "Account" },
    ],
    footerLinks: [
        { label: "Log out", href: "/logout", icon: LogOut },
    ],
};

const FREELANCER_GUEST_SIDEBAR_CONFIG: SidebarConfig = {
    ...FREELANCER_SIDEBAR_CONFIG,
    homeUrl: "/vos-sync/freelancer/jobs",
    navItems: [
        { label: "Find Work", href: "/vos-sync/freelancer/jobs", icon: Briefcase },
        { label: "How It Works", href: "/vos-sync/freelancer/how-it-works", icon: HelpCircle },
    ],
};

const CLIENT_SIDEBAR_CONFIG: SidebarConfig = {
    title: "LinkBridge",
    subtitle: "CLIENT PORTAL",
    homeUrl: "/vos-sync/client/dashboard",
    navItems: [
        { label: "Dashboard", href: "/vos-sync/client/dashboard", icon: LayoutDashboard, group: "Overview" },
        { label: "Company Profile", href: "/vos-sync/client/company-profile", icon: User },
        { label: "Manage Jobs", href: "/vos-sync/client/jobs", icon: Briefcase, group: "Hiring" },
        { label: "Review Candidates", href: "/vos-sync/client/applicants", icon: FileText },
        { label: "Talent Search", href: "/vos-sync/client/talent-search", icon: Search },
        { label: "Campus Talent", href: "/vos-sync/client/campus-talent", icon: GraduationCap },
        { label: "Interview Schedule", href: "/vos-sync/client/interviews", icon: CalendarDays },
        { label: "Messages", href: "/vos-sync/client/messaging", icon: MessageSquare, group: "Inbox" },
        { label: "Notifications", href: "/vos-sync/client/notifications", icon: Bell },
        // { label: "How It Works", href: "/vos-sync/client/how-it-works", icon: HelpCircle },
        { label: "ATS Pipeline", href: "/vos-sync/client/ats-pipeline", icon: GitFork, group: "Configuration" },
    ],
    footerLinks: [],
};

const SCHOOL_DASHBOARD_SIDEBAR_CONFIG: SidebarConfig = {
    title: "LinkBridge",
    subtitle: "SCHOOL ADMIN",
    homeUrl: "/vos-sync/school-admin",
    navItems: [
        { label: "Dashboard", href: "/vos-sync/school-admin", icon: LayoutDashboard, group: "Overview" },
        { label: "My School", href: "/vos-sync/school-admin/profile", icon: Building2 },
        { label: "My Courses", href: "/vos-sync/school-admin/courses", icon: GraduationCap, group: "Programs" },
        { label: "Student Roster", href: "/vos-sync/school-admin/students", icon: Users },
        { label: "Requests", href: "/vos-sync/school-admin/requests", icon: ClipboardCheck },
        { label: "Job Referrals", href: "/vos-sync/school-admin/job-referrals", icon: Briefcase, group: "Careers" },
        { label: "Success Metrics", href: "/vos-sync/school-admin/success-metrics", icon: TrendingUp },
        { label: "Configuration", href: "/vos-sync/school-admin/settings", icon: Settings2, group: "Account" },
    ],
    footerLinks: [
        { label: "Log out", href: "/logout", icon: LogOut },
    ],
};

const SCHOOL_ADMIN_SIDEBAR_CONFIG: SidebarConfig = {
    title: "LinkBridge",
    subtitle: "LinkBridge ADMIN",
    homeUrl: "/vos-sync/vos-admin",
    navItems: [
        { label: "Dashboard", href: "/vos-sync/vos-admin", icon: LayoutDashboard, group: "Overview" },
        { label: "Request Management", href: "/vos-sync/vos-admin/requests", icon: ClipboardCheck, group: "Management" },
        { label: "Contact Messages", href: "/vos-sync/vos-admin/contact-messages", icon: MessageSquare },
        { label: "User Management", href: "/vos-sync/vos-admin/users", icon: Users },
        { label: "Account Status", href: "/vos-sync/vos-admin/account-status", icon: ShieldAlert },
        { label: "Career Advice", href: "/vos-sync/vos-admin/career-articles", icon: FileText, group: "Content" },
        { label: "Platform Company", href: "/vos-sync/vos-admin/platform-company", icon: Building },
        { label: "Company Verification", href: "/vos-sync/vos-admin/company-verification", icon: Building2, group: "Verification" },
        { label: "School Verification", href: "/vos-sync/vos-admin/school-verification", icon: GraduationCap },
        { label: "Role Matching", href: "/vos-sync/vos-admin/job-roles", icon: Target, group: "System" },
        { label: "Gemini Monitoring", href: "/vos-sync/vos-admin/gemini-monitoring", icon: Cpu },
        { label: "Audit Trail", href: "/vos-sync/vos-admin/audit-trail", icon: ShieldCheck },
        { label: "Configuration", href: "/vos-sync/vos-admin/settings", icon: Settings2 },
    ],
    footerLinks: [
        { label: "Log out", href: "/logout", icon: LogOut },
    ],
};

export function AppSidebar({
    className,
    ...props
}: React.ComponentProps<typeof Sidebar>) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    const pathname = usePathname();
    const searchParams = useSearchParams();
    const portal = searchParams.get("portal");
    const userProfile = useUserProfile();
    const isGuest = !userProfile || userProfile.email === "guest@example.com";
    const role = userProfile?.role;

    if (pathname.startsWith('/vos-sync/suspended')) {
        return null;
    }

    if (!mounted) {
        return (
            <Sidebar
                {...props}
                className={cn(
                    "border-r border-sidebar-border/60 dark:border-white/20",
                    "shadow-sm dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_16px_40px_-24px_rgba(0,0,0,0.9)]",
                    className
                )}
            />
        );
    }

    if (role === "FREELANCER" || pathname.startsWith("/vos-sync/freelancer") || (isGuest && pathname.startsWith("/vos-sync/public")) || portal === "freelancer") {
        return (
            <DashboardSidebar
                config={isGuest ? FREELANCER_GUEST_SIDEBAR_CONFIG : FREELANCER_SIDEBAR_CONFIG}
                {...props}
            />
        );
    }

    if (role === "CLIENT" || pathname.startsWith("/vos-sync/client") || portal === "client") {
        return <DashboardSidebar config={CLIENT_SIDEBAR_CONFIG} {...props} />;
    }

    if (role === "SCHOOL_ADMIN" || pathname.startsWith("/vos-sync/school-admin") || portal === "school-admin") {
        return <DashboardSidebar config={SCHOOL_DASHBOARD_SIDEBAR_CONFIG} {...props} />;
    }

    if (role === "ADMIN" || pathname.startsWith("/vos-sync/vos-admin") || portal === "vos-admin") {
        return <DashboardSidebar config={SCHOOL_ADMIN_SIDEBAR_CONFIG} {...props} />;
    }
    return (
        <Sidebar
            {...props}
            className={cn(
                "border-r border-sidebar-border/60 dark:border-white/20",
                "shadow-sm dark:shadow-[0_0_0_1px_rgba(255,255,255,0.10),0_16px_40px_-24px_rgba(0,0,0,0.9)]",
                className
            )}
        >
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/main-dashboard">
                                <div className="flex aspect-square size-10 items-center justify-center overflow-hidden">
                                    <Image
                                        src="/vertex_logo_black.png"
                                        alt="VOS Logo"
                                        width={40}
                                        height={40}
                                        style={{ width: "auto", height: "auto" }}
                                        className="max-h-9 max-w-10 object-contain"
                                        priority
                                    />
                                </div>

                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">VOS Web</span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        Customer Relationship Management
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <Separator />

            <SidebarContent>
                <div className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">
                    Platform
                </div>

                <ScrollArea
                    className={cn(
                        "min-h-0 flex-1",
                        "[&_[data-radix-scroll-area-viewport]>div]:block",
                        "[&_[data-radix-scroll-area-viewport]>div]:w-full",
                        "[&_[data-radix-scroll-area-viewport]>div]:min-w-0"
                    )}
                >
                    <div className="w-full min-w-0">
                        <NavMain items={data.navMain} />
                    </div>
                </ScrollArea>
            </SidebarContent>

            <SidebarFooter className="p-0">
                <Separator />
                <div className="py-3 text-center text-xs text-muted-foreground">
                    VOS Web v2.0
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
