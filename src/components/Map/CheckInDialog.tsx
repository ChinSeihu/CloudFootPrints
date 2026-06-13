"use client";

import { useState } from "react";
import { IconStar, IconPin } from "@/components/icons";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
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
  onSnapChange?: (snap: "peek" | "full") => void;
};

// 打卡："我来过这里"（个人足迹：时间 / 文字 / 评分 / 图片）。
// 图片与发帖一致：客户端压缩后上传 Cloudinary，DB 只存返回 URL。
export function CheckInDialog({ lat, lng, eventId, onCancel, onSubmit, onSnapChange }: Props) {
  const [note, setNote] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [visitedAt, setVisitedAt] = useState("");
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
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      let photoUrl = "";
      if (file) {
        setPhase("uploading");
        try {
          const blob = await compressImage(file);
          photoUrl = await uploadToCloudinary(blob);
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
        photoUrl,
        visitedAt: toISO(visitedAt),
        eventId: eventId ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet title="打卡 · 我来过" hint="拖动地图上的蓝色锚点定位" onClose={onCancel} onSnapChange={onSnapChange}>
      <p className="flex items-center gap-1 text-xs text-neutral-500 mb-4">
        <IconPin className="w-3.5 h-3.5" />
        {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>

      <label className="block text-sm mb-1">打卡时间</label>
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

      {/* 图片（可选，客户端压缩后上传图床） */}
      <label className="block text-sm mb-1">图片（可选）</label>
      {canUpload ? (
        preview ? (
          <div className="relative mb-5 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="max-h-40 rounded-lg object-cover" />
            <button
              type="button"
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/70 text-white text-sm flex items-center justify-center"
              aria-label="移除图片"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="mb-5 flex items-center justify-center h-20 border border-dashed border-neutral-300 rounded-lg text-sm text-neutral-500 cursor-pointer">
            + 选择图片
            <input type="file" accept="image/*" onChange={pickFile} className="hidden" />
          </label>
        )
      ) : (
        <p className="mb-5 text-[11px] text-amber-600">
          未配置图床（NEXT_PUBLIC_CLOUDINARY_*），暂不能上传图片。
        </p>
      )}

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

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
          {phase === "uploading" ? "上传图片…" : submitting ? "保存中…" : "打卡"}
        </button>
      </div>
    </BottomSheet>
  );
}
