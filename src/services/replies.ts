import { prisma } from "@/lib/db";

// 「被回复」消息：① 别人回复了我的评论；② 别人评论了我的帖子（顶层评论）。
// 仅本人可见（route 取 userId 传入）。

const AUTHOR_SELECT = { id: true, username: true, avatarUrl: true } as const;

export type ReplyNotice = {
  id: string; // 新评论/回复的 id
  type: "reply" | "post"; // reply=回复了我的评论；post=评论了我的帖子
  text: string;
  author: { id: string; username: string; avatarUrl: string | null } | null;
  eventId: string;
  eventTitle: string;
  parentText: string | null; // type=reply 时，我被回复的那条评论内容
  createdAt: string;
};

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

  // 评论目标 id = eventId（官方活动）或 postId（用户发帖）
  const targetId = (c: { eventId: string | null; postId: string | null }) => c.eventId ?? c.postId ?? "";

  // 批量取作者 + 目标标题（标题可能来自 Event 或 Post）
  const userIds = [...new Set([...replies, ...onPosts].map((c) => c.userId))];
  const tIds = [...new Set([...replies, ...onPosts].map(targetId).filter(Boolean))];
  const [users, events, posts] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: AUTHOR_SELECT }) : [],
    tIds.length ? prisma.event.findMany({ where: { id: { in: tIds } }, select: { id: true, title: true } }) : [],
    tIds.length ? prisma.post.findMany({ where: { id: { in: tIds } }, select: { id: true, title: true } }) : [],
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const titleMap = new Map([...events, ...posts].map((e) => [e.id, e.title]));

  const notices: ReplyNotice[] = [
    ...replies.map((c) => ({
      id: c.id,
      type: "reply" as const,
      text: c.text,
      author: userMap.get(c.userId) ?? null,
      eventId: targetId(c),
      eventTitle: titleMap.get(targetId(c)) ?? "活动",
      parentText: c.parentId ? myCommentText.get(c.parentId) ?? null : null,
      createdAt: c.createdAt.toISOString(),
    })),
    ...onPosts.map((c) => ({
      id: c.id,
      type: "post" as const,
      text: c.text,
      author: userMap.get(c.userId) ?? null,
      eventId: targetId(c),
      eventTitle: titleMap.get(targetId(c)) ?? "活动",
      parentText: null,
      createdAt: c.createdAt.toISOString(),
    })),
  ];
  notices.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return notices;
}
