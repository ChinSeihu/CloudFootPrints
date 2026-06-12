"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

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
  children,
}: {
  title: string;
  hint?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const [snap, setSnap] = useState<"peek" | "full">("peek");
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef<number | null>(null);

  function onPointerDown(e: PointerEvent) {
    startYRef.current = e.clientY;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (startYRef.current == null) return;
    const dy = e.clientY - startYRef.current;
    // full 时不允许拖到 0 以上（往上拉无意义）；peek 时上下都可
    setDragY(snap === "full" ? Math.max(0, dy) : dy);
  }
  function onPointerUp() {
    if (startYRef.current == null) return;
    const dy = dragY;
    startYRef.current = null;
    setDragging(false);
    setDragY(0);
    if (snap === "full") {
      if (dy > DOWN_THRESHOLD) setSnap("peek");
    } else {
      if (dy < -UP_THRESHOLD) setSnap("full");
      else if (dy > DOWN_THRESHOLD) onClose();
    }
  }

  const base = snap === "peek" ? `100% - ${HEADER_PX}px` : "0px";

  return (
    <div className="absolute inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none">
      <div
        className="w-full sm:max-w-md max-h-[82%] flex flex-col bg-white rounded-t-2xl shadow-2xl pointer-events-auto"
        style={{
          transform: `translateY(calc(${base} + ${dragY}px))`,
          transition: dragging ? "none" : "transform 0.22s ease-out",
        }}
      >
        {/* 标题栏 = 抓手 + 标题 + 提示，整块可拖动吸附 */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="shrink-0 px-5 pt-2 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="mx-auto mb-2 w-10 h-1.5 rounded-full bg-neutral-300" />
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            <span className="text-[11px] text-blue-600 shrink-0">
              {snap === "peek" ? "上拉填写 ›" : "下拉重新定位"}
            </span>
          </div>
          {hint && snap === "peek" && (
            <p className="text-[11px] text-neutral-500 mt-0.5">{hint}</p>
          )}
        </div>

        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
