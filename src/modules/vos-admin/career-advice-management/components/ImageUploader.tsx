// src/modules/vos-admin/career-advice-management/components/ImageUploader.tsx
"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, formatAssetUrl } from "@/lib/utils";
import Image from "next/image";

interface ImageUploaderProps {
  currentUrl?: string | null;
  onUploaded: (result: { file_id: string; file_url: string }) => void;
  onRemove?: () => void;
  label?: string;
  articleId?: number;
  assetRole?: "FEATURED_COVER" | "INLINE_BODY" | "GALLERY" | "ATTACHMENT";
  className?: string;
}

export function ImageUploader({
  currentUrl,
  onUploaded,
  onRemove,
  label = "Featured Cover Image",
  articleId,
  assetRole = "FEATURED_COVER",
  className,
}: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (PNG, JPG, WEBP, etc.)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size cannot exceed 10MB");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("asset_role", assetRole);
      if (articleId) formData.append("article_id", String(articleId));

      const res = await fetch("/api/vos-admin/career-articles/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || "Upload failed");
      }

      const json = await res.json();
      onUploaded({
        file_id: json.data.file_id,
        file_url: json.data.file_url,
      });
    } catch (err: unknown) {
      console.error("[ImageUploader] error:", err);
      const message = err instanceof Error ? err.message : "Failed to upload image";
      setError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground">{label}</label>
        {currentUrl && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-6 text-xs text-destructive hover:bg-destructive/10"
          >
            <X className="mr-1 h-3 w-3" /> Remove Cover
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {currentUrl ? (
        <div className="group relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted/30">
          <Image
            src={formatAssetUrl(currentUrl) || currentUrl}
            alt="Uploaded Preview"
            fill
            className="object-cover transition-transform duration-200 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="text-xs shadow-md"
            >
              {isUploading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <UploadCloud className="mr-1 h-3 w-3" />}
              Replace Image
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors duration-150",
            dragActive ? "border-primary bg-primary/5" : "border-border/70 hover:border-primary/50 hover:bg-muted/30",
            isUploading && "pointer-events-none opacity-60"
          )}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Uploading to Directus assets...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full bg-primary/10 p-2.5 text-primary">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-xs font-medium text-foreground">
                Click or drag & drop to upload cover banner
              </p>
              <p className="text-[11px] text-muted-foreground">
                Directus folder: <code className="font-mono text-[10px] bg-muted px-1 py-0.5 rounded">bc80f14e...</code>
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
