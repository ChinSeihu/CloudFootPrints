import { prisma } from "@/lib/db";
import { ReactionType } from "@prisma/client";

// 「被回复」消息：① 别人回复了我的评论；② 别人评论了我的帖子（顶层评论）。
// 仅本人可见（route 取 userId 传入）。

const AUTHOR_SELECT = { id: true, username: true, avatarUrl: true } as const;

export type ReplyNotice = {
  id: string; // 新评论/回复的 id
  type: "reply" | "post" | "checkin_comment" | "checkin_like";
  targetType: "event" | "checkin";
  text: string;
  author: { id: string; username: string; avatarUrl: string | null } | null;
  eventId: string;
  eventTitle: string;
  parentText: string | null; // type=reply 时，我被回复的那条评论内容
  createdAt: string;
};

/**
 * Signature: `async function listReplyNotifications(userId: string): Promise<ReplyNotice[]>`
 * Purpose: Aggregates replies plus comments and likes received by the user's posts and footprints into one chronological interaction feed.
 */
export async function listReplyNotifications(userId: string): Promise<ReplyNotice[]> {
  // 我的评论（用于「回复了我的评论」+ 展示被回复内容）
  const myComments = await prisma.comment.findMany({
    where: { userId },
    select: { id: true, text: true },
  });
  const myCommentText = new Map(myComments.map((c) => [c.id, c.text]));
  const myCommentIds = myComments.map((c) => c.id);

  // 我的发帖（Post 表）
  const myPosts = await prisma.post.findMany({ where: { userId }, select: { id: true } });
  const myPostIds = myPosts.map((p) => p.id);
  const myCheckins = await prisma.checkIn.findMany({ where: { userId }, select: { id: true, note: true } });
  const myCheckinIds = myCheckins.map((checkin) => checkin.id);

  // ① 别人回复了我的评论
  const replies = myCommentIds.length
    ? await prisma.comment.findMany({
        where: { parentId: { in: myCommentIds }, userId: { not: userId } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  // ② 别人评论了我的发帖（顶层评论，避免与①重复）
  const onPosts = myPostIds.length
    ? await prisma.comment.findMany({
        where: { postId: { in: myPostIds }, parentId: null, userId: { not: userId } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  const onCheckins = myCheckinIds.length
    ? await prisma.comment.findMany({
        where: { checkInId: { in: myCheckinIds }, parentId: null, userId: { not: userId } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];
  const checkinLikes = myCheckinIds.length
    ? await prisma.reaction.findMany({
        where: { checkInId: { in: myCheckinIds }, type: ReactionType.LIKE, userId: { not: userId } },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  // 评论目标 id = eventId（官方活动）或 postId（用户发帖）
  const targetId = (c: { eventId: string | null; postId: string | null; checkInId: string | null }) => c.checkInId ?? c.eventId ?? c.postId ?? "";

  // 批量取作者 + 目标标题（标题可能来自 Event 或 Post）
  const commentRows = [...replies, ...onPosts, ...onCheckins];
  const userIds = [...new Set([...commentRows, ...checkinLikes].map((row) => row.userId))];
  const tIds = [...new Set(commentRows.filter((comment) => !comment.checkInId).map(targetId).filter(Boolean))];
  const checkinTargetIds = [...new Set([...commentRows.map((comment) => comment.checkInId), ...checkinLikes.map((reaction) => reaction.checkInId)].filter((id): id is string => !!id))];
  const [users, events, posts, targetCheckins] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: AUTHOR_SELECT }) : [],
    tIds.length ? prisma.event.findMany({ where: { id: { in: tIds } }, select: { id: true, title: true } }) : [],
    tIds.length ? prisma.post.findMany({ where: { id: { in: tIds } }, select: { id: true, title: true } }) : [],
    checkinTargetIds.length ? prisma.checkIn.findMany({ where: { id: { in: checkinTargetIds } }, select: { id: true, note: true } }) : [],
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const titleMap = new Map([...events, ...posts].map((e) => [e.id, e.title]));
  const checkinTitleMap = new Map(targetCheckins.map((checkin) => [checkin.id, checkin.note?.trim().slice(0, 28) || "足迹"]));

  const notices: ReplyNotice[] = [
    ...replies.map((c) => ({
      id: c.id,
      type: "reply" as const,
      targetType: c.checkInId ? "checkin" as const : "event" as const,
      text: c.text,
      author: userMap.get(c.userId) ?? null,
      eventId: targetId(c),
      eventTitle: c.checkInId ? checkinTitleMap.get(c.checkInId) ?? "你的足迹" : titleMap.get(targetId(c)) ?? "活动",
      parentText: c.parentId ? myCommentText.get(c.parentId) ?? null : null,
      createdAt: c.createdAt.toISOString(),
    })),
    ...onPosts.map((c) => ({
      id: c.id,
      type: "post" as const,
      targetType: "event" as const,
      text: c.text,
      author: userMap.get(c.userId) ?? null,
      eventId: targetId(c),
      eventTitle: titleMap.get(targetId(c)) ?? "活动",
      parentText: null,
      createdAt: c.createdAt.toISOString(),
    })),
    ...onCheckins.map((comment) => ({
      id: comment.id,
      type: "checkin_comment" as const,
      targetType: "checkin" as const,
      text: comment.text,
      author: userMap.get(comment.userId) ?? null,
      eventId: comment.checkInId ?? "",
      eventTitle: comment.checkInId ? checkinTitleMap.get(comment.checkInId) ?? "你的足迹" : "你的足迹",
      parentText: null,
      createdAt: comment.createdAt.toISOString(),
    })),
    ...checkinLikes.map((reaction) => ({
      id: reaction.id,
      type: "checkin_like" as const,
      targetType: "checkin" as const,
      text: "赞了你的足迹",
      author: userMap.get(reaction.userId) ?? null,
      eventId: reaction.checkInId ?? "",
      eventTitle: reaction.checkInId ? checkinTitleMap.get(reaction.checkInId) ?? "你的足迹" : "你的足迹",
      parentText: null,
      createdAt: reaction.createdAt.toISOString(),
    })),
  ];
  notices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return notices;
}
