"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

// 可吸附底部 sheet：两档 half（默认半屏）/ full（完整表单）。
//  - 打开默认 half：表单和地图都可见，锚点仍可调整
//  - 上拉 → full；从 full 下拉 → 回 half
const UP_THRESHOLD = 56; // 上拉超过则展开
const DOWN_THRESHOLD = 110; // 下拉超过则收起/关闭

/**
 * Signature: `function BottomSheet(props: { title: string; hint?: string; onClose: () => void; onSnapChange?: (snap: "peek" | "full") => void; busy?: ReactNode; footer?: ReactNode; children: ReactNode }): React.JSX.Element`
 * Purpose: Hosts map publishing forms in a draggable sheet with an optional fixed action footer.
 */
export function BottomSheet({
  title,
  hint,
  onClose,
  onSnapChange,
  busy,
  footer,
  children,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  onSnapChange?: (snap: "peek" | "full") => void;
  busy?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const [snap, setSnap] = useState<"peek" | "full">("peek");
  useEffect(() => { onSnapChange?.(snap); }, [snap, onSnapChange]);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  function onPointerDown(e: PointerEvent) {
    startYRef.current = e.clientY;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;
    if (snap === "full") {
      setDragY(Math.max(0, dy)); // full 只能往下拖（回 peek）
    } else {
      // half：上拖展开；下拖回弹。
      setDragY(dy);
    }
  }
  function onPointerUp() {
    if (startYRef.current == null) return;
    const dy = dragY;
    startYRef.current = null;
    setDragging(false);
    setDragY(0);
    // 拖动只在两档间切换，绝不因下拉直接取消（避免误拖丢失已填表单）。
    //  - full 下拉 → peek（回到地图重新定位，表单内容保留）
    //  - peek 上拉 → full（继续填写）；peek 下拉 → 回弹保持（关闭请用右上角 ×）
    if (snap === "full") {
      if (dy > DOWN_THRESHOLD) setSnap("peek");
    } else if (dy < -UP_THRESHOLD) {
      setSnap("full");
    }
  }

  const sheetHeight = snap === "peek" ? "56dvh" : "calc(100dvh - 4.5rem - env(safe-area-inset-bottom))";

  return (
    <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[999] flex justify-center pointer-events-none">
      <div
        ref={sheetRef}
        aria-busy={!!busy}
        className="relative flex w-full flex-col rounded-t-3xl bg-white shadow-[0_-14px_45px_rgba(15,23,42,0.16)] pointer-events-auto sm:max-w-md"
        style={{
          height: sheetHeight,
          transform: dragY > 0 || snap === "peek" ? `translateY(${Math.max(0, dragY)}px)` : `translateY(${dragY}px)`,
          transition: dragging ? "none" : "height 0.22s ease-out, transform 0.22s ease-out",
        }}
      >
        {/* 关闭按钮：拖动不会取消，明确关闭走这里（onPointerDown 阻止冒泡，避免触发拖动） */}
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="关闭"
          className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-neutral-100 text-xl leading-none text-neutral-500 hover:bg-neutral-200"
        >
          ×
        </button>

        {/* 标题栏 = 抓手 + 标题 + 提示，整块可拖动吸附 */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="shrink-0 cursor-grab select-none px-4 pb-2.5 pt-3 touch-none active:cursor-grabbing"
        >
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-neutral-300" />
          <div className="flex items-start justify-between gap-3 pr-9">
            <div>
              <h2 className="text-lg font-bold tracking-normal text-neutral-950">{title}</h2>
              {hint && <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500">{hint}</p>}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>

        {footer && <div className="shrink-0 border-t border-neutral-100 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5">{footer}</div>}

        {busy && (
          <div className="absolute inset-0 z-20 grid place-items-center rounded-t-3xl bg-white/80 px-6 backdrop-blur-sm">
            <div className="w-full max-w-xs rounded-3xl border border-white bg-white px-5 py-3 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
              {busy}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
