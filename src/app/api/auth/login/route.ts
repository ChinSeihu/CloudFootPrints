import { NextResponse } from "next/server";
import { loginUser } from "@/services/users";
import { createSession, getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const result = await loginUser(body.username ?? "", body.password ?? "");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 });
  await createSession(result.userId);
  return NextResponse.json({ user: await getCurrentUser() });
}
