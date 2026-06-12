"use client";

import { useState } from "react";
import { IconStar, IconPin } from "@/components/icons";
import { BottomSheet } from "./BottomSheet";

export type CheckInDraft = {
  lat: number;
  lng: number;
  note: string;
  rating: number | null;
  photoUrl: string;
  visitedAt: string | null; // ISO；用户可选打卡时间，默认现在
  eventId?: string | null;
};

const toISO = (local: string): string | null => (local ? new Date(local).toISOString() : null);

type Props = {
  lat: number;
  lng: number;
  eventId?: string | null;
  onCancel: () => void;
  onSubmit: (draft: CheckInDraft) => Promise<void>;
};

// 打卡："我来过这里"（个人足迹，门槛低：文字/评分/照片）。
// TODO(v1.5): 支持本地照片上传到 public/uploads。
export function CheckInDialog({ lat, lng, eventId, onCancel, onSubmit }: Props) {
  const [note, setNote] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [visitedAt, setVisitedAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit({
        lat,
        lng,
        note,
        rating,
        photoUrl,
        visitedAt: toISO(visitedAt),
        eventId: eventId ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet title="打卡 · 我来过" hint="拖动地图上的蓝色锚点定位" onClose={onCancel}>
      <p className="flex items-center gap-1 text-xs text-neutral-500 mb-4">
        <IconPin className="w-3.5 h-3.5" />
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>

      <label className="block text-sm mb-1">时间</label>
      <input
        type="datetime-local"
        value={visitedAt}
        onChange={(e) => setVisitedAt(e.target.value)}
        className="w-full border border-neutral-300 rounded-lg p-2 text-sm mb-4"
      />

      <label className="block text-sm mb-1">想说点什么</label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className="w-full border border-neutral-300 rounded-lg p-2 text-sm mb-4"
        placeholder="这家展览的灯光很好…"
      />

      <label className="block text-sm mb-1">评分</label>
      <div className="flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n === rating ? null : n)}
            className={rating && n <= rating ? "text-amber-500" : "text-neutral-300"}
            aria-label={`${n} 星`}
          >
            <IconStar filled={!!rating && n <= rating} className="w-6 h-6" />
          </button>
        ))}
      </div>

      <label className="block text-sm mb-1">照片链接（可选）</label>
      <input
        value={photoUrl}
        onChange={(e) => setPhotoUrl(e.target.value)}
        className="w-full border border-neutral-300 rounded-lg p-2 text-sm mb-5"
        placeholder="https://…"
      />

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm rounded-lg text-neutral-600"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          {submitting ? "保存中…" : "打卡"}
        </button>
      </div>
    </BottomSheet>
  );
}
