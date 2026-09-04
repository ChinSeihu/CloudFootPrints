"use client";

import { useEffect, useState } from "react";
import { LoadingScene, type LoadingSceneKind } from "./Mascot/LoadingScene";

const DOTS = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed"]; // 展览/市集/Live/祭典/讲座

/**
 * Signature: `function PageLoading({ text, scene }: { text?: string; scene?: LoadingSceneKind }): React.JSX.Element`
 * Purpose: Delays route feedback to avoid flashes, showing a scene-specific IP action while preserving navigation outside the page.
 */
export function PageLoading({ text = "正在加载…", scene }: { text?: string; scene?: LoadingSceneKind }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className="h-full min-h-64 flex flex-col items-center justify-center gap-3" role="status" aria-busy="true">
      {visible && <>
      {scene ? <LoadingScene scene={scene} /> : <div aria-hidden="true" className="flex items-end gap-1.5">
        {DOTS.map((c, i) => (
          <span
            key={i}
            className="w-2.5 h-2.5 rounded-full motion-safe:animate-bounce"
            style={{ backgroundColor: c, animationDelay: `${i * 0.12}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>}
      <p className="text-sm text-neutral-500">{text}</p>
      </>}
    </div>
  );
}
