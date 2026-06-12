import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { type EventCategory, isEventCategory } from "@/lib/categories";

// 领域逻辑：活动查询/写入。route handler 只调用这里，不写逻辑。

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

// 按矩形范围 + 可选筛选查活动。
// 时间窗逻辑：活动 [startTime, endTime||startTime] 与 [from,to] 有重叠即命中；
// 无 startTime 的活动（未定档）始终包含。
export async function getEventsInBounds(q: EventQuery) {
  const where: Prisma.EventWhereInput = {
    lat: { gte: q.minLat, lte: q.maxLat },
    lng: { gte: q.minLng, lte: q.maxLng },
  };

  if (q.category) where.category = q.category;

  if (q.from || q.to) {
    where.OR = [
      { startTime: null },
      {
        AND: [
          q.to ? { startTime: { lte: q.to } } : {},
          q.from
            ? { OR: [{ endTime: { gte: q.from } }, { startTime: { gte: q.from } }] }
            : {},
        ],
      },
    ];
  }

  return prisma.event.findMany({
    where,
    orderBy: [{ startTime: "asc" }],
    take: 500, // v1 安全上限，避免一次返回过多
  });
}

// 我的发帖：列出当前用户发布的活动（sourceType=USER），按创建时间倒序。
// v1 单用户，全部 USER 活动都属于本人；v2 接入认证后按 userId 过滤。
export function listUserEvents() {
  return prisma.event.findMany({
    where: { sourceType: "USER" },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
}

// 锚点发帖：用户在地图上标记并发布一个活动（sourceType=USER）。
// 用户已在地图上选点，故直接用其 lat/lng，无需地理编码。
export type CreateUserEventInput = {
  title: string;
  category: EventCategory;
  description?: string | null;
  venueName?: string | null;
  imageUrl?: string | null;
  lat: number;
  lng: number;
};

export type CreateUserEventResult =
  | { ok: true; event: Awaited<ReturnType<typeof createUserEventRow>> }
  | { ok: false; error: string };

function createUserEventRow(input: CreateUserEventInput) {
  return prisma.event.create({
    data: {
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      venueName: input.venueName?.trim() || null,
      imageUrl: input.imageUrl || null,
      address: null,
      lat: input.lat,
      lng: input.lng,
      sourceType: "USER",
      sourceUrl: null,
      trustLevel: 10, // 用户发布：低信任
    },
  });
}

export async function createUserEvent(
  input: CreateUserEventInput,
): Promise<CreateUserEventResult> {
  if (!input.title?.trim()) return { ok: false, error: "缺少活动名称" };
  if (!isEventCategory(input.category)) return { ok: false, error: "非法分类" };
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { ok: false, error: "缺少或非法的坐标" };
  }
  const event = await createUserEventRow(input);
  return { ok: true, event };
}

export type DeleteUserEventResult = { ok: true } | { ok: false; error: string };

export async function deleteUserEvent(id: string): Promise<DeleteUserEventResult> {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "活动不存在" };
  if (existing.sourceType !== "USER") return { ok: false, error: "只能删除自己发布的活动" };
  await prisma.event.delete({ where: { id } });
  return { ok: true };
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
