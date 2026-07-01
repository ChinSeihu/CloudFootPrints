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

// 解析评论目标 id 属于官方活动还是用户发帖（两表 id 全局唯一）。
async function resolveTarget(id: string): Promise<{ eventId: string } | { postId: string } | null> {
  const e = await prisma.event.findUnique({ where: { id }, select: { id: true } });
  if (e) return { eventId: id };
  const p = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (p) return { postId: id };
  return null;
}

function targetWhere(targetId: string) {
  return { OR: [{ eventId: targetId }, { postId: targetId }] };
}

export async function listComments(targetId: string) {
  const comments = await prisma.comment.findMany({
    where: targetWhere(targetId),
    orderBy: { createdAt: "asc" },
  });
  return withAuthors(comments);
}

export async function listCommentPage(
  targetId: string,
  opts: { limit?: number; cursor?: string | null; sort?: "hot" | "new"; replyLimit?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 20);
  const replyLimit = Math.min(Math.max(opts.replyLimit ?? 3, 0), 10);
  const orderBy = opts.sort === "hot"
    ? [{ replies: { _count: "desc" as const } }, { createdAt: "desc" as const }]
    : [{ createdAt: "desc" as const }];

  const roots = await prisma.comment.findMany({
    where: { ...targetWhere(targetId), parentId: null },
    orderBy,
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const visibleRoots = roots.slice(0, limit);
  const rootIds = visibleRoots.map((comment) => comment.id);
  const replyRows = rootIds.length
    ? await Promise.all(rootIds.map(async (rootId) => {
        const [items, total] = await Promise.all([
          prisma.comment.findMany({
            where: { ...targetWhere(targetId), parentId: rootId },
            orderBy: { createdAt: "asc" },
            take: replyLimit + 1,
          }),
          prisma.comment.count({ where: { ...targetWhere(targetId), parentId: rootId } }),
        ]);
        return { rootId, items: items.slice(0, replyLimit), total, hasMore: items.length > replyLimit };
      }))
    : [];

  const comments = await withAuthors([...visibleRoots, ...replyRows.flatMap((row) => row.items)]);
  const replyMeta = Object.fromEntries(
    replyRows.map((row) => [
      row.rootId,
      {
        total: row.total,
        loaded: row.items.slice(0, replyLimit).length,
        hasMore: row.hasMore,
        nextCursor: row.items.slice(0, replyLimit).at(-1)?.id ?? null,
      },
    ]),
  );
  const totalCount = await prisma.comment.count({ where: targetWhere(targetId) });

  return {
    comments,
    totalCount,
    hasMore: roots.length > limit,
    nextCursor: visibleRoots.at(-1)?.id ?? null,
    replyMeta,
  };
}

export async function listReplyPage(
  targetId: string,
  rootId: string,
  opts: { limit?: number; cursor?: string | null } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 20);
  const root = await prisma.comment.findFirst({
    where: { ...targetWhere(targetId), id: rootId, parentId: null },
    select: { id: true },
  });
  if (!root) return { comments: [], hasMore: false, nextCursor: null };

  const replies = await prisma.comment.findMany({
    where: { ...targetWhere(targetId), parentId: rootId },
    orderBy: { createdAt: "asc" },
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const visible = replies.slice(0, limit);
  return {
    comments: await withAuthors(visible),
    hasMore: replies.length > limit,
    nextCursor: visible.at(-1)?.id ?? null,
  };
}

export type CreateCommentResult =
  | { ok: true; comment: Awaited<ReturnType<typeof prisma.comment.create>> & { author: CommentAuthor | null } }
  | { ok: false; error: string };

export async function createComment(
  targetId: string,
  text: string,
  userId: string,
  parentId?: string | null,
): Promise<CreateCommentResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "评论内容不能为空" };
  if (trimmed.length > 1000) return { ok: false, error: "评论过长" };

  const target = await resolveTarget(targetId);
  if (!target) return { ok: false, error: "活动不存在" };

  // 校验回复目标存在且属于同一活动/发帖
  let pid: string | null = null;
  if (parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parentId },
      select: { id: true, eventId: true, postId: true },
    });
    const parentTargetId = parent?.eventId ?? parent?.postId;
    if (!parent || parentTargetId !== targetId) return { ok: false, error: "回复的评论不存在" };
    pid = parent.id;
  }

  const comment = await prisma.comment.create({ data: { ...target, text: trimmed, userId, parentId: pid } });
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
