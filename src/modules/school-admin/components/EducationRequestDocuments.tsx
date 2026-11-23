"use client";

import { useEffect, useState } from "react";
import { Download, FileWarning, FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export interface RequestProofDocument {
  readonly documentId: number;
  readonly type: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly url: string;
}

type PreviewKind = "pdf" | "image" | "unsupported";
type PreviewStatus = "loading" | "ready" | "unavailable";

const DOCUMENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  SCHOOL_ID: "School ID",
  DIPLOMA: "Diploma",
  TOR: "Transcript of Records",
  OTHER: "Other",
};

export function describeDocumentType(type: string): string {
  const known = DOCUMENT_TYPE_LABELS[type];
  if (known !== undefined) return known;
  const normalized = type.replace(/[_-]+/gu, " ").trim();
  if (normalized.length === 0) return "Document";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

function previewKindFor(mimeType: string): PreviewKind {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("application/pdf")) return "pdf";
  if (normalized.startsWith("image/")) return "image";
  return "unsupported";
}

function DocumentPreview({
  document,
  kind,
}: {
  readonly document: RequestProofDocument;
  readonly kind: PreviewKind;
}) {
  const [status, setStatus] = useState<PreviewStatus>("loading");

  useEffect(() => {
    if (kind === "unsupported") return;
    const controller = new AbortController();
    const verify = async (): Promise<void> => {
      try {
        const response = await fetch(document.url, {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (!controller.signal.aborted) setStatus("unavailable");
          return;
        }
        await response.body?.cancel();
        if (!controller.signal.aborted) setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("unavailable");
      }
    };
    void verify();
    return () => controller.abort();
  }, [document.url, kind]);

  if (kind === "unsupported") {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <FileWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
        Preview not available for this file type. Download the file to view it.
      </p>
    );
  }

  if (status === "loading") {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
        Loading preview...
      </p>
    );
  }

  if (status === "unavailable") {
    return (
      <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
        <FileWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
        Preview unavailable. Download the file to view it.
      </p>
    );
  }

  if (kind === "image") {
    return (
      <div className="flex justify-center p-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={document.url}
          alt={`Preview of ${document.fileName}`}
          loading="lazy"
          className="max-h-72 w-auto max-w-full rounded-md border border-border/60 bg-background object-contain"
        />
      </div>
    );
  }

  return (
    <iframe
      src={document.url}
      title={`Preview of ${document.fileName}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-72 w-full bg-background"
    />
  );
}

export function EducationRequestDocuments({
  documents,
}: {
  readonly documents: readonly RequestProofDocument[];
}) {
  return (
    <section className="space-y-3" aria-label="Submitted documents">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Submitted documents</h3>
      </div>
      {documents.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          No documents submitted
        </p>
      ) : (
        <ul className="space-y-3">
          {documents.map((document) => {
            const kind = previewKindFor(document.mimeType);
            return (
              <li
                key={document.documentId}
                className="overflow-hidden rounded-lg border border-border"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{describeDocumentType(document.type)}</p>
                    <p className="truncate text-xs text-muted-foreground" title={document.fileName}>
                      {document.fileName}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={document.url} download={document.fileName}>
                      <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                      Download
                    </a>
                  </Button>
                </div>
                <div className="bg-muted/10">
                  <DocumentPreview document={document} kind={kind} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
