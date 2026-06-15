"use client";

import { useEffect, useState } from "react";

// 图片放大查看：全屏黑底，点背景/×关闭；多图时左右切换。
export function Lightbox({
  images,
  index = 0,
  onClose,
}: {
  images: string[];
  index?: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  const n = images.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => (v + 1) % n);
      if (e.key === "ArrowLeft") setI((v) => (v - 1 + n) % n);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [n, onClose]);

  if (n === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭"
        className="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-full bg-white/10 text-white text-2xl leading-none"
      >
        ×
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[i]}
        alt=""
        className="max-w-[94vw] max-h-[88vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
      />

      {n > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setI((v) => (v - 1 + n) % n); }}
            aria-label="上一张"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/10 text-white text-2xl"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setI((v) => (v + 1) % n); }}
            aria-label="下一张"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 grid place-items-center rounded-full bg-white/10 text-white text-2xl"
          >
            ›
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-xs bg-white/10 rounded-full px-3 py-1">
            {i + 1} / {n}
          </div>
        </>
      )}
    </div>
  );
}
