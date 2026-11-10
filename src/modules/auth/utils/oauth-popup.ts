// src/modules/auth/utils/oauth-popup.ts
"use client";

export interface OAuthSuccessPayload {
  provider: string;
  flow: string;
  redirectUrl?: string;
  notice?: string;
}

export interface OAuthCancelPayload {
  provider: string;
  flow: string;
}

export interface OAuthErrorPayload {
  provider: string;
  error?: string;
  email?: string;
}

export interface OAuthPopupOptions {
  url: string;
  title?: string;
  width?: number;
  height?: number;
  onSuccess?: (payload: OAuthSuccessPayload) => void;
  onCancel?: (payload: OAuthCancelPayload) => void;
  onError?: (payload: OAuthErrorPayload) => void;
  onClose?: () => void;
}

/**
 * Opens a centered popup window for OAuth authentication.
 * Listens for structured postMessage response from callback bridge,
 * and falls back to full-page redirect if popups are blocked.
 */
export function openOAuthPopup({
  url,
  title,
  width = 600,
  height = 700,
  onSuccess,
  onCancel,
  onError,
  onClose,
}: OAuthPopupOptions): Window | null {
  if (typeof window === "undefined") return null;

  // Append popup=1 to preserve popup mode across OAuth initiation
  const targetUrl = new URL(url, window.location.origin);
  targetUrl.searchParams.set("popup", "1");

  const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
  const dualScreenTop = window.screenTop !== undefined ? window.screenTop : window.screenY;

  const innerWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
  const innerHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;

  const left = Math.max(0, Math.floor((innerWidth - width) / 2 + dualScreenLeft));
  const top = Math.max(0, Math.floor((innerHeight - height) / 2 + dualScreenTop));

  const windowName = (title || "vos_oauth_popup").replace(/[^a-zA-Z0-9_]/g, "_");

  let popup: Window | null = null;
  try {
    popup = window.open(
      targetUrl.toString(),
      windowName,
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no`
    );
  } catch {
    popup = null;
  }

  // Fallback if browser popup blocker blocked the window
  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    window.location.assign(url);
    return null;
  }

  if (popup.focus) {
    popup.focus();
  }

  let resolved = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const cleanup = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    window.removeEventListener("message", messageHandler);
  };

  const messageHandler = (event: MessageEvent) => {
    // Strictly enforce origin verification
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== "OAUTH_RESPONSE") return;

    resolved = true;
    cleanup();

    const { status, provider, flow, redirectUrl, error, notice, email } = event.data;

    if (status === "success") {
      onSuccess?.({ provider: provider || "", flow: flow || "", redirectUrl, notice });
    } else if (status === "cancelled") {
      onCancel?.({ provider: provider || "", flow: flow || "" });
    } else {
      onError?.({ provider: provider || "", error, email });
    }
  };

  window.addEventListener("message", messageHandler);

  // Poll for manual popup dismissal
  pollTimer = setInterval(() => {
    try {
      if (popup && popup.closed) {
        cleanup();
        if (!resolved) {
          onClose?.();
        }
      }
    } catch {
      // Cross-origin access restriction during redirection is normal
    }
  }, 500);

  return popup;
}
