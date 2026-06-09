"use client";

import { useState } from "react";
import { IconPin, CategoryIcon } from "@/components/icons";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { BottomSheet } from "./BottomSheet";

export type PostDraft = {
  lat: number;
  lng: number;
  title: string;
  category: EventCategory;
  description: string;
  venueName: string;
};

type Props = {
  lat: number;
  lng: number;
  onCancel: () => void;
  onSubmit: (draft: PostDraft) => Promise<void>;
};

// 锚点发帖："这里有个活动"——在地图上标记并发布一个活动（sourceType=USER）。
export function PostDialog({ lat, lng, onCancel, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("OTHER");
  const [description, setDescription] = useState("");
  const [venueName, setVenueName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({ lat, lng, title, category, description, venueName });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet onClose={onCancel}>
      <h2 className="text-lg font-semibold mb-1">发帖 · 标记这里有个活动</h2>
      <p className="flex items-center gap-1 text-xs text-neutral-500 mb-1">
        <IconPin className="w-3.5 h-3.5" />
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
      <p className="text-[11px] text-blue-600 mb-4">拖动地图上的锚点可微调位置 · 下滑收起</p>

      <label className="block text-sm mb-1">活动名称 *</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border border-neutral-300 rounded-lg p-2 text-sm mb-4"
        placeholder="例如：下北沢古着市集"
      />

      <label className="block text-sm mb-1">分类</label>
      <div className="flex flex-wrap gap-1.5 mb-4">
        {EVENT_CATEGORIES.map((c) => {
          const active = c === category;
          const meta = CATEGORY_META[c];
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border transition ${
                active ? "text-white border-transparent" : "bg-white text-neutral-500 border-neutral-300"
              }`}
              style={active ? { backgroundColor: meta.color } : undefined}
            >
              <CategoryIcon category={c} className="w-3.5 h-3.5" />
              {meta.label}
            </button>
          );
        })}
      </div>

      <label className="block text-sm mb-1">地点名（可选）</label>
      <input
        value={venueName}
        onChange={(e) => setVenueName(e.target.value)}
        className="w-full border border-neutral-300 rounded-lg p-2 text-sm mb-4"
        placeholder="场馆 / 地点名"
      />

      <label className="block text-sm mb-1">说明（可选）</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className="w-full border border-neutral-300 rounded-lg p-2 text-sm mb-5"
        placeholder="时间、内容、票价…"
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
          disabled={submitting || !title.trim()}
          className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-50"
        >
          {submitting ? "发布中…" : "发布"}
        </button>
      </div>
    </BottomSheet>
  );
}
