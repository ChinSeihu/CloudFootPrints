"use client";

import { useState } from "react";
import { IconPin, IconPlus, CategoryIcon } from "@/components/icons";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { BottomSheet } from "./BottomSheet";
import { fieldCls, labelCls } from "./formStyles";

export type PostDraft = {
  lat: number;
  lng: number;
  title: string;
  category: EventCategory;
  description: string;
  venueName: string;
  imageUrl: string | null;
  startTime: string | null; // ISO
  endTime: string | null; // ISO
};

type Props = {
  lat: number;
  lng: number;
  onCancel: () => void;
  onSubmit: (draft: PostDraft) => Promise<void>;
  onSnapChange?: (snap: "peek" | "full") => void;
};

const toISO = (local: string): string | null => (local ? new Date(local).toISOString() : null);

// 锚点发帖："这里有个活动"——在地图上标记并发布一个活动（sourceType=USER）。
export function PostDialog({ lat, lng, onCancel, onSubmit, onSnapChange }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("OTHER");
  const [description, setDescription] = useState("");
  const [venueName, setVenueName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"" | "uploading">("");
  const [error, setError] = useState<string | null>(null);

  const canUpload = cloudinaryConfigured();

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  function removeImage() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    if (start && end && new Date(end) < new Date(start)) {
      setError("结束时间不能早于开始时间");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      let imageUrl: string | null = null;
      if (file) {
        setPhase("uploading");
        try {
          const blob = await compressImage(file);
          imageUrl = await uploadToCloudinary(blob);
        } catch (err) {
          setError((err as Error).message || "图片上传失败");
          return;
        } finally {
          setPhase("");
        }
      }
      await onSubmit({
        lat,
        lng,
        title,
        category,
        description,
        venueName,
        imageUrl,
        startTime: toISO(start),
        endTime: toISO(end),
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet title="发帖 · 标记这里有个活动" hint="拖动地图上的蓝色锚点定位" onClose={onCancel} onSnapChange={onSnapChange}>
      <div className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-100 rounded-full px-2.5 py-1 mb-5">
        <IconPin className="w-3 h-3" />
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </div>

      <div className="mb-5">
        <label className={labelCls}>活动名称 <span className="text-red-400">*</span></label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldCls}
          placeholder="例如：下北沢古着市集"
        />
      </div>

      <div className="mb-5">
        <label className={labelCls}>分类</label>
        <div className="flex flex-wrap gap-2">
          {EVENT_CATEGORIES.map((c) => {
            const active = c === category;
            const meta = CATEGORY_META[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${
                  active
                    ? "text-white border-transparent shadow-sm"
                    : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300"
                }`}
                style={active ? { backgroundColor: meta.color } : undefined}
              >
                <CategoryIcon category={c} className="w-4 h-4" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-5">
        <label className={labelCls}>时间范围</label>
        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={`${fieldCls} flex-1 min-w-0`}
          />
          <span className="text-neutral-400 text-xs shrink-0">至</span>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className={`${fieldCls} flex-1 min-w-0`}
          />
        </div>
      </div>

      {/* 图片（可选，客户端压缩后上传图床） */}
      <div className="mb-5">
        <label className={labelCls}>图片（可选）</label>
        {canUpload ? (
          preview ? (
            <div className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="w-full max-h-48 object-cover rounded-xl" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white text-base leading-none flex items-center justify-center backdrop-blur"
                aria-label="移除图片"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 h-28 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-400 cursor-pointer transition hover:border-blue-400 hover:text-blue-500">
              <IconPlus className="w-6 h-6" />
              <span className="text-xs">选择图片</span>
              <input type="file" accept="image/*" onChange={pickFile} className="hidden" />
            </label>
          )
        ) : (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            未配置图床（NEXT_PUBLIC_CLOUDINARY_*），暂不能上传图片。
          </p>
        )}
      </div>

      <div className="mb-5">
        <label className={labelCls}>地点名（可选）</label>
        <input
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          className={fieldCls}
          placeholder="场馆 / 地点名"
        />
      </div>

      <div className="mb-5">
        <label className={labelCls}>说明（可选）</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${fieldCls} resize-none`}
          placeholder="内容、票价…"
        />
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-5 py-3 text-sm rounded-xl text-neutral-500 hover:bg-neutral-100 transition"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !title.trim()}
          className="flex-1 py-3 text-sm font-medium rounded-xl bg-blue-600 text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40"
        >
          {phase === "uploading" ? "上传图片…" : submitting ? "发布中…" : "发布活动"}
        </button>
      </div>
    </BottomSheet>
  );
}
