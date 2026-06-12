import { NextResponse } from "next/server";
import { deleteCheckin } from "@/services/checkins";

type Ctx = { params: Promise<{ id: string }> };

// DELETE /api/checkins/[id]
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await deleteCheckin(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
