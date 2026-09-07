"use client";

import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";

import { useEffect, useMemo, useState } from "react";
import { IconPlus } from "@/components/icons";
import { MoodSelector } from "@/components/common/MoodSelector";
import { moveImageItem, SortableImageList } from "@/components/common/SortableImageList";
import { compressImage } from "@/lib/image";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { BottomSheet } from "./BottomSheet";
import { compactFieldCls as fieldCls, compactLabelCls as labelCls } from "./formStyles";

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
  const [associationOpen, setAssociationOpen] = useState(false);

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

  const actionFooter = (
    <div className="flex items-center gap-2.5">
      <button type="button" onClick={onCancel} disabled={submitting} className="h-10 px-3 text-xs font-semibold text-neutral-500 transition hover:text-neutral-800">
        取消
      </button>
      <button type="button" onClick={handleSubmit} disabled={submitting} className="flex h-10 flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-[0_6px_16px_rgba(37,99,235,0.22)] transition active:scale-[0.99] disabled:opacity-40">
        {phase === "uploading" ? "上传图片..." : submitting ? "保存中..." : "留下足迹"}
      </button>
    </div>
  );

  return (
    <BottomSheet
      title="留下足迹"
      hint={selectedEvent ? `关联到「${selectedEvent.title}」` : "记录这次到访的感受"}
      onClose={onCancel}
      onSnapChange={onSnapChange}
      busy={submitting ? <LoadingFeedback compact scene="upload" text={phase === "uploading" ? "正在上传照片，保留这份城市记忆…" : "正在保存你的分享…"} /> : undefined}
      footer={actionFooter}
    >
      <div className="mb-3.5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <button type="button" onClick={() => setAssociationOpen((open) => !open)} aria-expanded={associationOpen} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left">
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-neutral-800">关联活动（可选）</span>
            <span className="mt-0.5 block truncate text-[10px] text-neutral-400">{selectedEvent?.title ?? "当前仅记录地图地点"}</span>
          </span>
          <span className={`shrink-0 text-sm text-neutral-400 transition ${associationOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>
        {associationOpen && (
          <div className="space-y-1.5 border-t border-neutral-100 p-2.5">
            {associationOptions.map((option) => (
              <button key={option.id} type="button" onClick={() => setSelectedEvent(option)} className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition ${selectedEvent?.id === option.id ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-neutral-700 hover:bg-neutral-50"}`}>
                <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${selectedEvent?.id === option.id ? "border-blue-600" : "border-neutral-300"}`}>
                  {selectedEvent?.id === option.id && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{option.title}</span>
                  {option.venueName && <span className="mt-0.5 block truncate text-[10px] text-neutral-400">{option.venueName}</span>}
                </span>
              </button>
            ))}
            <button type="button" onClick={() => setSelectedEvent(null)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${selectedEvent === null ? "bg-neutral-100 font-semibold text-neutral-700" : "text-neutral-500 hover:bg-neutral-50"}`}>
              <span className={`grid h-4 w-4 place-items-center rounded-full border ${selectedEvent === null ? "border-neutral-600" : "border-neutral-300"}`}>{selectedEvent === null && <span className="h-2 w-2 rounded-full bg-neutral-600" />}</span>
              不关联活动，仅记录地点
            </button>
            <div className="border-t border-neutral-100 pt-2">
              <input value={eventQuery} onChange={(event) => setEventQuery(event.target.value)} className={`${fieldCls} h-9 bg-white`} placeholder="搜索其他活动" />
              <p className="mt-1 text-[10px] text-neutral-400">{searchingEvents ? "正在搜索…" : eventQuery.trim().length === 1 ? "至少输入 2 个字" : "输入活动名称后选择"}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mb-3.5">
        <label className={labelCls}>想说点什么</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          maxLength={200}
          className={`${fieldCls} min-h-20 resize-none bg-white`}
          placeholder="记录这次到访的感受…"
        />
        <div className="mt-0.5 text-right text-[10px] text-neutral-400">{note.length}/200</div>
      </div>

      <div className="mb-3.5">
        <label className={labelCls}>心情</label>
        <MoodSelector value={moodTags} onChange={setMoodTags} />
      </div>

      <div className="mb-3.5">
        <label className={labelCls}>图片（可选，最多 {MAX_IMAGES} 张）</label>
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
            addControl={files.length < MAX_IMAGES ? (
              <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-neutral-300 bg-white text-neutral-400 transition hover:border-blue-400 hover:text-blue-500">
                <span className="flex flex-col items-center gap-1 text-[11px]">
                  <IconPlus className="h-6 w-6" />
                  添加图片
                </span>
                <input type="file" accept="image/*" multiple onChange={pickFiles} className="hidden" />
              </label>
            ) : undefined}
          />
        ) : (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-600">未配置图床（NEXT_PUBLIC_CLOUDINARY_*），暂不能上传图片。</p>
        )}
      </div>

      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

      <div className="mb-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
        <button type="button" onClick={() => setIsPublic((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
          <span>
            <span className="block text-xs font-semibold text-neutral-900">{isPublic ? "公开足迹" : "隐藏足迹"}</span>
            <span className="mt-0.5 block text-[10px] leading-relaxed text-neutral-500">{isPublic ? "显示在地图和相关活动中" : "仅自己可见，不参与公开聚合"}</span>
          </span>
          <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${isPublic ? "bg-blue-600" : "bg-neutral-200"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${isPublic ? "left-[1.125rem]" : "left-0.5"}`} />
          </span>
        </button>
      </div>
    </BottomSheet>
  );
}
