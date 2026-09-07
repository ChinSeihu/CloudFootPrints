"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Lightbox } from "./Lightbox";

type SortableImageListProps = {
  images: string[];
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  layout?: "row" | "grid";
  columns?: 3 | 4;
  addControl?: ReactNode;
  addPosition?: "start" | "end";
};

type PointerSession = {
  pointerId: number;
  index: number;
  startX: number;
  startY: number;
  dragging: boolean;
  lastReorderX: number | null;
  lastReorderY: number | null;
};

const DRAG_THRESHOLD = 6;
const REORDER_HYSTERESIS = 18;

/**
 * Signature: `function moveImageItem<T>(items: T[], fromIndex: number, toIndex: number): T[]`
 * Purpose: Returns a copy with one image inserted at a new position while preserving every other item's order.
 */
export function moveImageItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Signature: `function SortableImageList({ images, onMove, onRemove, layout, columns, addControl, addPosition }: SortableImageListProps): React.JSX.Element`
 * Purpose: Renders images with whole-tile pointer insertion, animated reflow, keyboard reordering, removal, and fullscreen preview.
 */
export function SortableImageList({ images, onMove, onRemove, layout = "grid", columns = 3, addControl, addPosition = "end" }: SortableImageListProps) {
  const activeIndexRef = useRef<number | null>(null);
  const pointerSessionRef = useRef<PointerSession | null>(null);
  const tileRefs = useRef(new Map<string, HTMLDivElement>());
  const previousRectsRef = useRef(new Map<string, DOMRect>());
  const animateNextLayoutRef = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!animateNextLayoutRef.current) return;
    animateNextLayoutRef.current = false;
    for (const [src, tile] of tileRefs.current) {
      const previous = previousRectsRef.current.get(src);
      if (!previous) continue;
      const current = tile.getBoundingClientRect();
      const deltaX = previous.left - current.left;
      const deltaY = previous.top - current.top;
      if (deltaX === 0 && deltaY === 0) continue;
      tile.animate(
        [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: "translate(0, 0)" }],
        { duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
  }, [images]);

  function captureRects() {
    previousRectsRef.current = new Map([...tileRefs.current].map(([src, tile]) => [src, tile.getBoundingClientRect()]));
    animateNextLayoutRef.current = true;
  }

  function begin(index: number) {
    activeIndexRef.current = index;
    setDraggingIndex(index);
  }

  function moveTo(toIndex: number) {
    const fromIndex = activeIndexRef.current;
    if (fromIndex === null || fromIndex === toIndex) return;
    captureRects();
    onMove(fromIndex, toIndex);
    activeIndexRef.current = toIndex;
    setDraggingIndex(toIndex);
  }

  function finish() {
    activeIndexRef.current = null;
    pointerSessionRef.current = null;
    setDraggingIndex(null);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, index: number) {
    if ((event.target as HTMLElement).closest("button")) return;
    pointerSessionRef.current = {
      pointerId: event.pointerId,
      index,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      lastReorderX: null,
      lastReorderY: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const session = pointerSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.dragging && distance >= DRAG_THRESHOLD && images.length > 1) {
      session.dragging = true;
      begin(session.index);
    }
    if (!session.dragging) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sort-index]");
    const toIndex = Number(target?.dataset.sortIndex);
    if (!Number.isInteger(toIndex) || toIndex === activeIndexRef.current) return;
    if (session.lastReorderX !== null && session.lastReorderY !== null) {
      const distanceSinceReorder = Math.hypot(event.clientX - session.lastReorderX, event.clientY - session.lastReorderY);
      if (distanceSinceReorder < REORDER_HYSTERESIS) return;
    }
    moveTo(toIndex);
    session.lastReorderX = event.clientX;
    session.lastReorderY = event.clientY;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>, index: number) {
    const session = pointerSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const wasDragging = session.dragging;
    finish();
    if (!wasDragging) setPreviewIndex(index);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setPreviewIndex(index);
      return;
    }
    const target = event.key === "ArrowLeft" || event.key === "ArrowUp"
      ? index - 1
      : event.key === "ArrowRight" || event.key === "ArrowDown"
        ? index + 1
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? images.length - 1
            : index;
    if (target === index || target < 0 || target >= images.length) return;
    event.preventDefault();
    captureRects();
    onMove(index, target);
  }

  const imageNodes = images.map((src, index) => (
    <div
      key={src}
      ref={(node) => { if (node) tileRefs.current.set(src, node); else tileRefs.current.delete(src); }}
      data-sort-index={index}
      className={`relative select-none rounded-xl ${layout === "row" ? "h-24 w-24 shrink-0" : "aspect-square min-w-0"} transition-[box-shadow,opacity] ${draggingIndex === index ? "z-10 opacity-75 ring-2 ring-blue-500 shadow-lg" : ""}`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`预览第 ${index + 1} 张图片${images.length > 1 ? "，可拖动调整顺序" : ""}`}
        onPointerDown={(event) => handlePointerDown(event, index)}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => handlePointerUp(event, index)}
        onPointerCancel={finish}
        onKeyDown={(event) => handleKeyDown(event, index)}
        className={`h-full w-full overflow-hidden rounded-xl outline-none ${images.length > 1 ? "touch-none cursor-grab active:cursor-grabbing" : "cursor-zoom-in"} focus-visible:ring-2 focus-visible:ring-blue-500`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" draggable={false} className="pointer-events-none h-full w-full object-cover" />
        {index === 0 && <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur">封面</span>}
      </div>
      <button type="button" onClick={() => onRemove(index)} className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-sm leading-none text-neutral-700 shadow backdrop-blur" aria-label={`移除第 ${index + 1} 张图片`}>×</button>
    </div>
  ));

  return (
    <div>
      {images.length > 0 && <p className="mb-1.5 text-[11px] text-neutral-400">{images.length > 1 ? "直接拖动图片排序，轻点放大预览，第一张为封面" : "轻点图片放大预览"}</p>}
      <div className={layout === "row" ? "flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : `grid gap-2 ${columns === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {addPosition === "start" && addControl}
        {imageNodes}
        {addPosition === "end" && addControl}
      </div>
      {previewIndex !== null && <Lightbox images={images} index={previewIndex} onClose={() => setPreviewIndex(null)} />}
    </div>
  );
}
