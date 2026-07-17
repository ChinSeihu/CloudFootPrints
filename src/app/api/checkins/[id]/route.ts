import { NextResponse } from "next/server";
import { deleteCheckin, updateCheckin } from "@/services/checkins";
import { getCurrentUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/checkins/[id] —— 仅本人可改（备注/评分/照片/时间，不改坐标）
export async function PATCH(req: Request, ctx: Ctx) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const result = await updateCheckin(id, userId, {
    note: b.note === null || typeof b.note === "string" ? (b.note as string | null) : undefined,
    rating: b.rating === null || typeof b.rating === "number" ? (b.rating as number | null) : undefined,
    moodTags: Array.isArray(b.moodTags) ? b.moodTags.map(Number) : undefined,
    photoUrls: Array.isArray(b.photoUrls) ? (b.photoUrls as string[]) : undefined,
    isPublic: typeof b.isPublic === "boolean" ? b.isPublic : undefined,
    visitedAt: b.visitedAt === null || typeof b.visitedAt === "string" ? (b.visitedAt as string | null) : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  revalidatePath("/recommend");
  return NextResponse.json({ ok: true });
}

// DELETE /api/checkins/[id] —— 仅本人可删
export async function DELETE(_req: Request, ctx: Ctx) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  const result = await deleteCheckin(id, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  revalidatePath("/recommend");
  return new NextResponse(null, { status: 204 });
}
