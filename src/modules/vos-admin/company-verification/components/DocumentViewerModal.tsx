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
      <div className="flex items-center justify-center gap-2 p-8 text-xs text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Loading PDF document...
      </div>
    ),
  }
);

export interface AdminDocumentPreview {
  fileId: string;
  fileName: string;
  documentTypeLabel: string;
}

interface DocumentViewerModalProps {
  doc: AdminDocumentPreview | null;
  onClose: () => void;
}

const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"];

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ doc, onClose }) => {
  const ext = doc?.fileName.split(".").pop()?.toLowerCase() || "";
  const isImage = IMAGE_EXTS.includes(ext) || ext === "";
  const isPdf = ext === "pdf";
  const assetUrl = doc ? `/api/assets/${doc.fileId}` : "";

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
        console.error("Admin verification PDF preview error:", err);
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

  const stopDrag = () => setIsDragging(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    dragStartRef.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!isDragging || !touch) return;
    setPan({ x: touch.clientX - dragStartRef.current.x, y: touch.clientY - dragStartRef.current.y });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[96vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl h-[92vh] max-h-[96vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-5 py-3 border-b bg-muted/40 flex flex-row items-center justify-between space-y-0 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">{doc.documentTypeLabel}</DialogTitle>
              <DialogDescription className="text-[11px] truncate">{doc.fileName}</DialogDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 mr-6 shrink-0">
            <Button variant="outline" size="sm" asChild className="h-8 text-xs gap-1.5 rounded-lg">
              <a href={`${assetUrl}?download`} download={doc.fileName}>
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </Button>
          </div>
        </DialogHeader>

        <div className="px-5 py-2 border-b bg-card/80 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                title="Zoom Out"
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs font-mono font-medium px-2 min-w-[3.5rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                title="Zoom In"
                className="h-8 w-8 p-0 rounded-lg"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRotation((r) => r - 90)}
                title="Rotate 90° Counter-Clockwise"
                className="h-8 w-8 p-0 rounded-lg"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRotation((r) => r + 90)}
                title="Rotate 90° Clockwise"
                className="h-8 w-8 p-0 rounded-lg"
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetView}
              disabled={zoom === 1 && rotation === 0 && pan.x === 0 && pan.y === 0}
              title="Reset zoom, rotation and position"
              className="h-8 text-xs gap-1.5 rounded-xl"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Reset
            </Button>

            {isPdf && numPages !== null && numPages > 1 && (
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pageNumber <= 1}
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                  title="Previous Page"
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono font-medium px-2">
                  Page {pageNumber} of {numPages}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pageNumber >= numPages}
                  onClick={() => setPageNumber((p) => Math.min(numPages ?? 1, p + 1))}
                  title="Next Page"
                  className="h-8 w-8 p-0 rounded-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Move className="h-3 w-3" /> Drag to pan
          </span>
        </div>

        <div
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={stopDrag}
          className={`flex-1 relative overflow-hidden bg-zinc-950/90 flex items-center justify-center select-none ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
        >
          {loadingPdf ? (
            <div className="flex flex-col items-center justify-center gap-3 p-8 text-xs text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              Loading PDF document...
            </div>
          ) : pdfError ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 text-xs text-rose-400">
              <AlertCircle className="h-8 w-8 text-rose-500" />
              <p className="font-medium text-sm text-foreground">{pdfError}</p>
              <Button variant="outline" size="sm" asChild className="text-xs rounded-lg">
                <a href={`${assetUrl}?download`} download={doc.fileName}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Download {doc.fileName}
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
                    onLoadSuccess={setNumPages}
                    onLoadError={() => setPdfError("Failed to render PDF document.")}
                  />
                ) : null
              ) : isImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={assetUrl}
                  alt={doc.fileName}
                  draggable={false}
                  className="max-h-[78vh] md:max-h-[82vh] max-w-full object-contain rounded-md shadow-2xl pointer-events-none"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                  <FileText className="h-10 w-10 text-zinc-400" />
                  <p className="text-sm text-zinc-200 font-medium">
                    Inline preview is not available for .{ext.toUpperCase()} files.
                  </p>
                  <Button variant="outline" size="sm" asChild className="text-xs rounded-lg">
                    <a href={`${assetUrl}?download`} download={doc.fileName}>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download {doc.fileName}
                    </a>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
