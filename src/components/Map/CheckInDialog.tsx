"use client";

import { useState } from "react";
import { IconHeart, IconPin, IconPlus } from "@/components/icons";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { BottomSheet } from "./BottomSheet";
import { DateTimeField } from "@/components/common/DateTimeField";
import { fieldCls, labelCls } from "./formStyles";

export type CheckInDraft = {
  lat: number;
  lng: number;
  note: string;
  rating: number | null;
  photoUrls: string[];
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
  onSnapChange?: (snap: "peek" | "full") => void;
};

// 打卡："我来过这里"（个人足迹：时间 / 文字 / 评分 / 图片）。
// 图片与发帖一致：客户端压缩后上传 Cloudinary，DB 只存返回 URL。
export function CheckInDialog({ lat, lng, eventId, onCancel, onSubmit, onSnapChange }: Props) {
  const [note, setNote] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [visitedAt, setVisitedAt] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"" | "uploading">("");
  const [error, setError] = useState<string | null>(null);

  const canUpload = cloudinaryConfigured();
  const MAX_IMAGES = 6;

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const add = picked.slice(0, Math.max(0, MAX_IMAGES - files.length));
    setFiles((prev) => [...prev, ...add]);
    setPreviews((prev) => [...prev, ...add.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }
  function removeImage(i: number) {
    URL.revokeObjectURL(previews[i]);
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      let photoUrls: string[] = [];
      if (files.length > 0) {
        setPhase("uploading");
        try {
          photoUrls = await Promise.all(
            files.map(async (f) => uploadToCloudinary(await compressImage(f))),
          );
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
        note,
        rating,
        photoUrls,
        visitedAt: toISO(visitedAt),
        eventId: eventId ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet title="足迹 · 我来过" hint="拖动地图上的蓝色锚点定位" onClose={onCancel} onSnapChange={onSnapChange}>
      <div className="inline-flex items-center gap-1 text-[11px] text-neutral-500 bg-neutral-100 rounded-full px-2.5 py-1 mb-5">
        <IconPin className="w-3 h-3" />
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </div>

      <div className="mb-5">
        <label className={labelCls}>到访时间</label>
        <DateTimeField value={visitedAt} onChange={setVisitedAt} placeholder="默认现在" />
      </div>

      <div className="mb-5">
        <label className={labelCls}>想说点什么</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={`${fieldCls} resize-none`}
          placeholder="这家展览的灯光很好…"
        />
      </div>

      <div className="mb-5">
        <label className={labelCls}>心情</label>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n === rating ? null : n)}
              className={`transition ${rating && n <= rating ? "text-amber-500" : "text-neutral-300 hover:text-amber-300"}`}
              aria-label={`心情 ${n}`}
            >
              <IconHeart filled={!!rating && n <= rating} className="w-7 h-7" />
            </button>
          ))}
        </div>
      </div>

      {/* 图片（可选，可多张，客户端压缩后上传图床） */}
      <div className="mb-5">
        <label className={labelCls}>图片（可选，最多 {MAX_IMAGES} 张）</label>
        {canUpload ? (
          <div className="grid grid-cols-3 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover rounded-xl" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white text-sm leading-none flex items-center justify-center backdrop-blur"
                  aria-label="移除图片"
                >
                  ×
                </button>
              </div>
            ))}
            {files.length < MAX_IMAGES && (
              <label className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-400 cursor-pointer transition hover:border-blue-400 hover:text-blue-500">
                <IconPlus className="w-6 h-6" />
                <span className="text-[11px]">添加</span>
                <input type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
              </label>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            未配置图床（NEXT_PUBLIC_CLOUDINARY_*），暂不能上传图片。
          </p>
        )}
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
          disabled={submitting}
          className="flex-1 py-3 text-sm font-medium rounded-xl bg-blue-600 text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40"
        >
          {phase === "uploading" ? "上传图片…" : submitting ? "保存中…" : "留下足迹"}
        </button>
      </div>
    </BottomSheet>
  );
}
