"use client";

import { useState } from "react";
import { IconPlus, IconHeart, IconPin } from "@/components/icons";

// 浮动操作按钮（FAB）：点开有两个动作——打卡 / 发帖。
//  - 打卡：我来过这里（个人足迹）
//  - 发帖：标记这里有个活动（发布到地图，sourceType=USER）
export function ActionFab({
  onCheckin,
  onPost,
}: {
  onCheckin: () => void;
  onPost: () => void;
}) {
  const [open, setOpen] = useState(false);

  function choose(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="absolute bottom-5 right-5 z-30 flex flex-col items-end gap-2">
      {open && (
        <>
          <button
            type="button"
            onClick={() => choose(onPost)}
            className="flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-white text-neutral-800 text-sm shadow-lg border border-black/5"
          >
            <IconPin className="w-4 h-4 text-blue-600" />
            发帖 · 标记活动
          </button>
          <button
            type="button"
            onClick={() => choose(onCheckin)}
            className="flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-white text-neutral-800 text-sm shadow-lg border border-black/5"
          >
            <IconHeart className="w-4 h-4 text-rose-500" />
            足迹 · 我来过
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="记录足迹或发帖"
        className="h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition"
      >
        <IconPlus className={`w-7 h-7 transition-transform ${open ? "rotate-45" : ""}`} />
      </button>
    </div>
  );
}
