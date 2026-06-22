"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconPin, IconCalendar, IconMap, IconExternalLink, IconSparkles, IconHeart, IconBookmark } from "@/components/icons";
import { CopyButton } from "@/components/CopyButton";
import { useGuide } from "@/components/Guide/GuideContext";
import { useAuth } from "@/components/Auth/AuthContext";
import { displayTags } from "@/lib/tags";
import { Lightbox } from "@/components/common/Lightbox";
import { Avatar } from "@/components/common/Avatar";
import { ShareButton } from "@/components/common/ShareButton";
import type { EventDTO, CommentDTO } from "@/lib/types";
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
  const { user } = useAuth();
  const meta = CATEGORY_META[event.category];

  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);

  // 按 id 索引，便于查回复目标
  const byId = useMemo(() => new Map(comments.map((c) => [c.id, c])), [comments]);

  // 顶层评论 + 其整棵子树的所有回复（楼中楼，平铺一层缩进，按时间排序）
  const threads = useMemo(() => {
    const map = new Map(comments.map((c) => [c.id, c]));
    const rootOf = (c: CommentDTO): string => {
      let cur = c;
      let guard = 0;
      while (cur.parentId && map.get(cur.parentId) && guard < 50) {
        cur = map.get(cur.parentId)!;
        guard++;
      }
      return cur.id;
    };
    const top = comments.filter((c) => !c.parentId);
    const descByRoot = new Map<string, CommentDTO[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const root = rootOf(c);
      if (root === c.id) continue;
      const arr = descByRoot.get(root);
      if (arr) arr.push(c);
      else descByRoot.set(root, [c]);
    }
    for (const arr of descByRoot.values()) arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return top.map((t) => ({ comment: t, replies: descByRoot.get(t.id) ?? [] }));
  }, [comments]);

  // 点赞 / 收藏 / 报名状态
  const [reactions, setReactions] = useState<ReactionState>({
    likeCount: 0,
    favoriteCount: 0,
    signupCount: 0,
    likedByMe: false,
    favoritedByMe: false,
    signedUpByMe: false,
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

  async function toggleReaction(type: "LIKE" | "FAVORITE" | "SIGNUP") {
    setErr(null);
    // 乐观更新
    setReactions((prev) => {
      if (type === "LIKE") {
        const a = prev.likedByMe;
        return { ...prev, likedByMe: !a, likeCount: prev.likeCount + (a ? -1 : 1) };
      }
      if (type === "FAVORITE") {
        const a = prev.favoritedByMe;
        return { ...prev, favoritedByMe: !a, favoriteCount: prev.favoriteCount + (a ? -1 : 1) };
      }
      const a = prev.signedUpByMe;
      return { ...prev, signedUpByMe: !a, signupCount: prev.signupCount + (a ? -1 : 1) };
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
            : type === "FAVORITE"
              ? { ...prev, favoritedByMe: d.active, favoriteCount: d.count }
              : { ...prev, signedUpByMe: d.active, signupCount: d.count },
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
        body: JSON.stringify({ text: t, parentId: replyTo?.id ?? null }),
      });
      if (res.ok) {
        const d = await res.json();
        setComments((prev) => [...prev, d.comment]);
        setText("");
        setReplyTo(null);
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

  async function removeComment(id: string) {
    if (deletingId) return;
    setErr(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/comments/${id}`, { method: "DELETE" });
      if (res.ok) {
        // 删除该评论及其整棵子树（后端级联删，前端同步移除）
        setComments((prev) => {
          const remove = new Set([id]);
          let changed = true;
          while (changed) {
            changed = false;
            for (const c of prev) {
              if (c.parentId && remove.has(c.parentId) && !remove.has(c.id)) {
                remove.add(c.id);
                changed = true;
              }
            }
          }
          return prev.filter((c) => !remove.has(c.id));
        });
      } else {
        const d = await res.json().catch(() => ({}));
        setErr(d.error || "删除失败");
      }
    } catch {
      setErr("网络错误，请稍后再试");
    } finally {
      setDeletingId(null);
    }
  }

  function jumpToMap() {
    router.push(`/?lat=${event.lat}&lng=${event.lng}`);
  }

  // 单条评论（含回复缩进、回复/删除按钮；楼中楼显示 @回复目标）
  function renderComment(c: CommentDTO, isReply: boolean) {
    const mine = !!user && c.userId === user.id;
    // 父级是「回复」（而非顶层评论）时，属于楼中楼 → 显示 @目标
    const parent = c.parentId ? byId.get(c.parentId) : null;
    const showAt = !!parent && !!parent.parentId;
    const atName = parent?.author?.username ?? "用户";
    return (
      <div className={`flex gap-2.5 ${isReply ? "ml-9" : ""}`}>
        <Avatar user={c.author} size={isReply ? 26 : 30} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-800">{c.author?.username ?? "用户"}</span>
            <span className="text-[11px] text-neutral-400">{new Date(c.createdAt).toLocaleString("zh-CN")}</span>
          </div>
          <div className="text-sm text-neutral-700 whitespace-pre-wrap mt-0.5">
            {showAt && <span className="text-blue-600 font-medium">@{atName}：</span>}
            {c.text}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => setReplyTo({ id: c.id, username: c.author?.username ?? "用户" })}
              className="text-[11px] text-neutral-400 hover:text-blue-600 transition"
            >
              回复
            </button>
            {mine && (
              <button
                type="button"
                onClick={() => removeComment(c.id)}
                disabled={deletingId === c.id}
                className="text-[11px] text-neutral-400 hover:text-red-500 transition disabled:opacity-60"
              >
                {deletingId === c.id ? "删除中…" : "删除"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
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

      {/* 可滚动区：报名 + 发帖人 + 地点 + 图片 + 简介 + 评论 */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
        {/* 报名（仅开启报名的活动） */}
        {event.signupEnabled && (
          <button
            type="button"
            onClick={() => toggleReaction("SIGNUP")}
            className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${
              reactions.signedUpByMe
                ? "bg-blue-50 text-blue-700 border border-blue-200"
                : "bg-blue-600 text-white"
            }`}
          >
            {reactions.signedUpByMe ? "已报名 · 点击取消" : "报名参加"}
            {reactions.signupCount > 0 && (
              <span className="ml-1 opacity-75 font-normal">（{reactions.signupCount} 人已报名）</span>
            )}
          </button>
        )}

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

        {(() => {
          const imgs = event.imageUrls?.length ? event.imageUrls : event.imageUrl ? [event.imageUrl] : [];
          if (imgs.length === 0) return null;
          if (imgs.length === 1) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgs[0]}
                alt=""
                onClick={() => setLightbox({ images: imgs, index: 0 })}
                className="w-full max-h-[60vh] object-contain rounded-lg bg-neutral-100 cursor-zoom-in"
              />
            );
          }
          return (
            <div className="grid grid-cols-3 gap-1">
              {imgs.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  loading="lazy"
                  onClick={() => setLightbox({ images: imgs, index: i })}
                  className="w-full aspect-square object-cover rounded-lg bg-neutral-100 cursor-zoom-in"
                />
              ))}
            </div>
          );
        })()}
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
            {threads.map(({ comment, replies }) => (
              <li key={comment.id} className="space-y-3">
                {renderComment(comment, false)}
                {replies.map((r) => (
                  <div key={r.id}>{renderComment(r, true)}</div>
                ))}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 底部操作：评论输入 + 问导游/看地图/来源 */}
      <div className="shrink-0 p-3 border-t border-black/5 space-y-2">
        {err && <p className="text-xs text-red-500 px-1">{err}</p>}
        {replyTo && (
          <div className="flex items-center justify-between text-[11px] text-blue-600 bg-blue-50 rounded-lg px-2.5 py-1">
            <span>回复 @{replyTo.username}</span>
            <button type="button" onClick={() => setReplyTo(null)} className="text-blue-400 hover:text-blue-600">
              取消
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addComment();
            }}
            placeholder={replyTo ? `回复 @${replyTo.username}…` : "写下你的评论…"}
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
          <ShareButton
            title={event.title}
            url={`${typeof window !== "undefined" ? window.location.origin : ""}/recommend?event=${event.id}`}
            className="inline-flex items-center justify-center gap-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 text-neutral-700"
          />
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

      {lightbox && (
        <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
