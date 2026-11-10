// src/modules/client/company-profile/components/DocumentPreviewModal.tsx
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Undo2,
  ExternalLink,
  FileText,
  Move,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Client-only canvas PDF viewer using react-pdf
const PdfViewer = dynamic(
  () =>
    import("react-pdf").then((mod) => {
      if (typeof window !== "undefined") {
        mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      return function PdfCanvas({
        data,
        pageNumber,
        onLoadSuccess,
        onLoadError,
      }: {
        data: ArrayBuffer;
        pageNumber: number;
        onLoadSuccess: (numPages: number) => void;
        onLoadError: () => void;
      }) {
        const fileSource = React.useMemo(() => ({ data }), [data]);
        return (
          <mod.Document
            file={fileSource}
            onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
            onLoadError={onLoadError}
            loading={null}
            className="flex flex-col items-center pointer-events-none shadow-2xl rounded-md overflow-hidden"
          >
            <mod.Page
              pageNumber={pageNumber}
              scale={1.6}
              devicePixelRatio={
                typeof window !== "undefined"
                  ? Math.max(window.devicePixelRatio || 1, 2)
                  : 2
              }
              renderAnnotationLayer={false}
              renderTextLayer={false}
              className="shadow-2xl rounded-md pointer-events-none"
            />
          </mod.Document>
        );
      };
    }),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-8 text-zinc-400 text-xs gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span>Loading PDF document...</span>
      </div>
    ),
  }
);

export interface PreviewableDoc {
  id: string;
  name: string;
  document_type?: string;
}

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  doc: PreviewableDoc | null;
}

export default function DocumentPreviewModal({
  isOpen,
  onClose,
  doc,
}: DocumentPreviewModalProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // PDF-specific state
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loadingPdf, setLoadingPdf] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [numPages, setNumPages] = useState<number | null>(null);

  // Reset transforms whenever a new doc opens or modal closes
  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  }, []);

  const isPdf = Boolean(doc?.name.toLowerCase().endsWith(".pdf"));
  const docUrl = doc ? `/api/assets/${doc.id}` : "";

  // Reset transforms and PDF state during render when active document changes
  const currentDocId = isOpen && doc ? doc.id : null;
  const [prevDocId, setPrevDocId] = useState<string | null>(currentDocId);

  if (currentDocId !== prevDocId) {
    setPrevDocId(currentDocId);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
    setPdfData(null);
    setLoadingPdf(Boolean(isOpen && doc && isPdf));
    setPdfError(null);
    setPageNumber(1);
    setNumPages(null);
  }

  // Authenticated fetch for PDF buffer
  useEffect(() => {
    if (!isOpen || !doc || !isPdf) {
      return;
    }

    let isMounted = true;

    fetch(docUrl, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load PDF (${res.status})`);
        }
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (isMounted) {
          setPdfData(buffer);
          setLoadingPdf(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("PDF preview error:", err);
          setPdfError("Failed to load PDF document.");
          setLoadingPdf(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, doc, isPdf, docUrl]);

  if (!doc) return null;

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(Number((prev + 0.25).toFixed(2)), 3.5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(Number((prev - 0.25).toFixed(2)), 0.5));
  };

  const handleRotateCw = () => {
    setRotation((prev) => prev + 90);
  };

  const handleRotateCcw = () => {
    setRotation((prev) => prev - 90);
  };

  // Mouse pan handlers (works on both PDFs and Images)
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan handlers for mobile/tablets
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    setIsDragging(true);
    dragStartRef.current = {
      x: touch.clientX - pan.x,
      y: touch.clientY - pan.y,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length === 0) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStartRef.current.x,
      y: touch.clientY - dragStartRef.current.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl h-[92vh] max-h-[96vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-primary/20 rounded-2xl shadow-2xl">
        {/* Header Bar */}
        <DialogHeader className="px-5 py-3 border-b border-border/80 bg-muted/40 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold truncate text-foreground">
                {doc.name}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground truncate">
                {isPdf ? "PDF Document" : "Image Document"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mr-6 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="h-8 text-xs gap-1.5 rounded-lg border-primary/20 text-foreground hover:bg-primary/10"
            >
              <a href={docUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 text-primary" />
                Open Original
              </a>
            </Button>
          </div>
        </DialogHeader>

        {/* Floating Toolbar Controls (both PDFs and Images) */}
        <div className="px-5 py-2 bg-card/80 border-b border-border/60 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom Out"
                className="h-8 w-8 p-0 rounded-lg text-foreground hover:bg-background"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>

              <span className="text-xs font-mono font-medium px-2 min-w-[3.5rem] text-center text-foreground">
                {Math.round(zoom * 100)}%
              </span>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3.5}
                title="Zoom In"
                className="h-8 w-8 p-0 rounded-lg text-foreground hover:bg-background"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>

            </div>

            {/* Rotation Controls */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRotateCcw}
                title="Rotate 90° Counter-Clockwise"
                className="h-8 w-8 p-0 rounded-lg text-foreground hover:bg-background"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRotateCw}
                title="Rotate 90° Clockwise"
                className="h-8 w-8 p-0 rounded-lg text-foreground hover:bg-background"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            {/* Reset View Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetView}
              disabled={zoom === 1 && rotation === 0 && pan.x === 0 && pan.y === 0}
              title="Reset Zoom, Rotation, and Position"
              className="h-8 text-xs gap-1.5 rounded-xl border-border/60 text-muted-foreground hover:text-foreground"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>

            {/* PDF Page Navigation */}
            {isPdf && numPages && numPages > 1 && (
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  title="Previous Page"
                  className="h-8 w-8 p-0 rounded-lg text-foreground hover:bg-background"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono font-medium px-2 text-foreground">
                  Page {pageNumber} of {numPages}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                  title="Next Page"
                  className="h-8 w-8 p-0 rounded-lg text-foreground hover:bg-background"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Move className="h-3 w-3" /> Drag to pan
            </span>
          </div>
        </div>

        {/* Viewport Area */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`flex-1 relative overflow-hidden bg-zinc-950/90 flex items-center justify-center select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {loadingPdf ? (
            <div className="flex flex-col items-center justify-center p-8 text-zinc-400 text-xs gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Loading PDF document...</span>
            </div>
          ) : pdfError ? (
            <div className="flex flex-col items-center justify-center p-6 text-rose-400 text-xs gap-3">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <p className="font-medium text-sm text-foreground">{pdfError}</p>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="text-xs rounded-lg"
              >
                <a href={docUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Open in New Tab
                </a>
              </Button>
            </div>
          ) : (
            <div
              className="relative flex items-center justify-center pointer-events-none select-none max-w-full max-h-full p-4"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                transition: isDragging ? "none" : "transform 0.15s ease-out",
                transformOrigin: "center center",
              }}
            >
              {isPdf ? (
                pdfData ? (
                  <PdfViewer
                    data={pdfData}
                    pageNumber={pageNumber}
                    onLoadSuccess={(pages) => setNumPages(pages)}
                    onLoadError={() => setPdfError("Failed to render PDF document.")}
                  />
                ) : null
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={docUrl}
                  alt={doc.name}
                  draggable={false}
                  className="max-h-[78vh] md:max-h-[82vh] max-w-full object-contain rounded-md shadow-2xl pointer-events-none"
                />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
