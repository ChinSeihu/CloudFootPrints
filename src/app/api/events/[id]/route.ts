import { NextResponse } from "next/server";
import { deleteUserEvent } from "@/services/events";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/events/[id] —— 只允许删除 sourceType=USER 的活动
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await deleteUserEvent(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
