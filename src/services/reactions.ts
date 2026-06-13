import { prisma } from "@/lib/db";
import { ReactionType } from "@prisma/client";

// 领域逻辑：点赞 / 收藏。route 取 getCurrentUserId() 后传入，service 不读 cookie。

export type ReactionState = {
  likeCount: number;
  favoriteCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
};

// 某活动的点赞/收藏汇总 + 当前用户是否已操作（未登录则 byMe 恒 false）。
export async function getReactionState(
  eventId: string,
  userId: string | null,
): Promise<ReactionState> {
  const [likeCount, favoriteCount, mine] = await Promise.all([
    prisma.reaction.count({ where: { eventId, type: ReactionType.LIKE } }),
    prisma.reaction.count({ where: { eventId, type: ReactionType.FAVORITE } }),
    userId
      ? prisma.reaction.findMany({ where: { eventId, userId }, select: { type: true } })
      : Promise.resolve([] as { type: ReactionType }[]),
  ]);
  return {
    likeCount,
    favoriteCount,
    likedByMe: mine.some((r) => r.type === ReactionType.LIKE),
    favoritedByMe: mine.some((r) => r.type === ReactionType.FAVORITE),
  };
}

export type ToggleResult = { active: boolean; count: number };

// 切换点赞/收藏：已存在则取消，否则新增。返回新状态 + 该类型最新计数。
export async function toggleReaction(
  eventId: string,
  userId: string,
  type: ReactionType,
): Promise<ToggleResult> {
  const existing = await prisma.reaction.findUnique({
    where: { userId_eventId_type: { userId, eventId, type } },
  });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    // 活动不存在时 create 会因外键失败 —— 先校验，给出干净错误。
    const ev = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!ev) throw new Error("活动不存在");
    await prisma.reaction.create({ data: { eventId, userId, type } });
  }
  const count = await prisma.reaction.count({ where: { eventId, type } });
  return { active: !existing, count };
}

// 当前用户收藏的活动（按收藏时间倒序）。返回活动 + 作者公开信息。
export async function listFavoriteEvents(userId: string) {
  const favs = await prisma.reaction.findMany({
    where: { userId, type: ReactionType.FAVORITE },
    orderBy: { createdAt: "desc" },
    include: { event: true },
  });
  const events = favs.map((f) => f.event);
  const authorIds = [...new Set(events.map((e) => e.userId).filter((x): x is string => !!x))];
  const users = authorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, username: true, avatarUrl: true },
      })
    : [];
  const map = new Map(users.map((u) => [u.id, u]));
  return events.map((e) => ({ ...e, author: e.userId ? map.get(e.userId) ?? null : null }));
}
