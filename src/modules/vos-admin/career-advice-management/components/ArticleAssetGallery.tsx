// src/modules/vos-admin/career-advice-management/components/ArticleAssetGallery.tsx
"use client";

import React, { useState } from "react";
import { ArticleAsset } from "../types/article.types";
import { Copy, Check, Trash2, Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatAssetUrl } from "@/lib/utils";
import Image from "next/image";

interface ArticleAssetGalleryProps {
  assets: ArticleAsset[];
  onUploadNew: (file: File) => Promise<void>;
  onDeleteAsset?: (assetId: number) => Promise<void>;
  onSelectAsCover?: (url: string, fileId: string) => void;
  isUploading?: boolean;
}

export function ArticleAssetGallery({
  assets,
  onUploadNew,
  onDeleteAsset,
  onSelectAsCover,
  isUploading,
}: ArticleAssetGalleryProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("Image URL copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadNew(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center justify-between border-b border-border/50 pb-3 gap-2">
        <div className="min-w-0">
          <h4 className="text-xs font-semibold text-foreground truncate">Media & Asset Library</h4>
          <p className="text-[11px] text-muted-foreground line-clamp-1">
            Copy URL to insert into TipTap body.
          </p>
        </div>
        <div>
          <label htmlFor="gallery-upload" className="cursor-pointer">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              asChild
              className="text-xs h-7 px-2 shrink-0"
            >
              <span>
                <Upload className="mr-1 h-3 w-3" />
                {isUploading ? "..." : "Upload"}
              </span>
            </Button>
          </label>
          <input
            id="gallery-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      </div>

      {assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-8 text-center">
          <ImageIcon className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-xs font-medium text-foreground">No assets uploaded yet</p>
          <p className="text-[11px] text-muted-foreground">Upload images above to build this article&apos;s media library</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0">
          {assets.map((asset, idx) => (
            <div
              key={asset.asset_id || asset.directus_file_id || idx}
              className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs min-w-0"
            >
              <div className="relative aspect-video w-full bg-muted/40 overflow-hidden">
                <Image
                  src={formatAssetUrl(asset.file_url) || asset.file_url}
                  alt={asset.caption || asset.file_name || "Article media"}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <Badge
                  variant="secondary"
                  className="absolute top-1.5 left-1.5 text-[9px] px-1.5 py-0 bg-background/90 backdrop-blur-xs font-mono"
                >
                  {asset.asset_role}
                </Badge>
              </div>

              <div className="p-2.5 flex flex-col justify-between flex-1 gap-2 min-w-0">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-foreground truncate" title={asset.file_name || ""}>
                    {asset.file_name || "Image file"}
                  </p>
                  
                  {/* Inline Editable Caption Field */}
                  <div className="space-y-0.5">
                    <input
                      type="text"
                      placeholder="Add image caption..."
                      defaultValue={asset.caption || ""}
                      onBlur={async (e) => {
                        const newCaption = e.target.value.trim();
                        if (asset.asset_id && newCaption !== (asset.caption || "")) {
                          try {
                            await fetch(`/api/vos-admin/career-articles/assets/${asset.asset_id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ caption: newCaption }),
                            });
                            toast.success("Caption saved");
                            asset.caption = newCaption;
                          } catch {
                            toast.error("Failed to save caption");
                          }
                        }
                      }}
                      className="w-full text-[11px] px-1.5 py-0.5 rounded border border-input bg-background text-foreground focus:outline-none focus:border-primary truncate"
                    />
                  </div>

                  <p className="text-[10px] font-mono text-muted-foreground truncate">
                    UUID: {asset.directus_file_id.slice(0, 8)}...
                  </p>
                </div>

                <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => copyUrl(asset.file_url, asset.directus_file_id)}
                    className="h-7 text-xs flex-1 justify-center"
                    title="Copy URL"
                  >
                    {copiedId === asset.directus_file_id ? (
                      <Check className="mr-1 h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="mr-1 h-3 w-3" />
                    )}
                    Copy URL
                  </Button>

                  {onSelectAsCover && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectAsCover(asset.file_url, asset.directus_file_id)}
                      className="h-7 text-[11px] text-primary"
                      title="Set as Cover"
                    >
                      Set Cover
                    </Button>
                  )}

                  {asset.asset_id && onDeleteAsset && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteAsset(asset.asset_id!)}
                      className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                      title="Delete asset"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
