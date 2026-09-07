"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

type SortableImageListProps = {
  images: string[];
  onMove: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
  layout?: "row" | "grid";
  columns?: 3 | 4;
  addControl?: ReactNode;
  addPosition?: "start" | "end";
};

/**
 * Signature: `function moveImageItem<T>(items: T[], fromIndex: number, toIndex: number): T[]`
 * Purpose: Returns a copy with one image moved while preserving the order of every other item.
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
 * Purpose: Renders uploaded images that can be reordered by mouse drag, touch drag handle, or keyboard arrows.
 */
export function SortableImageList({
  images,
  onMove,
  onRemove,
  layout = "grid",
  columns = 3,
  addControl,
  addPosition = "end",
}: SortableImageListProps) {
  const activeIndexRef = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  /**
   * Signature: `function begin(index: number): void`
   * Purpose: Starts a reorder gesture from the selected image index.
   */
  function begin(index: number) {
    activeIndexRef.current = index;
    setDraggingIndex(index);
  }

  /**
   * Signature: `function moveTo(toIndex: number): void`
   * Purpose: Moves the active image to a newly crossed list position.
   */
  function moveTo(toIndex: number) {
    const fromIndex = activeIndexRef.current;
    if (fromIndex === null || fromIndex === toIndex) return;
    onMove(fromIndex, toIndex);
    activeIndexRef.current = toIndex;
    setDraggingIndex(toIndex);
  }

  /**
   * Signature: `function finish(): void`
   * Purpose: Clears transient reorder state when a drag gesture ends.
   */
  function finish() {
    activeIndexRef.current = null;
    setDraggingIndex(null);
  }

  /**
   * Signature: `function handleDragStart(event: DragEvent<HTMLDivElement>, index: number): void`
   * Purpose: Initializes native mouse drag metadata for an image tile.
   */
  function handleDragStart(event: DragEvent<HTMLDivElement>, index: number) {
    begin(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  /**
   * Signature: `function handlePointerDown(event: PointerEvent<HTMLButtonElement>, index: number): void`
   * Purpose: Captures a touch or pen gesture from the visible reorder handle.
   */
  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, index: number) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    begin(index);
  }

  /**
   * Signature: `function handlePointerMove(event: PointerEvent<HTMLButtonElement>): void`
   * Purpose: Reorders an image when a captured touch or pen crosses another tile.
   */
  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (activeIndexRef.current === null) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-sort-index]");
    const toIndex = Number(target?.dataset.sortIndex);
    if (Number.isInteger(toIndex)) moveTo(toIndex);
  }

  /**
   * Signature: `function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void`
   * Purpose: Supports accessible image reordering through arrows, Home, and End.
   */
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
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
    onMove(index, target);
  }

  const imageNodes = images.map((src, index) => (
    <div
      key={src}
      data-sort-index={index}
      draggable={images.length > 1}
      onDragStart={(event) => handleDragStart(event, index)}
      onDragEnter={(event) => { event.preventDefault(); moveTo(index); }}
      onDragOver={(event) => event.preventDefault()}
      onDragEnd={finish}
      className={`relative ${layout === "row" ? "h-24 w-24 shrink-0" : "aspect-square min-w-0"} transition ${draggingIndex === index ? "scale-[0.96] opacity-70 ring-2 ring-blue-400" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full rounded-xl object-cover" />
      {index === 0 && <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur">封面</span>}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-sm leading-none text-neutral-700 shadow backdrop-blur"
        aria-label={`移除第 ${index + 1} 张图片`}
      >
        ×
      </button>
      {images.length > 1 && (
        <button
          type="button"
          onPointerDown={(event) => handlePointerDown(event, index)}
          onPointerMove={handlePointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className="absolute bottom-1.5 left-1.5 grid h-7 w-7 touch-none cursor-grab place-items-center rounded-lg bg-black/60 text-sm font-bold text-white shadow-sm backdrop-blur active:cursor-grabbing"
          aria-label={`拖动第 ${index + 1} 张图片调整顺序`}
          title="拖动调整顺序"
        >
          ⠿
        </button>
      )}
    </div>
  ));

  return (
    <div>
      {images.length > 1 && <p className="mb-1.5 text-[11px] text-neutral-400">按住图片左下角拖动排序，第一张为封面</p>}
      <div className={layout === "row" ? "flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : `grid gap-2 ${columns === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {addPosition === "start" && addControl}
        {imageNodes}
        {addPosition === "end" && addControl}
      </div>
    </div>
  );
}
