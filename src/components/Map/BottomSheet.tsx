"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

// 可吸附底部 sheet：两档 peek（最小化，露出地图便于拖锚点）/ full（完整表单）。
//  - 打开默认 peek：只露出标题栏，地图可见 → 拖动锚点定位
//  - 上拉 → full（填表单）；从 full 下拉 → 回 peek（重新定位）；从 peek 再下拉 → 关闭
const HEADER_PX = 76; // peek 时露出的高度（抓手 + 标题）
const UP_THRESHOLD = 56; // 上拉超过则展开
const DOWN_THRESHOLD = 110; // 下拉超过则收起/关闭

export function BottomSheet({
  title,
  hint,
  onClose,
  onSnapChange,
  children,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  onSnapChange?: (snap: "peek" | "full") => void;
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
      // peek：下拖随意；上拖最多到 full 位置，不越过顶部留给抓手的空间
      const sheetH = sheetRef.current?.offsetHeight ?? 0;
      setDragY(Math.max(dy, -(sheetH - HEADER_PX)));
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

  const base = snap === "peek" ? `100% - ${HEADER_PX}px` : "0px";

  return (
    <div className="fixed inset-x-0 bottom-0 z-[999] flex justify-center pointer-events-none">
      <div
        ref={sheetRef}
        className="relative w-full sm:max-w-md h-[100dvh] flex flex-col bg-white rounded-t-2xl shadow-2xl pointer-events-auto"
        style={{
          transform: `translateY(calc(${base} + ${dragY}px))`,
          transition: dragging ? "none" : "transform 0.22s ease-out",
        }}
      >
        {/* 关闭按钮：拖动不会取消，明确关闭走这里（onPointerDown 阻止冒泡，避免触发拖动） */}
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="关闭"
          className="absolute top-2.5 right-3 z-10 w-7 h-7 grid place-items-center rounded-full text-lg leading-none text-neutral-400 hover:bg-neutral-100"
        >
          ×
        </button>

        {/* 标题栏 = 抓手 + 标题 + 提示，整块可拖动吸附 */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="shrink-0 px-5 pt-2.5 pb-3 border-b border-black/5 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="mx-auto mb-3 w-9 h-1 rounded-full bg-neutral-300" />
          <div className="flex items-center justify-between gap-2 pr-7">
            <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
            <span className="shrink-0 text-[11px] text-blue-600">
              {snap === "peek" ? "上拉填写 ›" : "下拉重新定位"}
            </span>
          </div>
          {hint && snap === "peek" && (
            <p className="text-[11px] text-neutral-400 mt-1">{hint}</p>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
