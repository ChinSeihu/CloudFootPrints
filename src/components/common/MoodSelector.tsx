"use client";

import { MOOD_TAGS } from "@/lib/moods";

export function MoodSelector({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {MOOD_TAGS.map(({ value: moodValue, label, tone, Icon }) => {
        const active = value === moodValue;
        return (
          <button
            key={moodValue}
            type="button"
            onClick={() => onChange(active ? null : moodValue)}
            className={`min-h-10 rounded-xl border px-3 py-2 inline-flex items-center gap-2 text-sm transition ${
              active ? `${tone} ring-2 ring-blue-500/20` : "border-neutral-200 bg-white text-neutral-500 hover:border-blue-200 hover:bg-blue-50/40"
            }`}
            aria-pressed={active}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

