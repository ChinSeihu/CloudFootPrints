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
      <div className="grid grid-cols-3 gap-2">
        {visibleMoods.map(({ value: moodValue, label, tone, Icon }) => {
          const active = selectedValues.includes(moodValue);
          return (
            <button
              key={moodValue}
              type="button"
              onClick={() => toggle(moodValue)}
              className={`min-h-9 rounded-full border px-2.5 py-1.5 inline-flex items-center justify-center gap-1.5 text-[12px] font-medium transition ${
                active ? `${tone} shadow-sm ring-1 ring-current/10` : "border-neutral-200 bg-white text-neutral-500 hover:border-blue-200 hover:bg-blue-50/40"
              }`}
              aria-pressed={active}
              title={label}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{label}</span>
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
