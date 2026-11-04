"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Menu, X, Briefcase, ChevronDown, LayoutDashboard, FileText, LogOut } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { ThemeSelector } from "@/components/theme/ThemeSelector"
import { cn, formatAssetUrl } from "@/lib/utils"
import { usePrimaryPlatformCompany } from "@/hooks/usePrimaryPlatformCompany"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AuthUser = {
  name: string
  email?: string
  avatar?: string
  role: "client" | "freelancer" | "admin" | "school" | "other"
}

const PUBLIC_MOBILE_MENU_ID = "public-mobile-navigation"

const NAV_LINKS = [
  { href: "/find-jobs", label: "Find Jobs" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/companies", label: "Companies" },
  { href: "/career-advice", label: "Career Advice" },
  { href: "/about-us", label: "About Us" },
  { href: "/contact-us", label: "Contact Us" },
]

export function Header() {
  const pathname = usePathname()
  const { company } = usePrimaryPlatformCompany()
  const [isScrolled, setIsScrolled] = React.useState(false)
  const [mobileMenuPath, setMobileMenuPath] = React.useState<string | null>(null)
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [checkingAuth, setCheckingAuth] = React.useState(true)
  const mobileMenuButtonRef = React.useRef<HTMLButtonElement>(null)
  const mobileMenuOpen = mobileMenuPath === pathname

  // Handle navbar styling on scroll
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    handleScroll()
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  React.useEffect(() => {
    if (!mobileMenuOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuPath(null)
        mobileMenuButtonRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [mobileMenuOpen])

  // Check logged-in user session safely via /api/auth/me
  React.useEffect(() => {
    async function checkAuth() {
      try {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" })
        if (!meRes.ok) {
          setCheckingAuth(false)
          return
        }

        const meJson = await meRes.json()
        if (!meJson?.authenticated) {
          setCheckingAuth(false)
          return
        }

        if (meJson.role === "employer") {
          const clientRes = await fetch("/api/client/company-profile", { cache: "no-store" })
          if (clientRes.ok) {
            const clientJson = await clientRes.json()
            if (clientJson.company) {
              const comp = clientJson.company
              const logo = comp.company_logo
                ? comp.company_logo.startsWith("http") || comp.company_logo.startsWith("/")
                  ? comp.company_logo
                  : `/api/client/assets/${comp.company_logo}`
                : ""
              setUser({
                name: comp.company_name || "Client Portal",
                email: comp.company_email || "",
                avatar: logo,
                role: "client",
              })
              setCheckingAuth(false)
              return
            }
          }
          setUser({
            name: "Client Portal",
            email: "",
            avatar: "",
            role: "client",
          })
        } else if (meJson.role === "employee") {
          const freeRes = await fetch("/api/freelancer/profile", { cache: "no-store" })
          if (freeRes.ok) {
            const freeJson = await freeRes.json()
            if (freeJson.ok && freeJson.data) {
              const f = freeJson.data
              const name = `${f.user_fname || f.first_name || ""} ${f.user_lname || f.last_name || ""}`.trim() || "User"
              const rawAvatar = f.profile_image_url || f.profile_picture || ""
              const avatar = rawAvatar
                ? rawAvatar.startsWith("http") || rawAvatar.startsWith("/")
                  ? rawAvatar
                  : `/api/client/assets/${rawAvatar}`
                : ""
              setUser({
                name,
                email: f.user_email || f.email || "",
                avatar,
                role: "freelancer",
              })
              setCheckingAuth(false)
              return
            }
          }
          setUser({
            name: "Freelancer",
            email: "",
            avatar: "",
            role: "freelancer",
          })
        } else if (meJson.role === "admin") {
          setUser({
            name: "Administrator",
            email: "",
            avatar: "",
            role: "admin",
          })
        } else if (meJson.role === "school") {
          setUser({
            name: "School Admin",
            email: "",
            avatar: "",
            role: "school",
          })
        }
      } catch {
        // Ignore network errors for unauthenticated guests
      }
      setCheckingAuth(false)
    }
    checkAuth()
  }, [])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch (err) {
      console.error("Logout error:", err)
    } finally {
      // PRIV-017: no client-side cookie expire here - /api/auth/logout already
      // cleared the HttpOnly auth cookie, and JS cannot overwrite it.
      window.location.href = "/login"
    }
  }

  const initials = user?.name
    ? user.name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("")
    : "U"

  const showScrolledBg = isScrolled || mobileMenuOpen

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={`fixed top-0 w-full z-50 h-[72px] flex items-center border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out motion-reduce:transition-none ${
        showScrolledBg
          ? "bg-background/85 backdrop-blur-xl border-border/80 shadow-md shadow-primary/5"
          : "bg-transparent border-transparent shadow-none"
      }`}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <Link
          href="/"
          className="group flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 shadow-md shadow-indigo-600/30 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 overflow-hidden p-1.5">
            {company?.platform_icon &&
            (company.platform_icon.startsWith("/") ||
              company.platform_icon.startsWith("http") ||
              /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(company.platform_icon)) ? (
              <Image
                src={formatAssetUrl(company.platform_icon) || company.platform_icon}
                alt={company?.platform_name || "VOS Sync"}
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                unoptimized
              />
            ) : (
              <Briefcase className="h-5 w-5 text-white" aria-hidden="true" />
            )}
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            {company?.platform_name || "VOS Sync"}
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-8 font-medium text-sm">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center transition-colors relative",
                  isActive
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                {isActive && (
                  <motion.span
                    layoutId="active-header-nav-indicator"
                    className="absolute bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-gradient-to-r from-primary to-info shadow-xs shadow-primary/30"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 30,
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:flex items-center gap-4">
          <ThemeSelector />

          {!checkingAuth && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex min-h-11 items-center gap-2.5 px-3 py-2 rounded-full hover:bg-muted cursor-pointer transition-all">
                  <div className="h-7 w-7 rounded-full border border-border/40 overflow-hidden relative shrink-0 bg-muted flex items-center justify-center font-bold text-xs">
                    {user.avatar ? (
                      <Image
                        src={user.avatar}
                        alt={user.name}
                        width={28}
                        height={28}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <span className="text-xs font-bold text-primary">{initials}</span>
                    )}
                  </div>
                  <span className="text-sm font-semibold text-foreground max-w-[140px] truncate">
                    {user.name}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-xl rounded-xl border border-border bg-popover">
                <div className="px-3 py-2 border-b border-border/50 mb-1">
                  <p className="text-sm font-bold text-foreground truncate">{user.name}</p>
                  {user.email && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
                </div>

                {user.role === "client" ? (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/vos-sync/client/dashboard" className="flex min-h-11 items-center gap-2.5 cursor-pointer rounded-lg py-2 font-medium">
                        <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/vos-sync/client/jobs" className="flex min-h-11 items-center gap-2.5 cursor-pointer rounded-lg py-2 font-medium">
                        <Briefcase className="w-4 h-4 text-muted-foreground" />
                        Manage Jobs
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : user.role === "admin" ? (
                  <DropdownMenuItem asChild>
                    <Link href="/vos-sync/vos-admin" className="flex min-h-11 items-center gap-2.5 cursor-pointer rounded-lg py-2 font-medium">
                      <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                      Admin Portal
                    </Link>
                  </DropdownMenuItem>
                ) : user.role === "school" ? (
                  <DropdownMenuItem asChild>
                    <Link href="/vos-sync/school-admin" className="flex min-h-11 items-center gap-2.5 cursor-pointer rounded-lg py-2 font-medium">
                      <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                      School Portal
                    </Link>
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/vos-sync/freelancer/dashboard" className="flex min-h-11 items-center gap-2.5 cursor-pointer rounded-lg py-2 font-medium">
                        <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/vos-sync/freelancer/applications" className="flex min-h-11 items-center gap-2.5 cursor-pointer rounded-lg py-2 font-medium">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        My Applications
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex min-h-11 items-center gap-2.5 cursor-pointer rounded-lg py-2 text-rose-600 dark:text-rose-400 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" className="min-h-11 font-medium cursor-pointer text-foreground hover:bg-transparent hover:text-primary">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="min-h-11 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          <ThemeSelector />
          <Button
            ref={mobileMenuButtonRef}
            type="button"
            variant="ghost"
            className="size-11 p-0 cursor-pointer text-foreground"
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls={PUBLIC_MOBILE_MENU_ID}
            onClick={() => setMobileMenuPath(mobileMenuOpen ? null : pathname)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Nav Dropdown */}
      {mobileMenuOpen && (
        <nav
          id={PUBLIC_MOBILE_MENU_ID}
          aria-label="Mobile navigation"
          onClick={() => setMobileMenuPath(null)}
          className="lg:hidden absolute top-full left-0 flex max-h-[calc(100dvh-6rem)] w-full flex-col gap-4 overflow-y-auto overscroll-contain border-b border-border bg-background px-4 py-4 shadow-lg"
        >
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href || (href !== "/" && pathname?.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                prefetch={true}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center font-medium transition-colors px-3 rounded-lg relative",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="active-mobile-nav-indicator"
                    className="absolute inset-0 rounded-lg bg-primary/10 -z-10"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 30,
                    }}
                  />
                )}
                {label}
              </Link>
            );
          })}
          <hr className="border-border" />
          {user ? (
            <>
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="h-9 w-9 rounded-full border border-border/40 overflow-hidden relative shrink-0 bg-muted flex items-center justify-center font-bold text-xs">
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name}
                      width={36}
                      height={36}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-xs font-bold text-primary">{initials}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{user.name}</p>
                  {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                </div>
              </div>
              {user.role === "client" ? (
                <>
                  <Button asChild variant="outline" className="min-h-11 w-full justify-start gap-2 cursor-pointer border-border text-foreground hover:bg-muted">
                    <Link href="/vos-sync/client/dashboard">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="min-h-11 w-full justify-start gap-2 cursor-pointer border-border text-foreground hover:bg-muted">
                    <Link href="/vos-sync/client/jobs">
                      <Briefcase className="w-4 h-4" /> Manage Jobs
                    </Link>
                  </Button>
                </>
              ) : user.role === "admin" ? (
                <Button asChild variant="outline" className="min-h-11 w-full justify-start gap-2 cursor-pointer border-border text-foreground hover:bg-muted">
                  <Link href="/vos-sync/vos-admin">
                    <LayoutDashboard className="w-4 h-4" /> Admin Portal
                  </Link>
                </Button>
              ) : user.role === "school" ? (
                <Button asChild variant="outline" className="min-h-11 w-full justify-start gap-2 cursor-pointer border-border text-foreground hover:bg-muted">
                  <Link href="/vos-sync/school-admin">
                    <LayoutDashboard className="w-4 h-4" /> School Portal
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline" className="min-h-11 w-full justify-start gap-2 cursor-pointer border-border text-foreground hover:bg-muted">
                    <Link href="/vos-sync/freelancer/dashboard">
                      <LayoutDashboard className="w-4 h-4" /> Dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="min-h-11 w-full justify-start gap-2 cursor-pointer border-border text-foreground hover:bg-muted">
                    <Link href="/vos-sync/freelancer/applications">
                      <FileText className="w-4 h-4" /> My Applications
                    </Link>
                  </Button>
                </>
              )}
              <Button onClick={handleLogout} variant="destructive" className="min-h-11 w-full justify-start gap-2 cursor-pointer">
                <LogOut className="w-4 h-4" /> Logout
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" className="min-h-11 w-full justify-center cursor-pointer border-border text-foreground hover:bg-primary/10 hover:text-primary">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild className="min-h-11 w-full justify-center cursor-pointer bg-primary text-primary-foreground ">
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
      )}
    </motion.header>
  )
}

