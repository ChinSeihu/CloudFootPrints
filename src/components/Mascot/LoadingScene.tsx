"use client";

import { useEffect, useRef } from "react";
import { useMascotIdentity } from "./Mascot";
import styles from "./LoadingScene.module.css";

export type LoadingSceneKind = "calendar" | "discover" | "profile" | "map" | "thinking" | "upload" | "drawing" | "message";

const PORTRAITS = {
  kumoashi: "0 0 512 512",
  "kumoashi-sakura": "512 0 512 512",
  michiru: "0 512 512 512",
  "michiru-lilac": "512 512 512 512",
} as const;

/**
 * Signature: `function LoadingScene({ scene }: { scene: LoadingSceneKind }): React.JSX.Element | null`
 * Purpose: Plays continuous layered loading actions without React frame updates; respects hidden tabs, reduced motion and no-IP mode.
 */
export function LoadingScene({ scene }: { scene: LoadingSceneKind }) {
  const identity = useMascotIdentity();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const updateVisibility = () => {
      if (root.current) root.current.dataset.paused = String(document.hidden);
    };
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, [identity]);
  if (identity === "none") return null;
  return (
    <div ref={root} className={styles.scene} data-scene={scene} data-identity={identity} aria-hidden="true">
      <div className={styles.halo} />
      <div className={styles.shadow} />
      <div className={styles.character}>
        <svg viewBox={PORTRAITS[identity]} className={styles.portrait} overflow="hidden">
          <image href="/brand/mascots/loading-portraits.webp" width="1024" height="1024" />
        </svg>
      </div>
      {scene === "calendar" ? (
        <>
          <div className={styles.calendar}>
            <div className={styles.calendarBase}><span className={styles.dateMark} /></div>
            <div className={styles.turnPage}><span className={styles.pageGrid} /></div>
            <div className={styles.binding}><i /><i /></div>
          </div>
          <div className={`${styles.hand} ${styles.holdHand}`} />
          <div className={`${styles.hand} ${styles.turnHand}`} />
          <span className={styles.calendarSpark}>✦</span>
        </>
      ) : scene === "discover" ? (
        <>
          <div className={styles.cards}><i /><i /><i /></div>
          <div className={styles.searchArm}>
            <div className={styles.glass}><span /><i /></div>
            <div className={`${styles.hand} ${styles.searchHand}`} />
          </div>
          <span className={styles.discoverySpark}>✦</span>
          <span className={styles.smallSpark}>✧</span>
        </>
      ) : scene === "map" ? (
        <>
          <div className={styles.routeMap}>
            <svg viewBox="0 0 100 65"><path d="M3 42 30 24 61 40 97 16M31 3v60M64 3v60" fill="none" stroke="#d5e4dc" strokeWidth="3" /><path className={styles.routeLine} d="M16 47 36 23 63 42 84 17" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><circle cx="16" cy="47" r="5" fill="#f29aab" /><circle cx="84" cy="17" r="5" fill="#f29aab" /></svg>
          </div>
          <div className={`${styles.hand} ${styles.holdHand}`} />
          <div className={`${styles.hand} ${styles.pointHand}`} />
        </>
      ) : scene === "profile" || scene === "upload" ? (
        <>
          <div className={styles.album}><span /><i /></div>
          <div className={styles.photo}><span /></div>
          <div className={`${styles.hand} ${styles.holdHand}`} />
          <div className={`${styles.hand} ${styles.photoHand}`} />
          <span className={styles.calendarSpark}>✦</span>
          {scene === "upload" && <span className={styles.uploadArrow}>↑</span>}
        </>
      ) : scene === "message" ? (
        <>
          <div className={styles.letter}><i /><i /><i /></div>
          <div className={styles.envelope} />
          <div className={`${styles.hand} ${styles.holdHand}`} />
          <div className={`${styles.hand} ${styles.letterHand}`} />
        </>
      ) : (
        <>
          <div className={styles.notebook}><i /><i /><i /></div>
          <div className={`${styles.hand} ${styles.holdHand}`} />
          <div className={styles.writingArm}><span className={styles.pencil} /><div className={styles.hand} /></div>
          <div className={styles.thought}><i /><i /><span>✦</span></div>
          {scene === "drawing" && <div className={styles.paint}><i /><i /><i /></div>}
        </>
      )}
    </div>
  );
}
