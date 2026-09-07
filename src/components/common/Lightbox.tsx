"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Signature: `function Lightbox({ images, index, onClose }: { images: string[]; index?: number; onClose: () => void }): React.JSX.Element | null`
 * Purpose: Renders a viewport-level image gallery with backdrop close, buttons, and keyboard navigation.
 */
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

  if (n === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2200] flex items-center justify-center bg-black/90 px-4 py-16 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭图片预览"
        className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-white/15 text-2xl leading-none text-white backdrop-blur transition hover:bg-white/25"
      >
        ×
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={images[i]}
        alt={`预览图片 ${i + 1}`}
        draggable={false}
        className="max-h-full max-w-full select-none object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {n > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setI((v) => (v - 1 + n) % n); }}
            aria-label="上一张图片"
            className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-3xl text-white backdrop-blur transition hover:bg-white/25"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setI((v) => (v + 1) % n); }}
            aria-label="下一张图片"
            className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-3xl text-white backdrop-blur transition hover:bg-white/25"
          >
            ›
          </button>
          <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white/90">
            {i + 1} / {n}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
