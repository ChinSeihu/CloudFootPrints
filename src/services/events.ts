import { prisma } from "@/lib/db";
import type { Prisma, Event, Post } from "@prisma/client";
import { type EventCategory, isEventCategory } from "@/lib/categories";

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
  sourceUrl: string | null;
  trustLevel: number;
  featuredToday: boolean;
  tags: string[];
  signupEnabled: boolean;
  userId: string | null; // Post 的作者；官方活动为 null
  createdAt: Date;
  updatedAt: Date;
};

// 官方活动 → 统一形状（无作者、无 tags/多图/报名）。
export function normalizeOfficial(e: Event): NormalizedEvent {
  return {
    id: e.id, title: e.title, description: e.description, summary: e.summary,
    category: e.category, venueName: e.venueName, address: e.address,
    imageUrl: e.imageUrl, imageUrls: [], lat: e.lat, lng: e.lng,
    startTime: e.startTime, endTime: e.endTime,
    sourceType: e.sourceType, sourceUrl: e.sourceUrl, trustLevel: e.trustLevel,
    tags: e.tags, signupEnabled: false, featuredToday: e.featuredToday, userId: null,
    createdAt: e.createdAt, updatedAt: e.updatedAt,
  };
}

// 用户发帖 → 统一形状（sourceType=USER；无摘要/地址/来源链接；低信任）。
export function normalizePost(p: Post): NormalizedEvent {
  return {
    id: p.id, title: p.title, description: p.description, summary: null,
    category: p.category, venueName: p.venueName, address: null,
    imageUrl: p.imageUrl, imageUrls: p.imageUrls, lat: p.lat, lng: p.lng,
    startTime: p.startTime, endTime: p.endTime,
    sourceType: "USER", sourceUrl: null, trustLevel: 10,
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

// 按矩形范围 + 可选筛选查活动（官方 Event + 用户 Post 合并）。
export async function getEventsInBounds(q: EventQuery) {
  const bbox = { lat: { gte: q.minLat, lte: q.maxLat }, lng: { gte: q.minLng, lte: q.maxLng } };
  const or = timeWindowOR(q);

  // 官方活动按矩形范围抽取（数据量大，限范围控性能 + 流量）；
  // 用户发帖不限地理范围（量小，全量返回）——允许出现在东京 bbox 之外（如镰仓/箱根/远行的帖）。
  // 分类 / 时间窗筛选仍对两者同样生效。
  const eventWhere: Prisma.EventWhereInput = { ...bbox };
  const postWhere: Prisma.PostWhereInput = {};
  if (q.category) { eventWhere.category = q.category; postWhere.category = q.category; }
  if (or) { eventWhere.OR = or; postWhere.OR = or; }

  const [events, posts] = await Promise.all([
    prisma.event.findMany({ where: eventWhere, orderBy: [{ startTime: "asc" }], take: 500 }),
    prisma.post.findMany({ where: postWhere, orderBy: [{ startTime: "asc" }], take: 500 }),
  ]);
  const merged = [...events.map(normalizeOfficial), ...posts.map(normalizePost)].sort(
    (a, b) => (a.startTime?.getTime() ?? Infinity) - (b.startTime?.getTime() ?? Infinity),
  );
  return attachAuthors(merged.slice(0, 500 + posts.length));
}

export async function getMapEventsInBounds(q: EventQuery) {
  const bbox = { lat: { gte: q.minLat, lte: q.maxLat }, lng: { gte: q.minLng, lte: q.maxLng } };
  const or = timeWindowOR(q);
  const eventWhere: Prisma.EventWhereInput = { ...bbox };
  const postWhere: Prisma.PostWhereInput = {};
  if (q.category) { eventWhere.category = q.category; postWhere.category = q.category; }
  if (or) { eventWhere.OR = or; postWhere.OR = or; }

  const [events, posts] = await Promise.all([
    prisma.event.findMany({
      where: eventWhere,
      orderBy: [{ startTime: "asc" }],
      take: 500,
      select: {
        id: true, title: true, description: true, summary: true, category: true,
        venueName: true, address: true, imageUrl: true, lat: true, lng: true,
        startTime: true, endTime: true, sourceType: true, sourceUrl: true,
        trustLevel: true, featuredToday: true, tags: true, createdAt: true, updatedAt: true,
      },
    }),
    prisma.post.findMany({
      where: postWhere,
      orderBy: [{ startTime: "asc" }],
      take: 500,
      select: {
        id: true, title: true, description: true, category: true, venueName: true,
        imageUrl: true, imageUrls: true, lat: true, lng: true, startTime: true,
        endTime: true, tags: true, signupEnabled: true, userId: true,
        createdAt: true, updatedAt: true,
      },
    }),
  ]);

  return [
    ...events.map((e) => ({ ...e, imageUrls: [], signupEnabled: false, userId: null })),
    ...posts.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      summary: null,
      category: p.category,
      venueName: p.venueName,
      address: null,
      imageUrl: p.imageUrl,
      imageUrls: p.imageUrls,
      lat: p.lat,
      lng: p.lng,
      startTime: p.startTime,
      endTime: p.endTime,
      sourceType: "USER",
      sourceUrl: null,
      trustLevel: 10,
      featuredToday: false,
      tags: p.tags,
      signupEnabled: p.signupEnabled,
      userId: p.userId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      author: null,
    })),
  ].sort((a, b) => (a.startTime?.getTime() ?? Infinity) - (b.startTime?.getTime() ?? Infinity)).slice(0, 500 + posts.length);
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

// 锚点发帖：用户在地图上标记并发布一个活动（sourceType=USER）。
// 用户已在地图上选点，故直接用其 lat/lng，无需地理编码。
export type CreateUserEventInput = {
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

export async function createUserEvent(
  input: CreateUserEventInput,
  userId: string,
): Promise<CreateUserEventResult> {
  if (!input.title?.trim()) return { ok: false, error: "缺少活动名称" };
  if (!isEventCategory(input.category)) return { ok: false, error: "非法分类" };
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { ok: false, error: "缺少或非法的坐标" };
  }
  const event = await createUserEventRow(input, userId);
  return { ok: true, event };
}

export type DeleteUserEventResult = { ok: true } | { ok: false; error: string };

export async function deleteUserEvent(id: string, userId: string): Promise<DeleteUserEventResult> {
  const existing = await prisma.post.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) return { ok: false, error: "发帖不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权限删除" };
  await prisma.post.delete({ where: { id } });
  return { ok: true };
}

// 编辑发帖：仅作者可改，且只改文字信息（不动地图位置 lat/lng 与图片）。
export type UpdateUserEventInput = {
  title?: string;
  category?: EventCategory;
  description?: string | null;
  venueName?: string | null;
  startTime?: string | null; // ISO
  endTime?: string | null; // ISO
  tags?: string[];
  signupEnabled?: boolean;
};

export type UpdateUserEventResult =
  | { ok: true; event: NormalizedEvent }
  | { ok: false; error: string };

export async function updateUserEvent(
  id: string,
  userId: string,
  input: UpdateUserEventInput,
): Promise<UpdateUserEventResult> {
  const existing = await prisma.post.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) return { ok: false, error: "发帖不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权限编辑" };
  if (input.title !== undefined && !input.title.trim()) return { ok: false, error: "缺少活动名称" };
  if (input.category !== undefined && !isEventCategory(input.category)) {
    return { ok: false, error: "非法分类" };
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title.trim();
  if (input.category !== undefined) data.category = input.category;
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.venueName !== undefined) data.venueName = input.venueName?.trim() || null;
  if (input.startTime !== undefined) data.startTime = parseISO(input.startTime);
  if (input.endTime !== undefined) data.endTime = parseISO(input.endTime);
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.signupEnabled !== undefined) data.signupEnabled = input.signupEnabled;

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
