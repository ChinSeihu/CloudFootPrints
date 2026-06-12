"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";

const DISMISS_THRESHOLD = 120; // 下滑超过该距离则关闭

// 共用底部 sheet：不遮挡地图（便于在上方拖动锚点）+ 顶部抓手可下滑隐藏。
export function BottomSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
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
    setDragY(Math.max(0, e.clientY - startYRef.current));
  }
  function onPointerUp() {
    if (startYRef.current == null) return;
    startYRef.current = null;
    setDragging(false);
    if (dragY > DISMISS_THRESHOLD) onClose();
    else setDragY(0);
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-99 flex justify-center pointer-events-none">
      <div
        className="w-full sm:max-w-md max-h-[82%] flex flex-col bg-white rounded-t-2xl shadow-2xl pointer-events-auto"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 0.2s ease-out",
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="flex shrink-0 flex-col items-center pt-2 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-10 h-1.5 rounded-full bg-neutral-300" />
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}
