"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { useMascotIdentity } from "./Mascot";

/**
 * Signature: `function MascotAnimation({ animated, className }: { animated?: boolean; className?: string }): React.JSX.Element | null`
 * Purpose: Plays full-body character frames, pausing for hidden tabs and reduced motion; no-IP mode renders nothing.
 */
export function MascotAnimation({ animated = false, className = "h-28 w-28" }: { animated?: boolean; className?: string }) {
  const identity = useMascotIdentity();
  const clip = useId();
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!animated || identity === "none") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (media.matches || document.hidden) return;
      setFrame((value) => (value + 1) % 12);
    }, 140);
    return () => window.clearInterval(timer);
  }, [animated, identity]);
  if (identity === "none") return null;
  // Hold the neutral pose between waves; each atlas has two rows and four columns.
  const index = animated ? [0, 0, 1, 2, 3, 4, 5, 6, 7, 7, 7, 0][frame] : 0;
  const x = (index % 4) * 443.5;
  const split = identity === "kumoashi" ? 455 : 460;
  const y = index < 4 ? 0 : split;
  const height = index < 4 ? split : 887 - split;
  return (
    <svg aria-hidden="true" className={`block shrink-0 ${className}`} viewBox={`${x} ${y} 443.5 ${height}`} preserveAspectRatio="xMidYMid meet">
      <defs><clipPath id={clip}><rect x={x} y={y} width="443.5" height={height} /></clipPath></defs>
      <image href={`/brand/mascots/loading-${identity}.png`} width="1774" height="887" clipPath={`url(#${clip})`} />
    </svg>
  );
}

/**
 * Signature: `function MascotFeedback({ children, loading }: { children: ReactNode; loading?: boolean }): React.JSX.Element`
 * Purpose: Adds optional full-body companionship without replacing feedback text or actions.
 */
export function MascotFeedback({ children, loading = false }: { children: ReactNode; loading?: boolean }) {
  return <div className="flex flex-col items-center gap-2 py-4 text-center" role={loading ? "status" : undefined}>
    <MascotAnimation animated={loading} />
    <div className="text-sm text-neutral-500">{children}</div>
  </div>;
}

/**
 * Signature: `function NavigationFeedback(): React.JSX.Element | null`
 * Purpose: Delays route-loading feedback to avoid flashes during fast navigation.
 */
export function NavigationFeedback() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return <div className="grid min-h-64 flex-1 place-items-center"><MascotFeedback loading>正在打开页面…</MascotFeedback></div>;
}
