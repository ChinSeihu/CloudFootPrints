import { prisma } from "@/lib/db";
import { ReactionType } from "@prisma/client";
import { normalizeOfficial, normalizePost, type NormalizedEvent } from "./events";

// 领域逻辑：点赞 / 收藏。route 取 getCurrentUserId() 后传入，service 不读 cookie。
// 目标可为官方活动(Event)或用户发帖(Post)，前端只传一个 id；这里解析其归属表。

// 解析 id 属于官方活动还是用户发帖（id 在两表间全局唯一）。不存在返回 null。
type ReactionTarget = { eventId: string } | { postId: string } | { checkInId: string };

/**
 * Signature: `async function resolveTarget(id: string): Promise<ReactionTarget | null>`
 * Purpose: Resolves only official or already-visible targets that can receive reactions.
 */
async function resolveTarget(id: string): Promise<ReactionTarget | null> {
  const now = new Date();
  const e = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (e) return { eventId: id };
  const p = await prisma.post.findFirst({ where: { id, createdAt: { lte: now } }, select: { id: true } });
  if (p) return { postId: id };
  const c = await prisma.checkIn.findFirst({ where: { id, createdAt: { lte: now } }, select: { id: true, isPublic: true } });
  if (c?.isPublic) return { checkInId: id };
  return null;
}

export type ReactionState = {
  likeCount: number;
  favoriteCount: number;
  signupCount: number;
  likedByMe: boolean;
  favoritedByMe: boolean;
  signedUpByMe: boolean;
};

/**
 * Signature: `async function getReactionState(targetId: string, userId: string | null): Promise<ReactionState>`
 * Purpose: Returns published reaction totals and the current user's published reaction state.
 */
export async function getReactionState(
  targetId: string,
  userId: string | null,
): Promise<ReactionState> {
  // 目标 id 可能是 Event 或 Post，统一用 OR 匹配两列。
  const target = { OR: [{ eventId: targetId }, { postId: targetId }, { checkInId: targetId }] };
  const released = { createdAt: { lte: new Date() } };
  const [likeCount, favoriteCount, signupCount, mine] = await Promise.all([
    prisma.reaction.count({ where: { ...target, ...released, type: ReactionType.LIKE } }),
    prisma.reaction.count({ where: { ...target, ...released, type: ReactionType.FAVORITE } }),
    prisma.reaction.count({ where: { ...target, ...released, type: ReactionType.SIGNUP } }),
    userId
      ? prisma.reaction.findMany({ where: { ...target, ...released, userId }, select: { type: true } })
      : Promise.resolve([] as { type: ReactionType }[]),
  ]);
  return {
    likeCount,
    favoriteCount,
    signupCount,
    likedByMe: mine.some((r) => r.type === ReactionType.LIKE),
    favoritedByMe: mine.some((r) => r.type === ReactionType.FAVORITE),
    signedUpByMe: mine.some((r) => r.type === ReactionType.SIGNUP),
  };
}

export type ToggleResult = { active: boolean; count: number };

/**
 * Signature: `async function toggleReaction(targetId: string, userId: string, type: ReactionType): Promise<ToggleResult>`
 * Purpose: Toggles a reaction on a visible target and returns its published total.
 */
export async function toggleReaction(
  targetId: string,
  userId: string,
  type: ReactionType,
): Promise<ToggleResult> {
  // 目标不存在则给干净错误（否则外键失败）。同时确定写哪一列。
  const target = await resolveTarget(targetId);
  if (!target) throw new Error("活动不存在");

  const now = new Date();
  const existing = await prisma.reaction.findFirst({ where: { ...target, userId, type } });
  let active: boolean;
  if (existing && existing.createdAt <= now) {
    await prisma.reaction.delete({ where: { id: existing.id } });
    active = false;
  } else if (existing) {
    await prisma.reaction.update({ where: { id: existing.id }, data: { createdAt: now } });
    active = true;
  } else {
    await prisma.reaction.create({ data: { ...target, userId, type, createdAt: now } });
    active = true;
  }
  const count = await prisma.reaction.count({ where: { ...target, type, createdAt: { lte: now } } });
  return { active, count };
}

/**
 * Signature: `async function listEventsByReaction(userId: string, type: ReactionType): Promise<Array<NormalizedEvent & { author: { id: string; username: string; avatarUrl: string | null } | null }>>`
 * Purpose: Lists visible activities reached through the user's already-published reactions.
 */
async function listEventsByReaction(userId: string, type: ReactionType) {
  const now = new Date();
  const rows = await prisma.reaction.findMany({
    where: { userId, type, createdAt: { lte: now } },
    orderBy: { createdAt: "desc" },
    include: { event: true, post: true },
  });
  const events = rows
    .map((r) => (r.event ? normalizeOfficial(r.event) : r.post && r.post.createdAt <= now ? normalizePost(r.post) : null))
    .filter((e): e is NormalizedEvent => e !== null);
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

// 当前用户收藏的活动。
export function listFavoriteEvents(userId: string) {
  return listEventsByReaction(userId, ReactionType.FAVORITE);
}

/**
 * Signature: `function listWantedEvents(userId: string): Promise<Array<NormalizedEvent & { author: { id: string; username: string; avatarUrl: string | null } | null }>>`
 * Purpose: Lists the user's want-to-go activities in newest-first order using the dedicated WANT reaction.
 */
export function listWantedEvents(userId: string) {
  return listEventsByReaction(userId, ReactionType.WANT);
}

// 当前用户报名的活动。
export function listSignupEvents(userId: string) {
  return listEventsByReaction(userId, ReactionType.SIGNUP);
}
