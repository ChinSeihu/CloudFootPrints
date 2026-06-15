"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_META } from "@/lib/categories";
import { CategoryIcon, IconStar, IconPin, IconMap, IconBookmark, IconBell } from "@/components/icons";
import { useAuth } from "@/components/Auth/AuthContext";
import { AuthForm } from "@/components/Auth/AuthForm";
import { EventDetail } from "@/components/Recommend/EventDetail";
import { CountBadge } from "@/components/common/CountBadge";
import { Lightbox } from "@/components/common/Lightbox";
import { ProfileHeader } from "./ProfileHeader";
import type { CheckInDTO, EventDTO, ReplyNoticeDTO } from "@/lib/types";

type Tab = "checkins" | "posts" | "favorites" | "messages";

function fmtDate(d: string | null): string {
  if (!d) return "时间未定";
  return new Date(d).toLocaleString("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// 登录后的个人页内容：资料卡 + 打卡照片拼图 + 打卡/发帖/收藏/消息 tab。
function MeContent() {
  const router = useRouter();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("checkins");
  const [checkins, setCheckins] = useState<CheckInDTO[]>([]);
  const [posts, setPosts] = useState<EventDTO[]>([]);
  const [favorites, setFavorites] = useState<EventDTO[]>([]);
  const [notices, setNotices] = useState<ReplyNoticeDTO[]>([]);
  const [selected, setSelected] = useState<EventDTO | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [c, p, f, n] = await Promise.all([
        fetch("/api/checkins").then((r) => (r.ok ? r.json() : { checkins: [] })).catch(() => ({ checkins: [] })),
        fetch("/api/events?mine=1").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/favorites").then((r) => (r.ok ? r.json() : { events: [] })).catch(() => ({ events: [] })),
        fetch("/api/replies").then((r) => (r.ok ? r.json() : { notices: [] })).catch(() => ({ notices: [] })),
      ]);
      setCheckins(c.checkins ?? []);
      setPosts(p.events ?? []);
      setFavorites(f.events ?? []);
      setNotices(n.notices ?? []);
      setLoaded(true);
    })();
  }, []);

  // 打卡照片拼图：收集打卡上传的照片（最多 9 张）
  const photos = useMemo(
    () => checkins.map((c) => c.photoUrl).filter((u): u is string => !!u).slice(0, 9),
    [checkins],
  );

  // 消息未读：以「最后已读时间」之后产生的消息计未读（localStorage 按用户存）
  const readKey = user ? `tem_replies_read_${user.id}` : null;
  const [lastRead, setLastRead] = useState(0);
  useEffect(() => {
    if (!readKey) return;
    const v = localStorage.getItem(readKey);
    setLastRead(v ? Number(v) : 0);
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

  async function deletePost(id: string) {
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  async function deleteCheckin(id: string) {
    if (!confirm("确定删除这条打卡吗？")) return;
    const res = await fetch(`/api/checkins/${id}`, { method: "DELETE" });
    if (res.ok) setCheckins((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="h-full overflow-y-auto">
      <ProfileHeader />

      {/* 打卡照片拼图 */}
      <div className="px-4 pt-2 pb-1">
        {photos.length === 0 ? (
          <div className="h-28 rounded-2xl bg-neutral-100 grid place-items-center text-neutral-400">
            <div className="text-center px-4">
              <IconStar className="w-6 h-6 mx-auto mb-1 opacity-50" />
              <p className="text-xs">打卡时上传照片，这里会拼成你的足迹相册</p>
            </div>
          </div>
        ) : (
          <div className={`grid gap-0.5 rounded-2xl overflow-hidden ${photos.length === 1 ? "grid-cols-1" : photos.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt=""
                loading="lazy"
                className={`w-full object-cover ${photos.length === 1 ? "max-h-56" : "aspect-square"}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="flex gap-1 p-1 rounded-2xl bg-neutral-100">
          {([
            ["checkins", "打卡", checkins.length, IconStar],
            ["posts", "发帖", posts.length, IconPin],
            ["favorites", "收藏", favorites.length, IconBookmark],
            ["messages", "消息", notices.length, IconBell],
          ] as const).map(([key, label, count, Icon]) => {
            const active = tab === key;
            const isMsg = key === "messages";
            const badge = isMsg ? unreadCount : count;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  if (isMsg) markMessagesRead();
                }}
                className={`flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-xl text-[13px] transition ${
                  active ? "bg-white text-blue-600 font-medium shadow-sm" : "text-neutral-500"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {badge > 0 && <CountBadge count={badge} active={active} tone={isMsg ? "red" : "blue"} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4">
        {tab === "checkins" ? (
          <>{/* 打卡 */}
            {loaded && checkins.length === 0 && (
              <p className="text-sm text-neutral-500">还没有打卡。回到地图页，用右下角的 ＋ 打卡。</p>
            )}
            <ol className="relative border-l border-neutral-200 ml-2">
              {checkins.map((c) => (
                <li key={c.id} className="mb-5 ml-4">
                  <div className="absolute -left-1.5 w-3 h-3 rounded-full bg-blue-600 border border-white" />
                  <div className="flex items-center gap-2">
                    <time className="text-[11px] text-neutral-400">
                      {new Date(c.createdAt).toLocaleString("zh-CN")}
                    </time>
                    <button
                      type="button"
                      onClick={() => deleteCheckin(c.id)}
                      className="ml-auto text-[11px] text-neutral-400 hover:text-red-500 transition"
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
                  {c.rating != null && (
                    <div className="flex text-amber-500">
                      {Array.from({ length: c.rating }).map((_, i) => (
                        <IconStar key={i} filled className="w-4 h-4" />
                      ))}
                    </div>
                  )}
                  {c.note && <p className="text-sm mt-0.5">{c.note}</p>}
                  {(() => {
                    const imgs = c.photoUrls?.length ? c.photoUrls : c.photoUrl ? [c.photoUrl] : [];
                    if (imgs.length === 0) return null;
                    return (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {imgs.map((src, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={src}
                            alt=""
                            loading="lazy"
                            onClick={() => setLightbox({ images: imgs, index: i })}
                            className="w-20 h-20 rounded-lg object-cover cursor-zoom-in"
                          />
                        ))}
                      </div>
                    );
                  })()}
                </li>
              ))}
            </ol>
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
                        onClick={() => deletePost(p.id)}
                        className="text-xs text-red-500 ml-auto"
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
          <>{/* 收藏 */}
            {loaded && favorites.length === 0 && (
              <p className="text-sm text-neutral-500">还没有收藏。在活动详情里点 🔖 收藏，就会出现在这里。</p>
            )}
            <div className="columns-2 sm:columns-3 gap-3 [column-fill:_balance]">
              {favorites.map((p) => {
                const meta = CATEGORY_META[p.category];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className="mb-3 w-full text-left break-inside-avoid rounded-xl border border-black/10 overflow-hidden bg-white hover:shadow-md transition-shadow"
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
                      <span className="inline-flex items-center gap-1 text-xs text-amber-500 mt-2">
                        <IconBookmark filled className="w-3.5 h-3.5" />
                        已收藏
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>{/* 消息：被回复 */}
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
                      <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold grid place-items-center shrink-0">
                        {(n.author?.username ?? "用户").slice(0, 1).toUpperCase()}
                      </span>
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
      </div>

      {selected && (
        <EventDetail
          event={selected}
          onClose={() => {
            setSelected(null);
            // 详情里可能取消了收藏 —— 关闭时刷新收藏列表
            fetch("/api/favorites")
              .then((r) => (r.ok ? r.json() : { events: [] }))
              .then((d) => setFavorites(d.events ?? []))
              .catch(() => {});
          }}
        />
      )}

      {lightbox && (
        <Lightbox images={lightbox.images} index={lightbox.index} onClose={() => setLightbox(null)} />
      )}
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
