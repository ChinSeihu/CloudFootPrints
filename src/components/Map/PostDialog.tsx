"use client";

import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";

import { useState } from "react";
import { IconPlus, CategoryIcon } from "@/components/icons";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { DateTimeField } from "@/components/common/DateTimeField";
import { moveImageItem, SortableImageList } from "@/components/common/SortableImageList";
import { BottomSheet } from "./BottomSheet";
import { compactFieldCls as fieldCls, compactLabelCls as labelCls } from "./formStyles";
import { useLanguage } from "@/components/I18n/LanguageProvider";

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
  const { t } = useLanguage();
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
  const [moreOpen, setMoreOpen] = useState(false);

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
      setError(t("publish.selectDate"));
      return;
    }
    if (start && end && new Date(end) < new Date(start)) {
      setError(t("publish.invalidEnd"));
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
          setError((err as Error).message || t("publish.uploadFailed"));
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

  const actionFooter = (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={onCancel} disabled={submitting} className="h-10 px-3 text-xs font-semibold text-neutral-500 transition hover:text-neutral-800">
        {t("common.cancel")}
      </button>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !title.trim() || (kind === "ACTIVITY" && !start)}
        className="flex h-10 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(37,99,235,0.22)] transition active:scale-[0.99] disabled:opacity-40"
      >
        {phase === "uploading" ? t("publish.uploading") : submitting ? t("publish.saving") : kind === "ACTIVITY" ? t("publish.activity") : t("publish.post")}
      </button>
    </div>
  );

  return (
    <BottomSheet
      title={kind === "ACTIVITY" ? t("publish.activity") : t("publish.post")}
      hint={targetTitle ? t("publish.linkedTo", { title: targetTitle }) : kind === "ACTIVITY" ? t("publish.activityHint") : t("publish.postHint")}
      onClose={onCancel}
      onSnapChange={onSnapChange}
      busy={submitting ? <LoadingFeedback compact scene="upload" text={phase === "uploading" ? t("publish.uploadMemory") : t("publish.saveShare")} /> : undefined}
      footer={actionFooter}
    >
      <div className="mb-3.5">
        <label className={labelCls}>{kind === "ACTIVITY" ? t("publish.activityName") : t("publish.postTitle")} <span className="text-red-400">*</span></label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={50}
          className={`${fieldCls} h-10 bg-white`}
          placeholder={kind === "ACTIVITY" ? t("publish.activityTitleExample") : t("publish.postTitleExample")}
        />
      </div>

      <div className="mb-3.5">
        <label className={labelCls}>{kind === "ACTIVITY" ? t("publish.activityCategory") : t("publish.contentCategory")}</label>
        <div className="grid grid-cols-4 gap-1.5">
          {EVENT_CATEGORIES.map((c) => {
            const active = c === category;
            const meta = CATEGORY_META[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`relative flex h-11 items-center justify-center gap-1 rounded-xl border px-1 text-[11px] font-semibold transition active:scale-[0.98] ${
                  active
                    ? "bg-white text-neutral-950 shadow-sm"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
                style={active ? { borderColor: meta.color, boxShadow: `0 0 0 1px ${meta.color}33` } : undefined}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ color: active ? "#fff" : meta.color, backgroundColor: active ? meta.color : `${meta.color}14` }}>
                  <CategoryIcon category={c} className="h-3.5 w-3.5" />
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {kind === "ACTIVITY" && (
        <div className="mb-3.5">
          <label className={labelCls}>{t("publish.timeRange")} <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            <DateTimeField value={start} onChange={setStart} placeholder={t("publish.startRequired")} />
            <DateTimeField value={end} onChange={setEnd} placeholder={t("publish.endOptional")} align="right" />
          </div>
        </div>
      )}

      <div className="mb-3.5">
        <label className={labelCls}>{t("publish.description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={`${fieldCls} min-h-20 resize-none bg-white`}
          placeholder={t("publish.descriptionPlaceholder")}
        />
      </div>

      {/* 图片（可选，可多张，客户端压缩后上传图床） */}
      <div className="mb-3.5">
        <label className={labelCls}>{t("images.optionalMax", { count: MAX_IMAGES })}</label>
        {canUpload ? (
          <SortableImageList
            layout="grid"
            columns={4}
            images={previews}
            onMove={(fromIndex, toIndex) => {
              setFiles((current) => moveImageItem(current, fromIndex, toIndex));
              setPreviews((current) => moveImageItem(current, fromIndex, toIndex));
            }}
            onRemove={removeImage}
            addPosition="end"
            addControl={files.length < MAX_IMAGES ? (
              <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-neutral-300 bg-white text-neutral-400 transition hover:border-blue-400 hover:text-blue-500">
                <span className="flex flex-col items-center gap-1 text-[11px]">
                  <IconPlus className="h-6 w-6" />
                  {t("images.add")}
                </span>
                <input type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
              </label>
            ) : undefined}
          />
        ) : (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
            {t("checkin.noUpload")}
          </p>
        )}
      </div>

      <div className="mb-3.5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
        >
          <span>
            <span className="block text-xs font-semibold text-neutral-800">{t("publish.more")}</span>
            <span className="mt-0.5 block text-[10px] text-neutral-400">{t("publish.moreHint", { signup: kind === "ACTIVITY" ? t("publish.signupSuffix") : "" })}</span>
          </span>
          <span className={`text-sm text-neutral-400 transition ${moreOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>
        {moreOpen && (
          <div className="space-y-3 border-t border-neutral-100 px-3 py-3">
            <div>
              <label className={labelCls}>{t("publish.venueOptional")}</label>
              <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className={`${fieldCls} h-10 bg-white`} placeholder={t("publish.venuePlaceholder")} />
            </div>
            <div>
              <label className={labelCls}>{t("publish.tagsOptional")}</label>
              {tags.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 text-[11px] text-blue-600">
                      #{tag}
                      <button type="button" onClick={() => removeTag(tag)} className="leading-none text-blue-400 hover:text-blue-600" aria-label={t("publish.removeTag")}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-1.5">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder={t("publish.tagPlaceholder")}
                  className={`${fieldCls} h-10 min-w-0 flex-1 bg-white`}
                />
                <button type="button" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 8} className="rounded-lg bg-neutral-100 px-3 text-xs font-semibold text-neutral-600 disabled:opacity-40">{t("publish.add")}</button>
              </div>
            </div>
            {kind === "ACTIVITY" && (
              <button type="button" onClick={() => setSignupEnabled((value) => !value)} className="flex w-full items-center justify-between rounded-lg bg-blue-50/70 px-3 py-2.5">
                <span className="text-left">
                  <span className="block text-xs font-semibold text-neutral-800">{t("publish.enableSignup")}</span>
                  <span className="block text-[10px] text-neutral-400">{t("publish.signupHint")}</span>
                </span>
                <span className={`relative h-5 w-9 rounded-full transition ${signupEnabled ? "bg-blue-600" : "bg-neutral-300"}`}>
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${signupEnabled ? "left-[1.125rem]" : "left-0.5"}`} />
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}
    </BottomSheet>
  );
}
