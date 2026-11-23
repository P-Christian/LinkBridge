"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Shield,
    FileText,
    MapPin,
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Lock,
    Sparkles,
    ArrowUpRight,
    ArrowLeft,
    HelpCircle,
    FileCheck2,
} from "lucide-react";
import Link from "next/link";
import { IdentityVerification } from "@/modules/freelancer/freelancer-profile/services/identity-verification.repo";
import { IdProofScoreResult } from "@/modules/freelancer/freelancer-profile/services/identity-verification.service";
import GovIdModal from "./components/GovIdModal";
import AddressModal from "./components/AddressModal";
import { FreelancerPageHeader } from "@/components/shared/layout/FreelancerPageHeader";

interface VerifyIdentityClientProps {
    user: {
        name: string;
        email: string;
        avatar: string;
    };
    initialVerifications: IdentityVerification[];
    initialScoreData: IdProofScoreResult | null;
}

export default function VerifyIdentityClient({
    user,
    initialVerifications,
    initialScoreData,
}: VerifyIdentityClientProps) {
    const [verifications, setVerifications] = useState<IdentityVerification[]>(initialVerifications);
    const [scoreData, setScoreData] = useState<IdProofScoreResult | null>(initialScoreData);
    const [activeModal, setActiveModal] = useState<"gov_id" | "address" | null>(null);
    const [submittingTypes, setSubmittingTypes] = useState<Record<string, boolean>>({});

    const fetchData = async () => {
        try {
            const [verifsRes, scoreRes] = await Promise.all([
                fetch("/api/freelancer/verifications"),
                fetch("/api/freelancer/id-proof-score"),
            ]);

            if (verifsRes.ok) {
                const vData = await verifsRes.json();
                setVerifications(vData.data || []);
            }
            if (scoreRes.ok) {
                const sData = await scoreRes.json();
                setScoreData(sData);
            }
        } catch (error) {
            console.error("Error refreshing verification data:", error);
        } finally {
            setSubmittingTypes({});
        }
    };

    const handleSubmittingChange = (type: string, isSubmitting: boolean) => {
        setSubmittingTypes((prev) => ({
            ...prev,
            [type]: isSubmitting,
        }));
    };

    const isPendingOrSubmitting = (type: string) => {
        return !!submittingTypes[type] || getVerificationStatus(type) === "pending";
    };

    const getVerificationStatus = (type: string) => {
        if (submittingTypes[type]) return "pending";
        const match = verifications.find((v) => v.type === type);
        return match ? match.status : "not_submitted";
    };

    const getVerificationRecord = (type: string) => {
        return verifications.find((v) => v.type === type);
    };

    const getRejectionNote = (type: string) => {
        const match = verifications.find((v) => v.type === type && v.status === "rejected");
        return match ? match.rejection_note || undefined : undefined;
    };

    const currentScore = scoreData?.score ?? 0;
    const canApply = scoreData?.can_apply ?? currentScore >= 75;

    const renderStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return (
                    <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        Approved
                    </Badge>
                );
            case "pending":
                return (
                    <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-semibold bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-400">
                        <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin" />
                        Pending Review
                    </Badge>
                );
            case "rejected":
                return (
                    <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-semibold bg-destructive/10 text-destructive border-destructive/20">
                        <XCircle className="w-3.5 h-3.5" />
                        Needs Resubmission
                    </Badge>
                );
            default:
                return (
                    <Badge variant="outline" className="gap-1.5 py-1 px-2.5 text-xs font-semibold bg-muted text-muted-foreground border-border">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Not Submitted
                    </Badge>
                );
        }
    };

    const govIdStatus = getVerificationStatus("gov_id");
    const addressStatus = getVerificationStatus("address");
    const govIdRecord = getVerificationRecord("gov_id");

    return (
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
            <FreelancerPageHeader label="Verify Identity" user={user} />

            <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
                <div className="max-w-5xl mx-auto space-y-6 lg:space-y-8">
                    {/* Back Navigation to Profile */}
                    <div>
                        <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground h-9 px-3"
                        >
                            <Link href="/linkbridge/freelancer/profile">
                                <ArrowLeft className="w-4 h-4" />
                                <span>Back to Profile</span>
                            </Link>
                        </Button>
                    </div>

                    {/* Hero Header & ID Proof Score Card */}
                    <div className="bg-card text-card-foreground border rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

                        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div className="space-y-2 max-w-xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                                    <Shield className="w-3.5 h-3.5" />
                                    <span>Freelancer Identity & Trust</span>
                                </div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                    Verify Your Identity
                                </h1>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    LinkBridge requires freelancers to verify their identity to build client trust and safeguard the platform. A minimum score of <strong className="text-foreground">75%</strong> is required to submit job proposals.
                                </p>
                            </div>

                            {/* Score Card / Indicator */}
                            <div className="bg-background/80 backdrop-blur-sm border rounded-xl p-5 shrink-0 min-w-[280px] sm:min-w-[320px] shadow-xs space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        ID Proof Score
                                    </span>
                                    <Badge
                                        variant="outline"
                                        className={`font-mono font-bold ${
                                            canApply
                                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400"
                                                : "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400"
                                        }`}
                                    >
                                        {canApply ? "Ready to Apply" : "Action Needed"}
                                    </Badge>
                                </div>

                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-extrabold font-mono text-foreground">
                                        {currentScore}%
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        / 100% total
                                    </span>
                                </div>

                                {/* Progress Bar */}
                                <div className="relative w-full h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-700 ease-out rounded-full ${
                                            canApply ? "bg-emerald-500" : "bg-primary"
                                        }`}
                                        style={{ width: `${Math.min(100, Math.max(0, currentScore))}%` }}
                                    />
                                </div>

                                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    {canApply ? (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            <span>You have met the required verification threshold!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            <span>Complete the steps below to reach 75% or higher.</span>
                                        </>
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Breakdown Pills */}
                        <div className="mt-6 pt-6 border-t border-border/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <Link
                                href="/linkbridge/freelancer/profile"
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors border border-transparent hover:border-border text-xs group"
                            >
                                <div className="space-y-0.5">
                                    <div className="text-muted-foreground flex items-center gap-1">
                                        <span>Profile Sections</span>
                                        <ArrowUpRight className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="font-semibold text-foreground">
                                        Basic Info, Resume & Skills
                                    </div>
                                </div>
                                <span className="font-mono font-bold text-foreground bg-background px-2 py-1 rounded border shadow-2xs">
                                    {scoreData?.breakdown.profile_sections ?? 0}/50
                                </span>
                            </Link>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-transparent text-xs">
                                <div className="space-y-0.5">
                                    <div className="text-muted-foreground">Government ID</div>
                                    <div className="font-semibold text-foreground">
                                        Front photo & Selfie match
                                    </div>
                                </div>
                                <span className="font-mono font-bold text-foreground bg-background px-2 py-1 rounded border shadow-2xs">
                                    {scoreData?.breakdown.gov_id ?? 0}/25
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-transparent text-xs">
                                <div className="space-y-0.5">
                                    <div className="text-muted-foreground">Proof of Address</div>
                                    <div className="font-semibold text-foreground">
                                        Utility bill or bank record
                                    </div>
                                </div>
                                <span className="font-mono font-bold text-foreground bg-background px-2 py-1 rounded border shadow-2xs">
                                    {scoreData?.breakdown.address ?? 0}/25
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Verification Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Government ID Card */}
                        <Card className={`relative flex flex-col justify-between transition-all duration-200 border-2 ${
                            govIdStatus === "approved"
                                ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                                : govIdStatus === "pending"
                                ? "border-blue-500/20 bg-blue-500/[0.02]"
                                : govIdStatus === "rejected"
                                ? "border-destructive/30 bg-destructive/[0.02]"
                                : "border-border hover:border-primary/30"
                        }`}>
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start gap-4 mb-2">
                                    <div className={`p-3 rounded-xl ${
                                        govIdStatus === "approved"
                                            ? "bg-emerald-500/10 text-emerald-600"
                                            : "bg-primary/10 text-primary"
                                    }`}>
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    {renderStatusBadge(govIdStatus)}
                                </div>
                                <CardTitle className="text-xl">Government-Issued ID</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">
                                    Provide an official identity document with your clear photo, full legal name, and date of birth.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-5 flex-1 flex flex-col justify-between">
                                {/* Requirements checklist */}
                                <div className="space-y-2 bg-muted/40 rounded-lg p-3.5 text-xs text-muted-foreground border">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                        <FileCheck2 className="w-4 h-4 text-primary" />
                                        <span>Acceptable Documents</span>
                                    </div>
                                    <ul className="space-y-1 pl-5 list-disc">
                                        <li>Passport, Driver’s License, or National ID (PhilSys)</li>
                                        <li>Must be valid, unexpired, and clearly legible</li>
                                        <li>Includes a matching live selfie to confirm ownership</li>
                                    </ul>
                                </div>

                                {govIdStatus === "rejected" && getRejectionNote("gov_id") && (
                                    <div className="rounded-lg p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-semibold">Reviewer Feedback: </span>
                                            {getRejectionNote("gov_id")}
                                        </div>
                                    </div>
                                )}

                                {govIdStatus === "approved" ? (
                                    <div className="pt-2">
                                        <div className="flex items-center justify-between p-3 rounded-lg border bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                <span className="font-medium">
                                                    ID verified ({govIdRecord?.gov_id_type || "Government ID"})
                                                </span>
                                            </div>
                                            <span className="font-bold">+25%</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-2">
                                        <Button
                                            className="w-full h-11 text-sm font-semibold shadow-xs"
                                            variant={govIdStatus === "rejected" ? "default" : "default"}
                                            disabled={isPendingOrSubmitting("gov_id")}
                                            onClick={() => setActiveModal("gov_id")}
                                        >
                                            {govIdStatus === "pending"
                                                ? "Submitted (Under Review)"
                                                : govIdStatus === "rejected"
                                                ? "Resubmit Government ID"
                                                : "Submit Government ID"}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Address Verification Card */}
                        <Card className={`relative flex flex-col justify-between transition-all duration-200 border-2 ${
                            addressStatus === "approved"
                                ? "border-emerald-500/20 bg-emerald-500/[0.02]"
                                : addressStatus === "pending"
                                ? "border-blue-500/20 bg-blue-500/[0.02]"
                                : addressStatus === "rejected"
                                ? "border-destructive/30 bg-destructive/[0.02]"
                                : "border-border hover:border-primary/30"
                        }`}>
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start gap-4 mb-2">
                                    <div className={`p-3 rounded-xl ${
                                        addressStatus === "approved"
                                            ? "bg-emerald-500/10 text-emerald-600"
                                            : "bg-primary/10 text-primary"
                                    }`}>
                                        <MapPin className="w-6 h-6" />
                                    </div>
                                    {renderStatusBadge(addressStatus)}
                                </div>
                                <CardTitle className="text-xl">Proof of Address</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">
                                    Upload a document showing your current residence address matching your profile records.
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="space-y-5 flex-1 flex flex-col justify-between">
                                {/* Requirements checklist */}
                                <div className="space-y-2 bg-muted/40 rounded-lg p-3.5 text-xs text-muted-foreground border">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                                        <FileCheck2 className="w-4 h-4 text-primary" />
                                        <span>Acceptable Documents</span>
                                    </div>
                                    <ul className="space-y-1 pl-5 list-disc">
                                        <li>Utility bill (Electricity, Water, Internet, or Cable)</li>
                                        <li>Bank account statement or official government mail</li>
                                        <li>Issued within the last 3 months with your visible name</li>
                                    </ul>
                                </div>

                                {addressStatus === "rejected" && getRejectionNote("address") && (
                                    <div className="rounded-lg p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="font-semibold">Reviewer Feedback: </span>
                                            {getRejectionNote("address")}
                                        </div>
                                    </div>
                                )}

                                {addressStatus === "approved" ? (
                                    <div className="pt-2">
                                        <div className="flex items-center justify-between p-3 rounded-lg border bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 text-xs">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                <span className="font-medium">Residential address verified</span>
                                            </div>
                                            <span className="font-bold">+25%</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="pt-2">
                                        <Button
                                            className="w-full h-11 text-sm font-semibold shadow-xs"
                                            variant={addressStatus === "rejected" ? "default" : "default"}
                                            disabled={isPendingOrSubmitting("address")}
                                            onClick={() => setActiveModal("address")}
                                        >
                                            {addressStatus === "pending"
                                                ? "Submitted (Under Review)"
                                                : addressStatus === "rejected"
                                                ? "Resubmit Proof of Address"
                                                : "Submit Proof of Address"}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Trust & Security Banner */}
                    <div className="rounded-xl border bg-card/60 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-muted-foreground">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-muted text-foreground shrink-0">
                                <Lock className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5">
                                <span className="font-semibold text-foreground text-sm block">
                                    Your data is private and secure
                                </span>
                                <span>
                                    All documents submitted are encrypted at rest and reviewed exclusively by verified compliance officers. Your uploaded files are never displayed publicly.
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors shrink-0">
                            <HelpCircle className="w-4 h-4" />
                            <span>Need assistance? Contact support</span>
                        </div>
                    </div>
                </div>

                <GovIdModal
                    isOpen={activeModal === "gov_id"}
                    onClose={() => setActiveModal(null)}
                    onSuccess={fetchData}
                    onSubmittingChange={(submitting) => handleSubmittingChange("gov_id", submitting)}
                    rejectionNote={getRejectionNote("gov_id")}
                />
                <AddressModal
                    isOpen={activeModal === "address"}
                    onClose={() => setActiveModal(null)}
                    onSuccess={fetchData}
                    onSubmittingChange={(submitting) => handleSubmittingChange("address", submitting)}
                    rejectionNote={getRejectionNote("address")}
                />
            </main>
        </div>
    );
}
