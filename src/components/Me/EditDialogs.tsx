"use client";

import { useState, type ReactNode } from "react";
import { IconPlus, CategoryIcon } from "@/components/icons";
import { CATEGORY_META, EVENT_CATEGORIES, type EventCategory } from "@/lib/categories";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { DateTimeField } from "@/components/common/DateTimeField";
import { fieldCls, labelCls } from "@/components/Map/formStyles";
import { MoodSelector } from "@/components/common/MoodSelector";
import type { CheckInDTO, EventDTO } from "@/lib/types";

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
  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[92dvh] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-black/5">
          <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="关闭" className="w-8 h-8 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ───────── 编辑发帖（仅文字信息，不动坐标/图片）─────────
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

  async function save() {
    if (!title.trim() || saving) return;
    if (!start) { setError("请选择活动开始时间"); return; }
    if (start && end && new Date(end) < new Date(start)) { setError("结束时间不能早于开始时间"); return; }
    setError(null);
    setSaving(true);
    const patch = {
      title: title.trim(),
      category,
      description: description.trim() || null,
      venueName: venueName.trim() || null,
      startTime: toISO(start),
      endTime: toISO(end),
      tags,
      signupEnabled,
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
        setError(d.error || "保存失败");
        return;
      }
      onSaved({
        ...patch,
        imageUrl: imageUrls[0] ?? null,
      });
      onClose();
    } catch {
      setError("网络错误，请稍后再试");
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
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Modal title="编辑发帖" onClose={onClose}>
      {(imageUrls.length > 0 || canRegenerateImage) && (
        <div className="mb-5 rounded-2xl border border-violet-100 bg-violet-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-neutral-900">发帖图片</div>
              <div className="mt-0.5 text-xs text-neutral-500">
                {imageUrls.length > 0 ? `${imageUrls.length} 张图片` : "暂无图片"}
              </div>
            </div>
            {canRegenerateImage && (
              <button
                type="button"
                onClick={regenerateImage}
                disabled={regenerating || saving}
                className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
              >
                {regenerating ? "生图中…" : "重新生图"}
              </button>
            )}
          </div>
          {imageUrls.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {imageUrls.map((src, index) => (
                <div key={`${src}-${index}`} className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="h-full w-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setImageUrls((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-base leading-none text-white backdrop-blur transition hover:bg-black/75"
                    aria-label={`删除第 ${index + 1} 张图片`}
                    title="删除图片"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-5">
        <label className={labelCls}>活动名称 <span className="text-red-400">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} placeholder="活动名称" />
      </div>

      <div className="mb-5">
        <label className={labelCls}>分类</label>
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

      <div className="mb-5">
        <label className={labelCls}>时间范围 <span className="text-red-400">*</span></label>
        <div className="space-y-2">
          <DateTimeField value={start} onChange={setStart} placeholder="开始时间（必选）" />
          <DateTimeField value={end} onChange={setEnd} placeholder="结束时间（可选）" />
        </div>
      </div>

      <div className="mb-5">
        <label className={labelCls}>地点名（可选）</label>
        <input value={venueName} onChange={(e) => setVenueName(e.target.value)} className={fieldCls} placeholder="场馆 / 地点名" />
      </div>

      <div className="mb-5">
        <label className={labelCls}>说明（可选）</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${fieldCls} resize-none`} placeholder="内容、票价…" />
      </div>

      <div className="mb-5">
        <label className={labelCls}>标签（可选）</label>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-50 text-blue-600">
                #{t}
                <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))} className="text-blue-400 hover:text-blue-600 leading-none" aria-label="移除标签">×</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
            placeholder="如 免费、亲子…回车添加" className={`${fieldCls} flex-1 min-w-0`} />
          <button type="button" onClick={addTag} disabled={!tagInput.trim() || tags.length >= 8} className="px-4 rounded-xl bg-neutral-100 text-neutral-600 text-sm disabled:opacity-40">添加</button>
        </div>
      </div>

      <div className="mb-5">
        <button type="button" onClick={() => setSignupEnabled((v) => !v)} className="w-full flex items-center justify-between rounded-xl bg-neutral-50 border border-neutral-200 px-3.5 py-3">
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

      <div className="flex gap-3">
        <button type="button" onClick={onClose} disabled={saving} className="px-5 py-3 text-sm rounded-xl text-neutral-500 hover:bg-neutral-100 transition">取消</button>
        <button type="button" onClick={save} disabled={saving || !title.trim() || !start} className="flex-1 py-3 text-sm font-medium rounded-xl bg-blue-600 text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40">
          {saving ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}

// ───────── 编辑打卡（备注/评分/照片/时间，不改坐标）─────────
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
  const [note, setNote] = useState(checkin.note ?? "");
  const [moodTags, setMoodTags] = useState<number[]>(checkin.moodTags?.length ? checkin.moodTags : checkin.rating ? [checkin.rating] : []);
  const [isPublic, setIsPublic] = useState(checkin.isPublic);
  const [visitedAt, setVisitedAt] = useState(isoToLocal(checkin.createdAt));
  const [keptUrls, setKeptUrls] = useState<string[]>(checkin.photoUrls?.length ? checkin.photoUrls : checkin.photoUrl ? [checkin.photoUrl] : []);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [phase, setPhase] = useState<"" | "uploading">("");
  const [error, setError] = useState<string | null>(null);

  const canUpload = cloudinaryConfigured();
  const MAX_IMAGES = 6;
  const total = keptUrls.length + files.length;

  function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;
    const add = picked.slice(0, Math.max(0, MAX_IMAGES - total));
    setFiles((prev) => [...prev, ...add]);
    setPreviews((prev) => [...prev, ...add.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }
  function removeKept(i: number) { setKeptUrls((prev) => prev.filter((_, idx) => idx !== i)); }
  function removeNew(i: number) {
    URL.revokeObjectURL(previews[i]);
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function save() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      let newUrls: string[] = [];
      if (files.length > 0) {
        setPhase("uploading");
        try {
          newUrls = await Promise.all(files.map(async (f) => uploadToCloudinary(await compressImage(f))));
        } catch (err) {
          setError((err as Error).message || "图片上传失败");
          return;
        } finally {
          setPhase("");
        }
      }
      const photoUrls = [...keptUrls, ...newUrls];
      const patch = { note: note.trim() || null, rating: moodTags[0] ?? null, moodTags, photoUrls, isPublic, visitedAt: toISO(visitedAt) };
      const res = await fetch(`/api/checkins/${checkin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "保存失败");
        return;
      }
      onSaved({ note: patch.note, rating: patch.rating, moodTags, photoUrls, photoUrl: photoUrls[0] ?? null, isPublic, createdAt: patch.visitedAt ?? checkin.createdAt });
      onClose();
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setSaving(false);
    }
  }

  async function regenerateImage() {
    if (!onRegenerateImage || regenerating) return;
    if (total >= MAX_IMAGES) {
      window.alert("当前已有 6 张图片，请先删除一张后再生成");
      return;
    }
    setError(null);
    setRegenerating(true);
    try {
      const result = await onRegenerateImage(keptUrls);
      if (!result?.imageUrl) return;
      setKeptUrls(result.imageUrls?.length ? result.imageUrls : [result.imageUrl]);
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <Modal title="编辑足迹" onClose={onClose}>
      <div className="mb-5">
        <label className={labelCls}>到访时间</label>
        <DateTimeField value={visitedAt} onChange={setVisitedAt} placeholder="默认现在" />
      </div>

      <div className="mb-5">
        <label className={labelCls}>想说点什么</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={`${fieldCls} resize-none`} placeholder="这家展览的灯光很好…" />
      </div>

      <div className="mb-5">
        <label className={labelCls}>心情</label>
        <MoodSelector value={moodTags} onChange={setMoodTags} />
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className={labelCls}>图片（最多 {MAX_IMAGES} 张）</label>
          {canRegenerateImage && (
            <button
              type="button"
              onClick={regenerateImage}
              disabled={regenerating || saving}
              className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-600 transition hover:bg-violet-100 disabled:cursor-wait disabled:opacity-60"
            >
              {regenerating ? "生图中…" : "重新生图"}
            </button>
          )}
        </div>
        {canUpload ? (
          <div className="grid grid-cols-3 gap-2">
            {keptUrls.map((src, i) => (
              <div key={`k${i}`} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover rounded-xl" />
                <button type="button" onClick={() => removeKept(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white text-sm leading-none flex items-center justify-center backdrop-blur" aria-label="移除图片">×</button>
              </div>
            ))}
            {previews.map((src, i) => (
              <div key={`n${i}`} className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover rounded-xl" />
                <button type="button" onClick={() => removeNew(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/55 text-white text-sm leading-none flex items-center justify-center backdrop-blur" aria-label="移除图片">×</button>
              </div>
            ))}
            {total < MAX_IMAGES && (
              <label className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed border-neutral-200 rounded-xl text-neutral-400 cursor-pointer transition hover:border-blue-400 hover:text-blue-500">
                <IconPlus className="w-6 h-6" />
                <span className="text-[11px]">添加</span>
                <input type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
              </label>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-lg px-3 py-2">未配置图床，暂不能上传图片。</p>
        )}
      </div>

      <div className="mb-5 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <button type="button" onClick={() => setIsPublic((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
          <span>
            <span className="block text-sm font-medium text-neutral-900">{isPublic ? "公开足迹" : "隐藏足迹"}</span>
            <span className="mt-1 block text-xs text-neutral-500">{isPublic ? "会显示在地图和相关活动聚合中" : "仅自己可见"}</span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${isPublic ? "bg-blue-600" : "bg-neutral-200"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${isPublic ? "left-6" : "left-1"}`} />
          </span>
        </button>
      </div>

      {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onClose} disabled={saving} className="px-5 py-3 text-sm rounded-xl text-neutral-500 hover:bg-neutral-100 transition">取消</button>
        <button type="button" onClick={save} disabled={saving} className="flex-1 py-3 text-sm font-medium rounded-xl bg-blue-600 text-white shadow-sm transition active:scale-[0.99] disabled:opacity-40">
          {phase === "uploading" ? "上传图片…" : saving ? "保存中…" : "保存"}
        </button>
      </div>
    </Modal>
  );
}
