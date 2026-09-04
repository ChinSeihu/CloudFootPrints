"use client";

import { useEffect, useState } from "react";
import { LoadingScene, type LoadingSceneKind } from "./LoadingScene";
import { useMascotIdentity } from "./Mascot";
import styles from "./LoadingScene.module.css";

/**
 * Signature: `function LoadingFeedback({ scene, text, compact }: { scene: LoadingSceneKind; text: string; compact?: boolean }): React.JSX.Element`
 * Purpose: Provides delayed, accessible section loading feedback with a compact scene and an honest long-wait message.
 */
export function LoadingFeedback({ scene, text, compact = false }: { scene: LoadingSceneKind; text: string; compact?: boolean }) {
  const identity = useMascotIdentity();
  const [visible, setVisible] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const show = window.setTimeout(() => setVisible(true), 250);
    const notice = window.setTimeout(() => setSlow(true), 12000);
    return () => { window.clearTimeout(show); window.clearTimeout(notice); };
  }, []);
  return <div role="status" aria-busy="true" className={compact ? "flex min-h-16 items-center gap-2 py-2" : "flex min-h-64 flex-col items-center justify-center gap-2 py-4"}>
    {visible && <>
      {identity !== "none" && <div className={compact ? styles.compact : undefined}><LoadingScene scene={scene} /></div>}
      <div className="min-w-0 text-sm text-neutral-500"><p>{text}</p>{slow && <p className="mt-1 text-xs text-neutral-400">这次稍慢一些，还在等待结果…</p>}</div>
    </>}
  </div>;
}
