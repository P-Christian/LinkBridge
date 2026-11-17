"use client";

import { useEffect, useId, useRef, useState } from "react";
import Script from "next/script";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (err?: unknown) => void;
  className?: string;
  theme?: "light" | "dark" | "auto";
  requireExplicitConfirmation?: boolean;
  confirmationLabel?: string;
  onConfirmationChange?: (confirmed: boolean) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: (err?: unknown) => void;
          theme?: string;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export function TurnstileWidget({
  onVerify,
  onExpire,
  onError,
  className,
  theme = "auto",
  requireExplicitConfirmation = false,
  confirmationLabel = "I'm human",
  onConfirmationChange,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const confirmationId = useId();

  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  const onErrorRef = useRef(onError);
  const onConfirmationChangeRef = useRef(onConfirmationChange);

  useEffect(() => {
    onVerifyRef.current = onVerify;
    onExpireRef.current = onExpire;
    onErrorRef.current = onError;
    onConfirmationChangeRef.current = onConfirmationChange;
  }, [onVerify, onExpire, onError, onConfirmationChange]);

  useEffect(() => {
    if (requireExplicitConfirmation) {
      onConfirmationChangeRef.current?.(false);
    }
  }, [requireExplicitConfirmation]);

  // Retrieve site key strictly from NEXT_PUBLIC_TURNSTILE_SITE_KEY environment variable
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  useEffect(() => {
    if (siteKey && window.turnstile && containerRef.current && !widgetIdRef.current) {
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onVerifyRef.current?.(token);
          },
          "expired-callback": () => {
            setConfirmed(false);
            onConfirmationChangeRef.current?.(false);
            onExpireRef.current?.();
          },
          "error-callback": (err?: unknown) => {
            setConfirmed(false);
            onConfirmationChangeRef.current?.(false);
            onErrorRef.current?.(err);
          },
          theme,
        });
      } catch (e) {
        console.error("Turnstile render error:", e);
      }
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Silently ignore if widget was already removed
        }
        widgetIdRef.current = null;
      }
    };
  }, [scriptLoaded, siteKey, theme]);

  return (
    <div className={cn("my-2 flex flex-col items-center justify-center min-h-[65px]", className)}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        async
        defer
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} />
      {requireExplicitConfirmation ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={confirmationId}
            checked={confirmed}
            onCheckedChange={(checked) => {
              const next = checked === true;
              setConfirmed(next);
              onConfirmationChangeRef.current?.(next);
            }}
          />
          <label htmlFor={confirmationId} className="text-sm text-muted-foreground">
            {confirmationLabel}
          </label>
        </div>
      ) : null}
    </div>
  );
}

export default TurnstileWidget;
