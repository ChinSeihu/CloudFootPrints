import { NextResponse } from "next/server";
import { deleteUserEvent, getEventById, updateUserEvent } from "@/services/events";
import { getCurrentUserId } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/[id] —— 单个活动详情（含作者）
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const e = await getEventById(id);
    if (!e) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    return NextResponse.json({
      event: {
        id: e.id,
        title: e.title,
        description: e.description,
        summary: e.summary,
        category: e.category,
        venueName: e.venueName,
        address: e.address,
        imageUrl: e.imageUrl,
        imageUrls: e.imageUrls ?? [],
        lat: e.lat,
        lng: e.lng,
        startTime: e.startTime ? e.startTime.toISOString() : null,
        endTime: e.endTime ? e.endTime.toISOString() : null,
        sourceType: e.sourceType,
        sourceUrl: e.sourceUrl,
        trustLevel: e.trustLevel,
        tags: e.tags ?? [],
        signupEnabled: e.signupEnabled ?? false,
        author: e.author ?? null,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("GET /api/events/[id] failed:", err);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
}

// PATCH /api/events/[id] —— 作者编辑自己发布的 USER 活动（仅文字信息，不动坐标/图片）
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
  const result = await updateUserEvent(id, userId, {
    title: typeof b.title === "string" ? b.title : undefined,
    category: typeof b.category === "string" ? (b.category as never) : undefined,
    description: b.description === null || typeof b.description === "string" ? (b.description as string | null) : undefined,
    venueName: b.venueName === null || typeof b.venueName === "string" ? (b.venueName as string | null) : undefined,
    startTime: b.startTime === null || typeof b.startTime === "string" ? (b.startTime as string | null) : undefined,
    endTime: b.endTime === null || typeof b.endTime === "string" ? (b.endTime as string | null) : undefined,
    tags: Array.isArray(b.tags) ? (b.tags as string[]) : undefined,
    signupEnabled: typeof b.signupEnabled === "boolean" ? b.signupEnabled : undefined,
    imageUrls: Array.isArray(b.imageUrls)
      ? b.imageUrls.filter((url): url is string => typeof url === "string")
      : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  revalidatePath("/recommend");
  revalidatePath("/me");
  return NextResponse.json({ ok: true });
}

// DELETE /api/events/[id] —— 只允许作者删除自己发布的 USER 活动
export async function DELETE(_req: Request, ctx: Ctx) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await ctx.params;
  const result = await deleteUserEvent(id, userId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
