import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { updateProfile, type ProfileUpdate } from "@/services/users";

export async function PATCH(req: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as ProfileUpdate;
  const user = await updateProfile(userId, {
    signature: typeof body.signature === "string" ? body.signature : null,
    avatarUrl: typeof body.avatarUrl === "string" ? body.avatarUrl : null,
    hometown: typeof body.hometown === "string" ? body.hometown : null,
    status: typeof body.status === "string" ? body.status : null,
  });
  return NextResponse.json({ user });
}
