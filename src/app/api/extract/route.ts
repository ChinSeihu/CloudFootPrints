import { NextResponse } from "next/server";
import { runExtractionPipeline } from "@/services/extraction";

// /api/extract —— 触发一次提取管线（采集 → LLM 抽取 → 地理编码 → 入库）。
// 设计：数据全用户共享、无需手动刷新，由**每日定时任务**调用（见 vercel.json crons，凌晨更新一次）。
// 保护：设了 CRON_SECRET 时，必须带 `Authorization: Bearer <CRON_SECRET>`（Vercel Cron 会自动带上），
//       防止公网被随意触发这一较重的任务；未设则放行（本地开发方便）。
// 提取较慢（含网络 + 可选 LLM），用内存标志位避免并发重复跑。

export const maxDuration = 300; // 提取较慢，放宽函数超时（秒）

let running = false;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // 未配置密钥 → 本地/开发放行
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function runOnce(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  if (running) {
    return NextResponse.json({ error: "提取正在进行中，请稍候" }, { status: 409 });
  }
  running = true;
  try {
    const stats = await runExtractionPipeline();
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error("extract failed:", err);
    const message = err instanceof Error ? err.message : "提取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    running = false;
  }
}

// GET —— 定时任务（Vercel Cron 用 GET）触发
export async function GET(req: Request) {
  return runOnce(req);
}

// POST —— 手动/脚本触发（同样受 CRON_SECRET 保护）
export async function POST(req: Request) {
  return runOnce(req);
}
