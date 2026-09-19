import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth";
import { normalizePost } from "@/services/events";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Signature: `async function GET(_request: Request, ctx: Ctx): Promise<NextResponse>`
 * Purpose: Returns released posts and footprints related to a visible activity.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  const now = new Date();

  try {
    const [event, post] = await Promise.all([
      prisma.event.findUnique({ where: { id }, select: { id: true } }),
      prisma.post.findFirst({ where: { id, createdAt: { lte: now } }, select: { id: true } }),
    ]);

    if (!event && !post) {
      return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    }

    const checkinWhere = event
      ? { eventId: id, createdAt: { lte: now }, OR: userId ? [{ isPublic: true }, { userId }] : [{ isPublic: true }] }
      : { postId: id, createdAt: { lte: now }, OR: userId ? [{ isPublic: true }, { userId }] : [{ isPublic: true }] };

    const [posts, checkins] = await Promise.all([
      event
        ? prisma.post.findMany({
            where: { eventId: id, createdAt: { lte: now } },
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
    const authorIds = [...new Set(checkins.map((checkin) => checkin.userId).filter(Boolean))];
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, username: true, avatarUrl: true },
        })
      : [];
    const authorMap = new Map(authors.map((author) => [author.id, author]));

    return NextResponse.json({
      posts: posts.map(normalizePost),
      checkins: checkins.map(({ post: linkedPost, ...checkin }) => ({
        ...checkin,
        event: checkin.event ?? linkedPost ?? null,
        isMine: userId ? checkin.userId === userId : false,
        author: authorMap.get(checkin.userId) ?? null,
      })),
    });
  } catch (err) {
    console.error("GET /api/events/[id]/related failed:", err);
    return NextResponse.json({ error: "查询关联内容失败" }, { status: 500 });
  }
}
