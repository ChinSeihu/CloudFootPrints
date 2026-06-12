"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconPin, IconCalendar, IconMap, IconExternalLink } from "@/components/icons";
import { CopyButton } from "@/components/CopyButton";
import type { EventDTO, CommentDTO } from "@/lib/types";

function fmtRange(start: string | null, end: string | null): string {
  if (!start) return "时间未定";
  const opt: Intl.DateTimeFormatOptions = {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  const s = new Date(start).toLocaleString("zh-CN", opt);
  if (!end) return s;
  return `${s} — ${new Date(end).toLocaleString("zh-CN", opt)}`;
}

// 活动详情抽屉：详情 + 评论（查看/发表）+ "跳到地图"按钮。
export function EventDetail({
  event,
  onClose,
}: {
  event: EventDTO;
  onClose: () => void;
}) {
  const router = useRouter();
  const meta = CATEGORY_META[event.category];

  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`/api/events/${event.id}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => setComments(d.comments ?? []))
      .catch(() => setComments([]))
      .finally(() => setLoaded(true));
  }, [event.id]);

  async function addComment() {
    const t = text.trim();
    if (!t || posting) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/events/${event.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      if (res.ok) {
        const d = await res.json();
        setComments((prev) => [...prev, d.comment]);
        setText("");
      }
    } finally {
      setPosting(false);
    }
  }

  function jumpToMap() {
    router.push(`/?lat=${event.lat}&lng=${event.lng}`);
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[85%] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col">
        {/* 头部 */}
        <div className="p-5 border-b border-black/5">
          <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: meta.color }}>
            <CategoryIcon category={event.category} className="w-4 h-4" />
            {meta.label}
          </div>
          <h2 className="text-lg font-semibold leading-snug">{event.title}</h2>
          <div className="mt-2 space-y-1 text-sm text-neutral-600">
            <div className="flex items-center gap-1.5">
              <IconCalendar className="w-4 h-4 shrink-0 text-neutral-400" />
              {fmtRange(event.startTime, event.endTime)}
            </div>
            {(event.venueName || event.address) && (
              <div className="flex items-start gap-1.5">
                <IconPin className="w-4 h-4 shrink-0 text-neutral-400 mt-0.5" />
                <span className="flex-1 min-w-0">
                  {event.venueName}
                  {event.address ? (event.venueName ? ` · ${event.address}` : event.address) : ""}
                </span>
                <CopyButton text={event.address || event.venueName || ""} label="复制地址" />
              </div>
            )}
          </div>
        </div>

        {/* 可滚动区：简介 + 评论 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {event.description && (
            <p className="text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
              {event.description}
            </p>
          )}

          <div>
            <h3 className="text-sm font-medium mb-2">评论 {comments.length > 0 && `(${comments.length})`}</h3>
            {loaded && comments.length === 0 && (
              <p className="text-xs text-neutral-400">还没有评论，来说两句。</p>
            )}
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="text-sm bg-neutral-50 rounded-lg px-3 py-2">
                  <div className="text-[11px] text-neutral-400 mb-0.5">
                    {new Date(c.createdAt).toLocaleString("zh-CN")}
                  </div>
                  <div className="text-neutral-800 whitespace-pre-wrap">{c.text}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 底部操作：评论输入 + 跳到地图 */}
        <div className="p-3 border-t border-black/5 space-y-2">
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addComment();
              }}
              placeholder="写下你的评论…"
              className="flex-1 border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addComment}
              disabled={posting || !text.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white disabled:opacity-40"
            >
              发送
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-neutral-600"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={jumpToMap}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-neutral-900 text-white"
            >
              <IconMap className="w-4 h-4" />
              在地图上查看
            </button>
            {event.sourceUrl && (
              <a
                href={event.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 text-neutral-700"
              >
                <IconExternalLink className="w-4 h-4" />
                来源
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
