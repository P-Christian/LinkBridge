// src/modules/school-admin/school-profile/components/SchoolDocuments.tsx
"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Loader2, CheckCircle2, Eye, RefreshCw, Trash2, FileText, Plus } from "lucide-react";
import { SchoolDocumentTypeKey, UploadedSchoolDoc } from "../types/school-profile.types";
import { SchoolDocumentPreviewModal } from "./SchoolDocumentPreviewModal";
import { toast } from "sonner";

interface DocSlotConfig {
  type: SchoolDocumentTypeKey;
  title: string;
  description: string;
}

const DOCUMENT_SLOTS: DocSlotConfig[] = [
  {
    type: "CHED_DEPED_TESDA_RECOGNITION",
    title: "CHED / DepEd / TESDA Recognition",
    description: "Proof of government recognition or permit",
  },
  {
    type: "BUSINESS_PERMIT",
    title: "Mayor's / Business Permit",
    description: "Proof of institutional operation",
  },
  {
    type: "TIN_DOCUMENT",
    title: "TIN / BIR Document",
    description: "Tax identification certificate",
  },
];

interface SchoolDocumentsProps {
  schoolId?: number;
  onDocsChange?: (count: number) => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function SchoolDocuments({ schoolId, onDocsChange }: SchoolDocumentsProps) {
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const otherFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [isUploadingOther, setIsUploadingOther] = useState(false);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [docs, setDocs] = useState<UploadedSchoolDoc[]>([]);
  const [previewDoc, setPreviewDoc] = useState<UploadedSchoolDoc | null>(null);
  const [slotError, setSlotError] = useState<Record<string, string>>({});
  const [otherError, setOtherError] = useState<string | null>(null);

  const ALLOWED_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];
  const MAX_SIZE_MB = 10;

  const fetchDocs = useCallback(async () => {
    if (!schoolId) return;
    try {
      const res = await fetch(`/api/school-admin/school/documents?schoolId=${schoolId}`);
      if (res.ok) {
        const data = await res.json();
        setDocs(Array.isArray(data) ? data : []);
      } else {
        setDocs([]);
      }
    } catch (err) {
      console.warn("Failed to load school verification documents:", err);
      setDocs([]);
    }
  }, [schoolId]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!schoolId) return;
      try {
        const res = await fetch(`/api/school-admin/school/documents?schoolId=${schoolId}`);
        if (isMounted) {
          if (res.ok) {
            const data = await res.json();
            setDocs(Array.isArray(data) ? data : []);
          } else {
            setDocs([]);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn("Failed to load school verification documents:", err);
          setDocs([]);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [schoolId]);

  useEffect(() => {
    onDocsChange?.(docs.length);
  }, [docs, onDocsChange]);

  const triggerFileInput = (docType: string) => {
    setSlotError((prev) => ({ ...prev, [docType]: "" }));
    fileInputRefs.current[docType]?.click();
  };

  const handleFileChange = async (docType: SchoolDocumentTypeKey, e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;
    const file = selectedFiles[0];

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSlotError((prev) => ({ ...prev, [docType]: "Only PDF, JPG, PNG, or WEBP files are allowed." }));
      toast.error("Invalid file format. Please upload PDF, JPG, or PNG.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setSlotError((prev) => ({ ...prev, [docType]: `File size exceeds ${MAX_SIZE_MB}MB limit.` }));
      toast.error(`File exceeds ${MAX_SIZE_MB}MB limit.`);
      e.target.value = "";
      return;
    }

    setUploadingSlot(docType);
    setSlotError((prev) => ({ ...prev, [docType]: "" }));

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", docType);
      if (schoolId) formData.append("school_id", String(schoolId));

      const res = await fetch("/api/school-admin/school/documents", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to upload document.");
      }

      toast.success("Document uploaded successfully.");
      await fetchDocs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setSlotError((prev) => ({ ...prev, [docType]: msg }));
      toast.error(msg);
    } finally {
      setUploadingSlot(null);
      e.target.value = "";
    }
  };

  const handleOtherFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? []);
    if (selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setOtherError("Only PDF, JPG, PNG, or WEBP files are allowed.");
        toast.error("Invalid file format.");
        e.target.value = "";
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setOtherError(`"${file.name}" exceeds the ${MAX_SIZE_MB}MB limit.`);
        toast.error(`"${file.name}" exceeds the ${MAX_SIZE_MB}MB limit.`);
        e.target.value = "";
        return;
      }
    }

    setIsUploadingOther(true);
    setOtherError(null);

    try {
      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("document_type", "OTHER_DOCUMENT");
        if (schoolId) formData.append("school_id", String(schoolId));

        const res = await fetch("/api/school-admin/school/documents", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || `Failed to upload "${file.name}".`);
        }
      }

      toast.success("Supplementary documents uploaded successfully.");
      await fetchDocs();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to upload one or more files.";
      setOtherError(msg);
      toast.error(msg);
    } finally {
      setIsUploadingOther(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    setDeletingDocId(docId);
    try {
      const res = await fetch(`/api/school-admin/school/documents?id=${docId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to delete document.");
      }

      toast.success("Document deleted successfully.");
      await fetchDocs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleView = (doc: UploadedSchoolDoc) => {
    setPreviewDoc(doc);
  };

  const otherDocs = docs.filter((d) => d.document_type === "OTHER_DOCUMENT");

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {DOCUMENT_SLOTS.map((slot) => {
          const doc = docs.find((d) => d.document_type === slot.type);
          const isSlotUploading = uploadingSlot === slot.type;
          const error = slotError[slot.type];

          return (
            <div
              key={slot.type}
              className="p-3.5 rounded-xl border border-border bg-card/60 space-y-2.5 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    {slot.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {slot.description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <input
                    ref={(el) => {
                      fileInputRefs.current[slot.type] = el;
                    }}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => handleFileChange(slot.type, e)}
                  />

                  {doc ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          triggerFileInput(slot.type);
                        }}
                        disabled={isSlotUploading}
                        className="h-7 px-2.5 text-[11px] font-medium rounded-lg gap-1 border-border"
                      >
                        {isSlotUploading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleView(doc);
                        }}
                        className="h-7 px-2.5 text-[11px] font-medium rounded-lg gap-1 border-border"
                      >
                        <Eye className="h-3 w-3" />
                        View
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        triggerFileInput(slot.type);
                      }}
                      disabled={isSlotUploading}
                      className="h-7 px-3 text-[11px] font-medium rounded-lg gap-1.5 border-dashed border-primary/50 text-primary hover:bg-primary/5"
                    >
                      {isSlotUploading ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-3 w-3" />
                          Upload
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {doc && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-semibold flex-1">{doc.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatFileSize(doc.size)}
                  </span>
                </div>
              )}

              {error && (
                <p className="text-[11px] text-rose-500 font-medium">{error}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Other Supporting Documents Section */}
      <div className="p-3.5 rounded-xl border border-border bg-card/60 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-foreground">
              Other Supporting Documents
            </p>
            <p className="text-[11px] text-muted-foreground">
              Supplemental files (accreditation certificates, charters, SEC registration).
            </p>
          </div>

          <input
            ref={otherFileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleOtherFilesChange}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOtherError(null);
              otherFileInputRef.current?.click();
            }}
            disabled={isUploadingOther}
            className="h-7 px-2.5 text-[11px] font-semibold rounded-lg gap-1 border-dashed border-primary/50 text-primary hover:bg-primary/5 shrink-0"
          >
            {isUploadingOther ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
            Add Documents
          </Button>
        </div>

        {otherError && (
          <p className="text-[11px] text-rose-500 font-medium">{otherError}</p>
        )}

        {otherDocs.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            {otherDocs.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate font-medium text-foreground">{d.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    ({formatFileSize(d.size)})
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleView(d);
                    }}
                    className="h-6 px-2 text-[10px] rounded hover:text-primary"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(d.id);
                    }}
                    disabled={deletingDocId === d.id}
                    className="h-6 px-2 text-[10px] rounded text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    {deletingDocId === d.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3 mr-1" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            No supplementary documents uploaded yet.
          </p>
        )}
      </div>

      <SchoolDocumentPreviewModal
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
