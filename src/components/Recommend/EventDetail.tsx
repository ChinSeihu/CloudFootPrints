"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconPin, IconCalendar, IconMap, IconExternalLink, IconSparkles, IconHeart, IconBookmark } from "@/components/icons";
import { CopyButton } from "@/components/CopyButton";
import { useGuide } from "@/components/Guide/GuideContext";
import { displayTags } from "@/lib/tags";
import type { EventDTO, CommentDTO, UserBrief } from "@/lib/types";
import type { ReactionState } from "@/services/reactions";

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

// 用户头像：有图用图，否则首字母圆形兜底。
function Avatar({ user, size = 32 }: { user: UserBrief | null | undefined; size?: number }) {
  const name = user?.username ?? "用户";
  if (user?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatarUrl}
        alt={name}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-blue-100 text-blue-600 font-semibold grid place-items-center shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

// 活动详情：全屏铺满（同发帖 form）；下滑时头部（分类/标题/日期）固定，其余滚动。
// 显示发帖人、评论作者；右上角 × 关闭。
export function EventDetail({
  event,
  onClose,
}: {
  event: EventDTO;
  onClose: () => void;
}) {
  const router = useRouter();
  const { openGuide } = useGuide();
  const meta = CATEGORY_META[event.category];

  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 点赞 / 收藏状态
  const [reactions, setReactions] = useState<ReactionState>({
    likeCount: 0,
    favoriteCount: 0,
    likedByMe: false,
    favoritedByMe: false,
  });

  useEffect(() => {
    fetch(`/api/events/${event.id}/comments`)
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => setComments(d.comments ?? []))
      .catch(() => setComments([]))
      .finally(() => setLoaded(true));
    fetch(`/api/events/${event.id}/reactions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setReactions(d))
      .catch(() => {});
  }, [event.id]);

  async function toggleReaction(type: "LIKE" | "FAVORITE") {
    setErr(null);
    // 乐观更新
    setReactions((prev) => {
      const isLike = type === "LIKE";
      const active = isLike ? prev.likedByMe : prev.favoritedByMe;
      const delta = active ? -1 : 1;
      return isLike
        ? { ...prev, likedByMe: !active, likeCount: prev.likeCount + delta }
        : { ...prev, favoritedByMe: !active, favoriteCount: prev.favoriteCount + delta };
    });
    try {
      const res = await fetch(`/api/events/${event.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        // 回滚 + 提示
        const refetch = await fetch(`/api/events/${event.id}/reactions`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (refetch) setReactions(refetch);
        setErr(res.status === 401 ? "请先到「个人」页登录后再操作" : "操作失败");
      } else {
        const d = (await res.json()) as { active: boolean; count: number };
        setReactions((prev) =>
          type === "LIKE"
            ? { ...prev, likedByMe: d.active, likeCount: d.count }
            : { ...prev, favoritedByMe: d.active, favoriteCount: d.count },
        );
      }
    } catch {
      setErr("网络错误，请稍后再试");
    }
  }

  async function addComment() {
    const t = text.trim();
    if (!t || posting) return;
    setErr(null);
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
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(res.status === 401 ? "请先到「个人」页登录后再评论" : d.error || "评论失败");
      }
    } catch {
      setErr("网络错误，请稍后再试");
    } finally {
      setPosting(false);
    }
  }

  function jumpToMap() {
    router.push(`/?lat=${event.lat}&lng=${event.lng}`);
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* 固定头部：下滑时分类/标题/日期始终可见 */}
      <div className="relative shrink-0 px-5 pt-5 pb-4 border-b border-black/5 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-3.5 right-3.5 w-9 h-9 grid place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
        <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: meta.color }}>
          <CategoryIcon category={event.category} className="w-4 h-4" />
          {meta.label}
        </div>
        <h2 className="text-lg font-semibold leading-snug pr-10">{event.title}</h2>
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-neutral-600 min-w-0">
            <IconCalendar className="w-4 h-4 shrink-0 text-neutral-400" />
            <span className="truncate">{fmtRange(event.startTime, event.endTime)}</span>
          </div>
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => toggleReaction("LIKE")}
              aria-label="点赞"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition ${
                reactions.likedByMe
                  ? "bg-rose-50 text-rose-500 border-rose-200"
                  : "bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              <IconHeart filled={reactions.likedByMe} className="w-3.5 h-3.5" />
              {reactions.likeCount > 0 && reactions.likeCount}
            </button>
            <button
              type="button"
              onClick={() => toggleReaction("FAVORITE")}
              aria-label="收藏"
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition ${
                reactions.favoritedByMe
                  ? "bg-amber-50 text-amber-500 border-amber-200"
                  : "bg-white text-neutral-500 border-neutral-300 hover:bg-neutral-50"
              }`}
            >
              <IconBookmark filled={reactions.favoritedByMe} className="w-3.5 h-3.5" />
              {reactions.favoriteCount > 0 && reactions.favoriteCount}
            </button>
          </div>
        </div>
      </div>

      {/* 可滚动区：发帖人 + 地点 + 图片 + 简介 + 评论 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {/* 发帖人（仅用户发布的活动有作者） */}
        {event.author && (
          <div className="flex items-center gap-2.5">
            <Avatar user={event.author} size={36} />
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-800">{event.author.username}</div>
              <div className="text-[11px] text-neutral-400">发布了这个活动</div>
            </div>
          </div>
        )}

        {(event.venueName || event.address) && (
          <div className="flex items-start gap-1.5 text-sm text-neutral-600">
            <IconPin className="w-4 h-4 shrink-0 text-neutral-400 mt-0.5" />
            <span className="flex-1 min-w-0">
              {event.venueName}
              {event.address ? (event.venueName ? ` · ${event.address}` : event.address) : ""}
            </span>
            <CopyButton text={event.address || event.venueName || ""} label="复制地址" />
          </div>
        )}

        {event.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt="" className="w-full max-h-[60vh] object-contain rounded-lg bg-neutral-100" />
        )}
        {event.description && (
          <p className="text-sm leading-relaxed text-neutral-700 whitespace-pre-wrap">
            {event.description}
          </p>
        )}
        {(() => {
          const tags = displayTags(event);
          if (tags.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="px-2 py-0.5 rounded-md text-xs bg-neutral-100 text-neutral-600">
                  #{t}
                </span>
              ))}
            </div>
          );
        })()}

        <div>
          <h3 className="text-sm font-medium mb-2">评论 {comments.length > 0 && `(${comments.length})`}</h3>
          {loaded && comments.length === 0 && (
            <p className="text-xs text-neutral-400">还没有评论，来说两句。</p>
          )}
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-2.5">
                <Avatar user={c.author} size={30} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800">
                      {c.author?.username ?? "用户"}
                    </span>
                    <span className="text-[11px] text-neutral-400">
                      {new Date(c.createdAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-700 whitespace-pre-wrap mt-0.5">{c.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 底部操作：评论输入 + 问导游/看地图/来源 */}
      <div className="shrink-0 p-3 border-t border-black/5 space-y-2">
        {err && <p className="text-xs text-red-500 px-1">{err}</p>}
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
            onClick={() =>
              openGuide({
                title: event.title,
                category: meta.label,
                venueName: event.venueName,
                startTime: event.startTime,
                description: event.description,
              })
            }
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-violet-600 text-white"
          >
            <IconSparkles className="w-4 h-4" />
            问导游
          </button>
          <button
            type="button"
            onClick={jumpToMap}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-neutral-900 text-white"
          >
            <IconMap className="w-4 h-4" />
            看地图
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
  );
}
