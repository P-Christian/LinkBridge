"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { NotificationBell } from "@/modules/freelancer/freelancer-notifications/components/NotificationBellWrapper";
import { UserSearchBar } from "@/modules/shared/search/components/UserSearchBar";
import { NavUser } from "@/app/(linkbridge)/linkbridge/_components/nav-user";

type FreelancerPageHeaderUser = {
    name: string;
    email: string;
    avatar?: string;
};

interface FreelancerPageHeaderProps {
    /** Breadcrumb page title, e.g. "Dashboard", "Applications". */
    label: string;
    /** Fallback user for NavUser; the shared UserProfileProvider wins when it has a name. */
    user: FreelancerPageHeaderUser;
    /** Show the red "new" ping dot on the Help button. */
    showNewBadge?: boolean;
}

/**
 * Shared shell header for every freelancer portal page.
 * Mirrors the dashboard header exactly: SidebarTrigger + breadcrumb on the left,
 * and search (md+), notification bell, Help link and NavUser on the right.
 */
export function FreelancerPageHeader({
    label,
    user,
    showNewBadge = false,
}: FreelancerPageHeaderProps) {
    return (
        <header className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b shadow-xs bg-background sm:h-16">
            {/* Left: sidebar toggle + page title */}
            <div className="flex h-full min-w-0 items-center gap-2 px-3 sm:px-4 overflow-hidden">
                <SidebarTrigger className="-ml-1 shrink-0" />
                <Separator
                    orientation="vertical"
                    className="hidden sm:block mr-2 data-[orientation=vertical]:h-4 shrink-0"
                />
                <div className="min-w-0 overflow-hidden">
                    <Breadcrumb>
            <BreadcrumbList className="min-w-0 overflow-hidden flex-nowrap">
              <BreadcrumbItem className="hidden xl:block shrink-0">
                <BreadcrumbLink href="/linkbridge/freelancer/dashboard">Freelancer</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden xl:block shrink-0" />
                            <BreadcrumbItem className="min-w-0 overflow-hidden">
                                <BreadcrumbPage className="truncate max-w-[56vw] sm:max-w-[60vw] md:max-w-none">
                                    {label}
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>
            </div>

            {/* Right: search (md+), notifications, help, user */}
            <div className="flex h-full items-center px-2 sm:px-4 shrink-0 max-w-[48vw] sm:max-w-none gap-2">
                <div className="hidden lg:block mr-2">
                    <UserSearchBar />
                </div>
                <NotificationBell />
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                asChild
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-foreground flex relative cursor-pointer max-md:size-11"
                            >
                                <Link href="/linkbridge/freelancer/how-it-works">
                                    <HelpCircle className="h-5 w-5" />
                                    {showNewBadge && (
                                        <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                    )}
                                </Link>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="font-semibold text-xs">
                            <span>How It Works</span>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <div className="w-auto max-w-[240px] min-w-0">
          <NavUser user={user} />
        </div>
            </div>
        </header>
    );
}
