import { NextResponse } from "next/server";
import { listCommentPage, listComments, createComment, listReplyPage } from "@/services/comments";
import { getCurrentUserId } from "@/lib/auth";

// Next 16：动态段的 params 是 Promise，需 await。
type Ctx = { params: Promise<{ id: string }> };

// GET /api/events/[id]/comments —— 活动评论列表
export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const { searchParams } = new URL(req.url);
    const paged = searchParams.get("paged") === "1";
    const rootId = searchParams.get("rootId");
    if (rootId) {
      return NextResponse.json(await listReplyPage(id, rootId, {
        cursor: searchParams.get("cursor"),
        limit: Number(searchParams.get("limit") || 10),
      }));
    }
    if (paged) {
      const sort = searchParams.get("sort") === "new" ? "new" : "hot";
      return NextResponse.json(await listCommentPage(id, {
        cursor: searchParams.get("cursor"),
        limit: Number(searchParams.get("limit") || 10),
        sort,
        replyLimit: Number(searchParams.get("replyLimit") || 3),
      }));
    }
    const comments = await listComments(id);
    return NextResponse.json({ comments });
  } catch (err) {
    console.error("GET comments failed:", err);
    return NextResponse.json({ error: "查询评论失败" }, { status: 500 });
  }
}

// POST /api/events/[id]/comments —— 新增评论
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录后再评论" }, { status: 401 });

  const text = (body as { text?: unknown })?.text;
  if (typeof text !== "string") {
    return NextResponse.json({ error: "缺少 text" }, { status: 400 });
  }
  const parentIdRaw = (body as { parentId?: unknown })?.parentId;
  const parentId = typeof parentIdRaw === "string" ? parentIdRaw : null;

  const result = await createComment(id, text, userId, parentId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ comment: result.comment }, { status: 201 });
}
