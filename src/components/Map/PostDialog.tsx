"use client";

import { useState } from "react";
import { IconPlus, CategoryIcon } from "@/components/icons";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { BottomSheet } from "./BottomSheet";
import { DateTimeField } from "@/components/common/DateTimeField";
import { fieldCls, labelCls } from "./formStyles";

export type PostDraft = {
  lat: number;
  lng: number;
  title: string;
  category: EventCategory;
  description: string;
  venueName: string;
  imageUrls: string[];
  startTime: string | null; // ISO
  endTime: string | null; // ISO
  tags: string[];
  signupEnabled: boolean;
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
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [signupEnabled, setSignupEnabled] = useState(false);
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
    const room = MAX_IMAGES - files.length;
    const add = picked.slice(0, Math.max(0, room));
    setFiles((prev) => [...prev, ...add]);
    setPreviews((prev) => [...prev, ...add.map((f) => URL.createObjectURL(f))]);
    e.target.value = ""; // 允许再次选同一文件
  }
  function removeImage(i: number) {
    URL.revokeObjectURL(previews[i]);
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").slice(0, 16);
    if (!t || tags.includes(t) || tags.length >= 8) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }
  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    if (!start) {
      setError("请选择活动开始时间");
      return;
    }
    if (start && end && new Date(end) < new Date(start)) {
      setError("结束时间不能早于开始时间");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      let imageUrls: string[] = [];
      if (files.length > 0) {
        setPhase("uploading");
        try {
          imageUrls = await Promise.all(
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
        title,
        category,
        description,
        venueName,
        imageUrls,
        startTime: toISO(start),
        endTime: toISO(end),
        tags,
        signupEnabled,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet title="发布活动" hint="可拖动蓝色锚点重新定位" onClose={onCancel} onSnapChange={onSnapChange}>
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
        <label className={labelCls}>时间范围 <span className="text-red-400">*</span></label>
        <div className="space-y-2">
          <DateTimeField value={start} onChange={setStart} placeholder="开始时间（必选）" />
          <DateTimeField value={end} onChange={setEnd} placeholder="结束时间（可选）" />
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

      <div className="mb-5">
        <label className={labelCls}>标签（可选）</label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-600">
                #{t}
                <button type="button" onClick={() => removeTag(t)} className="text-blue-400 hover:text-blue-600 leading-none" aria-label="移除标签">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="如 免费、亲子、夜场…回车添加"
            className={`${fieldCls} flex-1 min-w-0`}
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!tagInput.trim() || tags.length >= 8}
            className="px-4 rounded-xl bg-neutral-100 text-neutral-600 text-sm disabled:opacity-40"
          >
            添加
          </button>
        </div>
      </div>

      {/* 报名模式 */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setSignupEnabled((v) => !v)}
          className="w-full flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 px-3.5 py-3"
        >
          <span className="text-left">
            <span className="block text-sm text-neutral-800">开启报名</span>
            <span className="block text-[11px] text-neutral-400">其他用户可点「报名」，你能看到报名人数</span>
          </span>
          <span className={`relative w-10 h-6 rounded-full transition ${signupEnabled ? "bg-blue-600" : "bg-neutral-300"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${signupEnabled ? "left-[1.125rem]" : "left-0.5"}`} />
          </span>
        </button>
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
          disabled={submitting || !title.trim() || !start}
          className="flex-1 py-3 text-sm font-medium rounded-xl bg-blue-600 text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40"
        >
          {phase === "uploading" ? "上传图片…" : submitting ? "发布中…" : "发布活动"}
        </button>
      </div>
    </BottomSheet>
  );
}
