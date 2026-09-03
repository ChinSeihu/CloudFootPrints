"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconPin, IconMap, IconBookmark, IconHeart } from "@/components/icons";
import { useAuth } from "@/components/Auth/AuthContext";
import { AuthForm } from "@/components/Auth/AuthForm";
import { EventDetail } from "@/components/Recommend/EventDetail";
import { CountBadge } from "@/components/common/CountBadge";
import { Lightbox } from "@/components/common/Lightbox";
import { Avatar } from "@/components/common/Avatar";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ProfileHeader } from "./ProfileHeader";
import { EditPostDialog, EditCheckInDialog } from "./EditDialogs";
import { DirectMessages } from "./DirectMessages";
import { moodTagOf } from "@/lib/moods";
import { DEMO_USERS } from "@/lib/demoUsers";
import type { CheckInDTO, DirectConversationDTO, EventDTO, ReplyNoticeDTO } from "@/lib/types";

type Tab = "checkins" | "posts" | "managed" | "favorites" | "messages";

function fmtDate(d: string | null): string {
  if (!d) return "时间未定";
  return new Date(d).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Signature: `function MeContent(): React.ReactElement`
 * Purpose: Renders the signed-in profile with posts, check-ins, activity collections, and messages.
 */
function MeContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("checkins");
  const [favSub, setFavSub] = useState<"wants" | "favorites" | "signups">("wants");
  const [checkins, setCheckins] = useState<CheckInDTO[]>([]);
  const [posts, setPosts] = useState<EventDTO[]>([]);
  const [managedPosts, setManagedPosts] = useState<EventDTO[]>([]);
  const [wants, setWants] = useState<EventDTO[]>([]);
  const [favorites, setFavorites] = useState<EventDTO[]>([]);
  const [signups, setSignups] = useState<EventDTO[]>([]);
  const [notices, setNotices] = useState<ReplyNoticeDTO[]>([]);
  const [conversations, setConversations] = useState<DirectConversationDTO[]>([]);
  const [directUnread, setDirectUnread] = useState(0);
  const [messageSub, setMessageSub] = useState<"direct" | "activity">("direct");
  const [initialChatTarget, setInitialChatTarget] = useState<string | null>(null);
  const [chatOpenNonce, setChatOpenNonce] = useState(0);
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [editingPost, setEditingPost] = useState<EventDTO | null>(null);
  const [editingCheckin, setEditingCheckin] = useState<CheckInDTO | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [confirmBox, setConfirmBox] = useState<{ message: string; onOk: () => void | Promise<void> } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const canRegenerateImages = !!user && DEMO_USERS.some((demo) => demo.username === user.username);

  useEffect(() => {
    (async () => {
      const [c, p, w, f, s, n, m] = await Promise.all([
        fetch("/api/checkins").then((r) => (r.ok ? r.json() : { checkins: [] })).catch(() => ({ checkins: [] })),
        fetch("/api/events?mine=1").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/wants").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/favorites").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/signups").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/replies").then((r) => (r.ok ? r.json() : { notices: [] })).catch(() => ({ notices: [] })),
        fetch("/api/messages").then((r) => (r.ok ? r.json() : { conversations: [] })).catch(() => ({ conversations: [] })),
      ]);
      setCheckins(c.checkins ?? []);
      setPosts(p.events ?? []);
      setWants(w.events ?? []);
      setFavorites(f.events ?? []);
      setSignups(s.events ?? []);
      setNotices(n.notices ?? []);
      setConversations(m.conversations ?? []);
      setDirectUnread((m.conversations ?? []).reduce((sum: number, item: DirectConversationDTO) => sum + item.unreadCount, 0));
      setLoaded(true);
    })();
    const target = new URLSearchParams(window.location.search).get("chat");
    if (target) {
      queueMicrotask(() => {
        setInitialChatTarget(target);
        setTab("messages");
        setMessageSub("direct");
      });
    }
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) return;
    fetch("/api/admin/posts")
      .then((response) => (response.ok ? response.json() : { events: [] }))
      .then((data) => setManagedPosts(data.events ?? []))
      .catch(() => setManagedPosts([]));
  }, [user?.isAdmin]);

  useEffect(() => {
    function openChat(event: Event) {
      const target = (event as CustomEvent<string>).detail;
      if (!target) return;
      setInitialChatTarget(target);
      setChatOpenNonce((current) => current + 1);
      setTab("messages");
      setMessageSub("direct");
    }
    window.addEventListener("tem:open-chat", openChat);
    return () => window.removeEventListener("tem:open-chat", openChat);
  }, []);

  // 打卡照片拼图：收集打卡上传的照片（最多 9 张）
  // 足迹统计：总数 / 照片数 / 活跃天数
  const footStats = useMemo(() => {
    const photoCount = checkins.reduce((n, c) => n + (c.photoUrls?.length || (c.photoUrl ? 1 : 0)), 0);
    const days = new Set(checkins.map((c) => new Date(c.createdAt).toLocaleDateString("zh-CN")));
    return { total: checkins.length, photos: photoCount, days: days.size };
  }, [checkins]);

  // 足迹按「年-月」分组（checkins 已按时间倒序），保留顺序
  const footGroups = useMemo(() => {
    const m = new Map<string, CheckInDTO[]>();
    for (const c of checkins) {
      const d = new Date(c.createdAt);
      const k = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      (m.get(k) ?? m.set(k, []).get(k)!).push(c);
    }
    return [...m.entries()];
  }, [checkins]);

  // 消息未读：以「最后已读时间」之后产生的消息计未读（localStorage 按用户存）
  const readKey = user ? `tem_replies_read_${user.id}` : null;
  const [lastRead, setLastRead] = useState(0);
  useEffect(() => {
    if (!readKey) return;
    const v = localStorage.getItem(readKey);
    queueMicrotask(() => setLastRead(v ? Number(v) : 0));
  }, [readKey]);
  const unreadCount = useMemo(
    () => notices.filter((n) => new Date(n.createdAt).getTime() > lastRead).length,
    [notices, lastRead],
  );
  function markMessagesRead() {
    const now = Date.now();
    setLastRead(now);
    if (readKey) localStorage.setItem(readKey, String(now));
  }

  // 点消息 → 拉取对应活动详情并打开
  async function openNoticeEvent(eventId: string) {
    try {
      const d = await fetch(`/api/events/${eventId}`).then((r) => (r.ok ? r.json() : null));
      if (d?.event) setSelected(d.event);
    } catch {
      /* 忽略 */
    }
  }

  function deletePost(id: string) {
    setConfirmBox({
      message: "确定删除这条发帖吗？",
      onOk: async () => {
        const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
        if (res.ok) {
          setPosts((prev) => prev.filter((p) => p.id !== id));
          setManagedPosts((prev) => prev.filter((p) => p.id !== id));
        }
      },
    });
  }

  function deleteCheckin(id: string) {
    setConfirmBox({
      message: "确定删除这条足迹吗？",
      onOk: async () => {
        const res = await fetch(`/api/checkins/${id}`, { method: "DELETE" });
        if (res.ok) setCheckins((prev) => prev.filter((c) => c.id !== id));
      },
    });
  }

  async function regenerateCheckin(id: string, photoUrls: string[]): Promise<{ imageUrl: string; imageUrls: string[] } | null> {
    try {
      const res = await fetch(`/api/checkins/${id}/regenerate-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.imageUrl) {
        window.alert(data?.error ?? "重新生图失败");
        return null;
      }
      setCheckins((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, photoUrl: data.imageUrl, photoUrls: data.imageUrls ?? [data.imageUrl] }
          : item,
        ),
      );
      return { imageUrl: data.imageUrl, imageUrls: data.imageUrls ?? [data.imageUrl] };
    } catch {
      window.alert("重新生图失败");
      return null;
    }
  }

  async function regeneratePost(id: string): Promise<{ imageUrl: string; imageUrls: string[] } | null> {
    try {
      const res = await fetch(`/api/events/${id}/regenerate-image`, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.imageUrl) {
        window.alert(data?.error ?? "重新生图失败");
        return null;
      }
      setPosts((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, imageUrl: data.imageUrl, imageUrls: data.imageUrls ?? [data.imageUrl] }
            : item,
        ),
      );
      setSelected((prev) =>
        prev?.id === id ? { ...prev, imageUrl: data.imageUrl, imageUrls: data.imageUrls ?? [data.imageUrl] } : prev,
      );
      return { imageUrl: data.imageUrl, imageUrls: data.imageUrls ?? [data.imageUrl] };
    } catch {
      window.alert("重新生图失败");
      return null;
    }
  }

  const tabs: Array<[Tab, string, number]> = [
    ["checkins", "足迹", checkins.length],
    ["posts", "发帖", posts.length],
    ...(user?.isAdmin ? [["managed", "管理", managedPosts.length] as [Tab, string, number]] : []),
    ["favorites", "活动", new Set([...wants, ...favorites, ...signups].map((event) => event.id)).size],
    ["messages", "消息", notices.length + conversations.length],
  ];

  return (
    <div className="h-full overflow-y-auto">
      <ProfileHeader />

      {/* 照片墙暂时隐藏：避免占用个人页首屏空间。 */}

      <div className="px-4 pt-3 pb-0 border-b border-neutral-100">
        <div className="flex items-end gap-6 overflow-x-auto">
          {tabs.map(([key, label, count]) => {
            const active = tab === key;
            const isMsg = key === "messages";
            const badge = isMsg ? unreadCount + directUnread : count;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  if (isMsg) markMessagesRead();
                }}
                className={`relative inline-flex items-center justify-center gap-1.5 pb-2 text-[14px] transition ${
                  active ? "text-neutral-950 font-semibold" : "text-neutral-500"
                }`}
              >
                {label}
                {isMsg && badge > 0 && <CountBadge count={badge} active={active} tone="red" />}
                {active && <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {!loaded ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-neutral-100 animate-pulse" />
            ))}
          </div>
        ) : tab === "checkins" ? (
          <>{/* 足迹 */}
            {loaded && checkins.length === 0 && (
              <p className="text-sm text-neutral-500">还没有足迹。回到地图页，用右下角的 ＋ 记录足迹。</p>
            )}
            {checkins.length > 0 && (
              <div className="grid grid-cols-3 gap-1.5 mb-4">
                {([["足迹", footStats.total], ["照片", footStats.photos], ["活跃天", footStats.days]] as const).map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-neutral-50 px-2 py-1.5 text-center">
                    <div className="text-sm font-semibold text-neutral-800 tabular-nums">{value}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            )}
            {footGroups.map(([month, items]) => (
            <div key={month} className="mb-6">
              <div className="mb-3 border-b border-neutral-200 pb-1 text-[15px] font-semibold text-neutral-900">{month} · {items.length} 处</div>
              <ol className="space-y-6">
              {items.map((c) => {
                const d = new Date(c.createdAt);
                const day = d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
                const weekday = d.toLocaleDateString("zh-CN", { weekday: "short" });
                const time = d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
                return (
                <li key={c.id} className="grid grid-cols-[54px_minmax(0,1fr)] gap-3">
                  <div className="relative text-right">
                    <div className="sticky top-2">
                      <div className="text-[13px] font-semibold text-neutral-800 tabular-nums">{day}</div>
                      <div className="mt-0.5 text-[10px] leading-tight text-neutral-400">{weekday}<br />{time}</div>
                    </div>
                  </div>
                  <div className="relative min-w-0 border-l border-neutral-200 pl-4 pb-1">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-600 shadow-sm" />
                    <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/?lat=${c.lat}&lng=${c.lng}`)}
                      className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-neutral-400 hover:text-blue-500 transition"
                    >
                      <IconMap className="w-3.5 h-3.5" />
                      在地图
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCheckin(c)}
                      className="text-[11px] text-neutral-400 hover:text-blue-500 transition"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCheckin(c.id)}
                      className="text-[11px] text-neutral-400 hover:text-red-500 transition"
                    >
                      删除
                    </button>
                  </div>
                  {c.event && (
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      <CategoryIcon category={c.event.category} className="w-3.5 h-3.5" />
                      {CATEGORY_META[c.event.category].label} · {c.event.title}
                    </div>
                  )}
                  {(() => {
                    const moods = (c.moodTags?.length ? c.moodTags : c.rating ? [c.rating] : []).map(moodTagOf).filter((mood) => !!mood);
                    if (moods.length === 0) return null;
                    return (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {moods.map((mood) => {
                          const { Icon } = mood;
                          return (
                            <span key={mood.value} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${mood.tone}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {mood.label}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })()}
                  {c.note && <p className="mt-2 text-[14px] leading-relaxed text-neutral-800">{c.note}</p>}
                  {(() => {
                    const imgs = c.photoUrls?.length ? c.photoUrls : c.photoUrl ? [c.photoUrl] : [];
                    if (imgs.length === 0) return null;
                    return (
                      <div className={`mt-3 grid gap-2 ${imgs.length === 1 ? "grid-cols-1" : imgs.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
                        {imgs.map((src, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={src}
                            alt=""
                            loading="lazy"
                            onClick={() => setLightbox({ images: imgs, index: i })}
                            className={`h-auto w-full cursor-zoom-in rounded-xl bg-neutral-100 object-contain ${imgs.length === 1 ? "max-h-[70vh] sm:max-h-[640px]" : "max-h-72"}`}
                          />
                        ))}
                      </div>
                    );
                  })()}
                  <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-neutral-400">
                    <span className="inline-flex items-center gap-1">
                      <IconHeart className="h-3.5 w-3.5 text-rose-400" />
                      {c.metrics?.likeCount ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                      </svg>
                      {c.metrics?.commentCount ?? 0}
                    </span>
                  </div>
                  </div>
                </li>
                );
              })}
              </ol>
            </div>
            ))}
          </>
        ) : tab === "posts" ? (
          <>{/* 发帖 */}
            {loaded && posts.length === 0 && (
              <p className="text-sm text-neutral-500">还没有发帖。回到地图页，用右下角的 ＋ → 发帖 标记一个活动。</p>
            )}
            <ul className="space-y-3">
              {posts.map((p) => {
                const meta = CATEGORY_META[p.category];
                return (
                  <li key={p.id} className="rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-md transition-shadow">
                    <button type="button" onClick={() => setSelected(p)} className="block w-full text-left">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" loading="lazy" className="w-full max-h-44 object-cover" />
                      )}
                      <div className="h-1.5" style={{ backgroundColor: meta.color }} />
                      <div className="px-3 pt-3">
                        <div className="flex items-center gap-1 text-[11px] text-neutral-500 mb-1">
                          <CategoryIcon category={p.category} className="w-3.5 h-3.5" />
                          {meta.label} · {fmtDate(p.startTime)}
                        </div>
                        <h3 className="text-sm font-medium leading-snug">{p.title}</h3>
                        {p.venueName && (
                          <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5">
                            <IconPin className="w-3 h-3 shrink-0" />
                            {p.venueName}
                          </div>
                        )}
                        {p.description && (
                          <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{p.description}</p>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-3 px-3 pb-3 pt-2">
                      <button
                        type="button"
                        onClick={() => router.push(`/?lat=${p.lat}&lng=${p.lng}`)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600"
                      >
                        <IconMap className="w-3.5 h-3.5" />
                        在地图上查看
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPost(p)}
                        className="text-xs text-neutral-500 hover:text-blue-600 ml-auto"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePost(p.id)}
                        className="text-xs text-red-500"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : tab === "managed" ? (
          <>{/* 管理员：虚拟用户发帖 */}
            <div className="mb-4 flex items-center justify-between border-b border-neutral-200 pb-2">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900">虚拟用户发帖</h2>
                <p className="mt-0.5 text-xs text-neutral-400">可编辑或删除角色账号发布的内容</p>
              </div>
              <CountBadge count={managedPosts.length} active tone="blue" />
            </div>
            {managedPosts.length === 0 && (
              <p className="text-sm text-neutral-500">当前没有虚拟用户发帖。</p>
            )}
            <ul className="space-y-3">
              {managedPosts.map((p) => {
                const meta = CATEGORY_META[p.category];
                return (
                  <li key={p.id} className="overflow-hidden rounded-lg border border-black/10 bg-white transition-shadow hover:shadow-md">
                    <div className="flex items-center gap-2 border-b border-neutral-100 px-3 py-2">
                      <Avatar user={p.author ?? null} size={28} />
                      <span className="min-w-0 truncate text-xs font-semibold text-neutral-800">
                        {p.author?.username ?? "虚拟用户"}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-neutral-400">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString("zh-CN") : ""}
                      </span>
                    </div>
                    <button type="button" onClick={() => setSelected(p)} className="block w-full text-left">
                      {p.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imageUrl} alt="" loading="lazy" className="max-h-44 w-full object-cover" />
                      )}
                      <div className="h-1" style={{ backgroundColor: meta.color }} />
                      <div className="px-3 py-3">
                        <div className="mb-1 flex items-center gap-1 text-[11px] text-neutral-500">
                          <CategoryIcon category={p.category} className="h-3.5 w-3.5" />
                          {meta.label} · {fmtDate(p.startTime)}
                        </div>
                        <h3 className="text-sm font-medium leading-snug">{p.title}</h3>
                        {p.venueName && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
                            <IconPin className="h-3 w-3 shrink-0" />
                            {p.venueName}
                          </div>
                        )}
                        {p.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{p.description}</p>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-3 border-t border-neutral-100 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => router.push(`/?lat=${p.lat}&lng=${p.lng}`)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600"
                      >
                        <IconMap className="h-3.5 w-3.5" />
                        地图
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPost(p)}
                        className="ml-auto text-xs text-neutral-600 hover:text-blue-600"
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => deletePost(p.id)}
                        className="text-xs text-red-500"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : tab === "favorites" ? (
          (() => {
            const list = favSub === "wants" ? wants : favSub === "favorites" ? favorites : signups;
            return (
              <>{/* 想去 / 收藏 / 报名 二级切换 */}
                <div className="flex gap-2 mb-3">
                  {([["wants", "想去", wants.length], ["favorites", "收藏", favorites.length], ["signups", "报名", signups.length]] as const).map(([key, label, n]) => {
                    const active = favSub === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFavSub(key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] border transition ${
                          active ? "bg-blue-600 text-white border-transparent" : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300"
                        }`}
                      >
                        {label}
                        {n > 0 && <CountBadge count={n} active={active} tone="blue" />}
                      </button>
                    );
                  })}
                </div>
                {loaded && list.length === 0 && (
                  <p className="text-sm text-neutral-500">
                    {favSub === "wants"
                      ? "还没有想去的活动。在推荐卡点“想去”，就会出现在这里。"
                      : favSub === "favorites"
                        ? "还没有收藏。在活动详情里点收藏，就会出现在这里。"
                        : "还没有报名。在开启报名的活动详情里点「报名参加」，就会出现在这里。"}
                  </p>
                )}
                <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3">
                  {list.map((p) => {
                    const meta = CATEGORY_META[p.category];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelected(p)}
                        className="min-w-0 overflow-hidden rounded-xl border border-black/10 bg-white text-left transition-shadow hover:shadow-md"
                      >
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" loading="lazy" className="w-full max-h-44 object-cover" />
                        )}
                        <div className="h-1.5" style={{ backgroundColor: meta.color }} />
                        <div className="p-3">
                          <div className="flex items-center gap-1 text-[11px] text-neutral-500 mb-1">
                            <CategoryIcon category={p.category} className="w-3.5 h-3.5" />
                            {meta.label} · {fmtDate(p.startTime)}
                          </div>
                          <h3 className="text-sm font-medium leading-snug mb-1 line-clamp-2">{p.title}</h3>
                          {p.venueName && (
                            <div className="flex items-center gap-1 text-xs text-neutral-500">
                              <IconPin className="w-3 h-3 shrink-0" />
                              {p.venueName}
                            </div>
                          )}
                          {p.description && (
                            <p className="text-xs text-neutral-600 mt-1 line-clamp-3">{p.description}</p>
                          )}
                          {favSub === "wants" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-rose-500 mt-2">
                              <IconHeart filled className="w-3.5 h-3.5" />
                              想去
                            </span>
                          ) : favSub === "favorites" ? (
                            <span className="inline-flex items-center gap-1 text-xs text-amber-500 mt-2">
                              <IconBookmark filled className="w-3.5 h-3.5" />
                              已收藏
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-500 mt-2">
                              ✓ 已报名
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            );
          })()
        ) : (
          <>{/* 消息：私信 / 被回复 */}
            <div className="mb-4 grid grid-cols-2 rounded-lg bg-neutral-100 p-1">
              <button type="button" onClick={() => setMessageSub("direct")} className={`rounded-md py-2 text-xs font-bold ${messageSub === "direct" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"}`}>私信{directUnread > 0 ? ` ${directUnread}` : ""}</button>
              <button type="button" onClick={() => { setMessageSub("activity"); markMessagesRead(); }} className={`rounded-md py-2 text-xs font-bold ${messageSub === "activity" ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"}`}>互动{unreadCount > 0 ? ` ${unreadCount}` : ""}</button>
            </div>
            {messageSub === "direct" ? (
              <DirectMessages currentUserId={user!.id} initialConversations={conversations} initialTargetId={initialChatTarget} openNonce={chatOpenNonce} onUnreadChange={setDirectUnread} />
            ) : (
            <>
            {loaded && notices.length === 0 && (
              <p className="text-sm text-neutral-500">还没有新消息。当别人评论你的帖子或回复你的评论时，会出现在这里。</p>
            )}
            <ul className="space-y-2.5">
              {notices.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openNoticeEvent(n.eventId)}
                    className="w-full text-left rounded-xl border border-black/10 bg-white p-3 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Avatar user={n.author} size={28} />
                      <span className="text-sm font-medium text-neutral-800 truncate">{n.author?.username ?? "用户"}</span>
                      <span className="text-[11px] text-neutral-400 shrink-0">
                        {n.type === "reply" ? "回复了你的评论" : "评论了你的帖子"}
                      </span>
                      <span className="text-[11px] text-neutral-300 ml-auto shrink-0">
                        {new Date(n.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm text-neutral-700 whitespace-pre-wrap">{n.text}</p>
                    {n.type === "reply" && n.parentText && (
                      <p className="text-xs text-neutral-400 mt-1 pl-2 border-l-2 border-neutral-200 line-clamp-2">
                        你：{n.parentText}
                      </p>
                    )}
                    <div className="text-[11px] text-blue-500 mt-1.5 truncate">在《{n.eventTitle}》· 查看 ›</div>
                  </button>
                </li>
              ))}
            </ul>
            </>
            )}
          </>
        )}
      </div>

      {selected && (
        <EventDetail
          event={selected}
          onClose={() => {
            setSelected(null);
            // 详情里可能改了收藏/报名 —— 关闭时刷新这两个列表
            fetch("/api/favorites")
              .then((r) => (r.ok ? r.json() : { events: [] }))
              .then((d) => setFavorites(d.events ?? []))
              .catch(() => {});
            fetch("/api/signups")
              .then((r) => (r.ok ? r.json() : { events: [] }))
              .then((d) => setSignups(d.events ?? []))
              .catch(() => {});
          }}
        />
      )}

      {editingPost && (
        <EditPostDialog
          event={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={(patch) => {
            setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? { ...p, ...patch } : p)));
            setManagedPosts((prev) => prev.map((p) => (p.id === editingPost.id ? { ...p, ...patch } : p)));
          }}
          canRegenerateImage={canRegenerateImages}
          onRegenerateImage={() => regeneratePost(editingPost.id)}
        />
      )}

      {editingCheckin && (
        <EditCheckInDialog
          checkin={editingCheckin}
          onClose={() => setEditingCheckin(null)}
          onSaved={(patch) => setCheckins((prev) => prev.map((c) => (c.id === editingCheckin.id ? { ...c, ...patch } : c)))}
          canRegenerateImage={canRegenerateImages}
          onRegenerateImage={(photoUrls) => regenerateCheckin(editingCheckin.id, photoUrls)}
        />
      )}

      {lightbox && (
        <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />
      )}

      <ConfirmDialog
        open={!!confirmBox}
        message={confirmBox?.message ?? ""}
        onConfirm={async () => { await confirmBox?.onOk(); setConfirmBox(null); }}
        onCancel={() => setConfirmBox(null)}
      />
    </div>
  );
}

// 个人页：未登录显示登录/注册，登录后显示资料 + 足迹。
export function MeView() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-full grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-neutral-200 border-t-blue-600 animate-spin" />
      </div>
    );
  }
  if (!user) return <AuthForm />;
  return <MeContent />;
}
