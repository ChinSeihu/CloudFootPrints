"use client";

import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";

import { useState } from "react";
import { IconPlus, CategoryIcon } from "@/components/icons";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { DateTimeField } from "@/components/common/DateTimeField";
import { BottomSheet } from "./BottomSheet";
import { fieldCls, labelCls } from "./formStyles";

export type PostDraft = {
  kind: "LIFE" | "ACTIVITY";
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
  eventId?: string | null;
};

type Props = {
  kind: "LIFE" | "ACTIVITY";
  lat: number;
  lng: number;
  eventId?: string | null;
  targetTitle?: string | null;
  onCancel: () => void;
  onSubmit: (draft: PostDraft) => Promise<void>;
  onSnapChange?: (snap: "peek" | "full") => void;
};

const toISO = (local: string): string | null => (local ? new Date(local).toISOString() : null);

// 锚点发帖："这里有个活动"——在地图上标记并发布一个活动（sourceType=USER）。
/**
 * Signature: `function PostDialog({ kind, lat, lng, eventId, targetTitle, onCancel, onSubmit, onSnapChange }: Props): React.JSX.Element`
 * Purpose: Collects either a location-based life update or a time-bounded user activity without conflating their time semantics.
 */
export function PostDialog({ kind, lat, lng, eventId, targetTitle, onCancel, onSubmit, onSnapChange }: Props) {
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

  /**
   * Signature: `async function handleSubmit(): Promise<void>`
   * Purpose: Validates fields by post kind, uploads optional images, and submits the normalized draft.
   */
  async function handleSubmit() {
    if (!title.trim() || submitting) return;
    if (kind === "ACTIVITY" && !start) {
      setError("请选择活动日期");
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
        kind,
        lat,
        lng,
        title,
        category,
        description,
        venueName,
        imageUrls,
        startTime: kind === "ACTIVITY" ? toISO(start) : null,
        endTime: kind === "ACTIVITY" ? toISO(end) : null,
        tags,
        signupEnabled: kind === "ACTIVITY" && signupEnabled,
        eventId: eventId ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      title={kind === "ACTIVITY" ? "发布活动" : "发布动态"}
      hint={targetTitle ? `关联到「${targetTitle}」` : kind === "ACTIVITY" ? "把附近正在发生或即将开始的活动分享给大家" : "分享此刻与这个地点有关的见闻"}
      onClose={onCancel}
      onSnapChange={onSnapChange}
      busy={submitting ? <LoadingFeedback compact scene="upload" text={phase === "uploading" ? "正在上传照片，保留这份城市记忆…" : "正在保存你的分享…"} /> : undefined}
    >
      <div className="mb-5">
        <label className={labelCls}>{kind === "ACTIVITY" ? "活动名称" : "动态标题"} <span className="text-red-400">*</span></label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
          className={`${fieldCls} h-12 rounded-2xl bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]`}
          placeholder={kind === "ACTIVITY" ? "例如：下北沢古着市集" : "例如：傍晚在河边散步"}
        />
      </div>

      <div className="mb-5">
        <label className={labelCls}>{kind === "ACTIVITY" ? "活动分类" : "内容分类"}</label>
        <div className="grid grid-cols-4 gap-2">
          {EVENT_CATEGORIES.map((c) => {
            const active = c === category;
            const meta = CATEGORY_META[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`relative flex h-[4.05rem] flex-col items-center justify-center gap-1.5 rounded-2xl border text-[11px] font-semibold transition active:scale-[0.98] ${
                  active
                    ? "bg-white text-neutral-950 shadow-[0_8px_22px_rgba(15,23,42,0.12)]"
                    : "border-neutral-200 bg-white text-neutral-700 shadow-[0_6px_18px_rgba(15,23,42,0.04)]"
                }`}
                style={active ? { borderColor: meta.color, boxShadow: `0 0 0 2px ${meta.color}33, 0 8px 22px rgba(15,23,42,0.12)` } : undefined}
              >
                {active && (
                  <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full text-[10px] font-black text-white" style={{ backgroundColor: meta.color }}>
                    ✓
                  </span>
                )}
                <span className="grid h-7 w-7 place-items-center rounded-xl" style={{ color: active ? "#fff" : meta.color, backgroundColor: active ? meta.color : `${meta.color}14` }}>
                  <CategoryIcon category={c} className="h-4 w-4" />
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {kind === "ACTIVITY" && (
        <div className="mb-5">
          <label className={labelCls}>时间范围 <span className="text-red-400">*</span></label>
          <div className="space-y-2">
            <DateTimeField value={start} onChange={setStart} placeholder="开始时间（必选）" />
            <DateTimeField value={end} onChange={setEnd} placeholder="结束时间（可选）" />
          </div>
        </div>
      )}

      {/* 图片（可选，可多张，客户端压缩后上传图床） */}
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
            {previews.map((src, i) => (
              <div key={i} className="relative h-24 w-24 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full rounded-2xl object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
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

      <div className="mb-5">
        <label className={labelCls}>地点名（可选）</label>
        <input
          value={venueName}
          onChange={(e) => setVenueName(e.target.value)}
          className={`${fieldCls} h-12 rounded-2xl bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]`}
          placeholder="场馆 / 地点名"
        />
      </div>

      <div className="mb-5">
        <label className={labelCls}>说明（可选）</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={`${fieldCls} resize-none rounded-2xl bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]`}
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
            className={`${fieldCls} h-12 min-w-0 flex-1 rounded-2xl bg-white shadow-[0_6px_18px_rgba(15,23,42,0.04)]`}
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!tagInput.trim() || tags.length >= 8}
            className="rounded-2xl bg-neutral-100 px-4 text-sm text-neutral-600 disabled:opacity-40"
          >
            添加
          </button>
        </div>
      </div>

      {/* 报名模式 */}
      {kind === "ACTIVITY" && <div className="mb-5">
        <button
          type="button"
          onClick={() => setSignupEnabled((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3"
        >
          <span className="text-left">
            <span className="block text-sm text-neutral-800">开启报名</span>
            <span className="block text-[11px] text-neutral-400">其他用户可点「报名」，你能看到报名人数</span>
          </span>
          <span className={`relative w-10 h-6 rounded-full transition ${signupEnabled ? "bg-blue-600" : "bg-neutral-300"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${signupEnabled ? "left-[1.125rem]" : "left-0.5"}`} />
          </span>
        </button>
      </div>}

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

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
          disabled={submitting || !title.trim() || (kind === "ACTIVITY" && !start)}
          className="flex h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)] transition active:scale-[0.99] disabled:opacity-40"
        >
          {phase === "uploading" ? "上传图片…" : submitting ? "发布中…" : kind === "ACTIVITY" ? "发布活动" : "发布动态"}
        </button>
      </div>
    </BottomSheet>
  );
}
