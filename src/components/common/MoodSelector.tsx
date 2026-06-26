"use client";

import { useMemo, useState } from "react";
import { MOOD_TAGS } from "@/lib/moods";

export function MoodSelector({
  value,
  onChange,
}: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedValues = value.slice(0, 6);
  const visibleMoods = useMemo(() => {
    if (expanded) return MOOD_TAGS;
    const selected = MOOD_TAGS.filter((mood) => selectedValues.includes(mood.value));
    const base = MOOD_TAGS.slice(0, 3);
    const merged = [...selected, ...base.filter((mood) => !selectedValues.includes(mood.value))];
    return merged.slice(0, 3);
  }, [expanded, selectedValues]);

  function toggle(moodValue: number) {
    if (selectedValues.includes(moodValue)) {
      onChange(selectedValues.filter((item) => item !== moodValue));
      return;
    }
    if (selectedValues.length >= 6) return;
    onChange([...selectedValues, moodValue]);
  }

  return (
    <div className="space-y-2">
      <div className={`grid gap-2 ${expanded ? "grid-cols-2" : "grid-cols-3"}`}>
        {visibleMoods.map(({ value: moodValue, label, subLabel, tone, Icon }) => {
          const active = selectedValues.includes(moodValue);
          return (
            <button
              key={moodValue}
              type="button"
              onClick={() => toggle(moodValue)}
              className={`relative min-h-[74px] rounded-xl border bg-white px-2.5 py-2 text-left transition ${
                active ? `${tone} ring-2 ring-blue-500/20` : "border-neutral-200 text-neutral-600 hover:border-blue-200 hover:bg-blue-50/30"
              }`}
              aria-pressed={active}
            >
              <span className={`absolute left-2 top-2 grid h-5 min-w-5 place-items-center rounded-lg px-1 text-[11px] font-semibold ${active ? "bg-white/70" : "bg-neutral-100 text-neutral-500"}`}>
                {moodValue}
              </span>
              <span className="flex h-full flex-col items-center justify-center gap-1 pt-2">
                <Icon className="h-6 w-6" />
                <span className="text-[13px] font-semibold leading-none text-neutral-900">{label}</span>
                <span className="max-w-full truncate text-[10px] text-neutral-500">{subLabel}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full rounded-xl border border-dashed border-neutral-200 bg-neutral-50/70 py-2 text-xs font-medium text-neutral-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
        aria-expanded={expanded}
      >
        {expanded ? "收起心情" : `更多心情（${MOOD_TAGS.length - 3}）`}
      </button>
      {selectedValues.length > 0 && <p className="text-[11px] text-neutral-400">已选择 {selectedValues.length}/6，可多选</p>}
    </div>
  );
}
