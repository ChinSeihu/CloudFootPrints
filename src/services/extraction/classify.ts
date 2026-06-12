import { classifyEvents } from "@/lib/llm";
import type { ExtractedEvent } from "./types";

// 可选的"LLM 重分类"增强步骤。
// prestructured 源（如 walkerplus）用关键词分类，OTHER 偏多；开启后交给 LLM 统一重判，更准。
// 开关：CLASSIFY_WITH_LLM=true 且有 LLM key 时启用，否则原样返回（零成本回退关键词分类）。
// 任意失败都静默回退，不阻塞入库。

function enabled(): boolean {
  const flag = (process.env.CLASSIFY_WITH_LLM ?? "").toLowerCase();
  const on = flag === "1" || flag === "true" || flag === "yes";
  const hasKey = !!(process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY);
  return on && hasKey;
}

export async function maybeReclassify(events: ExtractedEvent[]): Promise<ExtractedEvent[]> {
  if (!enabled() || events.length === 0) return events;
  try {
    const cats = await classifyEvents(
      events.map((e) => ({ title: e.title, description: e.description })),
    );
    let changed = 0;
    const out = events.map((e, i) => {
      const c = cats[i];
      if (c && c !== e.category) {
        changed++;
        return { ...e, category: c };
      }
      return e;
    });
    console.log(`  LLM 重分类：${changed}/${events.length} 条更新`);
    return out;
  } catch (err) {
    console.warn("  ⚠️  LLM 重分类整体失败，回退原分类：", (err as Error).message);
    return events;
  }
}
