"use client";

import { IconPlus } from "@/components/icons";

// 浮动操作按钮（FAB）：打卡/发帖是"动作"，不是第四个 tab。
export function CheckInFab({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="在地图上落锚点打卡"
      className="absolute bottom-5 right-5 z-10 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:scale-95 transition"
    >
      <IconPlus className="w-7 h-7" />
    </button>
  );
}
