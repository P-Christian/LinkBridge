// src/modules/vos-admin/hooks/useFullscreen.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fullscreen for one element + screen Wake Lock while it is open.
 * Browsers only allow fullscreen from a user gesture (click / key press), so a
 * kiosk TV should either press F once or launch Chrome with `--kiosk`.
 */
export function useFullscreen<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && !wakeLock.current) {
        wakeLock.current = await navigator.wakeLock.request('screen');
        wakeLock.current.addEventListener('release', () => {
          wakeLock.current = null;
        });
      }
    } catch {
      /* not allowed (battery saver, insecure origin…) – the map still works */
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLock.current?.release();
    } catch {
      /* already released */
    }
    wakeLock.current = null;
  }, []);

  useEffect(() => {
    const onChange = () => {
      const active = document.fullscreenElement != null;
      setIsFullscreen(active);
      if (active) void requestWakeLock();
      else void releaseWakeLock();
    };
    // The browser drops the lock when the tab is hidden; take it again when visible.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && document.fullscreenElement) void requestWakeLock();
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('visibilitychange', onVisible);
      void releaseWakeLock();
    };
  }, [requestWakeLock, releaseWakeLock]);

  const enter = useCallback(async () => {
    try {
      await ref.current?.requestFullscreen?.();
    } catch {
      /* denied – ignore */
    }
  }, []);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => (document.fullscreenElement ? exit() : enter()), [enter, exit]);

  return { ref, isFullscreen, enter, exit, toggle };
}

