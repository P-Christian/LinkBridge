// src/components/shared/layout/PortalPageHeader.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NotificationBell as FreelancerNotificationBell } from "@/modules/freelancer/freelancer-notifications/components/NotificationBellWrapper";
import { ClientNotificationBell } from "@/modules/client/notifications/components/ClientNotificationBellWrapper";
import { SchoolAdminNotificationBell } from "@/modules/school-admin/components/SchoolAdminNotificationBellWrapper";
// import { UserSearchBar } from "@/modules/shared/search/components/UserSearchBar";

/**
 * Reusable page header for all portal pages.
 * Layout: 3-column grid so the search bar is always truly centered,
 * regardless of the width of the left/right groups.
 *  - Left:   SidebarTrigger (hamburger)
 *  - Center: UserSearchBar (hidden on mobile and for admin routes)
 *  - Right:  Help (links to role How It Works guide) + Notification bell
 */
export interface PortalPageHeaderProps {
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
}

export function PortalPageHeader(_props?: PortalPageHeaderProps) {
  void _props;
  const pathname = usePathname();
  const isClientRoute = pathname?.startsWith("/linkbridge/client");
  const isFreelancerRoute = pathname?.startsWith("/linkbridge/freelancer");
  const isSchoolAdminRoute = pathname?.startsWith("/linkbridge/school-admin");
  // const isVosAdminRoute = pathname?.startsWith("/linkbridge/admin");

  const helpRoute = React.useMemo(() => {
    if (isClientRoute) return "/linkbridge/client/how-it-works";
    if (isFreelancerRoute) return "/linkbridge/freelancer/how-it-works";
    if (isSchoolAdminRoute) return "/linkbridge/school-admin/how-it-works";
    return "/how-it-works";
  }, [isClientRoute, isFreelancerRoute, isSchoolAdminRoute]);

  const storageKey = `vos_help_guide_seen_${pathname?.split("/")[3] ?? "portal"}`;

  const [hasSeenHelp, setHasSeenHelp] = React.useState<boolean>(true);

  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const seen = localStorage.getItem(storageKey);
        if (seen === "true" || pathname === helpRoute) {
          setHasSeenHelp(true);
          if (seen !== "true") {
            localStorage.setItem(storageKey, "true");
          }
        } else {
          setHasSeenHelp(false);
        }
      } catch {
        setHasSeenHelp(true);
      }
    });
  }, [storageKey, pathname, helpRoute]);

  const handleHelpClick = React.useCallback(() => {
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // Ignore localStorage errors
    }
    setHasSeenHelp(true);
  }, [storageKey]);

  const showNewBadge = !hasSeenHelp;
  // const showSearch = !isVosAdminRoute && !isSchoolAdminRoute;

  return (
    <header
      className="
        sticky top-0 z-50 isolate
        grid h-14 shrink-0 items-center gap-3 px-4 sm:h-16 md:gap-4 md:px-6
        grid-cols-2
        border-b border-border/60
        bg-gradient-to-r from-background/95 via-background/80 to-background/95
        backdrop-blur-xl backdrop-saturate-150
        shadow-[0_1px_0_0_hsl(var(--background)/0.6)_inset,0_4px_20px_-12px_hsl(var(--foreground)/0.25)]
      "
    >
      {/* Decorative background layers */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {/* soft brand glow, top-left */}
        <div className="absolute -left-24 -top-24 h-48 w-72 rounded-full bg-primary/10 blur-3xl" />
        {/* soft accent glow, top-right */}
        <div className="absolute -right-24 -top-24 h-48 w-72 rounded-full bg-primary/5 blur-3xl" />
        {/* subtle dot pattern fading toward the center */}
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2]
                     [background-image:radial-gradient(hsl(var(--foreground)/0.08)_1px,transparent_1px)]
                     [background-size:16px_16px]
                     [mask-image:linear-gradient(to_right,black,transparent_30%,transparent_70%,black)]"
        />
        {/* gradient hairline on the bottom edge */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      </div>

      {/* Left: sidebar toggle */}
      <div className="flex min-w-0 items-center justify-self-start">
        <SidebarTrigger
          className="-ml-1 shrink-0 rounded-xl text-muted-foreground transition-colors duration-150 hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label="Toggle navigation sidebar"
        />
      </div>

      {/* Center: search bar (empty cell on mobile/admin keeps the grid aligned) */}
      {/* <div className="min-w-0 justify-self-stretch">
        {showSearch && (
          <div className="hidden w-full min-w-0 md:block">
            <UserSearchBar />
          </div>
        )}
      </div> */}

      {/* Right: Help, then Bell */}
      <div className="flex shrink-0 items-center justify-self-end gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label="Help and guides"
                className="relative cursor-pointer text-muted-foreground hover:bg-primary/10 hover:text-foreground max-md:size-11"
              >
                <Link href={helpRoute} onClick={handleHelpClick}>
                  <HelpCircle className="h-5 w-5" />
                  {showNewBadge && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                    </span>
                  )}
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs font-semibold">
              <span>
                {showNewBadge ? "New guide & platform updates" : "Need Help?"}
              </span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isClientRoute && <ClientNotificationBell />}
        {isFreelancerRoute && <FreelancerNotificationBell />}
        {isSchoolAdminRoute && <SchoolAdminNotificationBell />}
      </div>
    </header>
  );
}