
// src/modules/client/company-profile/components/CompanyDocuments.tsx
"use client";

import Image from "next/image";
import React, { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Loader2,
  X,
  CheckCircle2,
  Eye,
  RefreshCw,
  Lock,
  Trash2,
  FileText,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import DocumentPreviewModal, { PreviewableDoc } from "./DocumentPreviewModal";

interface DocSlotConfig {
  type: string;
  matchedTypes: string[];
  title: string;
  description: string;
}

interface UploadedDoc {
  id: string;
  document_type: string;
  name: string;
  size: number;
  uploaded_at?: string | null;
}

interface CompanyDocumentsProps {
  companyId?: number;
  verificationStatus?: string;
  onDocsChange?: (count: number) => void;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const raw =
      dateStr.endsWith("Z") || dateStr.includes("+")
        ? dateStr
        : `${dateStr.replace(" ", "T")}Z`;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "Asia/Manila",
    });
  } catch {
    return dateStr;
  }
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function CompanyDocuments({
  companyId,
  verificationStatus = "DRAFT",
  onDocsChange,
}: CompanyDocumentsProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const otherFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [isUploadingOther, setIsUploadingOther] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [slotError, setSlotError] = useState<Record<string, string>>({});
  const [otherError, setOtherError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewableDoc | null>(null);


  type CompanyVerificationStatus =
    | "DRAFT"
    | "PENDING_VERIFICATION"
    | "IN_REVIEW"
    | "CORRECTION_REQUIRED"
    | "VERIFIED"
    | "APPROVED"
    | "REJECTED"
    | "INACTIVE"
    | "SUSPENDED";

  const normalizedStatus = (
    verificationStatus: string,
  ): CompanyVerificationStatus => {
    const status = verificationStatus.trim().toUpperCase();

    switch (status) {
      case "APPROVED":
        return "VERIFIED";

      case "PENDING_VERIFICATION":
      case "IN_REVIEW":
      case "CORRECTION_REQUIRED":
      case "DRAFT":
      case "VERIFIED":
      case "REJECTED":
      case "INACTIVE":
      case "SUSPENDED":
        return status;

      default:
        return "DRAFT";
    }
  };

  const currentStatus = normalizedStatus(verificationStatus);

  const canEditDocs =
    currentStatus === "DRAFT" ||
    currentStatus === "REJECTED" ||
    currentStatus === "CORRECTION_REQUIRED";

  const canRemoveDocs = canEditDocs;

  const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
  ];
  const MAX_SIZE_MB = 25;

  const fetchDocs = useCallback(async () => {
    if (!companyId) return;
    try {
      const res = await fetch(
        `/api/client/company-profile/documents?companyId=${companyId}`
      );
      if (!res.ok) throw new Error("Failed to load documents.");
      const data: UploadedDoc[] = await res.json();
      setDocs(data);
    } catch (err) {
      console.error("Error loading verification documents:", err);
    }
  }, [companyId]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!companyId) return;
      try {
        const res = await fetch(
          `/api/client/company-profile/documents?companyId=${companyId}`
        );
        if (!res.ok) throw new Error("Failed to load documents.");
        const data: UploadedDoc[] = await res.json();
        if (!ignore) {
          setDocs(data);
        }
      } catch (err) {
        console.error("Error loading verification documents:", err);
      }
    }
    void load();
    return () => {
      ignore = true;
    };
  }, [companyId]);

  useEffect(() => {
    onDocsChange?.(docs.length);
  }, [docs.length, onDocsChange]);

  const triggerFileInput = (docType: string) => {
    setSlotError((prev) => ({ ...prev, [docType]: "" }));
    fileInputRefs.current[docType]?.click();
  };

  const handleFileChange = async (
    docType: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;
    const file = selectedFiles[0];

    setSlotError((prev) => ({ ...prev, [docType]: "" }));

    if (!ALLOWED_TYPES.includes(file.type)) {
      const msg = `Only PDF, JPG, JPEG, or PNG files are allowed. (${file.name})`;
      setSlotError((prev) => ({ ...prev, [docType]: msg }));
      toast.error(msg);
      e.target.value = "";
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      const msg = `File must be under ${MAX_SIZE_MB}MB. (${file.name})`;
      setSlotError((prev) => ({ ...prev, [docType]: msg }));
      toast.error(msg);
      e.target.value = "";
      return;
    }

    setUploadingSlot(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (companyId) formData.append("companyId", String(companyId));
      formData.append("documentType", docType);

      const res = await fetch("/api/client/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed for ${file.name}`);
      }

      toast.success(`${file.name} uploaded successfully.`);
      await fetchDocs();
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Upload failed. Please try again.";
      setSlotError((prev) => ({
        ...prev,
        [docType]: errMsg,
      }));
      toast.error(errMsg);
    } finally {
      setUploadingSlot(null);
      e.target.value = "";
    }
  };

  // Handler for multiple Other Supporting Documents upload
  const handleOtherFilesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    setOtherError(null);

    // Validate all files
    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        const msg = `Invalid format in "${file.name}". Only PDF, JPG, JPEG, or PNG files are allowed.`;
        setOtherError(msg);
        toast.error(msg);
        e.target.value = "";
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        const msg = `File "${file.name}" exceeds the ${MAX_SIZE_MB}MB size limit.`;
        setOtherError(msg);
        toast.error(msg);
        e.target.value = "";
        return;
      }
    }

    setIsUploadingOther(true);
    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        if (companyId) formData.append("companyId", String(companyId));
        formData.append("documentType", "OTHER_DOCUMENT");

        const res = await fetch("/api/client/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `Upload failed for ${file.name}`);
        }
      }

      toast.success("Supporting documents uploaded successfully.");
      await fetchDocs();
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error
          ? err.message
          : "Upload failed for one or more files. Please try again.";
      setOtherError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsUploadingOther(false);
      e.target.value = "";
    }
  };

  // Handler for deleting an individual document
  const handleDeleteDoc = async (fileId: string, docName?: string) => {
    setDeletingDocId(fileId);
    setOtherError(null);
    try {
      const res = await fetch(
        `/api/client/company-profile/documents?id=${fileId}`,
        {
          method: "DELETE",
        }
      );
      const resJson = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resJson.error || "Failed to remove document.");
      }
      toast.success(
        docName
          ? `"${docName}" removed successfully.`
          : "Document removed successfully."
      );
      await fetchDocs();
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to remove document.";
      toast.error(errMsg);
      setOtherError(errMsg);
    } finally {
      setDeletingDocId(null);
    }
  };

  const documentSlots: DocSlotConfig[] = useMemo(
    () => [
      {
        type: "DTI_SEC_REGISTRATION",
        matchedTypes: [
          "DTI_SEC_REGISTRATION",
          "DTI_REGISTRATION",
          "SEC_REGISTRATION",
          "CDA_REGISTRATION",
        ],
        title: "DTI / SEC Registration",
        description: "Proof of company registration",
      },
      {
        type: "BUSINESS_PERMIT",
        matchedTypes: ["BUSINESS_PERMIT", "MAYORS_PERMIT"],
        title: "Business Permit",
        description: "Proof of business operation",
      },
      {
        type: "TIN_DOCUMENT",
        matchedTypes: ["TIN_DOCUMENT", "BIR_2303"],
        title: "TIN Document",
        description: "Tax identification document",
      },
    ],
    []
  );

  const findDocForSlot = useCallback(
    (slot: DocSlotConfig) => {
      return docs.find((d) =>
        slot.matchedTypes.includes((d.document_type || "").toUpperCase())
      );
    },
    [docs]
  );

  const primaryDocIds = useMemo(() => {
    return new Set(
      documentSlots.map((slot) => findDocForSlot(slot)?.id).filter(Boolean)
    );
  }, [documentSlots, findDocForSlot]);

  const otherDocs = useMemo(() => {
    return docs.filter((d) => !primaryDocIds.has(d.id));
  }, [docs, primaryDocIds]);

  return (
    <div className="space-y-6">
      {/* Header Info Banner */}
      <div className="rounded-xl bg-muted/40 p-3.5 border border-border flex items-start gap-2.5">
        <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />

        <div className="text-xs text-muted-foreground leading-relaxed space-y-1">
          <p>
            Upload documents required to verify your company. These documents are{" "}
            <span className="font-semibold text-foreground">private</span> and
            will only be accessible to authorized VOS Sync administrators.
          </p>

          <p className="text-[11px] font-medium">
            {canEditDocs ? (
              <>
                {currentStatus === "DRAFT" &&
                  "Your company profile is still a draft. You can upload, replace, or remove documents before submitting it for verification."}

                {currentStatus === "REJECTED" &&
                  "Your previous verification was rejected. You can update your documents and prepare your profile for resubmission."}

                {currentStatus === "CORRECTION_REQUIRED" &&
                  "The reviewer has requested corrections. Update your documents as needed before resubmitting your profile."}
              </>
            ) : (
              <>
                {currentStatus === "PENDING_VERIFICATION" &&
                  "Your profile has been submitted for verification. Document changes are locked while awaiting review."}

                {currentStatus === "IN_REVIEW" &&
                  "Your company is currently under review. Document uploads, replacements, and removals are temporarily locked."}

                {currentStatus === "VERIFIED" &&
                  "Your company has been verified. Verification documents are locked to preserve the approved records."}

                {currentStatus === "SUSPENDED" &&
                  "Your company verification is suspended. Document changes are locked pending administrative resolution."}

                {currentStatus === "INACTIVE" &&
                  "Your company profile is inactive. Document changes are locked until the profile is reactivated."}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Primary Verification Document Slots */}
      <div className="space-y-3">
        {documentSlots.map((slot) => {
          const existingDoc = findDocForSlot(slot);
          const isUploading = uploadingSlot === slot.type;
          const isDeleting = deletingDocId === existingDoc?.id;
          const errorMsg = slotError[slot.type];
          const isPdf = existingDoc?.name.toLowerCase().endsWith(".pdf");

          return (
            <div
              key={slot.type}
              className={`min-w-0 space-y-3 rounded-xl border bg-card p-4 transition-colors ${
                errorMsg
                  ? "border-destructive ring-1 ring-destructive/30 shadow-xs shadow-destructive/10"
                  : "border-border hover:border-border/80"
              }`}
            >
              {/* Document title and upload action */}
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {slot.title}
                  </h4>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {slot.description}
                  </p>
                </div>
                {!existingDoc && (
                  <div className="shrink-0">
                    {canEditDocs ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploading}
                        onClick={() => triggerFileInput(slot.type)}
                        className="h-9 w-full gap-1.5 rounded-lg border-primary/30 text-xs font-medium text-primary hover:bg-primary/10 sm:w-auto"
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5" />
                            Upload
                          </>
                        )}
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Upload locked
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Existing document */}
              {existingDoc ? (
                <div className="min-w-0 space-y-3 rounded-xl border border-border/80 bg-muted/40 p-3">
                  {/* File information */}
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(existingDoc)}
                      className="group/thumb relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-card transition-all hover:ring-2 hover:ring-primary/40"
                      title="Click to preview document"
                      aria-label={`Preview ${existingDoc.name}`}
                    >
                      {isPdf ? (
                        <div className="flex h-full w-full flex-col items-center justify-center bg-rose-500/10 font-bold text-rose-600 dark:text-rose-400">
                          <FileText className="h-4 w-4" />
                          <span className="font-mono text-[9px] tracking-tight">
                            PDF
                          </span>
                        </div>
                      ) : (
                        <Image
                          src={`/api/assets/${existingDoc.id}?width=240`}
                          alt={existingDoc.name}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover/thumb:scale-110"
                          width={48}
                          height={48}
                          unoptimized
                        />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(existingDoc)}
                          className="min-w-0 truncate text-left text-xs font-semibold text-foreground hover:text-primary hover:underline"
                          title={existingDoc.name}
                        >
                          {existingDoc.name}
                        </button>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span>{formatFileSize(existingDoc.size)}</span>

                        {existingDoc.uploaded_at && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              Uploaded {formatDate(existingDoc.uploaded_at)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Document actions */}
                  <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewDoc(existingDoc)}
                      className="h-9 flex-1 gap-1.5 rounded-lg text-xs sm:flex-none"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>

                    {canEditDocs && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploading || isDeleting}
                        onClick={() => triggerFileInput(slot.type)}
                        className="h-9 flex-1 gap-1.5 rounded-lg text-xs sm:flex-none"
                      >
                        {isUploading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Replace
                      </Button>
                    )}

                    {canRemoveDocs && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isDeleting || isUploading}
                        onClick={() =>
                          handleDeleteDoc(existingDoc.id, existingDoc.name)
                        }
                        className="h-9 flex-1 gap-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none"
                        title="Remove document"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                  <span>No document uploaded yet</span>
                </div>
              )}

              {/* Slot error */}
              <AnimatePresence>
                {errorMsg && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="mt-1 flex items-start gap-1.5 overflow-hidden text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 font-medium"
                  >
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">{errorMsg}</span>
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Hidden file input */}
              <input
                ref={(el) => {
                  fileInputRefs.current[slot.type] = el;
                }}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => handleFileChange(slot.type, e)}
                disabled={!canEditDocs || isUploading}
              />
            </div>
          );

        })}
      </div>

      {/* Other Supporting Documents (Multi-Upload Section) */}
      <div
        className={`rounded-xl border p-4 bg-card space-y-3 transition-colors ${
          otherError
            ? "border-destructive ring-1 ring-destructive/30 shadow-xs shadow-destructive/10"
            : "border-border"
        }`}
      >
        {/* Row 1: Header - Title/Desc and Action */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Other Supporting Documents
            </h4>
            <p className="text-xs text-muted-foreground">
              Upload optional supplementary files such as BIR 2303, General
              Information Sheet (GIS), Secretary&apos;s Certificate, or Special
              Permits.
            </p>
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canEditDocs || isUploadingOther}
              onClick={() => otherFileInputRef.current?.click()}
              className="h-8 max-md:min-h-10 text-xs gap-1.5 font-medium border-primary/30 text-primary hover:bg-primary/10 shrink-0 rounded-lg"
            >
              {isUploadingOther ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Add Documents
                </>
              )}
            </Button>

            {/* Hidden multi-file input for Other Documents */}
            <input
              ref={otherFileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={handleOtherFilesChange}
              disabled={!canEditDocs || isUploadingOther}
            />
          </div>
        </div>

        {/* Error banner for Other Documents */}
        <AnimatePresence>
          {otherError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="text-xs text-destructive flex items-center gap-1.5 bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 overflow-hidden"
            >
              <X className="h-3.5 w-3.5 shrink-0" />
              {otherError}
            </motion.p>
          )}
        </AnimatePresence>

        {/* List of uploaded other documents */}
        {otherDocs.length > 0 ? (
          <div className="space-y-2 pt-1 border-t border-border">
            <AnimatePresence initial={false}>
              {otherDocs.map((doc: UploadedDoc) => {
                const isDeleting = deletingDocId === doc.id;
                const isPdf = doc.name.toLowerCase().endsWith(".pdf");

                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-muted/40 border border-border text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Thumbnail Preview */}
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="relative group/thumb shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-border bg-card flex items-center justify-center hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
                        title="Click to preview document"
                      >
                        {isPdf ? (
                          <div className="flex flex-col items-center justify-center w-full h-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="text-[8px] tracking-tight font-mono">
                              PDF
                            </span>
                          </div>
                        ) : (
                          <Image
                            src={`/api/assets/${doc.id}?width=240`}
                            alt={doc.name}
                            className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200"
                            width={50}
                            height={50}
                            unoptimized
                          />
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <button
                            type="button"
                            onClick={() => setPreviewDoc(doc)}
                            className="font-semibold text-foreground hover:underline hover:text-primary truncate block text-left text-xs max-w-[160px] sm:max-w-xs"
                            title={doc.name}
                          >
                            {doc.name}
                          </button>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatFileSize(doc.size)}
                          {doc.uploaded_at
                            ? ` · Uploaded ${formatDate(doc.uploaded_at)}`
                            : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreviewDoc(doc)}
                        className="h-7 max-md:min-h-10 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground rounded-lg"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>

                      {canRemoveDocs && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                          onClick={() => handleDeleteDoc(doc.id, doc.name)}
                          className="h-7 max-md:min-h-10 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Delete
                        </Button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-4 border border-dashed rounded-lg border-border text-muted-foreground text-xs">
            No other supporting documents uploaded yet.
          </div>
        )}
      </div>

      {/* Interactive Document Preview Modal */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
      />
    </div>
  );
}
