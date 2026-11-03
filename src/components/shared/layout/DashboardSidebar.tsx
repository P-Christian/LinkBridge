"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    type LucideIcon,
    MoreVertical,
    Settings2,
    User as UserIcon,
    Moon,
    Sun,
    LogOut,
} from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useThemeCurtain } from "@/components/theme/useThemeCurtain";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/components/shared/providers/UserProfileProvider";

export type NavItem = {
    label: string;
    href: string;
    icon: LucideIcon;
    /**
     * Optional section heading shown above this item. It applies to the following
     * items until another item sets a different group, so only the first item of a
     * section needs it. Omit it everywhere for a flat list.
     */
    group?: string;
};

export type SidebarConfig = {
    title: string;
    subtitle: string;
    homeUrl?: string;
    navItems: NavItem[];
    ctaButton?: {
        label: string;
        href: string;
    };
    footerLinks: NavItem[];
};

interface DashboardSidebarProps extends React.ComponentProps<typeof Sidebar> {
    config: SidebarConfig;
}

/**
 * Shared motion tokens. Keep SIDEBAR_EASE in sync with the width transition in
 * components/ui/sidebar.tsx (shadcn default: duration-200 ease-linear).
 */
const SIDEBAR_EASE = "duration-200 ease-linear motion-reduce:transition-none";

/**
 * Fade + nudge instead of display:none, and never wrap. On expand the fade waits
 * ~100ms so the width has opened first; on collapse it starts immediately.
 */
const LABEL_FADE = cn(
    "whitespace-nowrap overflow-hidden transition-[opacity,transform]",
    SIDEBAR_EASE,
    "delay-100 group-data-[collapsible=icon]:delay-0",
    "group-data-[collapsible=icon]:-translate-x-1 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none"
);

function normalizePath(p: string) {
    return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/**
 * The nav item whose href is the longest match for the current path. Matching by
 * prefix keeps "Review Candidates" lit on /client/applicants/123, while the longest-match
 * rule stops a root item like "/school-admin" from lighting up on every sub-page.
 */
function findActiveHref(pathname: string, items: NavItem[]): string | null {
    const cur = normalizePath(pathname);
    let best: string | null = null;
    for (const { href } of items) {
        if (!href || href === "#") continue;
        const target = normalizePath(href);
        if ((cur === target || cur.startsWith(`${target}/`)) && (!best || target.length > best.length)) {
            best = target;
        }
    }
    return best;
}

const AVATAR_TONES = [
    "from-blue-500 to-indigo-600",
    "from-violet-500 to-fuchsia-600",
    "from-emerald-500 to-teal-600",
    "from-sky-500 to-cyan-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
];

function SidebarAvatar({ name, src }: { name: string; src?: string }) {
    const [failed, setFailed] = React.useState(false);
    const initials = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "U";
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;

    return (
        <div className="relative size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-background shadow-sm group-data-[collapsible=icon]:size-8">
            {src && !failed ? (
                <Image
                    src={src}
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="h-full w-full object-cover"
                    onError={() => setFailed(true)}
                />
            ) : (
                <div
                    className={cn(
                        "flex h-full w-full items-center justify-center bg-gradient-to-br text-xs font-bold text-white",
                        AVATAR_TONES[hash % AVATAR_TONES.length]
                    )}
                >
                    {initials}
                </div>
            )}
        </div>
    );
}

export function DashboardSidebar({
    config,
    className,
    ...props
}: DashboardSidebarProps) {
    const pathname = usePathname();
    const { state } = useSidebar();
    const user = useUserProfile();
    const { theme, systemTheme } = useTheme();
    const { switchTheme } = useThemeCurtain();
    const [unreadMessages, setUnreadMessages] = React.useState(0);
    const [unreadNotifications, setUnreadNotifications] = React.useState(0);
    const [unreadContactMessages, setUnreadContactMessages] = React.useState(0);
    const loggingOut = React.useRef(false);

    const currentTheme = theme === "system" ? systemTheme : theme;
    const isDark = currentTheme === "dark";

    const toggleTheme = React.useCallback(() => {
        switchTheme(isDark ? "light" : "dark");
    }, [isDark, switchTheme]);

    const activeHref = React.useMemo(
        () => findActiveHref(pathname, config.navItems),
        [pathname, config.navItems]
    );

    // Group consecutive items that share the same section heading
    const sections = React.useMemo(() => {
        const out: { title?: string; items: NavItem[] }[] = [];
        for (const item of config.navItems) {
            const last = out[out.length - 1];
            if (!last || (item.group && item.group !== last.title)) {
                out.push({ title: item.group, items: [item] });
            } else {
                last.items.push(item);
            }
        }
        return out;
    }, [config.navItems]);

    React.useEffect(() => {
        const hasMessagesItem = config.navItems.some((item) => item.label === "Messages");
        const hasNotificationsItem = config.navItems.some((item) => item.label === "Notifications");
        const hasContactMessagesItem = config.navItems.some((item) => item.label === "Contact Messages");

        let isCircuitBroken = false;
        let controller: AbortController | null = null;
        let inFlight = false;

        const fetchCounts = async () => {
            // Upstream reads can take many seconds; without this a slow tick
            // would stack a second full poll on top of it every 30s.
            if (inFlight) return;
            inFlight = true;

            controller?.abort();
            controller = new AbortController();
            const signal = controller.signal;

            try {
                if (hasMessagesItem) {
                    try {
                        const res = await fetch("/api/shared/messaging/unread-count", { signal });
                        if (res.ok) {
                            const data = await res.json();
                            setUnreadMessages(data.unreadCount || 0);
                        }
                    } catch {
                        if (signal.aborted) return;
                        if (typeof navigator !== "undefined" && !navigator.onLine) return;
                        toast.error("Something went wrong", {
                            id: "sidebar-fetch-error",
                            duration: 3000,
                        });
                    }
                }

                if (hasContactMessagesItem) {
                    try {
                        const res = await fetch("/api/vos-admin/contact-messages/unread-count", { signal });
                        if (res.ok) {
                            const data = await res.json();
                            setUnreadContactMessages(data.unreadCount || 0);
                        }
                    } catch {
                        if (signal.aborted) return;
                        if (typeof navigator !== "undefined" && !navigator.onLine) return;
                        toast.error("Something went wrong", {
                            id: "sidebar-fetch-error",
                            duration: 3000,
                        });
                    }
                }

                if (hasNotificationsItem && !isCircuitBroken) {
                    const isFreelancer = pathname?.startsWith("/vos-sync/freelancer") || pathname?.startsWith("/freelancer");
                    const isClient = pathname?.startsWith("/vos-sync/client") || pathname?.startsWith("/client");

                    const endpoint = isFreelancer
                        ? "/api/freelancer/notifications?unread_only=true"
                        : isClient
                        ? "/api/client/notifications?unread_only=true&limit=100"
                        : null;

                    if (endpoint) {
                        try {
                            const res = await fetch(endpoint, { signal });
                            if (res.status === 401 || res.status === 403) {
                                // Trip circuit breaker to avoid infinite 403 / 401 polling flood
                                isCircuitBroken = true;
                                return;
                            }
                            if (res.ok) {
                                const data = await res.json();
                                setUnreadNotifications(data.unreadCount ?? data.notifications?.length ?? 0);
                            }
                        } catch {
                            if (signal.aborted) return;
                            if (typeof navigator !== "undefined" && !navigator.onLine) return;
                            toast.error("Something went wrong", {
                                id: "sidebar-fetch-error",
                                duration: 3000,
                            });
                        }
                    }
                }
            } finally {
                inFlight = false;
            }
        };

        fetchCounts();

        const interval = setInterval(fetchCounts, 30000);
        return () => {
            clearInterval(interval);
            controller?.abort();
        };
    }, [config.navItems, pathname]);

    const handleFooterClick = async (e: React.MouseEvent<HTMLAnchorElement | HTMLDivElement>, href: string) => {
        if (href !== "/logout") return;
        e.preventDefault();
        if (loggingOut.current) return;
        loggingOut.current = true;
        try {
            await fetch("/api/auth/logout", { method: "POST" });
        } catch (err) {
            console.error("Logout error:", err);
        } finally {
            // PRIV-017: the logout route already cleared the HttpOnly auth
            // cookie; a client-side expire write cannot touch it.
            document.body.style.display = "none";
            window.location.href = "/login";
        }
    };

    const showUserCard = !!user?.name && user.email !== "guest@example.com";

    const verificationInfo = React.useMemo(() => {
        const rawStatus = (user.verification_status || user.status || "UNVERIFIED").toUpperCase();
        if (rawStatus === "VERIFIED" || rawStatus === "ACTIVE") {
            return {
                label: "Verified",
                badgeClass: "bg-success/10 text-success ring-success/20",
                dotClass: "bg-success",
            };
        }
        if (rawStatus === "PENDING" || rawStatus === "PENDING_VERIFICATION") {
            return {
                label: "Pending Verification",
                badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
                dotClass: "bg-amber-500",
            };
        }
        if (rawStatus === "SUSPENDED" || rawStatus === "BLOCKED") {
            return {
                label: "Suspended",
                badgeClass: "bg-destructive/10 text-destructive ring-destructive/20",
                dotClass: "bg-destructive",
            };
        }
        if (rawStatus === "LIMITED") {
            return {
                label: "Limited",
                badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20",
                dotClass: "bg-amber-500",
            };
        }
        return {
            label: "Unverified",
            badgeClass: "bg-muted text-muted-foreground ring-border",
            dotClass: "bg-muted-foreground",
        };
    }, [user.verification_status, user.status]);

    const profileUrl = React.useMemo(() => {
        if (config.homeUrl?.includes("/client")) return "/vos-sync/client/company-profile";
        if (config.homeUrl?.includes("/freelancer")) return "/vos-sync/freelancer/profile";
        if (config.homeUrl?.includes("/school-admin")) return "/vos-sync/school-admin/profile";
        return "/vos-sync/vos-admin/settings";
    }, [config.homeUrl]);

    const settingsUrl = React.useMemo(() => {
        if (config.homeUrl?.includes("/client")) return "/vos-sync/client/settings";
        if (config.homeUrl?.includes("/freelancer")) return "/vos-sync/freelancer/settings";
        if (config.homeUrl?.includes("/school-admin")) return "/vos-sync/school-admin/settings";
        return "/vos-sync/vos-admin/settings";
    }, [config.homeUrl]);

    return (
        <Sidebar
            collapsible="icon"
            {...props}
            className={cn(
                "bg-[#FAFBFD] dark:bg-[#0E1426] border-r border-[#E6EAF2] dark:border-[#1E2942]",
                "shadow-xs dark:shadow-none",
                // soft brand tint fading out from the top of the panel
                "[&_[data-sidebar=sidebar]]:bg-[linear-gradient(180deg,hsl(var(--primary)/0.07),transparent_38%)]",
                className
            )}
        >
            {/* Fixed h-16 (same as PortalPageHeader) so the logo row and the page header
                share one baseline in both expanded and collapsed states. The bottom border
                replaces the old <Separator /> and sits inside the 64px, like the header's border. */}
            <SidebarHeader className="h-16 justify-center border-b border-border/60 px-2 py-0">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild tooltip={config.title}>
                            <Link
                                href={config.homeUrl || "/main-dashboard"}
                                prefetch={true}
                                className={cn(
                                    "transition-[gap]",
                                    SIDEBAR_EASE,
                                    "group-data-[collapsible=icon]:!gap-0"
                                )}
                            >
                                <div className="flex aspect-square size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:rounded-lg">
                                    <Image
                                        src="/vertex_logo_black.png"
                                        alt="VOS Logo"
                                        width={40}
                                        height={40}
                                        style={{ width: "auto", height: "auto" }}
                                        className="max-h-8 max-w-9 object-contain group-data-[collapsible=icon]:max-h-6 group-data-[collapsible=icon]:max-w-6 dark:invert"
                                        priority
                                    />
                                </div>

                                <div className={cn("grid flex-1 text-left text-sm leading-tight", LABEL_FADE)}>
                                    <span className="truncate font-bold text-base text-primary">{config.title}</span>
                                    <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-primary/70 ring-1 ring-inset ring-primary/15">
                                        {config.subtitle}
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <ScrollArea
                    className={cn(
                        "min-h-0 flex-1 py-2",
                        "[&_[data-radix-scroll-area-viewport]>div]:block",
                        "[&_[data-radix-scroll-area-viewport]>div]:w-full",
                        "[&_[data-radix-scroll-area-viewport]>div]:min-w-0"
                    )}
                >
                    <nav aria-label={`${config.subtitle} navigation`}>
                        {sections.map((section, si) => (
                            <div key={si}>
                                {/* Expanded: collapsed to nothing. Collapsed: thin divider that grows in. */}
                                {si > 0 && (
                                    <div
                                        aria-hidden="true"
                                        className={cn(
                                            "mx-3 h-px max-h-0 bg-border/70 opacity-0 transition-[opacity,margin,max-height]",
                                            SIDEBAR_EASE,
                                            "group-data-[collapsible=icon]:my-2 group-data-[collapsible=icon]:max-h-px group-data-[collapsible=icon]:opacity-100"
                                        )}
                                    />
                                )}
                                {/* Section heading: fades and collapses its height so items below don't jump. */}
                                {section.title && (
                                    <p
                                        className={cn(
                                            "max-h-8 overflow-hidden whitespace-nowrap px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70",
                                            "transition-[opacity,max-height,padding]",
                                            SIDEBAR_EASE,
                                            "group-data-[collapsible=icon]:max-h-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:opacity-0",
                                            si === 0 ? "pt-1 pb-1" : "pt-4 pb-1"
                                        )}
                                    >
                                        {section.title}
                                    </p>
                                )}
                                <SidebarMenu className="px-2 space-y-0.5">
                                    {section.items.map((item) => {
                                        const isActive = !!activeHref && normalizePath(item.href) === activeHref;
                                        const isMessages = item.label === "Messages";
                                        const isNotifications = item.label === "Notifications";
                                        const isContactMessages = item.label === "Contact Messages";
                                        const badgeCount = isMessages
                                            ? unreadMessages
                                            : isNotifications
                                            ? unreadNotifications
                                            : isContactMessages
                                            ? unreadContactMessages
                                            : 0;

                                        return (
                                            <SidebarMenuItem key={item.href}>
                                                {isActive && (
                                                    <motion.span
                                                        layoutId="sidebar-active-bar"
                                                        aria-hidden="true"
                                                        transition={{ type: "spring", stiffness: 420, damping: 34 }}
                                                        className="absolute -left-2 top-1/2 z-10 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-sky-500"
                                                    />
                                                )}
                                                <SidebarMenuButton
                                                    asChild
                                                    isActive={isActive}
                                                    tooltip={item.label}
                                                    className={cn(
                                                        "group/nav relative h-[38px] group-data-[collapsible=icon]:!size-8 text-muted-foreground transition-colors duration-150",
                                                        "hover:bg-primary/[0.06] hover:text-foreground",
                                                        "data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:font-semibold",
                                                        "data-[active=true]:hover:bg-primary/15 data-[active=true]:hover:text-primary"
                                                    )}
                                                >
                                                    <Link
                                                        href={item.href}
                                                        prefetch={true}
                                                        aria-current={isActive ? "page" : undefined}
                                                        className="flex w-full items-center justify-between"
                                                    >
                                                        <div className="flex min-w-0 items-center gap-3">
                                                            <item.icon
                                                                className={cn(
                                                                    "size-5 shrink-0 transition-transform duration-150 group-hover/nav:scale-110",
                                                                    isActive && "text-primary"
                                                                )}
                                                            />
                                                            <span className={LABEL_FADE}>{item.label}</span>
                                                        </div>
                                                        {badgeCount > 0 && (
                                                            <>
                                                                {/* Expanded pill: fades out on collapse, waits for width on expand */}
                                                                <span
                                                                    aria-hidden="true"
                                                                    className="mr-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground shadow-xs transition-opacity duration-150 delay-100 motion-reduce:transition-none group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:delay-0"
                                                                >
                                                                    {badgeCount > 99 ? "99+" : badgeCount}
                                                                </span>
                                                                {/* Collapsed mini badge: fades in once the rail has narrowed */}
                                                                <span
                                                                    aria-hidden="true"
                                                                    className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground opacity-0 ring-2 ring-sidebar transition-opacity duration-150 motion-reduce:transition-none group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:delay-150"
                                                                >
                                                                    {badgeCount > 9 ? "9+" : badgeCount}
                                                                </span>
                                                                <span className="sr-only">
                                                                    {badgeCount} unread {item.label.toLowerCase()}
                                                                </span>
                                                            </>
                                                        )}
                                                    </Link>
                                                </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        );
                                    })}
                                </SidebarMenu>
                            </div>
                        ))}
                    </nav>
                </ScrollArea>

                {config.ctaButton && (
                    <div
                        className={cn(
                            "max-h-24 overflow-hidden px-4 py-3 transition-[opacity,max-height,padding]",
                            SIDEBAR_EASE,
                            "group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-h-0 group-data-[collapsible=icon]:py-0 group-data-[collapsible=icon]:opacity-0"
                        )}
                    >
                        <Button asChild className="w-full justify-start whitespace-nowrap font-medium bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white" size="lg">
                            <Link href={config.ctaButton.href} prefetch={true}>
                                {config.ctaButton.label}
                            </Link>
                        </Button>
                    </div>
                )}
            </SidebarContent>

            <SidebarFooter className="p-0">
                <Separator className="opacity-60" />

                {/* Account card with full interactive popup menu */}
                {showUserCard && (
                    <div className="p-2 pt-0.5">
                        <DropdownMenu>
                            <Tooltip open={state === "collapsed" ? undefined : false}>
                                <TooltipTrigger asChild>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label="User account menu"
                                            className={cn(
                                                "group/card flex w-full items-center gap-2.5 rounded-xl p-2 text-left cursor-pointer outline-none",
                                                "transition-[background-color,padding,gap]",
                                                SIDEBAR_EASE,
                                                "hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-primary",
                                                // no justify-center: avatar stays left-aligned and the padding closes around it
                                                "group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:p-0"
                                            )}
                                        >
                                            <div className="relative">
                                                <SidebarAvatar name={user.name} src={user.avatar} />
                                                {/* Verification dot: only meaningful once the text pill is gone */}
                                                <span
                                                    aria-hidden="true"
                                                    className={cn(
                                                        "absolute bottom-0 right-0 size-3 rounded-full opacity-0 ring-2 ring-sidebar transition-opacity duration-150 motion-reduce:transition-none group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:delay-150",
                                                        verificationInfo.dotClass
                                                    )}
                                                />
                                            </div>
                                            <div className={cn("min-w-0 flex-1", LABEL_FADE)}>
                                                <div className="flex items-center justify-between gap-1">
                                                    <p className="truncate text-xs font-semibold leading-tight text-foreground">{user.name}</p>
                                                    <span className={cn(
                                                        "inline-flex items-center rounded-full px-1.5 py-0.2 text-[9px] font-medium ring-1 ring-inset shrink-0",
                                                        verificationInfo.badgeClass
                                                    )}>
                                                        {verificationInfo.label}
                                                    </span>
                                                </div>
                                                <p className="truncate text-[11px] text-muted-foreground mt-0.5">{user.email}</p>
                                            </div>
                                            <MoreVertical
                                                className={cn(
                                                    "size-4 shrink-0 text-muted-foreground/70 group-hover/card:text-foreground",
                                                    "group-data-[collapsible=icon]:w-0",
                                                    LABEL_FADE
                                                )}
                                            />
                                        </button>
                                    </DropdownMenuTrigger>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                    {user.name} · {verificationInfo.label}
                                </TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent
                                side="top"
                                align="start"
                                sideOffset={8}
                                className="w-56 rounded-xl p-1.5 shadow-lg border-border/80 bg-card/95 backdrop-blur-xl z-50"
                            >
                                <DropdownMenuGroup>
                                    <DropdownMenuItem asChild>
                                        <Link href={profileUrl} className="flex items-center gap-2 cursor-pointer text-xs py-2 rounded-lg">
                                            <UserIcon className="size-4 text-primary" />
                                            <span>Profile</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link href={settingsUrl} className="flex items-center gap-2 cursor-pointer text-xs py-2 rounded-lg">
                                            <Settings2 className="size-4 text-muted-foreground" />
                                            <span>Settings</span>
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={toggleTheme}
                                        className="flex items-center gap-2 cursor-pointer text-xs py-2 rounded-lg"
                                    >
                                        {isDark ? <Sun className="size-4 text-amber-500" /> : <Moon className="size-4 text-blue-500" />}
                                        <span>{isDark ? "Light mode" : "Dark mode"}</span>
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator className="my-1" />
                                <DropdownMenuItem
                                    onClick={(e) => handleFooterClick(e, "/logout")}
                                    className="flex items-center gap-2 cursor-pointer text-xs py-2 rounded-lg text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 dark:text-rose-400"
                                >
                                    <LogOut className="size-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}

                {/* Additional footer links (if any) */}
                {config.footerLinks.length > 0 && !showUserCard && (
                    <SidebarMenu className="p-2 space-y-1">
                        {config.footerLinks.map((item) => {
                            const isLogout = item.href === "/logout";
                            return (
                                <SidebarMenuItem key={item.href}>
                                    <SidebarMenuButton
                                        asChild
                                        tooltip={item.label}
                                        className={cn(
                                            "text-muted-foreground hover:text-foreground",
                                            isLogout && "hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                                        )}
                                    >
                                        <Link href={item.href} prefetch={true} onClick={(e) => handleFooterClick(e, item.href)}>
                                            <item.icon className="size-4 shrink-0" />
                                            <span className={LABEL_FADE}>{item.label}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                )}
                {!showUserCard && config.footerLinks.length === 0 && <div className="h-2" />}
            </SidebarFooter>
        </Sidebar>
    );
}