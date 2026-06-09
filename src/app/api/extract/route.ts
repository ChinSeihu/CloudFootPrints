import { NextResponse } from "next/server";
import { runExtractionPipeline } from "@/services/extraction";

// POST /api/extract —— 手动触发一次提取管线（采集 → LLM 抽取 → 地理编码 → 入库）。
// 薄 handler：逻辑都在 service 里。用内存标志位避免并发重复跑。
// 提取较慢（含 LLM 调用），v1 同步执行 + 前端转圈即可。
// TODO(v2+): 量大时改为后台任务 / 定时 cron，前端轮询进度。

let running = false;

export async function POST() {
  if (running) {
    return NextResponse.json({ error: "提取正在进行中，请稍候" }, { status: 409 });
  }
  running = true;
  try {
    const stats = await runExtractionPipeline();
    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error("POST /api/extract failed:", err);
    const message = err instanceof Error ? err.message : "提取失败";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    running = false;
  }
}
