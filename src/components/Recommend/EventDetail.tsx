"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconPin, IconCalendar, IconMap, IconExternalLink, IconSparkles, IconHeart, IconBookmark, IconChevronLeft } from "@/components/icons";
import { useGuide } from "@/components/Guide/GuideContext";
import { useAuth } from "@/components/Auth/AuthContext";
import { displayTags } from "@/lib/tags";
import { Lightbox } from "@/components/common/Lightbox";
import { Avatar } from "@/components/common/Avatar";
import { CopyButton } from "@/components/CopyButton";
import type { EventDTO, CommentDTO } from "@/lib/types";
import type { ReactionState } from "@/services/reactions";

type CommentSort = "hot" | "new";
type ReplyPageMeta = { total: number; loaded: number; hasMore: boolean; nextCursor: string | null; loading?: boolean };

const COMMENT_PAGE_SIZE = 10;
const REPLY_PREVIEW_SIZE = 3;
const REPLY_PAGE_SIZE = 10;

const cx = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(" ");

function fmtDateTime(value: string | null): string {
  if (!value) return "时间未定";
  return new Date(value).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtCompact(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtCommentTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function durationLabel(start: string | null, end: string | null): string {
  if (!start || !end) return "";
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return "";
  const days = Math.max(1, Math.ceil((b.getTime() - a.getTime()) / 86_400_000) + 1);
  return `持续${days}天`;
}

function iconButtonClass(active = false) {
  return cx(
    "grid h-8 w-8 place-items-center rounded-full bg-white/95 text-neutral-900 shadow-[0_8px_20px_rgba(15,23,42,0.14)] backdrop-blur transition active:scale-95 sm:h-9 sm:w-9",
    active && "text-rose-500",
  );
}

function ShareIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m7 8 5-5 5 5" />
      <path d="M5 12v7h14v-7" />
    </svg>
  );
}

function SmileIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 10h.01M16 10h.01M8.5 15a5 5 0 0 0 7 0" />
    </svg>
  );
}

function ImageIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8" cy="10" r="1.5" />
      <path d="m21 16-5-5L5 19" />
    </svg>
  );
}

function ChevronDownIcon({ className = "h-4 w-4", up = false }: { className?: string; up?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d={up ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
    </svg>
  );
}

function TinyLoading({ label = "加载中" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-200 border-t-violet-400" />
      {label}
    </span>
  );
}

export function EventDetail({ event, onClose }: { event: EventDTO; onClose: () => void }) {
  const router = useRouter();
  const { openGuide } = useGuide();
  const { user } = useAuth();
  const meta = CATEGORY_META[event.category];
  const isUserPost = event.sourceType === "USER";
  const images = event.imageUrls?.length ? event.imageUrls : event.imageUrl ? [event.imageUrl] : [];
  const tags = displayTags(event);
  const cardTags = (event.tags?.length ? event.tags : tags).slice(0, 5);

  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentMoreLoading, setCommentMoreLoading] = useState(false);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentCursor, setCommentCursor] = useState<string | null>(null);
  const [commentHasMore, setCommentHasMore] = useState(false);
  const [replyMeta, setReplyMeta] = useState<Record<string, ReplyPageMeta>>({});
  const [err, setErr] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<CommentSort>("hot");
  const [authorFollowActive, setAuthorFollowActive] = useState(false);

  const [reactions, setReactions] = useState<ReactionState>({
    likeCount: 0,
    favoriteCount: 0,
    signupCount: 0,
    likedByMe: false,
    favoritedByMe: false,
    signedUpByMe: false,
  });

  const byId = useMemo(() => new Map(comments.map((c) => [c.id, c])), [comments]);
  const threads = useMemo(() => {
    const top = comments.filter((c) => !c.parentId);
    const descByRoot = new Map<string, CommentDTO[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      const arr = descByRoot.get(c.parentId);
      if (arr) arr.push(c);
      else descByRoot.set(c.parentId, [c]);
    }
    for (const arr of descByRoot.values()) arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return top.map((comment) => ({ comment, replies: descByRoot.get(comment.id) ?? [] }));
  }, [comments]);

  function mergeComments(prev: CommentDTO[], next: CommentDTO[]) {
    const map = new Map(prev.map((comment) => [comment.id, comment]));
    for (const comment of next) map.set(comment.id, comment);
    return [...map.values()];
  }

  async function loadCommentPage(reset = false) {
    if (reset) {
      setCommentLoading(true);
      setLoaded(false);
    } else {
      setCommentMoreLoading(true);
    }
    try {
      const params = new URLSearchParams({
        paged: "1",
        limit: String(COMMENT_PAGE_SIZE),
        replyLimit: String(REPLY_PREVIEW_SIZE),
        sort,
      });
      if (!reset && commentCursor) params.set("cursor", commentCursor);
      const res = await fetch(`/api/events/${event.id}/comments?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("comments failed");
      setComments((prev) => (reset ? data.comments ?? [] : mergeComments(prev, data.comments ?? [])));
      setCommentTotal(data.totalCount ?? 0);
      setCommentCursor(data.nextCursor ?? null);
      setCommentHasMore(!!data.hasMore);
      setReplyMeta((prev) => (reset ? data.replyMeta ?? {} : { ...prev, ...(data.replyMeta ?? {}) }));
    } catch {
      if (reset) setComments([]);
    } finally {
      setLoaded(true);
      setCommentLoading(false);
      setCommentMoreLoading(false);
    }
  }

  async function loadMoreReplies(rootId: string) {
    const meta = replyMeta[rootId];
    if (!meta || meta.loading || !meta.hasMore) return;
    setReplyMeta((prev) => ({ ...prev, [rootId]: { ...meta, loading: true } }));
    try {
      const params = new URLSearchParams({
        rootId,
        limit: String(REPLY_PAGE_SIZE),
      });
      if (meta.nextCursor) params.set("cursor", meta.nextCursor);
      const res = await fetch(`/api/events/${event.id}/comments?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error("replies failed");
      const newReplies = data.comments ?? [];
      setComments((prev) => mergeComments(prev, newReplies));
      setReplyMeta((prev) => ({
        ...prev,
        [rootId]: {
          ...prev[rootId],
          loaded: (prev[rootId]?.loaded ?? 0) + newReplies.length,
          hasMore: !!data.hasMore,
          nextCursor: data.nextCursor ?? null,
          loading: false,
        },
      }));
    } catch {
      setReplyMeta((prev) => ({ ...prev, [rootId]: { ...prev[rootId], loading: false } }));
    }
  }

  useEffect(() => {
    setComments([]);
    setReplyMeta({});
    setCommentCursor(null);
    setCommentHasMore(false);
    void loadCommentPage(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, sort]);

  useEffect(() => {
    fetch(`/api/events/${event.id}/reactions`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setReactions(d))
      .catch(() => {});
  }, [event.id]);

  useEffect(() => {
    const authorId = event.author?.id;
    if (!isUserPost || !user || !authorId || user.id === authorId) return;
    fetch(`/api/users/follows?userId=${authorId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAuthorFollowActive(!!d?.active))
      .catch(() => {});
  }, [event.author?.id, isUserPost, user]);

  async function toggleReaction(type: "LIKE" | "FAVORITE" | "SIGNUP") {
    setErr(null);
    setReactions((prev) => {
      if (type === "LIKE") {
        const active = prev.likedByMe;
        return { ...prev, likedByMe: !active, likeCount: Math.max(0, prev.likeCount + (active ? -1 : 1)) };
      }
      if (type === "FAVORITE") {
        const active = prev.favoritedByMe;
        return { ...prev, favoritedByMe: !active, favoriteCount: Math.max(0, prev.favoriteCount + (active ? -1 : 1)) };
      }
      const active = prev.signedUpByMe;
      return { ...prev, signedUpByMe: !active, signupCount: Math.max(0, prev.signupCount + (active ? -1 : 1)) };
    });
    try {
      const res = await fetch(`/api/events/${event.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        const refetch = await fetch(`/api/events/${event.id}/reactions`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (refetch) setReactions(refetch);
        setErr(res.status === 401 ? "请先到「个人」页登录后再操作" : "操作失败");
        return;
      }
      const d = (await res.json()) as { active: boolean; count: number };
      setReactions((prev) =>
        type === "LIKE"
          ? { ...prev, likedByMe: d.active, likeCount: d.count }
          : type === "FAVORITE"
            ? { ...prev, favoritedByMe: d.active, favoriteCount: d.count }
            : { ...prev, signedUpByMe: d.active, signupCount: d.count },
      );
    } catch {
      setErr("网络错误，请稍后再试");
    }
  }

  async function toggleAuthorFollow() {
    const authorId = event.author?.id;
    if (!authorId) return;
    if (!user) {
      setErr("请先到「个人」页登录后再关注");
      return;
    }
    if (user.id === authorId) return;
    const next = !authorFollowActive;
    setAuthorFollowActive(next);
    try {
      const res = await fetch("/api/users/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: authorId, active: next }),
      });
      if (!res.ok) setAuthorFollowActive(!next);
    } catch {
      setAuthorFollowActive(!next);
    }
  }

  async function addComment() {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setErr(null);
    setPosting(true);
    try {
      const res = await fetch(`/api/events/${event.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, parentId: replyTo?.id ?? null }),
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

  async function shareEvent() {
    const url = `${window.location.origin}/recommend?event=${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: event.title, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  }

  function jumpToMap() {
    router.push(`/?lat=${event.lat}&lng=${event.lng}`);
  }

  function askGuide() {
    openGuide({
      title: event.title,
      category: meta.label,
      venueName: event.venueName,
      startTime: event.startTime,
      description: event.description,
    });
  }

  function renderComment(c: CommentDTO, isReply: boolean) {
    const mine = !!user && c.userId === user.id;
    const parent = c.parentId ? byId.get(c.parentId) : null;
    const showAt = !!parent && !!parent.parentId;
    const atName = parent?.author?.username ?? "用户";
    return (
      <div className={cx("flex gap-2.5", isReply && "ml-8 border-l border-neutral-100 pl-3")}>
        <Avatar user={c.author} size={isReply ? 28 : 38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{c.author?.username ?? "用户"}</span>
            <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">评论</span>
            <button type="button" onClick={() => toggleReaction("LIKE")} className="ml-auto inline-flex items-center gap-1 text-neutral-400 hover:text-rose-500">
              <IconHeart className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-1 text-[13px] leading-6 text-neutral-800">
            {showAt && <span className="font-medium text-violet-600">@{atName} </span>}
            {c.text}
          </div>
          <div className="mt-1 flex items-center gap-4 text-xs text-neutral-400">
            <span>{fmtCommentTime(c.createdAt)}</span>
            <button type="button" onClick={() => setReplyTo({ id: c.id, username: c.author?.username ?? "用户" })} className="hover:text-violet-600">回复</button>
            {mine && (
              <button type="button" onClick={() => removeComment(c.id)} disabled={deletingId === c.id} className="hover:text-red-500 disabled:opacity-50">
                {deletingId === c.id ? "删除中…" : "删除"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  function commentSection() {
    return (
      <section className="border-t border-neutral-100 pt-5">
        <div className="mb-4 flex items-center gap-2.5">
          <h3 className="border-l-4 border-violet-600 pl-3 text-sm font-bold text-neutral-950">评论 ({commentTotal})</h3>
          <button type="button" onClick={() => setSort("hot")} className={cx("ml-1 rounded-full px-2.5 py-1 text-[11px] font-medium", sort === "hot" ? "border border-violet-400 bg-white text-violet-600" : "bg-neutral-100 text-neutral-600")}>最热</button>
          <button type="button" onClick={() => setSort("new")} className={cx("rounded-full px-2.5 py-1 text-[11px] font-medium", sort === "new" ? "border border-violet-400 bg-white text-violet-600" : "bg-neutral-100 text-neutral-600")}>最新</button>
          {commentLoading && <TinyLoading label="" />}
        </div>
        {!loaded && (
          <div className="py-5 text-center"><TinyLoading /></div>
        )}
        {loaded && !commentLoading && comments.length === 0 && <p className="pb-4 text-[13px] text-neutral-400">还没有评论，来说两句。</p>}
        <ul className="space-y-4">
          {threads.map(({ comment, replies }) => {
            const meta = replyMeta[comment.id];
            const remaining = Math.max(0, (meta?.total ?? replies.length) - replies.length);
            return (
            <li key={comment.id} className="space-y-3.5">
              {renderComment(comment, false)}
              {replies.map((reply) => <div key={reply.id}>{renderComment(reply, true)}</div>)}
              {meta?.hasMore && (
                <button
                  type="button"
                  onClick={() => loadMoreReplies(comment.id)}
                  disabled={!!meta.loading}
                  className="ml-11 inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-500 disabled:opacity-60"
                >
                  {meta.loading ? <TinyLoading label="加载回复" /> : `查看更多回复${remaining > 0 ? `（${remaining}）` : ""}`}
                </button>
              )}
            </li>
          );})}
        </ul>
        {commentHasMore && (
          <button
            type="button"
            onClick={() => loadCommentPage(false)}
            disabled={commentMoreLoading}
            className="mt-5 w-full rounded-full bg-neutral-50 py-3 text-[13px] font-medium text-neutral-600 disabled:opacity-60"
          >
            {commentMoreLoading ? <TinyLoading label="加载评论" /> : "加载更多评论"}
          </button>
        )}
      </section>
    );
  }

  function commentComposer() {
    return (
      <div className="space-y-2">
        {err && <p className="px-1 text-xs text-red-500">{err}</p>}
        {replyTo && (
          <div className="flex items-center justify-between rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-600">
            <span>回复 @{replyTo.username}</span>
            <button type="button" onClick={() => setReplyTo(null)}>取消</button>
          </div>
        )}
        <div className="flex items-center gap-2.5">
          <Avatar user={user} size={36} />
          <div className="flex min-w-0 flex-1 items-center rounded-2xl border border-neutral-200 bg-white px-3 shadow-sm">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addComment(); }}
              placeholder={replyTo ? `回复 @${replyTo.username}…` : "写下你的评论…"}
              className="h-10 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
            />
            <ImageIcon className="h-4 w-4 text-indigo-400" />
            <SmileIcon className="ml-2.5 h-4 w-4 text-indigo-400" />
          </div>
          <button type="button" onClick={addComment} disabled={posting || !text.trim()} className="h-10 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-400 px-4 text-[13px] font-semibold text-white shadow-sm disabled:opacity-40">
            发送
          </button>
        </div>
      </div>
    );
  }

  function detailActionStrip(sourceLabel: string) {
    const baseClass = "flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-1.5 text-center text-[11px] font-semibold text-neutral-700 transition hover:bg-white sm:gap-1.5 sm:py-2";
    const iconClass = "grid h-7 w-7 place-items-center rounded-full bg-white text-violet-500 shadow-sm ring-1 ring-neutral-100 sm:h-8 sm:w-8";
    return (
      <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-neutral-50 p-1.5 sm:p-2">
        <button type="button" onClick={askGuide} className={baseClass}>
          <span className={iconClass}><IconSparkles className="h-3.5 w-3.5" /></span>
          <span className="truncate">问导游</span>
        </button>
        <button type="button" onClick={jumpToMap} className={baseClass}>
          <span className={iconClass}><IconMap className="h-3.5 w-3.5" /></span>
          <span className="truncate">看地图</span>
        </button>
        <button type="button" onClick={shareEvent} className={baseClass}>
          <span className={iconClass}><ShareIcon className="h-3.5 w-3.5" /></span>
          <span className="truncate">分享</span>
        </button>
        {event.sourceUrl ? (
          <a href={event.sourceUrl} target="_blank" rel="noreferrer" className={baseClass}>
            <span className={iconClass}><IconExternalLink className="h-3.5 w-3.5" /></span>
            <span className="truncate">{sourceLabel}</span>
          </a>
        ) : (
          <button type="button" onClick={() => setErr("举报功能稍后开放")} className={baseClass}>
            <span className={iconClass}><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 21V4" /><path d="M5 4h13l-2 5 2 5H5" /></svg></span>
            <span className="truncate">举报</span>
          </button>
        )}
      </div>
    );
  }

  if (isUserPost) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
        <div className="mx-auto flex min-h-full w-full max-w-[920px] flex-col px-4 pb-3 pt-4 sm:px-7 sm:pb-5 sm:pt-8">
          <div className="mb-4 flex items-center sm:mb-7">
            <button type="button" onClick={onClose} aria-label="返回" className="grid h-9 w-9 place-items-center rounded-full bg-white/95 text-neutral-900 shadow-[0_10px_24px_rgba(15,23,42,0.12)] hover:bg-neutral-50 sm:h-10 sm:w-10">
              <IconChevronLeft className="h-5 w-5" />
            </button>
            <div className="ml-auto flex gap-2 sm:gap-2.5">
              <button type="button" onClick={shareEvent} aria-label="分享" className={iconButtonClass()}>
                <ShareIcon className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => toggleReaction("LIKE")} aria-label="点赞" className={iconButtonClass(reactions.likedByMe)}>
                <IconHeart filled={reactions.likedByMe} className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => toggleReaction("FAVORITE")} aria-label="收藏" className={iconButtonClass(reactions.favoritedByMe)}>
                <IconBookmark filled={reactions.favoritedByMe} className="h-4 w-4" />
              </button>
            </div>
          </div>

          <section className="rounded-2xl bg-neutral-50 px-3 py-3">
            <div className="flex items-start gap-2.5">
              <Avatar user={event.author} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-neutral-950">{event.author?.username ?? "用户"}</span>
                </div>
                {(event.venueName || event.address) && (
                  <div className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-4 text-neutral-500">
                    <IconPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                    <span className="line-clamp-2 min-w-0">{event.venueName}{event.address ? ` · ${event.address}` : ""}</span>
                  </div>
                )}
              </div>
              {event.author?.id && user?.id !== event.author.id && (
                <button
                  type="button"
                  onClick={toggleAuthorFollow}
                  className={cx(
                    "shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                    authorFollowActive
                      ? "border-neutral-200 bg-white text-neutral-500"
                      : "border-violet-200 bg-white text-violet-600",
                  )}
                >
                  {authorFollowActive ? "已关注" : "关注"}
                </button>
              )}
            </div>
          </section>

          <main className="mt-3 flex-1 sm:mt-6">
            {images.length > 0 && (
              <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-7 sm:px-7 [&::-webkit-scrollbar]:hidden">
                <div className="flex snap-x snap-mandatory gap-2.5 sm:gap-3">
                  {images.map((src, index) => (
                    <button
                      key={`${src}-${index}`}
                      type="button"
                      onClick={() => setLightbox({ images, index })}
                      className="relative h-[236px] w-[calc(100vw-32px)] max-w-[866px] shrink-0 snap-center overflow-hidden rounded-2xl bg-neutral-100 sm:h-72 sm:w-[calc(100vw-56px)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      {images.length > 1 && (
                        <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                          {index + 1}/{images.length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <h1 className="mt-3 text-[15px] font-black leading-snug tracking-normal text-neutral-950 sm:mt-5 sm:text-[17px]">{event.title}</h1>

            {event.description && (
              <p className="mt-2.5 text-[13px] leading-6 text-neutral-800 sm:mt-5 sm:text-sm sm:leading-7">
                {expanded ? event.description : event.description.slice(0, 120)}
                {!expanded && event.description.length > 120 ? "..." : ""}
                {event.description.length > 120 && (
                  <button type="button" onClick={() => setExpanded((v) => !v)} className="ml-2 inline-flex items-center gap-1 text-[13px] font-semibold text-violet-600">
                    {expanded ? "收起" : "展开"}
                    <ChevronDownIcon up={expanded} />
                  </button>
                )}
              </p>
            )}

            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2">
                {tags.map((tag) => <span key={tag} className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-600 sm:px-3 sm:py-1.5 sm:text-xs"># {tag}</span>)}
              </div>
            )}

            {(event.venueName || event.address) && (
              <button type="button" onClick={jumpToMap} className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-600 sm:text-xs">
                <IconMap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                查看路线
              </button>
            )}

            <div className="mt-3 sm:mt-4">{detailActionStrip("举报")}</div>

            <div className="mt-6 sm:mt-8">{commentSection()}</div>
          </main>

          <div className="mt-4 border-t border-neutral-100 bg-white py-3 sm:mt-6 sm:py-5">
            {commentComposer()}
          </div>
        </div>
        {lightbox && <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />}
      </div>
    );
  }

  const hero = images[0];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="mx-auto min-h-full w-full max-w-[920px] bg-white">
        <section className="relative h-[34vh] min-h-[292px] overflow-hidden bg-neutral-900 sm:h-[48vh] sm:min-h-[420px]">
          {hero ? (
            <button type="button" onClick={() => setLightbox({ images, index: 0 })} className="block h-full w-full cursor-zoom-in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero} alt="" className="h-full w-full object-cover" />
            </button>
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-500 via-emerald-300 to-violet-400" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/65" />
          <button type="button" onClick={onClose} aria-label="返回" className="absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-neutral-900 shadow-lg backdrop-blur sm:left-5 sm:top-5 sm:h-10 sm:w-10">
            <IconChevronLeft className="h-5 w-5" />
          </button>
          <div className="absolute right-4 top-4 flex gap-2 sm:right-5 sm:top-5 sm:gap-2.5">
            <button type="button" onClick={() => toggleReaction("LIKE")} className={iconButtonClass(reactions.likedByMe)}>
              <span className="flex flex-col items-center leading-none"><IconHeart filled={reactions.likedByMe} className="h-4 w-4" />{reactions.likeCount > 0 && <span className="mt-0.5 text-[9px]">{reactions.likeCount}</span>}</span>
            </button>
            <button type="button" onClick={() => toggleReaction("FAVORITE")} className={iconButtonClass(reactions.favoritedByMe)}>
              <IconBookmark filled={reactions.favoritedByMe} className="h-4 w-4" />
            </button>
            <button type="button" onClick={shareEvent} className={iconButtonClass()}><ShareIcon className="h-4 w-4" /></button>
          </div>
          <div className="absolute bottom-9 left-4 right-4 text-white sm:bottom-16 sm:left-8 sm:right-8">
            <span className="mb-2 inline-flex rounded-lg bg-violet-500 px-2.5 py-1 text-[11px] font-bold sm:mb-3 sm:px-3 sm:text-sm">限定</span>
            <h1 className="max-w-[760px] text-[19px] font-black leading-tight tracking-normal drop-shadow-sm sm:text-[24px]">{event.title}</h1>
            {event.summary || event.description ? <p className="mt-1.5 max-w-[740px] text-xs font-medium leading-5 drop-shadow-sm sm:mt-3 sm:text-base sm:leading-relaxed">{event.summary ?? event.description?.slice(0, 40)}</p> : null}
          </div>
          {images.length > 0 && (
            <button type="button" onClick={() => setLightbox({ images, index: 0 })} className="absolute bottom-8 right-4 inline-flex items-center gap-1.5 rounded-xl bg-black/45 px-2.5 py-1 text-xs text-white backdrop-blur sm:bottom-14 sm:right-8 sm:gap-2 sm:px-4 sm:py-2 sm:text-base">
              <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              1/{images.length}
            </button>
          )}
        </section>

        <main className="relative px-4 pb-3 sm:px-7 sm:pb-5">
          <section className="-mt-5 overflow-hidden rounded-[22px] bg-white shadow-[0_16px_38px_rgba(15,23,42,0.13)] ring-1 ring-black/5 sm:-mt-7 sm:rounded-[28px]">
            <div className="grid grid-cols-2 divide-x divide-neutral-100 px-3.5 py-3.5 sm:px-6 sm:py-6">
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400 sm:mb-2 sm:gap-2 sm:text-xs"><IconCalendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />活动时间</div>
                <div className="space-y-1 text-[13px] font-bold leading-snug text-neutral-950 sm:text-sm">
                  <div>{fmtCompact(event.startTime)}</div>
                  {event.endTime && <><div className="text-xs text-neutral-400">—</div><div>{fmtCompact(event.endTime)}</div></>}
                </div>
                {durationLabel(event.startTime, event.endTime) && <span className="mt-2 inline-flex rounded-lg bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-600 sm:text-xs">{durationLabel(event.startTime, event.endTime)}</span>}
              </div>
              <div className="pl-3.5 sm:pl-10">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-400 sm:mb-2 sm:gap-2 sm:text-xs"><IconPin className="h-3.5 w-3.5 sm:h-4 sm:w-4" />活动地点</div>
                <div className="space-y-1 text-[13px] font-bold leading-snug text-neutral-950 sm:text-sm">
                  <div className="flex min-w-0 items-start gap-1.5">
                    <span className="line-clamp-2 min-w-0 flex-1">{event.venueName ?? "地点未定"}</span>
                    <CopyButton text={event.address || event.venueName || ""} label="复制地点" className="h-5 w-5 rounded-full hover:bg-neutral-100" />
                  </div>
                  {event.address && <div className="truncate text-xs font-semibold text-neutral-600">{event.address}</div>}
                </div>
                <button type="button" onClick={jumpToMap} className="mt-2 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-500 sm:px-3 sm:py-1.5 sm:text-xs">查看地图 〉</button>
              </div>
            </div>
            <div className="border-t border-neutral-100 bg-neutral-50/70 px-3.5 py-2.5 sm:px-4 sm:py-3">
              <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-600">
                  <CategoryIcon category={event.category} className="h-4 w-4" />
                  {meta.label}
                </span>
                {cardTags.map((tag) => (
                  <span key={tag} className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 shadow-sm ring-1 ring-neutral-100">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="mt-3 sm:mt-4">{detailActionStrip("来源")}</div>

          {event.description && (
            <section className="px-2 py-5 sm:px-4 sm:py-6">
              <p className={cx("text-[13px] leading-6 text-neutral-900 sm:text-sm sm:leading-7", !expanded && "line-clamp-4")}>{event.description}</p>
              {event.description.length > 140 && (
                <button type="button" onClick={() => setExpanded((v) => !v)} className="mx-auto mt-4 block text-sm font-semibold text-violet-600">
                  <span className="inline-flex items-center gap-1">
                    {expanded ? "收起更多" : "展开更多"}
                    <ChevronDownIcon up={expanded} />
                  </span>
                </button>
              )}
            </section>
          )}

          <div className="mt-6 sm:mt-8">{commentSection()}</div>

          <div className="mt-5 border-t border-neutral-100 bg-white py-4 sm:mt-6 sm:py-5">
            {commentComposer()}
          </div>
        </main>
      </div>
      {lightbox && <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}
