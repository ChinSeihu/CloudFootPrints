"use client";

import type { MapTheme } from "@/lib/mapTheme";
import { useLanguage } from "@/components/I18n/LanguageProvider";

type Props = {
  value: MapTheme;
  onChange: (t: MapTheme) => void;
};

// 底图风格切换：标准（Positron）/ 柔和（马卡龙水彩）。由父级定位。
export function StyleSwitcher({ value, onChange }: Props) {
  const { t: translate } = useLanguage();
  return (
    <div className="pointer-events-auto">
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
            {translate(t === "standard" ? "map.standard" : "map.soft")}
          </button>
        ))}
      </div>
    </div>
  );
}
