"use client";

import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";

import { useState, type ReactNode } from "react";
import { IconPlus, CategoryIcon } from "@/components/icons";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { DateTimeField } from "@/components/common/DateTimeField";
import { moveImageItem, SortableImageList } from "@/components/common/SortableImageList";
import { fieldCls, labelCls } from "@/components/Map/formStyles";
import { MoodSelector } from "@/components/common/MoodSelector";
import type { CheckInDTO, EventDTO } from "@/lib/types";
import { useLanguage } from "@/components/I18n/LanguageProvider";

const toISO = (local: string): string | null => (local ? new Date(local).toISOString() : null);

// ISO（UTC）→ DateTimeField 需要的本地 "YYYY-MM-DDTHH:mm"。
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 居中模态外壳（个人页编辑用，区别于地图的底部 sheet）。
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useLanguage();
  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[92dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-black/5">
          <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t("common.close")} className="w-8 h-8 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ───────── 编辑发帖（仅文字信息，不动坐标/图片）─────────
/**
 * Signature: `function EditPostDialog(props: { event: EventDTO; onClose: () => void; onSaved: (patch: Partial<EventDTO>) => void; canRegenerateImage?: boolean; onRegenerateImage?: () => Promise<{ imageUrl: string; imageUrls: string[] } | null> }): React.JSX.Element`
 * Purpose: Edits shared post fields while exposing activity-only time and signup controls only for ACTIVITY posts.
 */
export function EditPostDialog({
  event,
  onClose,
  onSaved,
  canRegenerateImage = false,
  onRegenerateImage,
}: {
  event: EventDTO;
  onClose: () => void;
  onSaved: (patch: Partial<EventDTO>) => void;
  canRegenerateImage?: boolean;
  onRegenerateImage?: () => Promise<{ imageUrl: string; imageUrls: string[] } | null>;
}) {
  const { t } = useLanguage();
  const isActivity = event.postKind !== "LIFE";
  const [imageUrls, setImageUrls] = useState<string[]>(
    event.imageUrls?.length
      ? event.imageUrls
      : event.imageUrl
        ? [event.imageUrl]
        : [],
  );
  const [title, setTitle] = useState(event.title);
  const [category, setCategory] = useState<EventCategory>(event.category);
  const [description, setDescription] = useState(event.description ?? "");
  const [venueName, setVenueName] = useState(event.venueName ?? "");
  const [start, setStart] = useState(isoToLocal(event.startTime));
  const [end, setEnd] = useState(isoToLocal(event.endTime));
  const [tags, setTags] = useState<string[]>(event.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [signupEnabled, setSignupEnabled] = useState(event.signupEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").slice(0, 16);
    if (!t || tags.includes(t) || tags.length >= 8) { setTagInput(""); return; }
    setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  /**
   * Signature: `async function save(): Promise<void>`
   * Purpose: Validates and persists post edits according to LIFE or ACTIVITY time semantics.
   */
  async function save() {
    if (!title.trim() || saving) return;
    if (isActivity && !start) { setError(t("publish.selectDate")); return; }
    if (isActivity && start && end && new Date(end) < new Date(start)) { setError(t("publish.invalidEnd")); return; }
    setError(null);
    setSaving(true);
    const patch = {
      title: title.trim(),
      category,
      description: description.trim() || null,
      venueName: venueName.trim() || null,
      startTime: isActivity ? toISO(start) : null,
      endTime: isActivity ? toISO(end) : null,
      tags,
      signupEnabled: isActivity && signupEnabled,
      imageUrls,
    };
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || t("edit.saveFailed"));
        return;
      }
      onSaved({
        ...patch,
        imageUrl: imageUrls[0] ?? null,
      });
      onClose();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setSaving(false);
    }
  }

  async function regenerateImage() {
    if (!onRegenerateImage || regenerating) return;
    setError(null);
    setRegenerating(true);
    try {
      const result = await onRegenerateImage();
      if (result?.imageUrl) {
        setImageUrls(
          result.imageUrls?.length ? result.imageUrls : [result.imageUrl],
        );
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : t("edit.imageFailed"));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Modal title={t(isActivity ? "edit.activity" : "edit.post")} onClose={onClose}>
      {(imageUrls.length > 0 || canRegenerateImage) && (
        <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-neutral-900">{t("edit.postImages")}</div>
              <div className="mt-0.5 text-xs text-neutral-500">
                {imageUrls.length > 0 ? t("edit.imageCount", { count: imageUrls.length }) : t("edit.noImages")}
              </div>
            </div>
            {canRegenerateImage && (
              <button
                type="button"
                onClick={regenerateImage}
                disabled={regenerating || saving}
                className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                {t(regenerating ? "edit.generating" : "edit.regenerate")}
              </button>
            )}
          </div>
          {regenerating && <LoadingFeedback compact scene="drawing" text={t("edit.drawing")} />}
          {imageUrls.length > 0 && (
            <div className="mt-3">
              <SortableImageList
                images={imageUrls}
                onMove={(fromIndex, toIndex) => setImageUrls((current) => moveImageItem(current, fromIndex, toIndex))}
                onRemove={(index) => setImageUrls((current) => current.filter((_, itemIndex) => itemIndex !== index))}
              />
            </div>
          )}
        </div>
      )}

      <div className="mb-5">
        <label className={labelCls}>{t("publish.activityName")} <span className="text-red-400">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} placeholder={t("publish.activityName")} />
      </div>

      <div className="mb-5">
        <label className={labelCls}>{t("filter.category")}</label>
        <div className="flex flex-wrap gap-2">
          {EVENT_CATEGORIES.map((c) => {
            const active = c === category;
            const meta = CATEGORY_META[c];
            return (
              <button key={c} type="button" onClick={() => setCategory(c)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition ${active ? "text-white border-transparent shadow-sm" : "bg-neutral-50 text-neutral-600 border-neutral-200 hover:border-neutral-300"}`}
                style={active ? { backgroundColor: meta.color } : undefined}>
                <CategoryIcon category={c} className="w-4 h-4" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {isActivity && <div className="mb-5">
        <label className={labelCls}>{t("publish.timeRange")} <span className="text-red-400">*</span></label>
        <div className="space-y-2">
          <DateTimeField value={start} onChange={setStart} placeholder={t("publish.startRequired")} />
          <DateTimeField value={end} onChange={setEnd} placeholder={t("publish.endOptional")} />
        </div>
      </div>}

      <div className="mb-5">
        <label className={labelCls}>{t("publish.venueOptional")}</label>
        <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className={fieldCls} placeholder={t("publish.venuePlaceholder")} />
      </div>

      <div className="mb-5">
        <label className={labelCls}>{t("publish.description")}</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${fieldCls} resize-none`} placeholder={t("publish.descriptionPlaceholder")} />
      </div>

      <div className="mb-5">
        <label className={labelCls}>{t("publish.tagsOptional")}</label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-600">
                #{tag}
                <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== tag))} className="text-blue-400 hover:text-blue-600 leading-none" aria-label={t("publish.removeTag")}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder={t("edit.tagPlaceholder")} className={`${fieldCls} flex-1 min-w-0`} />
          <button type="button" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 8} className="px-4 rounded-xl bg-neutral-100 text-neutral-600 text-sm disabled:opacity-40">{t("publish.add")}</button>
        </div>
      </div>

      {isActivity && <div className="mb-5">
        <button type="button" onClick={() => setSignupEnabled((v) => !v)} className="w-full flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 px-3.5 py-3">
          <span className="text-left">
            <span className="block text-sm text-neutral-800">{t("publish.enableSignup")}</span>
            <span className="block text-[11px] text-neutral-400">{t("edit.signupHint")}</span>
          </span>
          <span className={`relative w-10 h-6 rounded-full transition ${signupEnabled ? "bg-blue-600" : "bg-neutral-300"}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${signupEnabled ? "left-[1.125rem]" : "left-0.5"}`} />
          </span>
        </button>
      </div>}

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {saving && <LoadingFeedback compact scene="profile" text={t("edit.savingMemory")} />}
      <div className="flex gap-3">
        <button type="button" onClick={onClose} disabled={saving} className="px-5 py-3 text-sm rounded-xl text-neutral-500 hover:bg-neutral-100 transition">{t("common.cancel")}</button>
        <button type="button" onClick={save} disabled={saving || !title.trim() || !start} className="flex-1 py-3 text-sm font-medium rounded-xl bg-blue-600 text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40">
          {t(saving ? "profile.saving" : "edit.save")}
        </button>
      </div>
    </Modal>
  );
}

// ───────── 编辑打卡（备注/评分/照片，不改坐标和打卡时间）─────────
/**
 * Signature: `function EditCheckInDialog(props: { checkin: CheckInDTO; onClose: () => void; onSaved: (patch: Partial<CheckInDTO>) => void; canRegenerateImage?: boolean; onRegenerateImage?: (photoUrls: string[]) => Promise<{ imageUrl: string; imageUrls: string[] } | null> }): React.JSX.Element`
 * Purpose: Edits a footprint's content, mood, photos, and visibility while preserving its original location and check-in time.
 */
export function EditCheckInDialog({
  checkin,
  onClose,
  onSaved,
  canRegenerateImage = false,
  onRegenerateImage,
}: {
  checkin: CheckInDTO;
  onClose: () => void;
  onSaved: (patch: Partial<CheckInDTO>) => void;
  canRegenerateImage?: boolean;
  onRegenerateImage?: (photoUrls: string[]) => Promise<{ imageUrl: string; imageUrls: string[] } | null>;
}) {
  const { t } = useLanguage();
  const [note, setNote] = useState(checkin.note ?? "");
  const [moodTags, setMoodTags] = useState<number[]>(checkin.moodTags?.length ? checkin.moodTags : checkin.rating ? [checkin.rating] : []);
  const [isPublic, setIsPublic] = useState(checkin.isPublic);
  const [photos, setPhotos] = useState<Array<{ source: "saved"; url: string } | { source: "new"; file: File; preview: string }>>(() =>
    (checkin.photoUrls?.length ? checkin.photoUrls : checkin.photoUrl ? [checkin.photoUrl] : []).map((url) => ({ source: "saved", url })),
  );
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [phase, setPhase] = useState<"" | "uploading">("");
  const [error, setError] = useState<string | null>(null);

  const canUpload = cloudinaryConfigured();
  const MAX_IMAGES = 6;
  const total = photos.length;

  /**
   * Signature: `function pickFiles(e: React.ChangeEvent<HTMLInputElement>): void`
   * Purpose: Adds local images to the ordered footprint photo collection.
   */
  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const add = picked.slice(0, Math.max(0, MAX_IMAGES - total));
    setPhotos((current) => [...current, ...add.map((file) => ({ source: "new" as const, file, preview: URL.createObjectURL(file) }))]);
    e.target.value = "";
  }
  /**
   * Signature: `function removePhoto(index: number): void`
   * Purpose: Removes one saved or local footprint photo and releases local preview resources.
   */
  function removePhoto(index: number) {
    setPhotos((current) => {
      const removed = current[index];
      if (removed?.source === "new") URL.revokeObjectURL(removed.preview);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  /**
   * Signature: `async function save(): Promise<void>`
   * Purpose: Uploads new photos in their chosen order and persists the edited footprint.
   */
  async function save() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      let photoUrls: string[] = [];
      if (photos.some((photo) => photo.source === "new")) {
        setPhase("uploading");
        try {
          photoUrls = await Promise.all(photos.map(async (photo) => photo.source === "saved" ? photo.url : uploadToCloudinary(await compressImage(photo.file))));
        } catch (err) {
          setError((err as Error).message || t("publish.uploadFailed"));
          return;
        } finally {
          setPhase("");
        }
      } else {
        photoUrls = photos.map((photo) => photo.source === "saved" ? photo.url : photo.preview);
      }
      const patch = { note: note.trim() || null, rating: moodTags[0] ?? null, moodTags, photoUrls, isPublic };
      const res = await fetch(`/api/checkins/${checkin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || t("edit.saveFailed"));
        return;
      }
      onSaved({ note: patch.note, rating: patch.rating, moodTags, photoUrls, photoUrl: photoUrls[0] ?? null, isPublic });
      onClose();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setSaving(false);
    }
  }

  /**
   * Signature: `async function regenerateImage(): Promise<void>`
   * Purpose: Replaces the ordered footprint photos with regenerated persisted images.
   */
  async function regenerateImage() {
    if (!onRegenerateImage || regenerating) return;
    if (total >= MAX_IMAGES) {
      window.alert(t("edit.imageLimit", { count: MAX_IMAGES }));
      return;
    }
    setError(null);
    setRegenerating(true);
    try {
      const result = await onRegenerateImage(photos.flatMap((photo) => photo.source === "saved" ? [photo.url] : []));
      if (!result?.imageUrl) return;
      setPhotos((current) => {
        current.forEach((photo) => { if (photo.source === "new") URL.revokeObjectURL(photo.preview); });
        return (result.imageUrls?.length ? result.imageUrls : [result.imageUrl]).map((url) => ({ source: "saved" as const, url }));
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : t("edit.imageFailed"));
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Modal title={t("edit.checkin")} onClose={onClose}>
      <div className="mb-5">
        <label className={labelCls}>{t("checkin.note")}</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${fieldCls} resize-none`} placeholder={t("edit.notePlaceholder")} />
      </div>

      <div className="mb-5">
        <label className={labelCls}>{t("checkin.mood")}</label>
        <MoodSelector value={moodTags} onChange={setMoodTags} />
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className={labelCls}>{t("edit.imagesMax", { count: MAX_IMAGES })}</label>
          {canRegenerateImage && (
            <button
              type="button"
              onClick={regenerateImage}
              disabled={regenerating || saving}
              className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-600 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60"
            >
              {t(regenerating ? "edit.generating" : "edit.regenerate")}
            </button>
          )}
        </div>
        {regenerating && <LoadingFeedback compact scene="drawing" text={t("edit.drawing")} />}
        {canUpload ? (
          <SortableImageList
            images={photos.map((photo) => photo.source === "saved" ? photo.url : photo.preview)}
            onMove={(fromIndex, toIndex) => setPhotos((current) => moveImageItem(current, fromIndex, toIndex))}
            onRemove={removePhoto}
            addControl={total < MAX_IMAGES ? (
              <label className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-400 cursor-pointer transition hover:border-blue-400 hover:text-blue-500">
                <IconPlus className="w-6 h-6" />
                <span className="text-[11px]">{t("publish.add")}</span>
                <input type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
              </label>
            ) : undefined}
          />
        ) : (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{t("checkin.noUpload")}</p>
        )}
      </div>

      <div className="mb-5 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={() => setIsPublic((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
          <span>
            <span className="block text-sm font-medium text-neutral-900">{t(isPublic ? "checkin.public" : "checkin.private")}</span>
            <span className="mt-1 block text-xs text-neutral-500">{t(isPublic ? "checkin.publicHint" : "edit.privateHint")}</span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${isPublic ? "bg-blue-600" : "bg-neutral-200"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${isPublic ? "left-6" : "left-1"}`} />
          </span>
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      {saving && <LoadingFeedback compact scene="upload" text={t(phase === "uploading" ? "edit.uploadingPhotos" : "edit.savingMemory")} />}
      <div className="flex gap-3">
        <button type="button" onClick={onClose} disabled={saving} className="px-5 py-3 text-sm rounded-xl text-neutral-500 hover:bg-neutral-100 transition">{t("common.cancel")}</button>
        <button type="button" onClick={save} disabled={saving} className="flex-1 py-3 text-sm font-medium rounded-xl bg-blue-600 text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40">
          {t(phase === "uploading" ? "publish.uploading" : saving ? "profile.saving" : "edit.save")}
        </button>
      </div>
    </Modal>
  );
}
