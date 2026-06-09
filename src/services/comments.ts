import { prisma } from "@/lib/db";

// 领域逻辑：活动评论的查询/写入。v1 单用户固定 "me"。
// TODO(v2): userId 从认证会话取；内容审核。
const CURRENT_USER_ID = "me";

export function listComments(eventId: string) {
  return prisma.comment.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
}

export type CreateCommentResult =
  | { ok: true; comment: Awaited<ReturnType<typeof createCommentRow>> }
  | { ok: false; error: string };

function createCommentRow(eventId: string, text: string, userId: string) {
  return prisma.comment.create({
    data: { eventId, text, userId },
  });
}

export async function createComment(
  eventId: string,
  text: string,
): Promise<CreateCommentResult> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "评论内容不能为空" };
  if (trimmed.length > 1000) return { ok: false, error: "评论过长" };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) return { ok: false, error: "活动不存在" };

  const comment = await createCommentRow(eventId, trimmed, CURRENT_USER_ID);
  return { ok: true, comment };
}
