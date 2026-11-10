"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import { Upload, Camera, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraCaptureModal } from "./CameraCaptureModal";

interface ImageUploadSlotProps {
    label: string;
    file: File | null;
    onChange: (file: File | null) => void;
    facingMode?: "user" | "environment";
    cameraModalTitle?: string;
    required?: boolean;
}

function formatBytes(bytes: number, decimals = 1) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function ImageUploadSlot({
    label,
    file,
    onChange,
    facingMode = "user",
    cameraModalTitle = "Take Photo",
    required = false,
}: ImageUploadSlotProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const previewUrl = useMemo(() => {
        if (!file) return null;
        return URL.createObjectURL(file);
    }, [file]);

    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0] || null;
        onChange(selected);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleRemove = () => {
        onChange(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium block">
                {label} {required && <span className="text-destructive">*</span>}
            </label>

            {/* Hidden Input with mobile capture flag */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture={facingMode}
                onChange={handleFileChange}
                className="hidden"
            />

            {previewUrl && file ? (
                /* Interactive Thumbnail Preview Card */
                <div className="border border-border bg-card rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={previewUrl}
                            alt={file.name}
                            className="w-14 h-14 object-cover rounded-lg border border-border/80 shrink-0 bg-muted"
                        />
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[180px] sm:max-w-[220px]" title={file.name}>
                                {file.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {formatBytes(file.size)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => fileInputRef.current?.click()}
                            title="Change or retake photo"
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={handleRemove}
                            title="Remove file"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ) : (
                /* Empty Upload & Camera Action Container */
                <div className="border-2 border-dashed border-border rounded-xl p-4 text-center hover:bg-muted/10 transition-colors flex flex-col items-center justify-center gap-2.5">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs h-9 gap-1.5"
                        >
                            <Upload className="h-3.5 w-3.5" />
                            Browse File
                        </Button>

                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setIsCameraOpen(true)}
                            className="text-xs h-9 gap-1.5"
                        >
                            <Camera className="h-3.5 w-3.5 text-primary" />
                            Take Photo
                        </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                        Supports JPG, PNG or direct camera snap (Max: 10MB)
                    </p>
                </div>
            )}

            <CameraCaptureModal
                isOpen={isCameraOpen}
                onClose={() => setIsCameraOpen(false)}
                onCapture={(capturedFile) => {
                    onChange(capturedFile);
                }}
                title={cameraModalTitle}
                facingMode={facingMode}
                onRequestFileUpload={() => fileInputRef.current?.click()}
            />
        </div>
    );
}
