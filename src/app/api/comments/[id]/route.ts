import { NextResponse } from "next/server";
import { deleteComment } from "@/services/comments";
import { getCurrentUserId } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/comments/[id] —— 删除自己的评论（级联删回复）
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const result = await deleteComment(id, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
