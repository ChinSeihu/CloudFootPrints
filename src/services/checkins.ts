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
  rating?: number | null;
  eventId?: string | null;
};

export type CreateCheckinResult =
  | { ok: true; checkin: Awaited<ReturnType<typeof createCheckinRow>> }
  | { ok: false; error: string };

function createCheckinRow(data: CreateCheckinInput, userId: string) {
  return prisma.checkIn.create({
    data: {
      userId,
      lat: data.lat,
      lng: data.lng,
      note: data.note ?? null,
      photoUrl: data.photoUrl ?? null,
      rating: data.rating ?? null,
      eventId: data.eventId ?? null,
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
