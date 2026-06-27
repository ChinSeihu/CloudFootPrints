"use client";

import { useState } from "react";
import { IconPlus } from "@/components/icons";
import { MoodSelector } from "@/components/common/MoodSelector";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { BottomSheet } from "./BottomSheet";
import { fieldCls, labelCls } from "./formStyles";

export type CheckInDraft = {
  lat: number;
  lng: number;
  note: string;
  rating: number | null;
  moodTags: number[];
  photoUrls: string[];
  eventId?: string | null;
};

type Props = {
  lat: number;
  lng: number;
  eventId?: string | null;
  onCancel: () => void;
  onSubmit: (draft: CheckInDraft) => Promise<void>;
  onSnapChange?: (snap: "peek" | "full") => void;
};

// 足迹创建不再让用户手填时间：真实用户默认使用提交时间；
// 虚拟人物仍由 simulation/engine.ts 通过服务端 visitedAt 传入虚拟时间。
export function CheckInDialog({ lat, lng, eventId, onCancel, onSubmit, onSnapChange }: Props) {
  const [note, setNote] = useState("");
  const [moodTags, setMoodTags] = useState<number[]>([]);
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
    setPreviews((prev) => [...prev, ...add.map((file) => URL.createObjectURL(file))]);
    e.target.value = "";
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(previews[index]);
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
    setPreviews((prev) => prev.filter((_, idx) => idx !== index));
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
            files.map(async (file) => uploadToCloudinary(await compressImage(file))),
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
        rating: moodTags[0] ?? null,
        moodTags,
        photoUrls,
        eventId: eventId ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet title="留下足迹" hint="记录这次到访的感受，只有你自己可见" onClose={onCancel} onSnapChange={onSnapChange}>
      <div className="mb-6">
        <label className={labelCls}>想说点什么</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={200}
          className={`${fieldCls} min-h-28 resize-none rounded-2xl bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]`}
          placeholder="这家展览的灯光很好..."
        />
        <div className="mt-1 text-right text-[11px] text-neutral-400">{note.length}/200</div>
      </div>

      <div className="mb-6">
        <label className={labelCls}>心情</label>
        <MoodSelector value={moodTags} onChange={setMoodTags} />
      </div>

      <div className="mb-6">
        <label className={labelCls}>图片（可选，最多 {MAX_IMAGES} 张）</label>
        {canUpload ? (
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {files.length < MAX_IMAGES && (
              <label className="grid h-24 w-24 shrink-0 cursor-pointer place-items-center rounded-2xl border border-dashed border-neutral-300 bg-white text-neutral-400 shadow-[0_6px_18px_rgba(15,23,42,0.04)] transition hover:border-blue-400 hover:text-blue-500">
                <span className="flex flex-col items-center gap-1 text-[11px]">
                  <IconPlus className="h-6 w-6" />
                  添加图片
                </span>
                <input type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
              </label>
            )}
            {previews.map((src, index) => (
              <div key={src} className="relative h-24 w-24 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full rounded-2xl object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-sm leading-none text-neutral-700 shadow backdrop-blur"
                  aria-label="移除图片"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            未配置图床（NEXT_PUBLIC_CLOUDINARY_*），暂不能上传图片。
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-700">
        你的足迹仅对自己可见，不会公开显示在地图中。
      </div>

      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-3 text-sm text-neutral-500 transition hover:text-neutral-800"
        >
          取消
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)] transition active:scale-[0.99] disabled:opacity-40"
        >
          {phase === "uploading" ? "上传图片..." : submitting ? "保存中..." : "留下足迹"}
        </button>
      </div>
    </BottomSheet>
  );
}
