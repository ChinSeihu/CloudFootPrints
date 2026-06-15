import { prisma } from "@/lib/db";

// 领域逻辑：打卡查询/写入。

// v1 单用户：固定本人。v2 接入真实用户后改为从会话取 userId。
// TODO(v2): 用认证会话替换固定 userId。
export const CURRENT_USER_ID = "me";

export async function listCheckins(userId: string = CURRENT_USER_ID) {
  return prisma.checkIn.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      event: { select: { id: true, title: true, category: true } },
    },
  });
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

function createCheckinRow(data: CreateCheckinInput, userId: string) {
  // 用户指定了 visitedAt 则覆盖 createdAt（用于补录过去的打卡）；否则用默认 now。
  const visited = data.visitedAt ? new Date(data.visitedAt) : null;
  const photoUrls = (data.photoUrls ?? []).filter(Boolean);
  return prisma.checkIn.create({
    data: {
      userId,
      lat: data.lat,
      lng: data.lng,
      note: data.note ?? null,
      photoUrl: photoUrls[0] ?? data.photoUrl ?? null,
      photoUrls,
      rating: data.rating ?? null,
      eventId: data.eventId ?? null,
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
  if (input.rating != null && (input.rating < 1 || input.rating > 5)) {
    return { ok: false, error: "rating 必须在 1–5 之间" };
  }
  const checkin = await createCheckinRow(input, userId);
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
