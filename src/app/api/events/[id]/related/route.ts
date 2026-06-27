import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { normalizePost } from "@/services/events";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();

  try {
    const [event, post] = await Promise.all([
      prisma.event.findUnique({ where: { id }, select: { id: true } }),
      prisma.post.findUnique({ where: { id }, select: { id: true } }),
    ]);

    if (!event && !post) {
      return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    }

    const checkinWhere = event
      ? { eventId: id, OR: userId ? [{ isPublic: true }, { userId }] : [{ isPublic: true }] }
      : { postId: id, OR: userId ? [{ isPublic: true }, { userId }] : [{ isPublic: true }] };

    const [posts, checkins] = await Promise.all([
      event
        ? prisma.post.findMany({
            where: { eventId: id },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      prisma.checkIn.findMany({
        where: checkinWhere,
        orderBy: { createdAt: "desc" },
        take: 80,
        include: {
          event: { select: { id: true, title: true, category: true } },
          post: { select: { id: true, title: true, category: true } },
        },
      }),
    ]);

    return NextResponse.json({
      posts: posts.map(normalizePost),
      checkins: checkins.map(({ post: linkedPost, ...checkin }) => ({
        ...checkin,
        event: checkin.event ?? linkedPost ?? null,
        isMine: userId ? checkin.userId === userId : false,
      })),
    });
  } catch (err) {
    console.error("GET /api/events/[id]/related failed:", err);
    return NextResponse.json({ error: "查询关联内容失败" }, { status: 500 });
  }
}
