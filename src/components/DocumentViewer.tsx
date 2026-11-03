"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Loader2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, AlertCircle, FileText, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Configure pdfjs worker to use local public worker (same-origin, strictly compliant with CSP and no external CDN dependency)
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

// PRIV-010: previews are rendered from attacker-controllable uploads, so the
// bytes pulled into the browser are capped before any parser sees them.
const MAX_PREVIEW_BYTES = 10 * 1024 * 1024; // 10 MB

class DocumentTooLargeError extends Error {}

function tooLargeError(): DocumentTooLargeError {
  return new DocumentTooLargeError(
    `File is larger than ${Math.floor(MAX_PREVIEW_BYTES / (1024 * 1024))} MB and cannot be previewed. Please download it instead.`
  );
}

async function fetchBoundedDocument(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(`Failed to load document (${res.status})`);
  }

  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PREVIEW_BYTES) {
    throw tooLargeError();
  }

  const buffer = await res.arrayBuffer();
  // content-length may be missing or wrong, so also check the bytes read.
  if (buffer.byteLength > MAX_PREVIEW_BYTES) {
    throw tooLargeError();
  }

  return buffer;
}

interface DocumentViewerProps {
  fileUrl: string;
  fileName: string;
  hideDownloadButton?: boolean;
  hideFileName?: boolean;
}

export function DocumentViewer({
  fileUrl,
  fileName,
  hideDownloadButton = false,
  hideFileName = false,
}: DocumentViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PDF state
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);

  // DOCX container ref
  const docxContainerRef = useRef<HTMLDivElement>(null);

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const isPdf = ext === "pdf";
  const isDocx = ext === "docx" || ext === "doc";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);

  // Normalize Directus asset URLs to /api/assets/[id]
  let proxiedUrl = fileUrl;
  const assetsMatch = fileUrl.match(/\/assets\/([a-zA-Z0-9-]+)/);
  if (assetsMatch?.[1]) {
    proxiedUrl = `/api/assets/${assetsMatch[1]}`;
  }

  // General Zoom & Pan & Rotation state (for DOCX & Images)
  const [zoom, setZoom] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  const handleReset = () => {
    setZoom(1.0);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  // Effect to load PDF authenticated buffer
  useEffect(() => {
    if (!isPdf) return;

    let isMounted = true;
    queueMicrotask(() => {
      if (isMounted) {
        setLoading(true);
        setError(null);
        setPdfData(null);
      }
    });

    fetchBoundedDocument(proxiedUrl)
      .then((buffer) => {
        if (!isMounted) return;
        setPdfData(buffer);
      })
      .catch((err) => {
        console.error("PDF Preview fetch error:", err);
        if (isMounted) {
          setError(
            err instanceof DocumentTooLargeError
              ? err.message
              : "Failed to load PDF document."
          );
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isPdf, proxiedUrl]);

  // Effect to load DOCX using docx-preview
  useEffect(() => {
    if (!isDocx || !docxContainerRef.current) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchBoundedDocument(proxiedUrl)
      .then(async (arrayBuffer) => {
        if (!isMounted || !docxContainerRef.current) return;
        docxContainerRef.current.innerHTML = "";
        const docxModule = await import("docx-preview");
        await docxModule.renderAsync(
          arrayBuffer,
          docxContainerRef.current,
          undefined,
          {
            className: "docx-wrapper",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreLastRenderedPageBreak: false,
            // PRIV-010: header/footer/footnote parts of an untrusted .docx are
            // rendered into extra DOM sections (and the library injects style
            // containers for them), so they stay off; only the body renders.
            renderHeaders: false,
            renderFooters: false,
            renderFootnotes: false,
            renderEndnotes: false,
            useBase64URL: true,
            experimental: false,
          }
        );
        if (isMounted) setLoading(false);
      })
      .catch((err) => {
        console.error("DOCX Preview error:", err);
        if (isMounted) {
          setError(
            err instanceof DocumentTooLargeError
              ? err.message
              : "Failed to render DOCX file. You can download the file to view it."
          );
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isDocx, proxiedUrl]);

  // Memoized source for react-pdf to avoid unnecessary re-parsing
  const fileSource = useMemo(() => {
    return pdfData ? { data: pdfData } : null;
  }, [pdfData]);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
    setLoading(false);
  }

  function onDocumentLoadError(err: Error) {
    console.error("PDF Load error:", err);
    setError("Failed to load PDF document.");
    setLoading(false);
  }

  if (isImage) {
    return (
      <div className="w-full h-full flex flex-col bg-zinc-950/5 dark:bg-zinc-950/40 overflow-hidden">
        <div className="flex items-center justify-end px-4 py-2 bg-zinc-800/80 text-zinc-200 border-b border-zinc-700/60 text-xs shrink-0 gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={zoom <= 0.4}
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
            className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="font-mono">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={zoom >= 2.5}
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
            className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            title="Rotate 90°"
            onClick={() => setRotation((r) => r + 90)}
            className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 px-2 text-[11px] font-semibold text-zinc-300 hover:text-white border border-zinc-700"
          >
            Reset
          </Button>
        </div>
        <div
          className="flex-1 overflow-hidden p-4 flex items-center justify-center select-none cursor-grab active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isDragging ? "none" : "transform 150ms ease-out",
            }}
            className="flex items-center justify-center max-w-full max-h-full"
          >
            <Image
              src={proxiedUrl}
              alt={fileName}
              width={1200}
              height={800}
              unoptimized
              draggable={false}
              className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-md select-none pointer-events-none"
            />
          </div>
        </div>
      </div>
    );
  }

  if (isPdf) {
    return (
      <div className="w-full h-full flex flex-col bg-zinc-900 overflow-hidden">
        {/* PDF Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-800 text-zinc-200 border-b border-zinc-700 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
              className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono">
              Page {pageNumber} of {numPages || "--"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              disabled={numPages ? pageNumber >= numPages : true}
              onClick={() => setPageNumber((p) => Math.min(numPages || 1, p + 1))}
              className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={scale <= 0.5}
              onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
              className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="font-mono">{Math.round(scale * 100)}%</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={scale >= 2.5}
              onClick={() => setScale((s) => Math.min(2.5, s + 0.2))}
              className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setScale(1.0)}
              className="h-7 px-2 text-[11px] font-semibold text-zinc-300 hover:text-white border border-zinc-700"
            >
              Reset
            </Button>
          </div>
        </div>

        {/* PDF Canvas Renderer */}
        <div className="flex-1 overflow-auto p-4 flex justify-center bg-zinc-900">
          {loading && (
            <div className="flex items-center gap-2 text-zinc-400 text-xs my-auto">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Loading PDF...
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3 text-rose-400 text-xs my-auto">
              <AlertCircle className="h-6 w-6" />
              <p>{error}</p>
              <a
                href={proxiedUrl}
                download={fileName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs"
              >
                <Download className="h-3.5 w-3.5" /> Download File
              </a>
            </div>
          )}
          {fileSource && (
            <Document
              file={fileSource}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
              className="flex flex-col items-center"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderAnnotationLayer={false}
                renderTextLayer={true}
                className="shadow-lg rounded"
              />
            </Document>
          )}
        </div>
      </div>
    );
  }

  if (isDocx) {
    return (
      <div className="w-full h-full flex flex-col bg-zinc-100 dark:bg-zinc-950 overflow-hidden relative">
        {/* DOCX Zoom Controls Toolbar */}
        <div
          className={cn(
            "flex items-center px-4 py-2 bg-zinc-800 text-zinc-200 border-b border-zinc-700 text-xs shrink-0",
            hideFileName ? "justify-end" : "justify-between"
          )}
        >
          {!hideFileName && (
            <div className="flex items-center gap-2 text-zinc-400">
              <FileText className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-zinc-200 truncate max-w-xs">{fileName}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={zoom <= 0.4}
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="font-mono">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={zoom >= 2.5}
              onClick={() => setZoom((z) => Math.min(2.5, z + 0.15))}
              className="h-7 w-7 p-0 text-zinc-300 hover:text-white"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(1.0)}
              className="h-7 px-2 text-[11px] font-semibold text-zinc-300 hover:text-white border border-zinc-700"
            >
              Reset
            </Button>
          </div>
        </div>

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 gap-2 text-xs text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Rendering DOCX Document...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-3 text-rose-600 dark:text-rose-400 text-xs z-10">
            <AlertCircle className="h-6 w-6" />
            <p>{error}</p>
            <a
              href={proxiedUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs"
            >
              <Download className="h-3.5 w-3.5" /> Download {fileName}
            </a>
          </div>
        )}
        <div className="flex-1 overflow-auto p-4 flex justify-center bg-zinc-100 dark:bg-zinc-950">
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
            className="transition-transform duration-150 ease-out w-full flex justify-center"
          >
            <div
              ref={docxContainerRef}
              className="w-full flex flex-col items-center justify-between"
            />
          </div>
        </div>
      </div>
    );
  }

  // Fallback for unknown file types
  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 gap-4 bg-zinc-50 dark:bg-zinc-900">
      <FileText className="h-12 w-12 text-zinc-400" />
      <div className="text-center space-y-1">
        <h4 className="font-semibold text-sm text-foreground">{fileName}</h4>
        <p className="text-xs text-muted-foreground">Direct preview is not available for this file type.</p>
      </div>
      {!hideDownloadButton && (
        <a
          href={proxiedUrl}
          download={fileName}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Download className="h-4 w-4" /> Download File
        </a>
      )}
    </div>
  );
}
