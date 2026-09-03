"use client";

import { useEffect, useMemo, useState } from "react";
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
  isPublic: boolean;
  eventId?: string | null;
};

export type CheckInEventOption = {
  id: string;
  title: string;
  venueName?: string | null;
  startTime?: string | null;
};

type Props = {
  lat: number;
  lng: number;
  eventId?: string | null;
  targetTitle?: string | null;
  nearbyEvents?: CheckInEventOption[];
  onCancel: () => void;
  onSubmit: (draft: CheckInDraft) => Promise<void>;
  onSnapChange?: (snap: "peek" | "full") => void;
};

/**
 * Signature: `function CheckInDialog({ lat, lng, eventId, targetTitle, nearbyEvents, onCancel, onSubmit, onSnapChange }: Props): React.JSX.Element`
 * Purpose: Creates a footprint and lets the user confirm, replace, search, or remove its optional activity association.
 */
export function CheckInDialog({ lat, lng, eventId, targetTitle, nearbyEvents = [], onCancel, onSubmit, onSnapChange }: Props) {
  const [note, setNote] = useState("");
  const [moodTags, setMoodTags] = useState<number[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"" | "uploading">("");
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CheckInEventOption | null>(
    eventId ? { id: eventId, title: targetTitle ?? "已选活动" } : null,
  );
  const [eventQuery, setEventQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CheckInEventOption[]>([]);
  const [searchingEvents, setSearchingEvents] = useState(false);

  const canUpload = cloudinaryConfigured();
  const MAX_IMAGES = 6;
  const associationOptions = useMemo(() => {
    const byId = new Map<string, CheckInEventOption>();
    if (selectedEvent) byId.set(selectedEvent.id, selectedEvent);
    for (const option of nearbyEvents) byId.set(option.id, option);
    for (const option of searchResults) byId.set(option.id, option);
    return [...byId.values()];
  }, [nearbyEvents, searchResults, selectedEvent]);

  useEffect(() => {
    const query = eventQuery.trim();
    if (query.length < 2) {
      queueMicrotask(() => { setSearchResults([]); setSearchingEvents(false); });
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchingEvents(true);
      try {
        const response = await fetch(`/api/events?search=${encodeURIComponent(query)}`, { signal: controller.signal });
        const data = response.ok ? await response.json() as { events?: CheckInEventOption[] } : {};
        setSearchResults(data.events ?? []);
      } catch (searchError) {
        if ((searchError as Error).name !== "AbortError") setSearchResults([]);
      } finally {
        setSearchingEvents(false);
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [eventQuery]);

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
        isPublic,
        eventId: selectedEvent?.id ?? null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet title="留下足迹" hint={selectedEvent ? `关联到「${selectedEvent.title}」` : "记录这次到访的感受"} onClose={onCancel} onSnapChange={onSnapChange}>
      <div className="mb-6">
        <label className={labelCls}>关联活动（可选）</label>
        <div className="space-y-2 rounded-2xl border border-neutral-200 bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,0.04)]">
          {associationOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setSelectedEvent(option)}
              className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left transition ${selectedEvent?.id === option.id ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-neutral-700 hover:bg-neutral-50"}`}
            >
              <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selectedEvent?.id === option.id ? "border-blue-600" : "border-neutral-300"}`}>
                {selectedEvent?.id === option.id && <span className="h-2 w-2 rounded-full bg-blue-600" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{option.title}</span>
                {option.venueName && <span className="mt-0.5 block truncate text-[11px] text-neutral-400">{option.venueName}</span>}
              </span>
            </button>
          ))}
          <button type="button" onClick={() => setSelectedEvent(null)} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs transition ${selectedEvent === null ? "bg-neutral-100 font-semibold text-neutral-700" : "text-neutral-500 hover:bg-neutral-50"}`}>
            <span className={`grid h-4 w-4 place-items-center rounded-full border ${selectedEvent === null ? "border-neutral-600" : "border-neutral-300"}`}>{selectedEvent === null && <span className="h-2 w-2 rounded-full bg-neutral-600" />}</span>
            不关联活动，仅记录地点
          </button>
          <div className="border-t border-neutral-100 pt-2">
            <input value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} className={`${fieldCls} h-10`} placeholder="输入活动名称，搜索其他活动" />
            <p className="mt-1 text-[11px] text-neutral-400">{searchingEvents ? "正在搜索…" : eventQuery.trim().length === 1 ? "至少输入 2 个字" : "可从上方结果中选择已有活动"}</p>
          </div>
        </div>
      </div>
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

      <div className="mb-5 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-[0_8px_20px_rgba(15,23,42,0.05)]">
        <button
          type="button"
          onClick={() => setIsPublic((value) => !value)}
          className="flex w-full items-center justify-between gap-4 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-neutral-900">{isPublic ? "公开足迹" : "隐藏足迹"}</span>
            <span className="mt-1 block text-xs leading-relaxed text-neutral-500">
              {isPublic ? "会出现在地图和相关活动的足迹聚合中" : "仅自己可见，不参与公开聚合"}
            </span>
          </span>
          <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${isPublic ? "bg-blue-600" : "bg-neutral-200"}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${isPublic ? "left-6" : "left-1"}`} />
          </span>
        </button>
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
