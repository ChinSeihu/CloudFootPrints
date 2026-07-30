import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth";
import { listVirtualUserEvents } from "@/services/events";

export async function GET() {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!actor.isAdmin) return NextResponse.json({ error: "无管理员权限" }, { status: 403 });

  try {
    const events = await listVirtualUserEvents();
    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/admin/posts failed:", error);
    return NextResponse.json({ error: "查询虚拟用户发帖失败" }, { status: 500 });
  }
}
