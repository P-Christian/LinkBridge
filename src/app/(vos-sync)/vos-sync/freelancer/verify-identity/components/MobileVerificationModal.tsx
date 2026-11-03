import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { sendMobileOtpAction, verifyMobileOtpAction } from "@/modules/freelancer/freelancer-profile/services/identity-verification.actions";
import { toast } from "sonner";

interface MobileVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const countries = [
    { code: "PH", dialCode: "+63", flag: "🇵🇭", name: "Philippines" },
    { code: "EG", dialCode: "+20", flag: "🇪🇬", name: "Egypt" },
    { code: "US", dialCode: "+1", flag: "🇺🇸", name: "United States" },
    { code: "GB", dialCode: "+44", flag: "🇬🇧", name: "United Kingdom" },
    { code: "SG", dialCode: "+65", flag: "🇸🇬", name: "Singapore" },
    { code: "AE", dialCode: "+971", flag: "🇦🇪", name: "United Arab Emirates" },
    { code: "SA", dialCode: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
    { code: "CA", dialCode: "+1", flag: "🇨🇦", name: "Canada" },
    { code: "AU", dialCode: "+61", flag: "🇦🇺", name: "Australia" },
];

const COUNTRY_DIAL_OPTIONS = countries.map((c) => ({
    value: c.code,
    label: `${c.flag} ${c.dialCode} ${c.name}`,
}));

export default function MobileVerificationModal({ isOpen, onClose, onSuccess }: MobileVerificationModalProps) {
    const [mobileNumber, setMobileNumber] = useState<string>("");
    const [selectedCountry, setSelectedCountry] = useState<string>("PH");
    const [otp, setOtp] = useState<string>("");
    const [step, setStep] = useState<1 | 2>(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getFullMobileNumber = () => {
        const activeCountry = countries.find(c => c.code === selectedCountry) || countries[0];
        // Clean leading zero and any non-digits
        const cleanedNumber = mobileNumber.trim().replace(/^0+/, "").replace(/[^\d]/g, "");
        return `${activeCountry.dialCode}${cleanedNumber}`;
    };

    const handleSendOtp = async () => {
        if (!mobileNumber.trim()) {
            toast.error("Please enter a mobile number.");
            return;
        }
        try {
            setIsSubmitting(true);
            const fullMobileNumber = getFullMobileNumber();
            const res = await sendMobileOtpAction(fullMobileNumber);
            if (!res.success) throw new Error(res.error);
            setStep(2);
            toast.success("OTP sent.");
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send OTP.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) {
            toast.error("Please enter the OTP.");
            return;
        }
        try {
            setIsSubmitting(true);
            const fullMobileNumber = getFullMobileNumber();
            const res = await verifyMobileOtpAction(fullMobileNumber, otp);
            if (!res.success) throw new Error(res.error);
            toast.success("Mobile number verified successfully!");
            onSuccess();
            onClose();
            // reset state for next time
            setTimeout(() => { setStep(1); setMobileNumber(""); setSelectedCountry("PH"); setOtp(""); }, 500);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Invalid OTP.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                setStep(1);
                setMobileNumber("");
                setOtp("");
                onClose();
            }
        }}>
            <DialogContent className="sm:max-w-[425px] max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto max-md:[&>[data-slot=dialog-close]]:p-3.5 max-md:[&>[data-slot=dialog-close]]:-m-3.5">
                <DialogHeader>
                    <DialogTitle>Verify Mobile Number</DialogTitle>
                    <DialogDescription>
                        {step === 1 ? "Enter your mobile number to receive a one-time password (OTP)." : "Enter the 6-digit OTP sent to your phone."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {step === 1 ? (
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Mobile Number</label>
                            <div className="flex gap-2">
                                <div className="w-[140px] max-md:min-h-11">
                                    <SearchableSelect 
                                        value={selectedCountry} 
                                        onValueChange={setSelectedCountry}
                                        options={COUNTRY_DIAL_OPTIONS}
                                        placeholder="Country"
                                        triggerClassName="flex gap-2 items-center justify-between max-md:min-h-11 w-full"
                                    />
                                </div>
                                <Input 
                                    type="tel" 
                                    placeholder="912 345 6789"
                                    value={mobileNumber}
                                    onChange={(e) => setMobileNumber(e.target.value)}
                                    className="flex-1 max-md:min-h-11"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">One-Time Password (OTP)</label>
                            <Input 
                                type="text" 
                                placeholder="000000"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="max-md:min-h-11"
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="max-md:min-h-11">Cancel</Button>
                    {step === 1 ? (
                        <Button onClick={handleSendOtp} disabled={isSubmitting} className="max-md:min-h-11">
                            {isSubmitting ? "Sending..." : "Send OTP"}
                        </Button>
                    ) : (
                        <Button onClick={handleVerifyOtp} disabled={isSubmitting} className="max-md:min-h-11">
                            {isSubmitting ? "Verifying..." : "Verify OTP"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
