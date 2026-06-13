import { prisma } from "@/lib/db";

// 领域逻辑：活动评论的查询/写入，并附作者公开信息（用户名/头像）。
// 评论需登录（由 route 取 userId 传入）；旧 "me" 数据无对应 User，author 为 null。

const AUTHOR_SELECT = { id: true, username: true, avatarUrl: true } as const;
export type CommentAuthor = { id: string; username: string; avatarUrl: string | null };

async function withAuthors<T extends { userId: string }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.userId))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: AUTHOR_SELECT })
    : [];
  const map = new Map(users.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...r, author: map.get(r.userId) ?? null }));
}

export async function listComments(eventId: string) {
  const comments = await prisma.comment.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
  return withAuthors(comments);
}

export type CreateCommentResult =
  | { ok: true; comment: Awaited<ReturnType<typeof createCommentRow>> & { author: CommentAuthor | null } }
  | { ok: false; error: string };

function createCommentRow(eventId: string, text: string, userId: string) {
  return prisma.comment.create({ data: { eventId, text, userId } });
}

export async function createComment(
  eventId: string,
  text: string,
  userId: string,
): Promise<CreateCommentResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "评论内容不能为空" };
  if (trimmed.length > 1000) return { ok: false, error: "评论过长" };

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return { ok: false, error: "活动不存在" };

  const comment = await createCommentRow(eventId, trimmed, userId);
  const author = await prisma.user.findUnique({ where: { id: userId }, select: AUTHOR_SELECT });
  return { ok: true, comment: { ...comment, author } };
}
