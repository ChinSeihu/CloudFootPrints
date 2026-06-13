import { NextResponse } from "next/server";
import { deleteCheckin } from "@/services/checkins";
import { getCurrentUserId } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/checkins/[id] —— 仅本人可删
export async function DELETE(_req: Request, ctx: Ctx) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  const result = await deleteCheckin(id, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
