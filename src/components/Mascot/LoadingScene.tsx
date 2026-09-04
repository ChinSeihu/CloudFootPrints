"use client";

import { useEffect, useRef } from "react";
import { useMascotIdentity } from "./Mascot";
import styles from "./LoadingScene.module.css";

export type LoadingSceneKind = "calendar" | "discover";

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
      ) : (
        <>
          <div className={styles.cards}><i /><i /><i /></div>
          <div className={styles.searchArm}>
            <div className={styles.glass}><span /><i /></div>
            <div className={`${styles.hand} ${styles.searchHand}`} />
          </div>
          <span className={styles.discoverySpark}>✦</span>
          <span className={styles.smallSpark}>✧</span>
        </>
      )}
    </div>
  );
}
