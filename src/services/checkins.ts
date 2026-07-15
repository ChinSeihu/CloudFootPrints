import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// 领域逻辑：打卡查询/写入。

// v1 单用户：固定本人。v2 接入真实用户后改为从会话取 userId。
// TODO(v2): 用认证会话替换固定 userId。
export const CURRENT_USER_ID = "me";

function normalizeMoodTags(moodTags?: number[], fallbackRating?: number | null): number[] {
  const raw = moodTags && moodTags.length > 0 ? moodTags : fallbackRating != null ? [fallbackRating] : [];
  return [...new Set(raw.map((value) => Math.round(Number(value))).filter((value) => Number.isFinite(value)))].slice(0, 6);
}

function serializeCheckin(row: any, currentUserId?: string | null, authors?: Map<string, { id: string; username: string; avatarUrl: string | null }>) {
  const { post, ...checkin } = row;
  return {
    ...checkin,
    postId: row.postId ?? null,
    event: row.event ?? post ?? null,
    metrics: {
      likeCount: row._count?.reactions ?? 0,
      commentCount: row._count?.comments ?? 0,
    },
    isMine: currentUserId ? row.userId === currentUserId : false,
    author: authors?.get(row.userId) ?? null,
  };
}

function clampPageSize(value: number, fallback = 40): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(value)));
}

export async function listCheckins(userId: string = CURRENT_USER_ID) {
  const rows = await prisma.checkIn.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true, category: true } },
      post: { select: { id: true, title: true, category: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });
  // 关联目标可能是官方活动或用户发帖；统一暴露为 event 字段（前端不区分），并去掉 post。
  const authors = await loadCheckinAuthors(rows);
  return rows.map((row) => serializeCheckin(row, userId, authors));
}

export async function listVisibleCheckins(userId?: string | null) {
  const rows = await prisma.checkIn.findMany({
    where: userId ? { OR: [{ isPublic: true }, { userId }] } : { isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      event: { select: { id: true, title: true, category: true } },
      post: { select: { id: true, title: true, category: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });
  const authors = await loadCheckinAuthors(rows);
  return rows.map((row) => serializeCheckin(row, userId, authors));
}

export async function listMapCheckins(userId?: string | null) {
  const rows = await prisma.checkIn.findMany({
    where: userId ? { OR: [{ isPublic: true }, { userId }] } : { isPublic: true },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true,
      userId: true,
      eventId: true,
      postId: true,
      lat: true,
      lng: true,
      note: true,
      photoUrl: true,
      photoUrls: true,
      rating: true,
      moodTags: true,
      isPublic: true,
      createdAt: true,
      event: { select: { id: true, title: true, category: true } },
      post: { select: { id: true, title: true, category: true } },
    },
  });
  const authors = await loadCheckinAuthors(rows);
  return rows.map((row) => serializeCheckin({ ...row, _count: { comments: 0, reactions: 0 } }, userId, authors));
}

export async function listDiscoverCheckins(input: { offset?: number; limit?: number; userId?: string | null } = {}) {
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const limit = clampPageSize(input.limit ?? 40);
  const rows = await prisma.checkIn.findMany({
    where: { isPublic: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: offset,
    take: limit + 1,
    include: {
      event: { select: { id: true, title: true, category: true } },
      post: { select: { id: true, title: true, category: true } },
      _count: { select: { comments: true, reactions: true } },
    },
  });
  const pageRows = rows.slice(0, limit);
  const authors = await loadCheckinAuthors(pageRows);
  return {
    checkins: pageRows.map((row) => serializeCheckin(row, input.userId, authors)),
    nextOffset: offset + pageRows.length,
    hasMore: rows.length > limit,
  };
}

async function loadCheckinAuthors(rows: Array<{ userId: string }>) {
  const ids = [...new Set(rows.map((row) => row.userId).filter(Boolean))];
  if (ids.length === 0) return new Map<string, { id: string; username: string; avatarUrl: string | null }>();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true, avatarUrl: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

export type CreateCheckinInput = {
  lat: number;
  lng: number;
  note?: string | null;
  photoUrl?: string | null;
  photoUrls?: string[];
  rating?: number | null;
  moodTags?: number[];
  isPublic?: boolean;
  visitedAt?: string | null; // ISO；用户自选打卡时间，默认现在
  eventId?: string | null;
  imageSpec?: Prisma.InputJsonValue | null;
};

export type CreateCheckinResult =
  | { ok: true; checkin: Awaited<ReturnType<typeof createCheckinRow>> }
  | { ok: false; error: string };

// 关联目标 id 可能是官方活动或用户发帖（两表 id 全局唯一），解析后写对应列。
async function resolveTarget(id: string): Promise<{ eventId: string } | { postId: string } | null> {
  const e = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (e) return { eventId: id };
  const p = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (p) return { postId: id };
  return null;
}

async function createCheckinRow(data: CreateCheckinInput, userId: string) {
  // 用户指定了 visitedAt 则覆盖 createdAt（用于补录过去的打卡）；否则用默认 now。
  const visited = data.visitedAt ? new Date(data.visitedAt) : null;
  const photoUrls = (data.photoUrls ?? []).filter(Boolean);
  const moodTags = normalizeMoodTags(data.moodTags, data.rating);
  // 关联目标（可选）：解析是官方活动还是用户发帖；解析不到则不关联。
  const target = data.eventId ? await resolveTarget(data.eventId) : null;
  return prisma.checkIn.create({
    data: {
      userId,
      lat: data.lat,
      lng: data.lng,
      note: data.note ?? null,
      photoUrl: photoUrls[0] ?? data.photoUrl ?? null,
      photoUrls,
      imageSpec: data.imageSpec ?? undefined,
      rating: moodTags[0] ?? null,
      moodTags,
      isPublic: data.isPublic === true,
      ...(target ?? {}),
      ...(visited && !Number.isNaN(visited.getTime()) ? { createdAt: visited } : {}),
    },
  });
}

export async function createCheckin(
  input: CreateCheckinInput,
  userId: string = CURRENT_USER_ID,
): Promise<CreateCheckinResult> {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { ok: false, error: "缺少或非法的经纬度" };
  }
  const moodTags = normalizeMoodTags(input.moodTags, input.rating);
  if (moodTags.some((value) => value < 1 || value > 40)) {
    return { ok: false, error: "moodTags 必须在 1–40 之间" };
  }
  const checkin = await createCheckinRow(input, userId);
  return { ok: true, checkin };
}

// 编辑打卡：仅本人可改，文字信息 + 照片 + 时间（不改坐标）。
export type UpdateCheckinInput = {
  note?: string | null;
  rating?: number | null;
  moodTags?: number[];
  photoUrls?: string[];
  isPublic?: boolean;
  visitedAt?: string | null; // ISO
};

export type UpdateCheckinResult =
  | { ok: true; checkin: Awaited<ReturnType<typeof prisma.checkIn.update>> }
  | { ok: false; error: string };

export async function updateCheckin(
  id: string,
  userId: string,
  input: UpdateCheckinInput,
): Promise<UpdateCheckinResult> {
  const existing = await prisma.checkIn.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "打卡记录不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权限编辑" };
  const moodTags = input.moodTags !== undefined ? normalizeMoodTags(input.moodTags, input.rating) : undefined;
  if (moodTags?.some((value) => value < 1 || value > 40)) {
    return { ok: false, error: "moodTags 必须在 1–40 之间" };
  }

  const data: Record<string, unknown> = {};
  if (input.note !== undefined) data.note = input.note ?? null;
  if (moodTags !== undefined) {
    data.moodTags = moodTags;
    data.rating = moodTags[0] ?? null;
  } else if (input.rating !== undefined) {
    const fallbackMoodTags = normalizeMoodTags(undefined, input.rating);
    data.moodTags = fallbackMoodTags;
    data.rating = fallbackMoodTags[0] ?? null;
  }
  if (input.photoUrls !== undefined) {
    const photoUrls = input.photoUrls.filter(Boolean);
    data.photoUrls = photoUrls;
    data.photoUrl = photoUrls[0] ?? null; // 封面 = 首图
  }
  if (input.isPublic !== undefined) data.isPublic = input.isPublic;
  if (input.visitedAt !== undefined) {
    const v = input.visitedAt ? new Date(input.visitedAt) : null;
    if (v && !Number.isNaN(v.getTime())) data.createdAt = v;
  }

  const checkin = await prisma.checkIn.update({ where: { id }, data });
  return { ok: true, checkin };
}

export type DeleteCheckinResult = { ok: true } | { ok: false; error: string };

export async function deleteCheckin(
  id: string,
  userId: string = CURRENT_USER_ID,
): Promise<DeleteCheckinResult> {
  const existing = await prisma.checkIn.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "打卡记录不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权限删除" };
  await prisma.checkIn.delete({ where: { id } });
  return { ok: true };
}
