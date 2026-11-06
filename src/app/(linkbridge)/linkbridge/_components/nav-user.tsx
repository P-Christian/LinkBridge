/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    ChevronsUpDown,
    LogOut,
    Settings,
    User,
    KeyRound,
    ShieldCheck,
    Moon,
    Sun,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useThemeCurtain } from "@/components/theme/useThemeCurtain"
import { useUserProfile } from "@/components/shared/providers/UserProfileProvider"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { purgeApplicantAiCache } from "@/modules/client/applicants/utils/applicantAiCache"

type NavUserProps = {
    user: {
        name: string
        email: string
        avatar?: string
    }
    /**
     * Optional override. If not provided, NavUser will perform:
     * POST /api/auth/logout -> router.replace("/login") -> router.refresh()
     */
    onLogout?: () => void
    profileUrl?: string
    settingsUrl?: string
    compact?: boolean
}

export function NavUser({ user: propUser, onLogout, profileUrl, settingsUrl, compact }: NavUserProps) {

    const contextUser = useUserProfile()
    const user = contextUser?.name ? contextUser : propUser


    const [loggingOut, setLoggingOut] = React.useState(false)

    // ✅ theme toggle support
    const { theme, systemTheme } = useTheme()
    const { switchTheme } = useThemeCurtain()
    const [mounted, setMounted] = React.useState(false)
    const pathname = usePathname()
    React.useEffect(() => setMounted(true), [])

    const currentTheme = theme === "system" ? systemTheme : theme
    const isDark = currentTheme === "dark"

    const toggleTheme = React.useCallback(() => {
        // If theme is not resolved yet, default to toggling from light -> dark
        const next = isDark ? "light" : "dark"
        switchTheme(next)
    }, [isDark, switchTheme])

    const initials =
        user?.name
            ?.split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("") || "U"

    const handleLogout = React.useCallback(async () => {
        if (loggingOut) return
        setLoggingOut(true)

        try {
            // If a parent provided a handler, use it.
            if (onLogout) {
                await Promise.resolve(onLogout())
                return
            }

            // Default wiring: clear HttpOnly cookie via Next route
            await fetch("/api/auth/logout", { method: "POST" })
        } finally {
            // PRIV-016: candidate AI assessments cached in this browser must not
            // outlive the session. The HttpOnly auth cookie is cleared by the
            // logout route above - a client-side cookie write cannot touch it.
            purgeApplicantAiCache()

            // Hide the body to prevent bfcache flash on back navigation
            document.body.style.display = 'none';
            // Always redirect to login (hard refresh to clear client-side cache)
            window.location.href = "/login"
        }
    }, [loggingOut, onLogout])

    // Compute dynamic URLs based on current portal path
    let defaultProfileUrl = "#"
    let defaultSettingsUrl = "#"

    if (pathname.startsWith("/linkbridge/freelancer")) {
        defaultProfileUrl = "/linkbridge/freelancer/profile"
        defaultSettingsUrl = "/linkbridge/freelancer/settings"
    } else if (pathname.startsWith("/linkbridge/client")) {
        defaultProfileUrl = "/linkbridge/client/company-profile"
        defaultSettingsUrl = "/linkbridge/client/settings"
    } else if (pathname.startsWith("/linkbridge/school-admin")) {
        defaultProfileUrl = "/linkbridge/school-admin/settings"
        defaultSettingsUrl = "/linkbridge/school-admin/settings"
    } else if (pathname.startsWith("/linkbridge/admin")) {
        defaultProfileUrl = "/linkbridge/admin/profile"
        defaultSettingsUrl = "/linkbridge/settings?portal=vos-admin"
    }

    const finalProfileUrl = profileUrl || defaultProfileUrl
    const finalSettingsUrl = settingsUrl || defaultSettingsUrl

    if (compact) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        aria-label="User account menu"
                        className="relative size-9 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/20 hover:ring-primary/45 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 cursor-pointer"
                    >
                        <Avatar className="h-full w-full">
                            <AvatarImage src={user.avatar || ""} alt={user.name} className="object-cover" />
                            <AvatarFallback className="rounded-full bg-gradient-to-br from-primary/10 to-sky-500/10 text-xs font-bold text-primary">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    className="w-56 rounded-xl p-1.5 shadow-lg border-border/80 bg-card/95 backdrop-blur-xl z-50"
                    side="bottom"
                    align="end"
                    sideOffset={8}
                >
                    <div className="px-2 py-1.5 border-b border-border/60 mb-1">
                        <p className="truncate text-xs font-semibold text-foreground">{user.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            className="cursor-pointer text-xs py-2 rounded-lg"
                            onSelect={(e) => {
                                e.preventDefault()
                                toggleTheme()
                            }}
                            disabled={!mounted}
                        >
                            {isDark ? (
                                <Sun className="mr-2 size-4 text-amber-500" />
                            ) : (
                                <Moon className="mr-2 size-4 text-blue-500" />
                            )}
                            {isDark ? "Light mode" : "Dark mode"}
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                            <Link href={finalProfileUrl} className="cursor-pointer text-xs py-2 rounded-lg">
                                <User className="mr-2 size-4" />
                                My Profile
                            </Link>
                        </DropdownMenuItem>

                        <DropdownMenuItem asChild>
                            <Link href={finalSettingsUrl} className="cursor-pointer text-xs py-2 rounded-lg">
                                <Settings className="mr-2 size-4" />
                                Settings
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator className="my-1" />
                    <DropdownMenuItem
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="cursor-pointer text-xs py-2 rounded-lg text-rose-600 focus:text-rose-600 focus:bg-rose-500/10 dark:text-rose-400"
                    >
                        <LogOut className="mr-2 size-4" />
                        Log out
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    }

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        {/* Cursor pointer for whole trigger row */}
                        <SidebarMenuButton size="lg" className="w-full cursor-pointer">
                            <Avatar className="h-8 w-8 rounded-lg">
                                <AvatarImage src={user.avatar || ""} alt={user.name} />
                                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                            </Avatar>

                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{user.name}</span>
                                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
                            </div>

                            <ChevronsUpDown className="ml-auto size-4 opacity-70" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg max-md:min-w-0 max-md:max-w-[calc(100vw-2rem)]"
                        side="bottom"
                        align="start"
                        sideOffset={8}
                    >
                        <DropdownMenuGroup>
                            {/* ✅ NEW: Theme toggle above My Profile */}
                            <DropdownMenuItem
                                className="cursor-pointer"
                                onSelect={(e) => {
                                    // prevent dropdown from closing on click (optional; remove if you want it to close)
                                    e.preventDefault()
                                    toggleTheme()
                                }}
                                disabled={!mounted}
                            >
                                {isDark ? (
                                    <Sun className="mr-2 size-4" />
                                ) : (
                                    <Moon className="mr-2 size-4" />
                                )}
                                {isDark ? "Light mode" : "Dark mode"}
                            </DropdownMenuItem>

                            <DropdownMenuItem asChild>
                                <Link href={finalProfileUrl} className="cursor-pointer">
                                    <User className="mr-2 size-4" />
                                    My Profile
                                </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem asChild>
                                <Link href="/crm/change-password" className="cursor-pointer">
                                    <KeyRound className="mr-2 size-4" />
                                    Change Password
                                </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem asChild>
                                <Link href="/crm/login-activity" className="cursor-pointer">
                                    <ShieldCheck className="mr-2 size-4" />
                                    Login Activity
                                </Link>
                            </DropdownMenuItem>

                            <DropdownMenuItem asChild>
                                <Link href={finalSettingsUrl} className="cursor-pointer">
                                    <Settings className="mr-2 size-4" />
                                    Settings
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuGroup>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem asChild>
                            <button
                                type="button"
                                className="w-full cursor-pointer text-left text-destructive focus:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                                onClick={handleLogout}
                                disabled={loggingOut}
                            >
                <span className="inline-flex items-center">
                  <LogOut className="mr-2 size-4" />
                    {loggingOut ? "Logging out..." : "Log out"}
                </span>
                            </button>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}

export default NavUser
