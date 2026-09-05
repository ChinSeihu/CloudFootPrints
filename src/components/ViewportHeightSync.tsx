"use client";

import { useEffect } from "react";

/**
 * Signature: `function ViewportHeightSync(): null`
 * Purpose: Keeps the app shell aligned to the visible mobile viewport after PWA resume and system UI changes.
 */
export function ViewportHeightSync() {
  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;
    let settleTimer = 0;

    const applyHeight = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      root.style.setProperty("--app-height", `${Math.round(height)}px`);
    };
    const syncHeight = () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      frame = window.requestAnimationFrame(applyHeight);
      // Some Android standalone PWAs report the restored viewport after the first frame.
      settleTimer = window.setTimeout(applyHeight, 250);
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === "visible") syncHeight();
    };

    syncHeight();
    window.addEventListener("resize", syncHeight, { passive: true });
    window.addEventListener("pageshow", syncHeight, { passive: true });
    window.visualViewport?.addEventListener("resize", syncHeight, { passive: true });
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", syncHeight);
      window.removeEventListener("pageshow", syncHeight);
      window.visualViewport?.removeEventListener("resize", syncHeight);
      document.removeEventListener("visibilitychange", syncWhenVisible);
      root.style.removeProperty("--app-height");
    };
  }, []);

  return null;
}
