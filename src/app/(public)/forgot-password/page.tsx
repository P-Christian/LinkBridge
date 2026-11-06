"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { KeyRound, Mail, ShieldCheck, Briefcase, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { validatePasswordStrict } from "@/lib/password-validation"
import PasswordRequirementsChecklist from "@/components/auth/PasswordRequirementsChecklist"


import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

type Step = "EMAIL" | "OTP" | "NEW_PASSWORD"

export default function ForgotPasswordPage() {
    return (
        <React.Suspense fallback={<div className="min-h-dvh flex items-center justify-center">Loading...</div>}>
            <ForgotPasswordForm />
        </React.Suspense>
    )
}

function ForgotPasswordForm() {
    const router = useRouter()

    const [step, setStep] = React.useState<Step>("EMAIL")
    const [loading, setLoading] = React.useState(false)
    const [userId, setUserId] = React.useState<string | null>(null)

    // Form states
    const [email, setEmail] = React.useState("")
    const [otp, setOtp] = React.useState("")
    const [newPassword, setNewPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")
    
    // UI states
    const [showPw, setShowPw] = React.useState(false)
    const [showConfirmPw, setShowConfirmPw] = React.useState(false)

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) {
            toast.error("Email required")
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            })
            
            const data = await res.json().catch(() => null)
            
            if (!res.ok) {
                toast.error("Error", { description: data?.message || "Failed to request password reset" })
                return
            }

            toast.success("Code sent", { description: data.message })
            if (data.userId) {
                setUserId(data.userId)
            }
            setStep("OTP")
        } catch {
            toast.error("Network error", { description: "Please try again later." })
        } finally {
            setLoading(false)
        }
    }

    const handleOtpSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (otp.length !== 6) {
            toast.error("Invalid code", { description: "Please enter the 6-digit code." })
            return
        }
        setStep("NEW_PASSWORD")
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newPassword || !validatePasswordStrict(newPassword)) {
            toast.error("Invalid password", { description: "Password does not meet all security requirements." })
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match")
            return
        }

        setLoading(true)
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, userId, otp, newPassword }),
            })
            
            const data = await res.json().catch(() => null)
            
            if (!res.ok) {
                toast.error("Reset failed", { description: data?.message || "Failed to reset password." })
                if (data?.message?.toLowerCase().includes("expired")) {
                    setStep("EMAIL")
                }
                return
            }

            toast.success("Password updated", { description: "You can now sign in with your new password." })
            router.replace("/login")
        } catch {
            toast.error("Network error", { description: "Please try again later." })
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="max-md:items-start min-h-dvh flex-grow flex items-center justify-center py-4 md:py-8 px-4 md:px-6 bg-background text-foreground font-sans">
            <div className="max-w-[1280px] w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-0 items-stretch md:min-h-[700px] bg-card rounded-xl shadow-sm border overflow-hidden">
                
                {/* Left Side: Illustration */}
                <div className="hidden lg:flex flex-col justify-center p-10 lg:p-16 bg-muted/30 border-r relative overflow-hidden">
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/30 rounded-full blur-3xl"></div>
                    
                    <div className="relative z-10">
                        <div className="mb-10">
                            <span className="text-xl font-bold text-primary mb-2 block">LinkBridge</span>
                            <h1 className="text-5xl font-bold text-foreground mb-4 tracking-tight">Account Recovery</h1>
                            <div className="w-16 h-1.5 bg-primary rounded-full"></div>
                        </div>

                        <div className="space-y-8">
                            <div className="flex gap-4 group">
                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-background border flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                                    <Mail className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-foreground">Verify Email</h3>
                                    <p className="text-base text-muted-foreground max-w-sm mt-1">
                                        Enter your registered email address to receive a secure recovery code.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4 group">
                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-background border flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-foreground">Secure OTP</h3>
                                    <p className="text-base text-muted-foreground max-w-sm mt-1">
                                        Enter the 6-digit code sent to your email to prove your identity.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4 group">
                                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-background border flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                                    <KeyRound className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-semibold text-foreground">New Password</h3>
                                    <p className="text-base text-muted-foreground max-w-sm mt-1">
                                        Set a strong new password to regain access to your account.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form Card */}
                <div className="flex flex-col justify-center items-center p-8 lg:p-16 bg-card">
                    <div className="w-full max-w-[440px]">
                        <div className="lg:hidden flex items-center gap-2 mb-8">
                            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                                <Briefcase className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <span className="text-xl font-bold text-foreground">LinkBridge</span>
                        </div>
                        
                        {step === "EMAIL" && (
                            <form onSubmit={handleEmailSubmit} className="space-y-6 fade-in">
                                <div className="mb-8">
                                    <h2 className="text-3xl font-semibold text-foreground">Forgot Password</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Enter your email to receive a password reset code.</p>
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-foreground block mb-1.5" htmlFor="email">Email ID</label>
                                    <Input 
                                        id="email" 
                                        type="email" 
                                        placeholder="e.g. name@company.com" 
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={loading}
                                        className="h-11"
                                    />
                                </div>

                                <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading}>
                                    {loading ? "Sending..." : "Send Code"}
                                </Button>
                            </form>
                        )}

                        {step === "OTP" && (
                            <form onSubmit={handleOtpSubmit} className="space-y-6 fade-in">
                                <div className="mb-8">
                                    <h2 className="text-3xl font-semibold text-foreground">Enter Code</h2>
                                    <p className="text-sm text-muted-foreground mt-1">We sent a 6-digit code to <strong>{email}</strong>.</p>
                                </div>

                                <div className="flex justify-center py-4">
                                    <InputOTP
                                        maxLength={6}
                                        value={otp}
                                        onChange={setOtp}
                                        disabled={loading}
                                    >
                                        <InputOTPGroup className="gap-2 sm:gap-4">
                                            {[...Array(6)].map((_, i) => (
                                                <InputOTPSlot key={i} index={i} className="w-12 h-14 sm:w-14 sm:h-16 text-xl sm:text-2xl rounded-md border" />
                                            ))}
                                        </InputOTPGroup>
                                    </InputOTP>
                                </div>

                                <Button type="submit" className="w-full h-11 text-base font-medium" disabled={loading || otp.length < 6}>
                                    Verify Code
                                </Button>
                                
                                <div className="text-center">
                                    <button 
                                        type="button" 
                                        onClick={() => setStep("EMAIL")}
                                        className="max-md:py-3.5 max-md:-my-3.5 text-sm text-primary hover:underline"
                                    >
                                        Change email address
                                    </button>
                                </div>
                            </form>
                        )}

                        {step === "NEW_PASSWORD" && (
                            <form onSubmit={handlePasswordSubmit} className="space-y-6 fade-in">
                                <div className="mb-8">
                                    <h2 className="text-3xl font-semibold text-foreground">Set New Password</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Please enter a new strong password.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm font-medium text-foreground block mb-1.5" htmlFor="new-password">New Password</label>
                                            <div className="relative">
                                                <Input 
                                                    id="new-password" 
                                                    type={showPw ? "text" : "password"} 
                                                    placeholder="Enter new password" 
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    disabled={loading}
                                                    className="h-11 pr-12"
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowPw(s => !s)}
                                                    disabled={loading}
                                                    className="max-md:flex max-md:h-11 max-md:w-11 max-md:items-center max-md:justify-center absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="text-sm font-medium text-foreground block mb-1.5" htmlFor="confirm-password">Confirm Password</label>
                                            <div className="relative">
                                                <Input 
                                                    id="confirm-password" 
                                                    type={showConfirmPw ? "text" : "password"} 
                                                    placeholder="Confirm new password" 
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    disabled={loading}
                                                    className="h-11 pr-12"
                                                />
                                                <button 
                                                    type="button" 
                                                    onClick={() => setShowConfirmPw(s => !s)}
                                                    disabled={loading}
                                                    className="max-md:flex max-md:h-11 max-md:w-11 max-md:items-center max-md:justify-center absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    {showConfirmPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <PasswordRequirementsChecklist password={newPassword} confirmPassword={confirmPassword} className="mt-1" />
                                </div>

                                <Button type="submit" className="w-full h-11 text-base font-medium disabled:opacity-50" disabled={loading || !validatePasswordStrict(newPassword)}>
                                    {loading ? "Updating..." : "Reset Password"}
                                </Button>
                            </form>
                        )}

                        <p className="mt-8 text-center text-sm text-muted-foreground">
                            Remember your password?{" "}
                            <Link className="max-md:py-3.5 max-md:-my-3.5 text-primary font-medium hover:underline" href="/login">Sign in</Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    )
}
