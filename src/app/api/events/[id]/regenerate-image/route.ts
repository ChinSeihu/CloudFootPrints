import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { regeneratePostImage } from "@/services/simulation/regenerate";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Signature: `async function POST(_req: Request, ctx: Ctx): Promise<NextResponse>`
 * Purpose: Regenerates a personal-page simulated post image using the environment-selected image provider.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { id } = await ctx.params;
  try {
    const result = await regeneratePostImage(id, userId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/events/[id]/regenerate-image failed:", err);
    return NextResponse.json({ error: "重新生图失败" }, { status: 500 });
  }
}
