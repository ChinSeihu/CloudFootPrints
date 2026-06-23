import { NextResponse } from "next/server";
import { simulateDay } from "@/services/simulation/engine";

// /api/simulate —— 跑一次「当天」社区推演（World → 各角色决策 → 记忆/足迹）。
// 设计：每日一次（凌晨）由定时任务调用；白天用户访问只读库、不触发模拟。
// 保护：设了 CRON_SECRET 时必须带 `Authorization: Bearer <CRON_SECRET>`；未设则放行（本地开发）。
// 幂等：当天已模拟过的角色会自动跳过，重复调用安全。

export const maxDuration = 300; // 含 12 次 LLM 决策，放宽超时（秒）

let running = false;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function tokyoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

async function runOnce(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "未授权" }, { status: 401 });
  if (running) return NextResponse.json({ error: "推演进行中，请稍候" }, { status: 409 });
  running = true;
  try {
    const date = tokyoToday();
    const result = await simulateDay(date);
    const posted = result.results.filter((r) => r.status === "posted").length;
    const memory = result.results.filter((r) => r.status === "memory").length;
    return NextResponse.json({ ok: true, date, world: result.world, posted, memory });
  } catch (err) {
    console.error("simulate failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "推演失败" }, { status: 500 });
  } finally {
    running = false;
  }
}

export async function GET(req: Request) {
  return runOnce(req);
}
export async function POST(req: Request) {
  return runOnce(req);
}
