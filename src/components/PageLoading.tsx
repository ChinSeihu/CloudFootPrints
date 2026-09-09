"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { LoadingScene, type LoadingSceneKind } from "./Mascot/LoadingScene";

const DOTS = ["#2563eb", "#16a34a", "#db2777", "#ea580c", "#7c3aed"]; // 展览/市集/Live/祭典/讲座

/**
 * Signature: `function PageLoading({ text, scene, variant }: { text?: string; scene?: LoadingSceneKind; variant?: "default" | "splash" }): React.JSX.Element`
 * Purpose: Delays route feedback to avoid flashes, with an optional minimal logo-like brand splash for the initial app load.
 */
export function PageLoading({ text = "正在加载…", scene, variant = "default" }: { text?: string; scene?: LoadingSceneKind; variant?: "default" | "splash" }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  if (variant === "splash") {
    return (
      <div className="fixed inset-0 z-[2000] grid place-items-center overflow-hidden bg-[#fbfaff] text-[#282447]" role="status" aria-busy="true">
        <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_44%,rgba(232,228,255,.72),transparent_28%)]" />
        <div className={`relative flex flex-col items-center transition-all duration-700 ease-out ${visible ? "scale-100 opacity-100" : "scale-[.96] opacity-0"}`}>
          <Image src="/brand-mark.svg" alt="" width={128} height={128} priority className="h-28 w-28 drop-shadow-[0_18px_32px_rgba(86,70,180,.22)] md:h-32 md:w-32" />
          <h1 className="mt-7 text-[2rem] font-semibold tracking-[.16em] text-[#302c49] md:text-[2.25rem]">云迹东京</h1>
          <p className="mt-2 text-xs tracking-[.28em] text-[#9690aa] md:text-sm">发现 · 出发 · 留下足迹</p>
          <div aria-label={text} className="mt-9 flex items-center gap-2">
            {[0, 1, 2].map((index) => (
              <span key={index} className="h-1.5 w-1.5 rounded-full bg-[#7b6dde] motion-safe:animate-pulse" style={{ animationDelay: `${index * 180}ms` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

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
