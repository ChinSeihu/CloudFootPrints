import { NextResponse } from "next/server";
import { deleteUserEvent, getEventById } from "@/services/events";
import { getCurrentUserId } from "@/lib/auth";

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
        category: e.category,
        venueName: e.venueName,
        address: e.address,
        imageUrl: e.imageUrl,
        lat: e.lat,
        lng: e.lng,
        startTime: e.startTime ? e.startTime.toISOString() : null,
        endTime: e.endTime ? e.endTime.toISOString() : null,
        sourceType: e.sourceType,
        sourceUrl: e.sourceUrl,
        trustLevel: e.trustLevel,
        tags: e.tags ?? [],
        author: e.author ?? null,
      },
    });
  } catch (err) {
    console.error("GET /api/events/[id] failed:", err);
    return NextResponse.json({ error: "查询失败" }, { status: 500 });
  }
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
