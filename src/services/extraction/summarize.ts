import { summarizeEvents } from "@/lib/llm";
import type { ExtractedEvent } from "./types";

// 可选的「LLM 一句话摘要」增强步骤。
// 为每条活动生成 ≤14 字的短摘要，存入 Event.summary，供地图标签使用
// （活动 description 常冗长/缺失，直接截取效果差）。
// 开关：SUMMARIZE_WITH_LLM=true 且有 LLM key 时启用；否则原样返回（summary 保持 null）。
// 任意失败都静默回退，不阻塞入库。

function enabled(): boolean {
  const flag = (process.env.SUMMARIZE_WITH_LLM ?? "").toLowerCase();
  const on = flag === "1" || flag === "true" || flag === "yes";
  const hasKey = !!(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY);
  return on && hasKey;
}

export async function maybeSummarize(events: ExtractedEvent[]): Promise<ExtractedEvent[]> {
  if (!enabled() || events.length === 0) return events;
  // 已有摘要的跳过（理论上抽取阶段不产 summary，这里保险）。
  const need = events.some((e) => !e.summary);
  if (!need) return events;
  try {
    const sums = await summarizeEvents(
      events.map((e) => ({ title: e.title, description: e.description })),
    );
    let filled = 0;
    const out = events.map((e, i) => {
      const s = sums[i];
      if (s && !e.summary) {
        filled++;
        return { ...e, summary: s };
      }
      return e;
    });
    console.log(`  LLM 摘要：${filled}/${events.length} 条生成`);
    return out;
  } catch (err) {
    console.warn("  ⚠️  LLM 摘要整体失败，跳过：", (err as Error).message);
    return events;
  }
}
