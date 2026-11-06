"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, RefreshCw, Check } from "lucide-react";

interface CameraCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
    title?: string;
    facingMode?: "user" | "environment";
    onRequestFileUpload?: () => void;
}

export function CameraCaptureModal({
    isOpen,
    onClose,
    onCapture,
    title = "Take Photo",
    facingMode = "user",
    onRequestFileUpload
}: CameraCaptureModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
    const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
    const [cameraError, setCameraError] = useState<{ message: string; isPermission?: boolean } | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsStreaming(false);
    }, []);

    const initStream = useCallback(async () => {
        setCameraError(null);
        if (!navigator?.mediaDevices?.getUserMedia) {
            setCameraError({
                message: "Camera access is not supported by your browser. Please use 'Browse File' instead."
            });
            return;
        }

        try {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }

            let stream: MediaStream;
            try {
                // First attempt: try requested ideal facingMode
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: facingMode },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });
            } catch (err: unknown) {
                const errorName = err instanceof Error ? err.name : "";
                // If it's a constraint or device error (e.g. desktop doesn't have environment camera), fallback to any video camera
                if (errorName === "OverconstrainedError" || errorName === "ConstraintNotSatisfiedError") {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false
                    });
                } else {
                    throw err;
                }
            }

            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setIsStreaming(true);
            }
        } catch (err: unknown) {
            console.error("Camera access error:", err);
            const errorName = err instanceof Error ? err.name : "";
            if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
                setCameraError({
                    message: "Camera permission was blocked. Please click the lock or camera icon in your browser address bar to allow camera access.",
                    isPermission: true
                });
            } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
                setCameraError({
                    message: "No camera device detected on this device. Please connect a webcam or browse an existing photo."
                });
            } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
                setCameraError({
                    message: "Camera is currently being used by another application. Please close other camera apps and try again."
                });
            } else {
                setCameraError({
                    message: "Unable to start camera. Please ensure permissions are granted or upload an image directly."
                });
            }
            setIsStreaming(false);
        }
    }, [facingMode]);

    useEffect(() => {
        if (!isOpen) {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
            return;
        }

        let isMounted = true;
        (async () => {
            if (isMounted) {
                await initStream();
            }
        })();

        return () => {
            isMounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };
    }, [isOpen, initStream]);

    const handleSnap = () => {
        if (!videoRef.current) return;
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // If facingMode is user, mirror image for natural selfie view
        if (facingMode === "user") {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
            (blob) => {
                if (blob) {
                    setCapturedBlob(blob);
                    setCapturedPreview(canvas.toDataURL("image/jpeg", 0.9));
                    stopStream();
                }
            },
            "image/jpeg",
            0.9
        );
    };

    const handleConfirm = () => {
        if (!capturedBlob) return;
        const filename = `${facingMode === "user" ? "selfie" : "id-front"}-${Date.now()}.jpg`;
        const file = new File([capturedBlob], filename, { type: "image/jpeg" });
        onCapture(file);
        onClose();
    };

    const handleRetake = () => {
        setCapturedPreview(null);
        setCapturedBlob(null);
        initStream();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-background">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
                </DialogHeader>

                <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    {cameraError ? (
                        <div className="p-4 text-center space-y-3 max-w-[90%]">
                            <div className="p-3 text-xs md:text-sm text-destructive bg-destructive/15 rounded-lg border border-destructive/20">
                                {cameraError.message}
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => initStream()}
                                    className="text-xs h-8 text-foreground"
                                >
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                    Try Again
                                </Button>
                                {onRequestFileUpload && (
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                            onClose();
                                            onRequestFileUpload();
                                        }}
                                        className="text-xs h-8 bg-primary text-primary-foreground"
                                    >
                                        Upload File Instead
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : capturedPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={capturedPreview}
                            alt="Captured snapshot"
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
                        />
                    )}
                </div>

                <DialogFooter className="p-4 border-t flex flex-row items-center justify-between sm:justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Cancel
                    </Button>

                    <div className="flex items-center gap-2">
                        {capturedPreview ? (
                            <>
                                <Button variant="outline" size="sm" onClick={handleRetake}>
                                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                                    Retake
                                </Button>
                                <Button size="sm" onClick={handleConfirm} className="bg-primary text-primary-foreground">
                                    <Check className="mr-1.5 h-3.5 w-3.5" />
                                    Use Photo
                                </Button>
                            </>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleSnap}
                                disabled={!isStreaming || Boolean(cameraError)}
                                className="bg-primary text-primary-foreground"
                            >
                                <Camera className="mr-1.5 h-3.5 w-3.5" />
                                Snap Photo
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
