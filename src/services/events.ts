import { prisma } from "@/lib/db";
import type { Prisma, Event, Post, PostKind } from "@prisma/client";
import { type EventCategory, isEventCategory } from "@/lib/categories";
import { DEMO_USERS } from "@/lib/demoUsers";
import { unstable_cache } from "next/cache";

// 领域逻辑：活动查询/写入。route handler 只调用这里，不写逻辑。
// 抓取的官方活动存 Event，用户发帖存 Post（两表分开）。地图/推荐等读路径把两表
// 并起来统一成下面的 NormalizedEvent（Post 映射为 sourceType="USER"），前端无需区分。

export type BBox = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type EventQuery = BBox & {
  category?: EventCategory;
  from?: Date; // 时间窗起
  to?: Date; // 时间窗止
};

// 两表统一后的活动形状（字段对齐 EventDTO；时间仍为 Date，序列化交给上层）。
export type NormalizedEvent = {
  id: string;
  title: string;
  description: string | null;
  summary: string | null;
  category: EventCategory;
  venueName: string | null;
  address: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  lat: number;
  lng: number;
  startTime: Date | null;
  endTime: Date | null;
  sourceType: string;
  postKind: PostKind | null;
  sourceUrl: string | null;
  trustLevel: number;
  featuredToday: boolean;
  tags: string[];
  signupEnabled: boolean;
  userId: string | null; // Post 的作者；官方活动为 null
  createdAt: Date;
  updatedAt: Date;
};

type CachedOfficialEvent = Omit<NormalizedEvent, "startTime" | "endTime" | "createdAt" | "updatedAt"> & {
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
};

// 官方活动 → 统一形状（无作者、无 tags/多图/报名）。
export function normalizeOfficial(e: Event): NormalizedEvent {
  return {
    id: e.id, title: e.title, description: e.description, summary: e.summary,
    category: e.category, venueName: e.venueName, address: e.address,
    imageUrl: e.imageUrl, imageUrls: [], lat: e.lat, lng: e.lng,
    startTime: e.startTime, endTime: e.endTime,
    sourceType: e.sourceType, postKind: null, sourceUrl: e.sourceUrl, trustLevel: e.trustLevel,
    tags: e.tags, signupEnabled: false, featuredToday: e.featuredToday, userId: null,
    createdAt: e.createdAt, updatedAt: e.updatedAt,
  };
}

/**
 * Signature: `function normalizePost(p: Post): NormalizedEvent`
 * Purpose: Converts a LIFE or ACTIVITY Post into the shared event-shaped read model without losing its post kind.
 */
export function normalizePost(p: Post): NormalizedEvent {
  return {
    id: p.id, title: p.title, description: p.description, summary: null,
    category: p.category, venueName: p.venueName, address: null,
    imageUrl: p.imageUrl, imageUrls: p.imageUrls, lat: p.lat, lng: p.lng,
    startTime: p.startTime, endTime: p.endTime,
    sourceType: "USER", postKind: p.kind, sourceUrl: null, trustLevel: 10,
    tags: p.tags, signupEnabled: p.signupEnabled, featuredToday: false, userId: p.userId,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

// 时间窗 where 片段：活动 [startTime, endTime||startTime] 与 [from,to] 有重叠即命中；
// 无 startTime（未定档）始终包含。Event/Post 通用。
function timeWindowOR(q: EventQuery) {
  if (!q.from && !q.to) return undefined;
  return [
    { startTime: null },
    {
      AND: [
        q.to ? { startTime: { lte: q.to } } : {},
        q.from ? { OR: [{ endTime: { gte: q.from } }, { startTime: { gte: q.from } }] } : {},
      ],
    },
  ];
}

const getCachedOfficialEventsInBounds = unstable_cache(async (q: EventQuery) => {
  const bbox = { lat: { gte: q.minLat, lte: q.maxLat }, lng: { gte: q.minLng, lte: q.maxLng } };
  const or = timeWindowOR(q);
  const eventWhere: Prisma.EventWhereInput = { ...bbox };
  if (q.category) eventWhere.category = q.category;
  if (or) eventWhere.OR = or;
  const events = await prisma.event.findMany({ where: eventWhere, orderBy: [{ startTime: "asc" }], take: 500 });
  return events.map((event): CachedOfficialEvent => {
    const normalized = normalizeOfficial(event);
    return {
      ...normalized,
      startTime: normalized.startTime?.toISOString() ?? null,
      endTime: normalized.endTime?.toISOString() ?? null,
      createdAt: normalized.createdAt.toISOString(),
      updatedAt: normalized.updatedAt.toISOString(),
    };
  });
}, ["official-events-in-bounds-v1"], { revalidate: 86_400, tags: ["official-events"] });

/**
 * Signature: `async function getFreshUserPosts(q: EventQuery): Promise<Array<NormalizedEvent & { author: { id: string; username: string; avatarUrl: string | null } | null }>>`
 * Purpose: Loads uncached user and virtual-user posts inside the requested map bounds and optional time/category filters.
 */
async function getFreshUserPosts(q: EventQuery) {
  const bbox = { lat: { gte: q.minLat, lte: q.maxLat }, lng: { gte: q.minLng, lte: q.maxLng } };
  const or = timeWindowOR(q);
  const postWhere: Prisma.PostWhereInput = { ...bbox };
  if (q.category) postWhere.category = q.category;
  if (or) postWhere.OR = or;
  const posts = await prisma.post.findMany({ where: postWhere, orderBy: [{ createdAt: "desc" }], take: 500 });
  return attachAuthors(posts.map(normalizePost));
}

// 官方活动按天缓存；用户发帖始终实时查询，最后合并为现有统一数据结构。
export async function getEventsInBounds(q: EventQuery) {
  const [cachedEvents, posts] = await Promise.all([
    getCachedOfficialEventsInBounds(q),
    getFreshUserPosts(q),
  ]);
  const events: NormalizedEvent[] = cachedEvents.map((event) => ({
    ...event,
    startTime: event.startTime ? new Date(event.startTime) : null,
    endTime: event.endTime ? new Date(event.endTime) : null,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  }));
  return [...events.map((event) => ({ ...event, author: null })), ...posts].sort(
    (a, b) => (a.startTime?.getTime() ?? Infinity) - (b.startTime?.getTime() ?? Infinity),
  ).slice(0, 500 + posts.length);
}

export async function getMapEventsInBounds(q: EventQuery) {
  return getEventsInBounds(q);
}

/**
 * Signature: `async function searchActivities(query: string, limit?: number): Promise<Array<NormalizedEvent & { author: { id: string; username: string; avatarUrl: string | null } | null }>>`
 * Purpose: Searches existing official and user-created activities by title or venue for optional check-in association, excluding LIFE posts.
 */
export async function searchActivities(query: string, limit = 12) {
  const keyword = query.trim().slice(0, 60);
  if (keyword.length < 2) return [];
  const take = Math.min(Math.max(limit, 1), 20);
  const [events, posts] = await Promise.all([
    prisma.event.findMany({
      where: { OR: [{ title: { contains: keyword, mode: "insensitive" } }, { venueName: { contains: keyword, mode: "insensitive" } }] },
      orderBy: { startTime: "desc" },
      take,
    }),
    prisma.post.findMany({
      where: {
        kind: "ACTIVITY",
        OR: [{ title: { contains: keyword, mode: "insensitive" } }, { venueName: { contains: keyword, mode: "insensitive" } }],
      },
      orderBy: { startTime: "desc" },
      take,
    }),
  ]);
  const combined = [...events.map(normalizeOfficial), ...posts.map(normalizePost)].slice(0, take);
  return attachAuthors(combined);
}

// 给一批活动附作者公开信息（仅 Post 有 userId；官方活动 author 为 null）。
async function attachAuthors<T extends { userId: string | null }>(events: T[]) {
  const ids = [...new Set(events.map((e) => e.userId).filter((x): x is string => !!x))];
  const users = ids.length
    ? await prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, username: true, avatarUrl: true },
      })
    : [];
  const map = new Map(users.map((u) => [u.id, u]));
  return events.map((e) => ({ ...e, author: e.userId ? map.get(e.userId) ?? null : null }));
}

// 按 id 取单个活动（先查官方 Event，再查用户 Post），带作者公开信息；不存在返回 null。
export async function getEventById(id: string) {
  const ev = await prisma.event.findUnique({ where: { id } });
  if (ev) { const [w] = await attachAuthors([normalizeOfficial(ev)]); return w; }
  const post = await prisma.post.findUnique({ where: { id } });
  if (post) { const [w] = await attachAuthors([normalizePost(post)]); return w; }
  return null;
}

// 我的发帖：列出当前用户发布的帖子（Post 表），按创建时间倒序。
export async function listUserEvents(userId: string) {
  const posts = await prisma.post.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return attachAuthors(posts.map(normalizePost));
}

// 管理员后台：只列出角色库中的虚拟用户帖子，避免把真实用户内容混入管理范围。
export async function listVirtualUserEvents() {
  const users = await prisma.user.findMany({
    where: { username: { in: DEMO_USERS.map((user) => user.username) } },
    select: { id: true },
  });
  if (users.length === 0) return [];
  const posts = await prisma.post.findMany({
    where: { userId: { in: users.map((user) => user.id) } },
    orderBy: { createdAt: "desc" },
  });
  return attachAuthors(posts.map(normalizePost));
}

// 锚点发帖：用户在地图上标记并发布一个活动（sourceType=USER）。
// 用户已在地图上选点，故直接用其 lat/lng，无需地理编码。
export type CreateUserEventInput = {
  kind: PostKind;
  title: string;
  category: EventCategory;
  description?: string | null;
  venueName?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  startTime?: string | null; // ISO
  endTime?: string | null; // ISO
  tags?: string[];
  signupEnabled?: boolean;
  eventId?: string | null;
  imageSpec?: Prisma.InputJsonValue | null;
  lat: number;
  lng: number;
};

function parseISO(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type CreateUserEventResult =
  | { ok: true; event: NormalizedEvent }
  | { ok: false; error: string };

/**
 * Signature: `async function createUserEventRow(input: CreateUserEventInput, userId: string): Promise<NormalizedEvent>`
 * Purpose: Persists one typed user post with LIFE or ACTIVITY invariants supplied by the service boundary.
 */
async function createUserEventRow(input: CreateUserEventInput, userId: string): Promise<NormalizedEvent> {
  const imageUrls = (input.imageUrls ?? []).filter(Boolean);
  const linkedEvent = input.eventId ? await prisma.event.findUnique({ where: { id: input.eventId }, select: { id: true } }) : null;
  const post = await prisma.post.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      venueName: input.venueName?.trim() || null,
      imageUrl: imageUrls[0] ?? input.imageUrl ?? null, // 封面 = 首图
      imageUrls,
      imageSpec: input.imageSpec ?? undefined,
      kind: input.kind,
      lat: input.lat,
      lng: input.lng,
      startTime: parseISO(input.startTime),
      endTime: parseISO(input.endTime),
      tags: input.tags ?? [],
      signupEnabled: input.signupEnabled ?? false,
      eventId: linkedEvent?.id ?? null,
      userId,
    },
  });
  return normalizePost(post);
}

/**
 * Signature: `async function createUserEvent(input: CreateUserEventInput, userId: string): Promise<CreateUserEventResult>`
 * Purpose: Validates and creates a LIFE update or a time-required ACTIVITY post.
 */
export async function createUserEvent(
  input: CreateUserEventInput,
  userId: string,
): Promise<CreateUserEventResult> {
  if (!input.title?.trim()) return { ok: false, error: "缺少活动名称" };
  if (input.kind === "ACTIVITY" && !input.startTime) return { ok: false, error: "请选择活动开始时间" };
  if (!isEventCategory(input.category)) return { ok: false, error: "非法分类" };
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { ok: false, error: "缺少或非法的坐标" };
  }
  const event = await createUserEventRow(input, userId);
  return { ok: true, event };
}

export type DeleteUserEventResult = { ok: true } | { ok: false; error: string };

async function canManagePostOwner(ownerId: string, actorId: string, isAdmin: boolean) {
  if (ownerId === actorId) return true;
  if (!isAdmin) return false;
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { username: true },
  });
  return !!owner && DEMO_USERS.some((user) => user.username === owner.username);
}

export async function deleteUserEvent(
  id: string,
  userId: string,
  isAdmin = false,
): Promise<DeleteUserEventResult> {
  const existing = await prisma.post.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) return { ok: false, error: "发帖不存在" };
  if (!(await canManagePostOwner(existing.userId, userId, isAdmin))) {
    return { ok: false, error: "无权限删除" };
  }
  await prisma.post.delete({ where: { id } });
  return { ok: true };
}

// 编辑发帖：仅作者可改，且只改文字信息（不动地图位置 lat/lng 与图片）。
export type UpdateUserEventInput = {
  title?: string;
  category?: EventCategory;
  description?: string | null;
  venueName?: string | null;
  imageUrls?: string[];
  startTime?: string | null; // ISO
  endTime?: string | null; // ISO
  tags?: string[];
  signupEnabled?: boolean;
};

export type UpdateUserEventResult =
  | { ok: true; event: NormalizedEvent }
  | { ok: false; error: string };

/**
 * Signature: `async function updateUserEvent(id: string, userId: string, input: UpdateUserEventInput, isAdmin?: boolean): Promise<UpdateUserEventResult>`
 * Purpose: Updates a user post while enforcing LIFE versus ACTIVITY time and signup invariants.
 */
export async function updateUserEvent(
  id: string,
  userId: string,
  input: UpdateUserEventInput,
  isAdmin = false,
): Promise<UpdateUserEventResult> {
  const existing = await prisma.post.findUnique({ where: { id }, select: { userId: true, kind: true, startTime: true, endTime: true } });
  if (!existing) return { ok: false, error: "发帖不存在" };
  if (!(await canManagePostOwner(existing.userId, userId, isAdmin))) {
    return { ok: false, error: "无权限编辑" };
  }
  if (input.title !== undefined && !input.title.trim()) return { ok: false, error: "缺少标题" };
  if (input.category !== undefined && !isEventCategory(input.category)) {
    return { ok: false, error: "非法分类" };
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.category !== undefined) data.category = input.category;
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.venueName !== undefined) data.venueName = input.venueName?.trim() || null;
  if (existing.kind === "ACTIVITY") {
    const nextStart = input.startTime !== undefined ? parseISO(input.startTime) : existing.startTime;
    const nextEnd = input.endTime !== undefined ? parseISO(input.endTime) : existing.endTime;
    if (!nextStart) return { ok: false, error: "请选择活动开始时间" };
    if (nextEnd && nextEnd < nextStart) return { ok: false, error: "结束时间不能早于开始时间" };
    if (input.startTime !== undefined) data.startTime = nextStart;
    if (input.endTime !== undefined) data.endTime = nextEnd;
  } else {
    data.startTime = null;
    data.endTime = null;
  }
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.signupEnabled !== undefined) data.signupEnabled = existing.kind === "ACTIVITY" && input.signupEnabled;
  if (input.imageUrls !== undefined) {
    const imageUrls = input.imageUrls.filter(Boolean);
    data.imageUrls = imageUrls;
    data.imageUrl = imageUrls[0] ?? null;
  }

  const post = await prisma.post.update({ where: { id }, data });
  return { ok: true, event: normalizePost(post) };
}

// 把 URLSearchParams 解析成 EventQuery，做基本校验。
export function parseEventQuery(params: URLSearchParams): EventQuery | { error: string } {
  const num = (k: string) => {
    const v = params.get(k);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  const minLat = num("minLat");
  const maxLat = num("maxLat");
  const minLng = num("minLng");
  const maxLng = num("maxLng");

  for (const [k, v] of [
    ["minLat", minLat],
    ["maxLat", maxLat],
    ["minLng", minLng],
    ["maxLng", maxLng],
  ] as const) {
    if (v === null || Number.isNaN(v)) return { error: `缺少或非法的范围参数：${k}` };
  }

  const q: EventQuery = {
    minLat: minLat!,
    maxLat: maxLat!,
    minLng: minLng!,
    maxLng: maxLng!,
  };

  const category = params.get("category");
  if (category) {
    if (!isEventCategory(category)) return { error: `非法 category：${category}` };
    q.category = category;
  }

  const from = params.get("from");
  if (from) {
    const d = new Date(from);
    if (Number.isNaN(d.getTime())) return { error: "非法 from 时间" };
    q.from = d;
  }
  const to = params.get("to");
  if (to) {
    const d = new Date(to);
    if (Number.isNaN(d.getTime())) return { error: "非法 to 时间" };
    q.to = d;
  }

  return q;
}
