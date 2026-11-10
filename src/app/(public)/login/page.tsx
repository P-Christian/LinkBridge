"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { User, Code2, CheckCircle2, Briefcase, Eye, EyeOff, AlertCircle } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { SocialAuthButtons } from "@/modules/auth/components/SocialAuthButtons"


function normalizeLoginErrorMessage(rawMsg: string, httpStatus?: number) {
    const msg = String(rawMsg || "")
    const m = msg.toLowerCase()

    // ✅ Pass through detailed lockout and attempt messages
    if (
        m.includes("account is locked") ||
        m.includes("account locked") ||
        m.includes("account is blocked") ||
        (m.includes("invalid") && m.includes("remaining"))
    ) {
        return msg
    }

    // ✅ Generic Invalid credentials (401)
    if (
        httpStatus === 401 ||
        m.includes("http 401") ||
        m.includes("unauthorized") ||
        m.includes("invalid credentials")
    ) {
        return "Credentials invalid."
    }

    // ✅ Backend unreachable / connection problems -> friendly message
    if (
        m.includes("cannot reach spring api") ||
        m.includes("econnrefused") ||
        m.includes("fetch failed") ||
        m.includes("network error") ||
        m.includes("timeout") ||
        m.includes("aborted")
    ) {
        return "Server is down, please contact Administrator."
    }

    return msg
}

type FieldErrors = {
    email?: string
    hashPassword?: string
}

// Open-redirect guard: same-origin relative paths only (single leading slash, no "//", no backslashes).
function sanitizeNextPath(value: string | null): string | null {
    if (!value) return null
    if (!value.startsWith("/") || value.startsWith("//")) return null
    if (value.includes("\\")) return null

    try {
        const baseUrl = "https://vos-sync.invalid"
        const destination = new URL(value, baseUrl)
        if (destination.origin !== baseUrl) return null
        return `${destination.pathname}${destination.search}${destination.hash}`
    } catch {
        return null
    }
}

export default function LoginPage() {
    return (
        <React.Suspense fallback={<div className="min-h-dvh flex items-center justify-center">Loading...</div>}>
            <LoginForm />
        </React.Suspense>
    )
}

function LoginForm() {
    const searchParams = useSearchParams()

    const [showPw, setShowPw] = React.useState(false)
    const [loading, setLoading] = React.useState(false)

    const [email, setEmail] = React.useState("")
    const [hashPassword, setHashPassword] = React.useState("")
    const [remember, setRemember] = React.useState(false)
    const passwordInputRef = React.useRef<HTMLInputElement>(null)

    const [errors, setErrors] = React.useState<FieldErrors>({})

    // PRIV-017: no client-side "already signed in" probe here - the auth cookie
    // is HttpOnly so document.cookie cannot see it; middleware.ts performs that
    // redirect server-side for /login.

    React.useEffect(() => {
        const error = searchParams.get("error")
        const queryEmail = searchParams.get("email")
        if (
            (error === "google_not_connected" ||
                error === "google_not_linked" ||
                error === "facebook_not_connected" ||
                error === "facebook_not_linked" ||
                error === "linkedin_not_connected" ||
                error === "linkedin_not_linked") &&
            queryEmail
        ) {
            queueMicrotask(() => {
                setEmail(queryEmail)
            })
        }
    }, [searchParams])

    React.useEffect(() => {
        const error = searchParams.get("error")
        if (!error) return

        const errorMap: Record<string, string> = {
            account_not_found: "No account found with this email. Please sign up first.",
            google_not_connected: "This email already has a LinkBridge account, but it isn't connected to Google.",
            google_identity_conflict: "Google identity is linked to a different account than the entered email.",
            google_not_linked: "This Google account is not connected to an existing account. Sign in using your original login method, then connect Google in Security & Auth → Connected Accounts & Social Logins.",
            facebook_not_connected: "This email already has a LinkBridge account, but it isn't connected to Facebook.",
            facebook_identity_conflict: "Facebook identity is linked to a different account than the entered email.",
            facebook_not_linked: "This Facebook account is not connected to an existing account. Sign in using your original login method, then connect Facebook in Security & Auth → Connected Accounts & Social Logins.",
            linkedin_not_connected: "This email already has a LinkBridge account, but it isn't connected to LinkedIn.",
            linkedin_identity_conflict: "LinkedIn identity is linked to a different account than the entered email.",
            linkedin_not_linked: "This LinkedIn account is not connected to an existing account. Sign in using your original login method, then connect LinkedIn in Security & Auth → Connected Accounts & Social Logins.",
            google_already_registered: "This Google account is already registered. Please sign in.",
            email_already_registered: "An account with this email already exists. Please sign in using your existing login method, then connect your social provider in Settings.",
            account_blocked: "Your account is blocked. Please contact support.",
            account_inactive: "Your account is not active or verified.",
            google_cancelled: "Google sign-in was cancelled.",
            facebook_cancelled: "Facebook sign-in was cancelled.",
            linkedin_cancelled: "LinkedIn sign-in was cancelled.",
            state_mismatch: "Authentication state mismatch. Please try again.",
            invalid_oauth_state: "Authentication session expired or invalid. Please try again.",
            transaction_replayed: "Authentication transaction was already consumed. Please try again.",
            oauth_callback_failed: "Sign in could not be completed.",
            facebook_callback_failed: "Sign in with Facebook could not be completed.",
            linkedin_callback_failed: "Sign in with LinkedIn could not be completed.",
            oauth_init_failed: "Failed to connect to authentication provider. Please try again.",
            facebook_init_failed: "Failed to connect to Facebook. Please try again.",
            linkedin_init_failed: "Failed to connect to LinkedIn. Please try again.",
        }

        const message = errorMap[error] || "Authentication failed. Please try again."
        toast.error("Sign in failed", { id: "login-auth-error", description: message })
    }, [searchParams])

    const validate = React.useCallback((): boolean => {
        const next: FieldErrors = {}

        if (!String(email).trim()) next.email = "Email is required"
        if (!String(hashPassword).trim()) next.hashPassword = "Password is required"

        setErrors(next)
        return Object.keys(next).length === 0
    }, [email, hashPassword])

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validate()) return

        setLoading(true)

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, hashPassword, remember }),
            })

            const data = await res.json().catch(() => null)

            if (!res.ok || !data?.ok) {
                const raw = String(data?.message ?? `Login failed (HTTP ${res.status}).`)
                const msg = normalizeLoginErrorMessage(raw, res.status)
                toast.error("Sign in failed", { description: msg })
                return
            }

            toast.success("Signed in", { description: "Welcome back." })

            // console.log("[LoginForm] Login response payload:", data)

            const roleId = Number(data?.role_id);
            const roleStr = String(data?.role || data?.role_name || "").toUpperCase();

            const serverDestination = sanitizeNextPath(
                typeof data?.destination === "string" ? data.destination : null
            )

            let defaultPath = serverDestination || "/main-dashboard"
            if (!serverDestination) {
                if (roleId === 1 || roleStr === "FREELANCER") {
                    defaultPath = "/linkbridge/freelancer/dashboard"
                } else if (roleId === 2 || roleStr === "CLIENT" || roleStr === "EMPLOYER") {
                    defaultPath = "/linkbridge/client/dashboard"
                } else if (roleId === 3 || roleStr === "ADMIN") {
                    defaultPath = "/linkbridge/admin"
                } else if (roleId === 4 || roleStr === "SCHOOL_ADMIN" || roleStr === "SCH_ADMIN") {
                    defaultPath = "/linkbridge/school-admin"
                }
            }

            const nextParam = sanitizeNextPath(searchParams.get("next"))
            let targetPath = defaultPath

            const returnsToLogin =
                nextParam === "/login" ||
                nextParam?.startsWith("/login?") ||
                nextParam?.startsWith("/login#")

            if (nextParam && !returnsToLogin) {
                const p = nextParam.toLowerCase()
                let isAllowed = true
                const isFreelancer = roleId === 1 || roleStr === "FREELANCER"
                const isClient = roleId === 2 || roleStr === "CLIENT" || roleStr === "EMPLOYER"
                const isSchoolAdmin = roleId === 4 || roleStr === "SCHOOL_ADMIN" || roleStr === "SCH_ADMIN"

                if (isFreelancer && (p.startsWith("/linkbridge/admin") || p.startsWith("/linkbridge/client") || p.startsWith("/linkbridge/school-admin"))) {
                    isAllowed = false
                } else if (isClient && (p.startsWith("/linkbridge/admin") || p.startsWith("/linkbridge/freelancer") || p.startsWith("/linkbridge/school-admin"))) {
                    isAllowed = false
                } else if (isSchoolAdmin && (p.startsWith("/linkbridge/admin") || p.startsWith("/linkbridge/freelancer") || p.startsWith("/linkbridge/client"))) {
                    isAllowed = false
                }

                if (isAllowed) {
                    targetPath = nextParam
                }
            }

            // console.log(`[LoginForm] Redirecting user: roleId=${roleId}, roleStr=${roleStr} -> targetPath=${targetPath}`)

            window.location.href = targetPath
        } catch (err: unknown) {
            const raw = err instanceof Error ? err.message : "Network error. Please try again."
            const msg = normalizeLoginErrorMessage(raw)
            toast.error("Sign in failed", { description: msg })
        } finally {
            setLoading(false)
        }
    }

    const emailHasError = Boolean(errors.email)
    const pwHasError = Boolean(errors.hashPassword)

    return (
        <div className="max-md:items-start min-h-[calc(100dvh-6rem)] flex-grow flex items-center justify-center py-6 md:py-8 px-4 md:px-6 text-foreground font-sans relative z-10">
            <div className="max-w-[1280px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 items-stretch md:min-h-[700px] bg-white/90 dark:bg-card/80 backdrop-blur-2xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] border border-border/80 overflow-hidden">

                {/* Left Side: Content / How it Works */}
                <div className="hidden lg:flex flex-col justify-center p-10 lg:p-16 bg-muted/20 dark:bg-muted/10 backdrop-blur-md border-r border-border/70 relative overflow-hidden">
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/30 rounded-full blur-3xl"></div>

                    <div className="relative z-10">
                        <div className="mb-10">
                            <span className="text-xl font-bold text-primary mb-2 block">LinkBridge</span>
                            <h1 className="text-5xl font-bold text-foreground mb-4 tracking-tight">How it Works</h1>
                            <div className="w-16 h-1.5 bg-primary rounded-full"></div>
                        </div>

                        <div className="space-y-8">
                            <div className="flex gap-4 group">
                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-background border flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                                    <User className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-foreground">Create Profile</h3>
                                    <p className="text-base text-muted-foreground max-w-sm mt-1">
                                        Register as a job seeker, verified employer, or educational institution partner.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4 group">
                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-background border flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                                    <Code2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-foreground">Match & Connect</h3>
                                    <p className="text-base text-muted-foreground max-w-sm mt-1">
                                        Explore verified job opportunities, post hiring requisitions, and review applicant credentials.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4 group">
                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-background border flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-foreground">Direct Hiring</h3>
                                    <p className="text-base text-muted-foreground max-w-sm mt-1">
                                        Coordinate interviews, evaluate assessments, and make direct verified hires with ease.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Login Card */}
                <div className="flex flex-col justify-center items-center p-5 md:p-8 lg:p-16 bg-white/60 dark:bg-card/60 backdrop-blur-xl">
                    <div className="w-full max-w-[440px]">
                        <div className="lg:hidden flex items-center gap-2 mb-5 md:mb-8">
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                                <Briefcase className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <span className="text-xl font-bold text-foreground">LinkBridge</span>
                        </div>

                        <div className="mb-5 md:mb-8">
                            <h2 className="text-3xl font-semibold text-foreground">Sign In</h2>
                            <p className="text-sm text-muted-foreground mt-1">Welcome back! Please enter your details.</p>
                        </div>

                        {searchParams.get("error") === "account_not_found" && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-2">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Account Not Found</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    No LinkBridge account was found with that email. If you are new to LinkBridge, please create an account.
                                </p>
                                <div className="pt-1">
                                    <Link
                                        href="/signup"
                                        className="inline-flex items-center justify-center h-8 px-3 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                    >
                                        Create an Account
                                    </Link>
                                </div>
                            </div>
                        )}

                        {(searchParams.get("error") === "google_not_connected" || searchParams.get("error") === "google_not_linked") && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-3">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Google account not connected</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    This email already has a LinkBridge account, but it isn&apos;t connected to Google. Sign in using your original login method, then connect your Google account in <strong>Security &amp; Auth &rarr; Connected Accounts &amp; Social Logins</strong>.
                                </p>
                                <div className="pt-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="default"
                                        onClick={() => {
                                            const queryEmail = searchParams.get("email");
                                            if (queryEmail) {
                                                setEmail(queryEmail);
                                                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                                            }
                                            passwordInputRef.current?.focus();
                                        }}
                                        className="h-8 px-3 text-xs font-medium"
                                    >
                                        Use original login
                                    </Button>
                                </div>
                            </div>
                        )}

                        {searchParams.get("error") === "google_identity_conflict" && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-2">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Google Identity Conflict</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    This Google identity is associated with a different LinkBridge account than the entered email address. Please sign in using your original login credentials.
                                </p>
                            </div>
                        )}

                        {(searchParams.get("error") === "facebook_not_connected" || searchParams.get("error") === "facebook_not_linked") && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-3">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Facebook account not connected</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    This email already has a LinkBridge account, but it isn&apos;t connected to Facebook. Sign in using your original login method, then connect your Facebook account in <strong>Security &amp; Auth &rarr; Connected Accounts &amp; Social Logins</strong>.
                                </p>
                                <div className="pt-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="default"
                                        onClick={() => {
                                            const queryEmail = searchParams.get("email");
                                            if (queryEmail) {
                                                setEmail(queryEmail);
                                                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                                            }
                                            passwordInputRef.current?.focus();
                                        }}
                                        className="h-8 px-3 text-xs font-medium"
                                    >
                                        Use original login
                                    </Button>
                                </div>
                            </div>
                        )}

                        {searchParams.get("error") === "facebook_identity_conflict" && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-2">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Facebook Identity Conflict</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    This Facebook identity is associated with a different LinkBridge account than the entered email address. Please sign in using your original login credentials.
                                </p>
                            </div>
                        )}

                        {(searchParams.get("error") === "linkedin_not_connected" || searchParams.get("error") === "linkedin_not_linked") && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-3">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>LinkedIn account not connected</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    This email already has a LinkBridge account, but it isn&apos;t connected to LinkedIn. Sign in using your original login method, then connect your LinkedIn account in <strong>Security &amp; Auth &rarr; Connected Accounts &amp; Social Logins</strong>.
                                </p>
                                <div className="pt-1">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="default"
                                        onClick={() => {
                                            const queryEmail = searchParams.get("email");
                                            if (queryEmail) {
                                                setEmail(queryEmail);
                                                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
                                            }
                                            passwordInputRef.current?.focus();
                                        }}
                                        className="h-8 px-3 text-xs font-medium"
                                    >
                                        Use original login
                                    </Button>
                                </div>
                            </div>
                        )}

                        {searchParams.get("error") === "linkedin_identity_conflict" && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-2">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>LinkedIn Identity Conflict</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    This LinkedIn identity is associated with a different LinkBridge account than the entered email address. Please sign in using your original login credentials.
                                </p>
                            </div>
                        )}

                        {searchParams.get("error") === "google_already_registered" && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-2">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Google Account Already Registered</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    This Google account is already linked to an existing account in our system. Please sign in below.
                                </p>
                            </div>
                        )}

                        {searchParams.get("error") === "email_already_registered" && (
                            <div className="mb-5 p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-left space-y-2">
                                <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>Account Already Exists</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    An account with this email address already exists. Please sign in using your existing password, then connect Google in <strong>Security &amp; Auth &rarr; Connected Accounts &amp; Social Logins</strong>.
                                </p>
                            </div>
                        )}

                        <form onSubmit={onSubmit} className="space-y-4 md:space-y-6">
                            <div>
                                <label className="text-sm font-medium text-foreground block mb-1.5" htmlFor="email">Email ID</label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="e.g. name@company.com"
                                    value={email}
                                    onChange={(e) => {
                                        setEmail(e.target.value)
                                        if (errors.email) setErrors((p) => ({ ...p, email: undefined }))
                                    }}
                                    disabled={loading}
                                    className={cn("h-11", emailHasError && "border-destructive focus-visible:ring-destructive")}
                                />
                                {emailHasError ? (
                                    <p className="text-xs text-destructive mt-1.5">{errors.email}</p>
                                ) : null}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1.5">
                                    <label className="text-sm font-medium text-foreground block" htmlFor="password">Password</label>
                                    <Link className="inline-flex min-h-11 items-center text-sm text-primary hover:underline" href="/forgot-password">Forgot password?</Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        ref={passwordInputRef}
                                        id="password"
                                        type={showPw ? "text" : "password"}
                                        placeholder="Enter your password"
                                        value={hashPassword}
                                        onChange={(e) => {
                                            setHashPassword(e.target.value)
                                            if (errors.hashPassword) setErrors((p) => ({ ...p, hashPassword: undefined }))
                                        }}
                                        disabled={loading}
                                        className={cn("h-11 pr-12", pwHasError && "border-destructive focus-visible:ring-destructive")}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(s => !s)}
                                        disabled={loading}
                                        aria-label={showPw ? "Hide password" : "Show password"}
                                        className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                {pwHasError ? (
                                    <p className="text-xs text-destructive mt-1.5">{errors.hashPassword}</p>
                                ) : null}
                            </div>

                            <div className="flex min-h-11 items-center">
                                <Checkbox
                                    id="remember"
                                    checked={remember}
                                    onCheckedChange={(v) => setRemember(Boolean(v))}
                                    disabled={loading}
                                />
                                <label className="ml-2 flex min-h-11 cursor-pointer items-center text-sm text-muted-foreground" htmlFor="remember">Remember me for 30 days</label>
                            </div>

                            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
                                {loading ? "Signing in..." : "Sign in"}
                            </Button>
                        </form>

                        <SocialAuthButtons mode="login" disabled={loading} />

                        <p className="mt-6 md:mt-8 text-center text-sm text-muted-foreground">
                            Don&apos;t have an account?{" "}
                            <Link className="inline-flex min-h-11 items-center text-primary font-medium hover:underline" href="/signup">Sign up</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
