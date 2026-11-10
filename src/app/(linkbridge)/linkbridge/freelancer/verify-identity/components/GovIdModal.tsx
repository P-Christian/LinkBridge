import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { uploadVerificationDocumentAction, submitIdentityVerificationAction } from "@/modules/freelancer/freelancer-profile/services/identity-verification.actions";
import { toast } from "sonner";
import { ImageUploadSlot } from "./ImageUploadSlot";

interface GovIdModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onSubmittingChange?: (isSubmitting: boolean) => void;
    rejectionNote?: string;
}

const ID_TYPE_OPTIONS = [
    { value: "PhilSys National ID", label: "PhilSys National ID" },
    { value: "Philippine Passport", label: "Philippine Passport" },
    { value: "Driver's License (LTO)", label: "Driver's License (LTO)" },
    { value: "SSS ID", label: "SSS ID" },
    { value: "GSIS ID", label: "GSIS ID" },
    { value: "UMID", label: "UMID" },
    { value: "PRC ID", label: "PRC ID" },
    { value: "Voter's ID (COMELEC)", label: "Voter's ID (COMELEC)" },
    { value: "TIN ID (BIR)", label: "TIN ID (BIR)" },
    { value: "Postal ID", label: "Postal ID" },
    { value: "PhilHealth ID", label: "PhilHealth ID" },
    { value: "Others", label: "Others" },
];

export default function GovIdModal({ isOpen, onClose, onSuccess, onSubmittingChange, rejectionNote }: GovIdModalProps) {
    const [idType, setIdType] = useState<string>("");
    const [otherIdName, setOtherIdName] = useState<string>("");
    const [frontId, setFrontId] = useState<File | null>(null);
    const [selfieId, setSelfieId] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        const resolvedIdType = idType === "Others" ? otherIdName.trim() : idType;
        if (!resolvedIdType || !frontId || !selfieId) {
            toast.error("Please fill in all fields and upload both images.");
            return;
        }

        try {
            setIsSubmitting(true);
            onSubmittingChange?.(true);
            
            const frontFormData = new FormData();
            frontFormData.append("file", frontId);
            frontFormData.append("documentClass", "identity_image");
            const frontRes = await uploadVerificationDocumentAction(0 /* placeholder */, frontFormData);
            
            if (!frontRes.success) throw new Error(frontRes.error);

            const selfieFormData = new FormData();
            selfieFormData.append("file", selfieId);
            selfieFormData.append("documentClass", "identity_image");
            const selfieRes = await uploadVerificationDocumentAction(0 /* placeholder */, selfieFormData);

            if (!selfieRes.success) throw new Error(selfieRes.error);

            const submitRes = await submitIdentityVerificationAction({
                type: 'gov_id',
                gov_id_type: resolvedIdType,
                gov_id_front_image_uuid: frontRes.fileId,
                gov_id_selfie_image_uuid: selfieRes.fileId
            });

            if (!submitRes.success) throw new Error(submitRes.error);

            toast.success("Government ID submitted successfully for review.");
            onClose();
            await onSuccess();
        } catch (error) {
            onSubmittingChange?.(false);
            const message = error instanceof Error ? error.message : "Failed to submit Government ID.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto max-md:[&>[data-slot=dialog-close]]:p-3.5 max-md:[&>[data-slot=dialog-close]]:-m-3.5">
                <DialogHeader>
                    <DialogTitle>Submit Government ID</DialogTitle>
                    <DialogDescription>
                        Upload a clear photo of your ID and a selfie of you holding it.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {rejectionNote && (
                        <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-md text-sm">
                            <strong className="font-semibold">Previous Submission Rejected: </strong>
                            {rejectionNote}
                        </div>
                    )}
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">ID Type *</label>
                        <SearchableSelect
                            value={idType}
                            onValueChange={setIdType}
                            options={ID_TYPE_OPTIONS}
                            placeholder="Select ID Type"
                            triggerClassName="max-md:min-h-11 w-full"
                        />
                    </div>
                    {idType === "Others" && (
                        <div className="grid gap-2">
                            <label className="text-sm font-medium">Specify ID Type *</label>
                            <Input
                                type="text"
                                value={otherIdName}
                                onChange={(e) => setOtherIdName(e.target.value)}
                                placeholder="e.g. Senior Citizen ID, PWD ID"
                                className="max-md:min-h-11"
                            />
                        </div>
                    )}
                    <ImageUploadSlot
                        label="Front of ID"
                        file={frontId}
                        onChange={setFrontId}
                        facingMode="environment"
                        cameraModalTitle="Capture Front of ID"
                        required={true}
                    />

                    <ImageUploadSlot
                        label="Selfie holding ID"
                        file={selfieId}
                        onChange={setSelfieId}
                        facingMode="user"
                        cameraModalTitle="Take Selfie holding ID"
                        required={true}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="max-md:min-h-11">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="max-md:min-h-11">
                        {isSubmitting ? "Submitting..." : "Submit"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
