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
    homeUrl: "/linkbridge/freelancer/dashboard",
    navItems: [
        { label: "Dashboard", href: "/linkbridge/freelancer/dashboard", icon: LayoutDashboard, group: "Overview" },
        { label: "My Profile", href: "/linkbridge/freelancer/profile", icon: User },
        { label: "Find Work", href: "/linkbridge/freelancer/jobs", icon: Briefcase, group: "Work" },
        { label: "My Applications", href: "/linkbridge/freelancer/applications", icon: FileText },
        { label: "Messages", href: "/linkbridge/freelancer/messaging", icon: MessageSquare, group: "Inbox" },
        { label: "Referrals", href: "/linkbridge/freelancer/referrals", icon: Share2 },
        { label: "Notifications", href: "/linkbridge/freelancer/notifications", icon: Bell },
        // { label: "How It Works", href: "/linkbridge/freelancer/how-it-works", icon: HelpCircle },
        { label: "Settings", href: "/linkbridge/freelancer/settings", icon: Settings2, group: "Account" },
    ],
    footerLinks: [
        { label: "Log out", href: "/logout", icon: LogOut },
    ],
};

const FREELANCER_GUEST_SIDEBAR_CONFIG: SidebarConfig = {
    ...FREELANCER_SIDEBAR_CONFIG,
    homeUrl: "/linkbridge/freelancer/jobs",
    navItems: [
        { label: "Find Work", href: "/linkbridge/freelancer/jobs", icon: Briefcase },
        { label: "How It Works", href: "/linkbridge/freelancer/how-it-works", icon: HelpCircle },
    ],
};

const CLIENT_SIDEBAR_CONFIG: SidebarConfig = {
    title: "LinkBridge",
    subtitle: "CLIENT PORTAL",
    homeUrl: "/linkbridge/client/dashboard",
    navItems: [
        { label: "Dashboard", href: "/linkbridge/client/dashboard", icon: LayoutDashboard, group: "Overview" },
        { label: "Company Profile", href: "/linkbridge/client/company-profile", icon: User },
        { label: "Manage Jobs", href: "/linkbridge/client/jobs", icon: Briefcase, group: "Hiring" },
        { label: "Review Candidates", href: "/linkbridge/client/applicants", icon: FileText },
        { label: "Talent Search", href: "/linkbridge/client/talent-search", icon: Search },
        { label: "Campus Talent", href: "/linkbridge/client/campus-talent", icon: GraduationCap },
        { label: "Interview Schedule", href: "/linkbridge/client/interviews", icon: CalendarDays },
        { label: "Messages", href: "/linkbridge/client/messaging", icon: MessageSquare, group: "Inbox" },
        { label: "Notifications", href: "/linkbridge/client/notifications", icon: Bell },
        // { label: "How It Works", href: "/linkbridge/client/how-it-works", icon: HelpCircle },
        { label: "ATS Pipeline", href: "/linkbridge/client/ats-pipeline", icon: GitFork, group: "Configuration" },
    ],
    footerLinks: [],
};

const SCHOOL_DASHBOARD_SIDEBAR_CONFIG: SidebarConfig = {
    title: "LinkBridge",
    subtitle: "SCHOOL PORTAL",
    homeUrl: "/linkbridge/school-admin",
    navItems: [
        { label: "Dashboard", href: "/linkbridge/school-admin", icon: LayoutDashboard, group: "Overview" },
        { label: "My School", href: "/linkbridge/school-admin/profile", icon: Building2 },
        { label: "My Courses", href: "/linkbridge/school-admin/courses", icon: GraduationCap, group: "Programs" },
        { label: "Student Roster", href: "/linkbridge/school-admin/students", icon: Users },
        { label: "Requests", href: "/linkbridge/school-admin/requests", icon: ClipboardCheck },
        { label: "Job Referrals", href: "/linkbridge/school-admin/job-referrals", icon: Briefcase, group: "Careers" },
        { label: "Success Metrics", href: "/linkbridge/school-admin/success-metrics", icon: TrendingUp },
        { label: "Configuration", href: "/linkbridge/school-admin/settings", icon: Settings2, group: "Account" },
    ],
    footerLinks: [
        { label: "Log out", href: "/logout", icon: LogOut },
    ],
};

const SCHOOL_ADMIN_SIDEBAR_CONFIG: SidebarConfig = {
    title: "LinkBridge",
    subtitle: "ADMIN PORTAL",
    homeUrl: "/linkbridge/admin",
    navItems: [
        { label: "Dashboard", href: "/linkbridge/admin", icon: LayoutDashboard, group: "Overview" },
        { label: "Request Management", href: "/linkbridge/admin/requests", icon: ClipboardCheck, group: "Management" },
        { label: "Contact Messages", href: "/linkbridge/admin/contact-messages", icon: MessageSquare },
        { label: "User Management", href: "/linkbridge/admin/users", icon: Users },
        { label: "Account Status", href: "/linkbridge/admin/account-status", icon: ShieldAlert },
        { label: "Career Advice", href: "/linkbridge/admin/career-articles", icon: FileText, group: "Content" },
        { label: "Platform Company", href: "/linkbridge/admin/platform-company", icon: Building },
        { label: "Company Verification", href: "/linkbridge/admin/company-verification", icon: Building2, group: "Verification" },
        { label: "School Verification", href: "/linkbridge/admin/school-verification", icon: GraduationCap },
        { label: "Role Matching", href: "/linkbridge/admin/job-roles", icon: Target, group: "System" },
        { label: "Gemini Monitoring", href: "/linkbridge/admin/gemini-monitoring", icon: Cpu },
        { label: "Audit Trail", href: "/linkbridge/admin/audit-trail", icon: ShieldCheck },
        { label: "Configuration", href: "/linkbridge/admin/settings", icon: Settings2 },
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

    if (pathname.startsWith('/linkbridge/suspended') || pathname.startsWith('/linkbridge/suspended')) {
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

    if (role === "FREELANCER" || pathname.startsWith("/linkbridge/freelancer") || pathname.startsWith("/linkbridge/freelancer") || (isGuest && (pathname.startsWith("/linkbridge/public") || pathname.startsWith("/linkbridge/public"))) || portal === "freelancer") {
        return (
            <DashboardSidebar
                config={isGuest ? FREELANCER_GUEST_SIDEBAR_CONFIG : FREELANCER_SIDEBAR_CONFIG}
                {...props}
            />
        );
    }

    if (role === "CLIENT" || pathname.startsWith("/linkbridge/client") || pathname.startsWith("/linkbridge/client") || portal === "client") {
        return <DashboardSidebar config={CLIENT_SIDEBAR_CONFIG} {...props} />;
    }

    if (role === "SCHOOL_ADMIN" || pathname.startsWith("/linkbridge/school-admin") || pathname.startsWith("/linkbridge/school-admin") || portal === "school-admin") {
        return <DashboardSidebar config={SCHOOL_DASHBOARD_SIDEBAR_CONFIG} {...props} />;
    }

    if (role === "ADMIN" || pathname.startsWith("/linkbridge/admin") || pathname.startsWith("/linkbridge/admin") || portal === "vos-admin" || portal === "admin") {
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
                                <div
                                    className="flex aspect-square items-center justify-center overflow-hidden shrink-0"
                                    style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                                >
                                    <Image
                                        src="/Link-Bridge-logo.png"
                                        alt="LinkBridge Logo"
                                        width={32}
                                        height={32}
                                        unoptimized
                                        priority
                                        className="object-contain shrink-0"
                                        style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                                    />
                                </div>

                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">LinkBridge</span>
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
                    LinkBridge v2.0
                </div>
            </SidebarFooter>
        </Sidebar>
    );
}
