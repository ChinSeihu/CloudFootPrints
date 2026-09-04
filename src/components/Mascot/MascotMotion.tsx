"use client";

import { useEffect, useId, useRef } from "react";
import { useMascotIdentity } from "./Mascot";
import styles from "./MascotMotion.module.css";

export type MascotMotionKind = "idle" | "welcome" | "success";
const PORTRAITS = {
  kumoashi: "0 0 512 512",
  "kumoashi-sakura": "512 0 512 512",
  michiru: "0 512 512 512",
  "michiru-lilac": "512 512 512 512",
} as const;

/**
 * Signature: `function MascotMotion({ animated, kind, className }: { animated?: boolean; kind?: MascotMotionKind; className?: string }): React.JSX.Element | null`
 * Purpose: Renders a stable portrait with continuous welcome motion or one-shot success feedback, never sprite-frame swapping.
 */
export function MascotMotion({ animated = false, kind = "idle", className = "h-28 w-28" }: { animated?: boolean; kind?: MascotMotionKind; className?: string }) {
  const identity = useMascotIdentity();
  const gradient = useId();
  const root = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const sync = () => {
      root.current?.setAttribute("data-paused", String(document.hidden));
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [identity]);
  if (identity === "none") return null;
  return <svg ref={root} viewBox="0 0 208 208" className={`${styles.motion} ${className}`} data-kind={kind} data-animated={animated} aria-hidden="true" focusable="false">
    <defs><radialGradient id={gradient} cx="32%" cy="25%" r="80%"><stop offset="0" stopColor="#fff" /><stop offset=".65" stopColor="#f2f4fb" /><stop offset="1" stopColor="#c8d1e5" /></radialGradient></defs>
    <g className={styles.body}>
      <svg x="12" y="8" width="184" height="184" viewBox={PORTRAITS[identity]} overflow="hidden"><image href="/brand/mascots/loading-portraits.webp" width="1024" height="1024" /></svg>
    </g>
    {kind === "welcome" && <g className={styles.hand}>
      <path d="M161 161c-7-4-13-11-14-17-1-5 4-7 7-3l5 6-2-21c0-5 5-6 7-1l2 10 1-17c1-5 6-4 6 1l1 16 3-13c2-4 7-2 6 2l-2 16 3-8c2-4 7-1 5 3l-4 18c-2 10-16 16-24 8Z" fill={`url(#${gradient})`} stroke="#c9d2e6" strokeWidth="1" />
      <path d="M161 149q8-5 13 2" fill="none" stroke="#d6dfed" strokeWidth="1.5" strokeLinecap="round" />
    </g>}
    {kind === "success" && <>
      <g className={styles.badge}><circle cx="157" cy="163" r="24" fill="#fff" /><circle cx="157" cy="163" r="20" fill="#41b99a" /><path className={styles.check} d="m148 163 6 6 12-13" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></g>
      <g className={styles.spark}><path d="m36 70 3-8 3 8 8 3-8 3-3 8-3-8-8-3Z" fill="#efc571" /><circle cx="176" cy="61" r="4" fill="#e6a0b7" /><path d="m174 91 3-5 3 5-3 5Z" fill="#9eafe1" /></g>
    </>}
  </svg>;
}
