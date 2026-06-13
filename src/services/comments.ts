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

function createCommentRow(eventId: string, text: string, userId: string, parentId: string | null) {
  return prisma.comment.create({ data: { eventId, text, userId, parentId } });
}

export async function createComment(
  eventId: string,
  text: string,
  userId: string,
  parentId?: string | null,
): Promise<CreateCommentResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "评论内容不能为空" };
  if (trimmed.length > 1000) return { ok: false, error: "评论过长" };

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) return { ok: false, error: "活动不存在" };

  // 校验回复目标存在且属于同一活动
  let pid: string | null = null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, eventId: true },
    });
    if (!parent || parent.eventId !== eventId) return { ok: false, error: "回复的评论不存在" };
    pid = parent.id;
  }

  const comment = await createCommentRow(eventId, trimmed, userId, pid);
  const author = await prisma.user.findUnique({ where: { id: userId }, select: AUTHOR_SELECT });
  return { ok: true, comment: { ...comment, author } };
}

// 删除评论：仅作者本人可删（级联删除其回复）。
export async function deleteComment(
  commentId: string,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const c = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true, userId: true } });
  if (!c) return { ok: false, error: "评论不存在", status: 404 };
  if (c.userId !== userId) return { ok: false, error: "只能删除自己的评论", status: 403 };
  await prisma.comment.delete({ where: { id: commentId } });
  return { ok: true };
}
