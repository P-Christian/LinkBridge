"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Undo2,
  Download,
  FileText,
  Move,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { UploadedSchoolDoc } from "../types/school-profile.types";

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
            loading={
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-8">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading PDF...
              </div>
            }
          >
            <mod.Page
              pageNumber={pageNumber}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-md rounded overflow-hidden"
              width={Math.min(typeof window !== "undefined" ? window.innerWidth * 0.85 : 900, 1050)}
            />
          </mod.Document>
        );
      };
    }),
  { ssr: false }
);

interface SchoolDocumentPreviewModalProps {
  doc: UploadedSchoolDoc | null;
  onClose: () => void;
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

export const SchoolDocumentPreviewModal: React.FC<SchoolDocumentPreviewModalProps> = ({
  doc,
  onClose,
}) => {
  const ext = doc?.name.split(".").pop()?.toLowerCase() || "";
  const isImage = IMAGE_EXTS.includes(ext) || ext === "";
  const isPdf = ext === "pdf";
  const assetUrl = doc ? `/api/assets/${doc.id}` : "";

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(isPdf);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState<number | null>(null);

  const currentDocId = doc ? doc.id : null;
  const [prevDocId, setPrevDocId] = useState<string | null>(currentDocId);

  if (currentDocId !== prevDocId) {
    setPrevDocId(currentDocId);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
    setPdfData(null);
    setLoadingPdf(Boolean(doc && isPdf));
    setPdfError(null);
    setPageNumber(1);
    setNumPages(null);
  }

  useEffect(() => {
    if (!doc || !isPdf) return;

    let isMounted = true;

    fetch(assetUrl, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        if (!isMounted) return;
        setPdfData(buffer);
        setLoadingPdf(false);
      })
      .catch((err) => {
        console.error("School document PDF preview error:", err);
        if (!isMounted) return;
        setPdfError("Failed to load PDF document.");
        setLoadingPdf(false);
      });

    return () => {
      isMounted = false;
    };
  }, [doc, isPdf, assetUrl]);

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  if (!doc) return null;

  const handleZoomIn = () => setZoom((z) => Math.min(Number((z + 0.25).toFixed(2)), 4));
  const handleZoomOut = () => setZoom((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.5));

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStartRef.current.x, y: e.clientY - dragStartRef.current.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <Dialog open={Boolean(doc)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl h-[92vh] max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between space-y-0 shrink-0 pr-12">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 rounded-lg text-primary shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold truncate text-foreground">
                {doc.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                {doc.document_type.replace(/_/g, " ")}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs text-foreground hover:bg-muted font-medium"
            >
              <a href={assetUrl} download={doc.name} target="_blank" rel="noopener noreferrer">
                <Download className="w-3.5 h-3.5 text-primary" />
                Download
              </a>
            </Button>
          </div>
        </DialogHeader>

        {/* Controls Toolbar */}
        <div className="px-4 py-2 border-b border-border bg-muted/40 flex items-center justify-between text-xs text-muted-foreground shrink-0 select-none">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground hover:bg-muted"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <span className="w-10 text-center font-mono text-[11px] font-semibold text-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground hover:bg-muted"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground hover:bg-muted"
              onClick={() => setRotation((r) => (r - 90) % 360)}
              title="Rotate Left"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground hover:bg-muted"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title="Rotate Right"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-foreground hover:bg-muted"
              onClick={resetView}
              title="Reset View"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* PDF Page Navigation */}
          {isPdf && numPages && numPages > 1 && (
            <div className="flex items-center gap-1 font-mono text-[11px]">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={pageNumber <= 1}
                onClick={() => setPageNumber((p) => Math.max(p - 1, 1))}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span className="text-foreground">
                {pageNumber} / {numPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={pageNumber >= numPages}
                onClick={() => setPageNumber((p) => Math.min(p + 1, numPages))}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          <div className="flex items-center gap-1 text-[11px]">
            <Move className="w-3 h-3 text-muted-foreground" />
            <span>Drag to pan</span>
          </div>
        </div>

        {/* Main Canvas Viewport */}
        <div
          className={`flex-1 h-full min-h-0 overflow-hidden relative flex items-center justify-center bg-neutral-900/10 dark:bg-neutral-950/40 select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isImage ? (
            <div
              className="transition-transform duration-75 ease-out flex items-center justify-center p-4 pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={assetUrl}
                alt={doc.name}
                className="max-h-[78vh] max-w-full object-contain rounded shadow-lg border border-border/50 bg-background"
                draggable={false}
              />
            </div>
          ) : isPdf ? (
            <div
              className="transition-transform duration-75 ease-out flex items-center justify-center p-4 pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              {loadingPdf && (
                <div className="flex flex-col items-center gap-2 p-8 text-sm text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span>Loading PDF document...</span>
                </div>
              )}
              {pdfError && (
                <div className="flex flex-col items-center gap-2 p-8 text-sm text-rose-500">
                  <AlertCircle className="w-6 h-6" />
                  <span>{pdfError}</span>
                </div>
              )}
              {pdfData && (
                <PdfViewer
                  data={pdfData}
                  pageNumber={pageNumber}
                  onLoadSuccess={(pages) => setNumPages(pages)}
                  onLoadError={() => setPdfError("Failed to render PDF page.")}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">Preview not supported for this file type.</p>
              <Button variant="outline" size="sm" asChild>
                <a href={assetUrl} download={doc.name} target="_blank" rel="noopener noreferrer">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download File
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

