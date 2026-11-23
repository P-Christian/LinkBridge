"use client";

import React, { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { generateUUID } from "@/lib/utils";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./local-dialog";

const DOCUMENT_TYPE_OPTIONS = [
    { value: "SCHOOL_ID", label: "School ID" },
    { value: "DIPLOMA", label: "Diploma" },
    { value: "TOR", label: "Transcript of Records" },
    { value: "OTHER", label: "Other document" },
] as const;

const VERIFICATION_BENEFITS = [
    "Verified badge on your profile",
    "Employers see your education as Verified",
    "Better Best Match results",
    "Your school confirms your attendance",
] as const;

type DocumentType = (typeof DOCUMENT_TYPE_OPTIONS)[number]["value"];

const MAX_DOCUMENTS = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const ACCEPTED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"];

interface DocumentRow {
    readonly id: string;
    documentType: DocumentType | "";
    file: File | null;
}

interface EducationVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    educationId: number;
    schoolName?: string | null;
    courseName?: string | null;
    onSubmitted: () => void | Promise<void>;
}

function createRow(): DocumentRow {
    return { id: generateUUID(), documentType: "", file: null };
}

function isDocumentType(value: string): value is DocumentType {
    return DOCUMENT_TYPE_OPTIONS.some((option) => option.value === value);
}

function validateFile(file: File): string | null {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ACCEPTED_MIME_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(extension)) {
        return `${file.name} is not a PDF, JPG, or PNG.`;
    }
    if (file.size > MAX_FILE_BYTES) {
        return `${file.name} is larger than 10 MB.`;
    }
    return null;
}

function submitErrorMessage(status: number): string {
    switch (status) {
        case 409:
            return "This education is already under review.";
        case 400:
            return "One or more files could not be accepted. Check the file type and size, then try again.";
        case 502:
            return "Verification is temporarily unavailable. Please try again.";
        case 401:
            return "Your session has expired. Sign in again to continue.";
        default:
            return "Could not submit your documents. Please try again.";
    }
}

export function EducationVerificationModal(props: EducationVerificationModalProps) {
    if (!props.isOpen) return null;
    return <EducationVerificationDialog {...props} />;
}

function EducationVerificationDialog({
    onClose,
    educationId,
    schoolName,
    courseName,
    onSubmitted,
}: EducationVerificationModalProps) {
    const [rows, setRows] = useState<DocumentRow[]>(() => [createRow()]);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const updateRow = (id: string, patch: Partial<Omit<DocumentRow, "id">>) => {
        setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    };

    const addRow = () => {
        setRows((current) => (current.length >= MAX_DOCUMENTS ? current : [...current, createRow()]));
    };

    const removeRow = (id: string) => {
        setRows((current) => (current.length <= 1 ? current : current.filter((row) => row.id !== id)));
    };

    const validateRows = (): string | null => {
        if (rows.length < 1 || rows.length > MAX_DOCUMENTS) {
            return "Add between 1 and 5 documents.";
        }
        for (const [index, row] of rows.entries()) {
            if (!row.documentType) {
                return `Choose a document type for document ${index + 1}.`;
            }
            if (!row.file) {
                return `Add a file for document ${index + 1}.`;
            }
            const fileError = validateFile(row.file);
            if (fileError) return fileError;
        }
        return null;
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isSubmitting) return;

        const validationError = validateRows();
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);
        setIsSubmitting(true);

        let submitted = false;
        try {
            const formData = new FormData();
            formData.append("educationId", String(educationId));
            formData.append(
                "documentTypes",
                JSON.stringify(rows.map((row) => row.documentType)),
            );
            for (const row of rows) {
                if (row.file) {
                    formData.append("files", row.file, row.file.name);
                }
            }

            const response = await fetch("/api/freelancer/education-verification", {
                method: "POST",
                body: formData,
            });
            if (!response.ok) {
                setError(submitErrorMessage(response.status));
            } else {
                submitted = true;
            }
        } catch {
            setError("Could not submit your documents. Please try again.");
        } finally {
            setIsSubmitting(false);
        }

        if (submitted) {
            toast.success("Documents submitted for verification.");
            onClose();
            await onSubmitted();
        }
    };

    const contextLine = [schoolName, courseName].filter((value): value is string => Boolean(value)).join(" · ");

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !isSubmitting) onClose();
            }}
        >
            <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background max-md:max-w-[calc(100vw-2rem)]">
                <DialogHeader className="p-5 pb-3 border-b shrink-0 text-left">
                    <DialogTitle className="text-xl font-semibold text-foreground">
                        Verify your education
                    </DialogTitle>
                    <DialogDescription>
                        Verified education builds trust with schools and employers.
                    </DialogDescription>
                    {contextLine && (
                        <p className="text-sm text-muted-foreground">{contextLine}</p>
                    )}
                    <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {VERIFICATION_BENEFITS.map((benefit) => (
                            <li key={benefit} className="flex items-start gap-2">
                                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                                <span>{benefit}</span>
                            </li>
                        ))}
                    </ul>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="p-5 pt-3 overflow-y-auto flex-1 space-y-4 min-h-0">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                                <Label>Documents</Label>
                                <p className="text-sm text-muted-foreground">
                                    Add 1 to 5 files. PDF, JPG, or PNG up to 10 MB each.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addRow}
                                disabled={rows.length >= MAX_DOCUMENTS || isSubmitting}
                                className="shrink-0 max-md:min-h-11"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                Add document
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {rows.map((row, index) => {
                                const rowNumber = index + 1;
                                const typeId = `${row.id}-type`;
                                const fileId = `${row.id}-file`;
                                return (
                                    <div key={row.id} className="rounded-lg border border-border bg-muted/20 p-3">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-foreground">
                                                Document {rowNumber}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive max-md:size-11"
                                                onClick={() => removeRow(row.id)}
                                                disabled={rows.length === 1 || isSubmitting}
                                                aria-label={`Remove document ${rowNumber}`}
                                            >
                                                <X className="h-4 w-4" aria-hidden="true" />
                                            </Button>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-[11rem_minmax(0,1fr)]">
                                            <div>
                                                <Label htmlFor={typeId} className="sr-only">
                                                    Document {rowNumber} type
                                                </Label>
                                                <Select
                                                    value={row.documentType}
                                                    onValueChange={(value) => {
                                                        if (isDocumentType(value)) {
                                                            updateRow(row.id, { documentType: value });
                                                        }
                                                    }}
                                                    disabled={isSubmitting}
                                                >
                                                    <SelectTrigger
                                                        id={typeId}
                                                        className="w-full"
                                                        aria-label={`Document ${rowNumber} type`}
                                                    >
                                                        <SelectValue placeholder="Document type" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {DOCUMENT_TYPE_OPTIONS.map((option) => (
                                                            <SelectItem key={option.value} value={option.value}>
                                                                {option.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label htmlFor={fileId} className="sr-only">
                                                    Document {rowNumber} file
                                                </Label>
                                                <Input
                                                    id={fileId}
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                                                    onChange={(event) => {
                                                        const file = event.target.files?.[0] ?? null;
                                                        updateRow(row.id, { file });
                                                    }}
                                                    disabled={isSubmitting}
                                                    aria-label={`Document ${rowNumber} file`}
                                                    className="h-9 cursor-pointer file:mr-3 file:text-primary"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {rows.length >= MAX_DOCUMENTS && (
                            <p className="text-sm text-muted-foreground">Remove a document to add another.</p>
                        )}

                        {error && (
                            <div
                                role="alert"
                                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                            >
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="p-5 border-t flex justify-end gap-3 shrink-0 bg-muted/20">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="max-md:min-h-11"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            aria-busy={isSubmitting}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 max-md:min-h-11"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    Submitting...
                                </>
                            ) : (
                                "Submit documents"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
