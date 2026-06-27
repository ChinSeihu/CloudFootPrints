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
        <div className="mb-1 grid w-64 grid-cols-2 gap-2 rounded-2xl border border-white/80 bg-white/95 p-2 shadow-[0_14px_34px_rgba(15,23,42,0.16)] backdrop-blur">
          <button
            type="button"
            onClick={() => choose(onPost)}
            className="flex flex-col items-center gap-1 rounded-xl bg-blue-50 px-3 py-3 text-sm font-semibold text-blue-700 transition active:scale-[0.98]"
          >
            <IconPin className="w-5 h-5" />
            发布活动
          </button>
          <button
            type="button"
            onClick={() => choose(onCheckin)}
            className="flex flex-col items-center gap-1 rounded-xl bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-600 transition active:scale-[0.98]"
          >
            <IconHeart className="w-5 h-5" />
            发布足迹
          </button>
        </div>
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
