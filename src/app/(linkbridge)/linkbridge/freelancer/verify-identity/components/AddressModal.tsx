import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadVerificationDocumentAction, submitIdentityVerificationAction } from "@/modules/freelancer/freelancer-profile/services/identity-verification.actions";
import { toast } from "sonner";

interface AddressModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    onSubmittingChange?: (isSubmitting: boolean) => void;
    rejectionNote?: string;
}

export default function AddressModal({ isOpen, onClose, onSuccess, onSubmittingChange, rejectionNote }: AddressModalProps) {
    const [addressDoc, setAddressDoc] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!addressDoc) {
            toast.error("Please upload a document.");
            return;
        }

        try {
            setIsSubmitting(true);
            onSubmittingChange?.(true);
            
            const formData = new FormData();
            formData.append("file", addressDoc);
            formData.append("documentClass", "address_document");
            const uploadRes = await uploadVerificationDocumentAction(0 /* placeholder */, formData);
            
            if (!uploadRes.success) throw new Error(uploadRes.error);

            const submitRes = await submitIdentityVerificationAction({
                type: 'address',
                address_doc_image_uuid: uploadRes.fileId
            });

            if (!submitRes.success) throw new Error(submitRes.error);

            toast.success("Address document submitted successfully for review.");
            onClose();
            await onSuccess();
        } catch (error) {
            onSubmittingChange?.(false);
            const message = error instanceof Error ? error.message : "Failed to submit Address verification.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px] max-md:max-w-[calc(100vw-2rem)] max-md:max-h-[90dvh] max-md:overflow-y-auto max-md:[&>[data-slot=dialog-close]]:p-3.5 max-md:[&>[data-slot=dialog-close]]:-m-3.5">
                <DialogHeader>
                    <DialogTitle>Address Verification</DialogTitle>
                    <DialogDescription>
                        Upload a recent utility bill, bank statement, or other official document showing your name and current address.
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
                        <label className="text-sm font-medium">Proof of Address Document</label>
                        <Input 
                            type="file" 
                            accept="image/*,application/pdf" 
                            onChange={(e) => setAddressDoc(e.target.files?.[0] || null)} 
                            className="max-md:min-h-11"
                        />
                    </div>
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
