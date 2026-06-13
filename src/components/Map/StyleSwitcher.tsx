"use client";

import type { MapTheme } from "@/lib/mapTheme";

type Props = {
  value: MapTheme;
  onChange: (t: MapTheme) => void;
};

// 底图风格切换：标准（Positron）/ 柔和（马卡龙水彩）。左下角小控件。
export function StyleSwitcher({ value, onChange }: Props) {
  return (
    <div className="absolute bottom-24 left-3 z-10 pointer-events-auto">
      <div className="inline-flex rounded-full bg-white/95 backdrop-blur shadow-sm border border-black/10 overflow-hidden text-xs">
        {(["standard", "soft"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={`px-3 py-1.5 transition ${
              value === t ? "bg-blue-600 text-white" : "text-neutral-600"
            }`}
          >
            {t === "standard" ? "标准" : "柔和"}
          </button>
        ))}
      </div>
    </div>
  );
}
