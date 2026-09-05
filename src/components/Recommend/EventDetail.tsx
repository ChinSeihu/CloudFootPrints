"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconPin, IconCalendar, IconMap, IconHeart, IconBookmark, IconChevronLeft } from "@/components/icons";
import { useAuth } from "@/components/Auth/AuthContext";
import { displayTags } from "@/lib/tags";
import { Lightbox } from "@/components/common/Lightbox";
import { Avatar } from "@/components/common/Avatar";
import { CopyButton } from "@/components/CopyButton";
import { DirectMessages } from "@/components/Me/DirectMessages";
import { copyToClipboard } from "@/lib/clipboard";
import { buildJourneyMapUrl } from "@/lib/eventJourney";
import type { EventDTO, CommentDTO } from "@/lib/types";
import type { ReactionState } from "@/services/reactions";

type CommentSort = "hot" | "new";
type ReplyPageMeta = { total: number; loaded: number; hasMore: boolean; nextCursor: string | null; loading?: boolean; error?: boolean };

const COMMENT_PAGE_SIZE = 10;
const REPLY_PREVIEW_SIZE = 3;
const REPLY_PAGE_SIZE = 10;

const cx = (...items: Array<string | false | null | undefined>) => items.filter(Boolean).join(" ");

/**
 * Signature: `function fmtDateTime(value: string | null): string`
 * Purpose: Formats activity times in Tokyo time for departure planning.
 */
function fmtDateTime(value: string | null): string {
  if (!value) return "时间未定";
  return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Signature: `function fmtCompact(value: string | null): string`
 * Purpose: Formats activity times in Tokyo time for departure planning.
 */
function fmtCompact(value: string | null): string {
  if (!value) return "时间待定";
  return new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
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
    "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/95 text-neutral-900 shadow-[0_8px_20px_rgba(15,23,42,0.14)] backdrop-blur transition active:scale-95 sm:h-9 sm:w-9",
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

/**
 * Signature: `function MoreIcon(props): React.JSX.Element`
 * Purpose: Shows the compact overflow affordance used for the post action group.
 */
function MoreIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="19" cy="12" r="1.7" />
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

/**
 * Signature: `function EventDetail({ event, onClose }: { event: EventDTO; onClose: () => void }): React.JSX.Element`
 * Purpose: Renders activity details with account-backed want-to-go actions and type-appropriate life update interactions.
 */
export function EventDetail({ event, onClose }: { event: EventDTO; onClose: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const meta = CATEGORY_META[event.category];
  const isUserPost = event.sourceType === "USER";
  const images = event.imageUrls?.length ? event.imageUrls : event.imageUrl ? [event.imageUrl] : [];
  const tags = displayTags(event);
  const cardTags = (event.tags?.length ? event.tags : tags).slice(0, 5);

  const [comments, setComments] = useState<CommentDTO[]>([]);
  const [directMessageTarget, setDirectMessageTarget] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentLoadError, setCommentLoadError] = useState(false);
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
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [wantedId, setWantedId] = useState<string | null>(null);
  const [wantLoadedKey, setWantLoadedKey] = useState<string | null>(null);
  const [wantSaving, setWantSaving] = useState(false);
  const [wantError, setWantError] = useState<string | null>(null);
  const [postActionsExpanded, setPostActionsExpanded] = useState(true);
  const wantInFlight = useRef(false);
  const shareNoticeTimer = useRef<number | null>(null);
  const postScrollRef = useRef<HTMLDivElement | null>(null);

  const [reactions, setReactions] = useState<ReactionState>({
    likeCount: 0,
    favoriteCount: 0,
    signupCount: 0,
    likedByMe: false,
    favoritedByMe: false,
    signedUpByMe: false,
  });

  const byId = useMemo(() => new Map(comments.map((c) => [c.id, c])), [comments]);

  /**
   * Signature: `function handlePostScroll(): void`
   * Purpose: Switches the post action bar between its full and compact states as the detail scrolls.
   */
  function handlePostScroll() {
    const element = postScrollRef.current;
    if (!element) return;
    const scrollableDistance = element.scrollHeight - element.clientHeight;
    const scrollEndBuffer = 24;
    const collapseThreshold = Math.min(element.clientHeight * 0.25, Math.max(1, scrollableDistance - scrollEndBuffer));
    const expanded = scrollableDistance <= 0 || element.scrollTop < collapseThreshold;
    setPostActionsExpanded((current) => current === expanded ? current : expanded);
  }

  useEffect(() => {
    if (!isUserPost) return;
    handlePostScroll();
  }, [event.id, isUserPost]);

  useEffect(() => {
    if (!user || event.postKind === "LIFE") return;
    let cancelled = false;
    fetch("/api/wants")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { events: EventDTO[] }) => {
        if (!cancelled) {
          setWantedId(data.events.some((item) => item.id === event.id) ? event.id : null);
          setWantLoadedKey(`${user.id}:${event.id}`);
        }
      })
      .catch(() => { if (!cancelled) setWantError("想去状态加载失败，请重新打开详情"); });
    return () => { cancelled = true; };
  }, [event.id, event.postKind, user]);

  /**
   * Signature: `async function toggleWant(): Promise<void>`
   * Purpose: Saves the dedicated WANT reaction and notifies mounted recommendation cards after success.
   */
  async function toggleWant() {
    if (!user) { router.push("/me"); onClose(); return; }
    if (wantInFlight.current) return;
    wantInFlight.current = true;
    setWantSaving(true);
    setWantError(null);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "WANT" }),
      });
      const data = await response.json() as { active: boolean; error?: string };
      if (!response.ok) throw new Error(data.error ?? "保存失败，请稍后再试");
      setWantedId(data.active ? event.id : null);
      window.dispatchEvent(new Event("wants-changed"));
    } catch (error) {
      setWantError(error instanceof Error ? error.message : "网络错误，请稍后再试");
    } finally {
      wantInFlight.current = false;
      setWantSaving(false);
    }
  }
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

  /**
   * Signature: `async function loadCommentPage(reset?: boolean): Promise<void>`
   * Purpose: Loads comment pages while distinguishing request failures from confirmed empty results.
   */
  async function loadCommentPage(reset = false) {
    setCommentLoadError(false);
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
      setCommentLoadError(true);
    } finally {
      setLoaded(true);
      setCommentLoading(false);
      setCommentMoreLoading(false);
    }
  }

  /**
   * Signature: `async function loadMoreReplies(rootId: string): Promise<void>`
   * Purpose: Loads additional replies with per-thread loading and retry feedback.
   */
  async function loadMoreReplies(rootId: string) {
    const meta = replyMeta[rootId];
    if (!meta || meta.loading || !meta.hasMore) return;
    setReplyMeta((prev) => ({ ...prev, [rootId]: { ...meta, loading: true, error: false } }));
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
      setReplyMeta((prev) => ({ ...prev, [rootId]: { ...prev[rootId], loading: false, error: true } }));
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

  function startDirectMessage() {
    const authorId = event.author?.id;
    if (!authorId || user?.id === authorId) return;
    if (!user) {
      setErr("请先登录后再发起私信");
      return;
    }
    setDirectMessageTarget(authorId);
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

  function showShareNotice(message: string) {
    if (shareNoticeTimer.current !== null) window.clearTimeout(shareNoticeTimer.current);
    setShareNotice(message);
    shareNoticeTimer.current = window.setTimeout(() => {
      setShareNotice(null);
      shareNoticeTimer.current = null;
    }, 1800);
  }

  useEffect(() => () => {
    if (shareNoticeTimer.current !== null) window.clearTimeout(shareNoticeTimer.current);
  }, []);

  async function shareEvent() {
    const url = `${window.location.origin}/recommend?event=${event.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text: event.title, url });
        showShareNotice("分享已完成");
        return;
      } catch {
        /* Some desktop browsers report AbortError when no share target exists. */
      }
    }
    const copied = await copyToClipboard(url);
    showShareNotice(copied ? "活动链接已复制" : "分享失败，请稍后再试");
  }

  const shareFeedback = shareNotice && (
    <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[80] -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-950/90 px-4 py-2.5 text-xs font-semibold text-white shadow-xl backdrop-blur">
      {shareNotice}
    </div>
  );

  /**
   * Signature: `function jumpToMap(): void`
   * Purpose: Opens the map with this activity preselected as the route destination.
   */
  function jumpToMap() {
    router.push(buildJourneyMapUrl(event, "route"));
  }

  /**
   * Signature: `function eventActionPanel(): React.JSX.Element | null`
   * Purpose: Keeps activity-specific planning and reservation guidance available without restoring the secondary social action strip.
   */
  function eventActionPanel() {
    if (event.postKind === "LIFE") return null;
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={toggleWant} disabled={wantSaving || (!!user && wantLoadedKey !== `${user.id}:${event.id}`)} aria-pressed={!!user && wantedId === event.id}
            className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition active:scale-[0.99] disabled:opacity-60 ${user && wantedId === event.id ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-600 hover:bg-rose-100"}`}>
            <IconHeart filled={!!user && wantedId === event.id} className="h-4 w-4" />
            {wantSaving ? "保存中…" : user && wantedId === event.id ? "已想去" : "想去"}
          </button>
          <button type="button" onClick={jumpToMap} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white"><IconMap className="h-4 w-4" />规划出发路线</button>
        </div>
        <div className="rounded-xl bg-neutral-50 px-3 py-2 text-xs leading-5 text-neutral-600">
          <p>{event.signupEnabled ? "此活动开放站内报名；门票及入场要求请向发布者确认。" : "预约、票价及入场时段以活动来源的最新说明为准。"}</p>
          {event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex py-1 font-semibold text-violet-700">查看来源与预约信息 ↗</a> : <span>请联系发布者确认，想去或收藏不代表完成预约。</span>}
          {user && wantedId === event.id && <button type="button" className="ml-2 py-1 font-semibold text-rose-600" onClick={() => { onClose(); router.push("/me?collection=wants"); }}>查看我的想去 ›</button>}
          {reactions.favoritedByMe && <button type="button" className="ml-2 py-1 font-semibold text-violet-700" onClick={() => { onClose(); router.push("/me?collection=favorites"); }}>查看我的收藏 ›</button>}
        </div>
        {wantError && <p role="alert" className="text-xs text-red-600">{wantError}</p>}
      </div>
    );
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
        {!loaded && !commentLoading && !commentLoadError && <p role="status" className="pb-4 text-xs text-neutral-500">正在加载评论…</p>}
        {commentLoadError && <p role="alert" className="pb-4 text-xs text-rose-700">评论加载失败。<button type="button" className="ml-2 underline" onClick={() => void loadCommentPage(comments.length === 0)}>重试</button></p>}
        {loaded && !commentLoading && !commentLoadError && comments.length === 0 && <p className="pb-4 text-[13px] text-neutral-400">还没有评论，来说两句。</p>}
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
                  {meta.loading ? <TinyLoading label="加载回复" /> : meta.error ? "回复加载失败，点击重试" : `查看更多回复${remaining > 0 ? `（${remaining}）` : ""}`}
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

  if (isUserPost) {
    return (
      <div ref={postScrollRef} onScroll={handlePostScroll} className="fixed inset-0 z-50 overflow-y-auto bg-white">
        <div className="mx-auto flex min-h-full w-full max-w-[920px] flex-col px-4 pb-3 pt-4 sm:px-7 sm:pb-5 sm:pt-8">
          <div className="sticky top-0 z-40 -mx-4 flex min-w-0 items-center bg-white/95 px-4 py-2 shadow-[0_6px_18px_rgba(15,23,42,0.06)] backdrop-blur sm:-mx-7 sm:px-7 sm:py-2.5">
            <button type="button" onClick={onClose} aria-label="返回" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/95 text-neutral-900 shadow-[0_10px_24px_rgba(15,23,42,0.12)] hover:bg-neutral-50 sm:h-10 sm:w-10">
              <IconChevronLeft className="h-5 w-5" />
            </button>
            <div className="ml-3 flex min-w-0 flex-1 items-center gap-2.5">
              <Avatar user={event.author} size={36} />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span title={event.author?.username ?? "用户"} className="min-w-0 flex-1 truncate whitespace-nowrap text-sm text-neutral-950">{event.author?.username ?? "用户"}</span>
                {event.author?.id && user?.id !== event.author.id && (
                  <button type="button" onClick={startDirectMessage} className="shrink-0 whitespace-nowrap text-[10px] font-semibold text-violet-600 sm:text-[11px]">私信</button>
                )}
              </div>
            </div>
            <div className="ml-1 flex shrink-0 items-center gap-1 sm:ml-auto sm:gap-2.5">
              {event.author?.id && user?.id !== event.author.id && (
                <button
                  type="button"
                  onClick={toggleAuthorFollow}
                  className={cx(
                    "h-7 w-[3.25rem] shrink-0 whitespace-nowrap rounded-full border px-1 py-1.5 text-[10px] font-semibold transition sm:h-9 sm:w-16 sm:px-2 sm:text-[11px]",
                    authorFollowActive
                      ? "border-neutral-200 bg-white text-neutral-500"
                      : "border-violet-200 bg-white text-violet-600",
                  )}
                >
                  {authorFollowActive ? "已关注" : "关注"}
                </button>
              )}
              <div
                className={cx(
                  "flex items-center gap-1 overflow-hidden transition-[max-width,opacity,transform] duration-300 ease-out sm:gap-2.5",
                  postActionsExpanded ? "max-w-[8rem] translate-x-0 opacity-100 sm:max-w-[10rem]" : "pointer-events-none max-w-0 translate-x-2 opacity-0",
                )}
                aria-hidden={!postActionsExpanded}
              >
                <button type="button" tabIndex={postActionsExpanded ? 0 : -1} onClick={() => toggleReaction("LIKE")} aria-label="点赞" className={iconButtonClass(reactions.likedByMe)}>
                  <IconHeart filled={reactions.likedByMe} className="h-4 w-4" />
                </button>
                <button type="button" tabIndex={postActionsExpanded ? 0 : -1} onClick={() => toggleReaction("FAVORITE")} aria-label="收藏" className={iconButtonClass(reactions.favoritedByMe)}>
                  <IconBookmark filled={reactions.favoritedByMe} className="h-4 w-4" />
                </button>
                <button type="button" tabIndex={postActionsExpanded ? 0 : -1} onClick={shareEvent} aria-label="分享" className={iconButtonClass()}>
                  <ShareIcon className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPostActionsExpanded(true)}
                aria-label="展开点赞、收藏和分享操作"
                aria-expanded={postActionsExpanded}
                aria-hidden={postActionsExpanded}
                tabIndex={postActionsExpanded ? -1 : 0}
                className={cx(
                  "grid h-7 shrink-0 place-items-center rounded-full bg-white/95 text-neutral-700 shadow-[0_8px_20px_rgba(15,23,42,0.14)] backdrop-blur transition-[opacity,transform,width] duration-300 ease-out active:scale-95",
                  postActionsExpanded ? "pointer-events-none w-0 translate-x-2 opacity-0" : "w-7 translate-x-0 opacity-100 sm:h-9 sm:w-9",
                )}
              >
                <MoreIcon />
              </button>
            </div>
          </div>

          <main className="mt-3 flex-1 sm:mt-6">
            {images.length > 0 && (
              <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-7 sm:px-7 [&::-webkit-scrollbar]:hidden">
                <div className="flex items-start snap-x snap-mandatory gap-2.5 sm:gap-3">
                  {images.map((src, index) => (
                    <button
                      key={`${src}-${index}`}
                      type="button"
                      onClick={() => setLightbox({ images, index })}
                      className="relative block w-[calc(100vw-32px)] max-w-[866px] shrink-0 snap-center overflow-hidden rounded-2xl bg-neutral-100 sm:w-[calc(100vw-56px)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="block h-auto w-full" />
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

            {event.postKind === "LIFE" && (
              <p className="mt-2 text-[11px] leading-4 text-neutral-400">发布时间：{event.createdAt ? fmtCompact(event.createdAt) : "时间未定"}</p>
            )}

            <section className="mt-2 bg-neutral-50 px-3 py-3 sm:mt-3">
              {(event.venueName || event.address) && (
                <div className="mt-1.5 flex justify-between items-center gap-1.5 text-[11px] leading-4 text-neutral-500">
                  <section className="bg-neutral-50">
                    <span className="flex items-center gap-1.5 min-w-0 mb-1">
                      <IconPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                      <span className="line-clamp-2 min-w-0">{event.venueName}{event.address ? ` · ${event.address}` : ""}</span>
                    </span>
                    {event.postKind !== "LIFE" && (
                      <span>活动时间：{fmtCompact(event.startTime)}{event.endTime ? ` - ${fmtCompact(event.endTime)}` : ""}</span>
                    )}
                  </section>
                  <button type="button" onClick={jumpToMap} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1.5 text-[11px] font-semibold text-violet-600 sm:text-xs">
                    <IconMap className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    查看路线
                  </button>
                </div>
              )}
            </section>
            <div className="mt-3 sm:mt-5">{commentSection()}</div>
          </main>

          <div className="mt-4 border-t border-neutral-100 bg-white py-3 sm:mt-6 sm:py-5">
            {commentComposer()}
          </div>
        </div>
        {shareFeedback}
        {lightbox && <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />}
        {directMessageTarget && user && (
          <DirectMessages
            currentUserId={user.id}
            initialConversations={[]}
            initialTargetId={directMessageTarget}
            openNonce={0}
            onUnreadChange={() => undefined}
            onClose={() => setDirectMessageTarget(null)}
          />
        )}
      </div>
    );
  }

  const hero = images[0];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="mx-auto min-h-full w-full max-w-[920px] bg-white">
        <div className="absolute z-99 opacity-50 px-4 w-full pb-3 pt-4 sm:px-7 sm:pb-5 sm:pt-8">
          <button type="button" onClick={onClose} aria-label="返回" className="left-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-neutral-900 shadow-lg backdrop-blur sm:left-5 sm:top-5 sm:h-10 sm:w-10">
            <IconChevronLeft className="h-5 w-5" />
          </button>
          <div className="absolute right-4 top-4 flex gap-2 sm:right-5 sm:top-5 sm:gap-2.5">
            <button type="button" onClick={() => toggleReaction("LIKE")} className={iconButtonClass(reactions.likedByMe)}>
              <span className="flex flex-col items-center leading-none"><IconHeart filled={reactions.likedByMe} className="h-4 w-4" /></span>
            </button>
            <button type="button" onClick={() => toggleReaction("FAVORITE")} className={iconButtonClass(reactions.favoritedByMe)}>
              <IconBookmark filled={reactions.favoritedByMe} className="h-4 w-4" />
            </button>
            <button type="button" onClick={shareEvent} aria-label="分享" className={iconButtonClass()}><ShareIcon className="h-4 w-4" /></button>
          </div>
        </div>
        <section className="relative h-[34vh] min-h-[292px] overflow-hidden bg-blue-500 sm:h-[48vh] sm:min-h-[420px]">
          {hero ? (
            <button type="button" onClick={() => setLightbox({ images, index: 0 })} className="block h-full w-full cursor-zoom-in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero} alt="" className="h-full w-full object-cover" />
            </button>
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-500 via-emerald-300 to-violet-400" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/65" />
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
                <button type="button" onClick={jumpToMap} className="mt-2 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-semibold text-indigo-500 sm:px-3 sm:py-1.5 sm:text-xs">查看路线 〉</button>
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

          <div className="mt-3 sm:mt-4">{eventActionPanel()}</div>

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
      {shareFeedback}
      {lightbox && <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />}
    </div>
  );
}
