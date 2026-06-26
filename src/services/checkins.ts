import { prisma } from "@/lib/db";

// 领域逻辑：打卡查询/写入。

// v1 单用户：固定本人。v2 接入真实用户后改为从会话取 userId。
// TODO(v2): 用认证会话替换固定 userId。
export const CURRENT_USER_ID = "me";

export async function listCheckins(userId: string = CURRENT_USER_ID) {
  const rows = await prisma.checkIn.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true, category: true } },
      post: { select: { id: true, title: true, category: true } },
    },
  });
  // 关联目标可能是官方活动或用户发帖；统一暴露为 event 字段（前端不区分），并去掉 post。
  return rows.map(({ post, ...c }) => ({ ...c, event: c.event ?? post ?? null }));
}

export type CreateCheckinInput = {
  lat: number;
  lng: number;
  note?: string | null;
  photoUrl?: string | null;
  photoUrls?: string[];
  rating?: number | null;
  visitedAt?: string | null; // ISO；用户自选打卡时间，默认现在
  eventId?: string | null;
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
      rating: data.rating ?? null,
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
  if (input.rating != null && (input.rating < 1 || input.rating > 10)) {
    return { ok: false, error: "rating 必须在 1–10 之间" };
  }
  const checkin = await createCheckinRow(input, userId);
  return { ok: true, checkin };
}

// 编辑打卡：仅本人可改，文字信息 + 照片 + 时间（不改坐标）。
export type UpdateCheckinInput = {
  note?: string | null;
  rating?: number | null;
  photoUrls?: string[];
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
  if (input.rating != null && (input.rating < 1 || input.rating > 10)) {
    return { ok: false, error: "rating 必须在 1–10 之间" };
  }

  const data: Record<string, unknown> = {};
  if (input.note !== undefined) data.note = input.note ?? null;
  if (input.rating !== undefined) data.rating = input.rating ?? null;
  if (input.photoUrls !== undefined) {
    const photoUrls = input.photoUrls.filter(Boolean);
    data.photoUrls = photoUrls;
    data.photoUrl = photoUrls[0] ?? null; // 封面 = 首图
  }
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
