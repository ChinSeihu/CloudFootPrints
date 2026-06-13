import { NextResponse } from "next/server";
import { listReplyNotifications } from "@/services/replies";
import { getCurrentUserId } from "@/lib/auth";

// GET /api/replies —— 当前用户的「被回复」消息（回复我的评论 / 评论我的帖子）
export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NextResponse.json({ notices: [] });
    const notices = await listReplyNotifications(userId);
    return NextResponse.json({ notices });
  } catch (err) {
    console.error("GET /api/replies failed:", err);
    return NextResponse.json({ error: "查询消息失败" }, { status: 500 });
  }
}
