import { extractEventsFromText } from "@/lib/llm";
import { ExtractedEventSchema, type ExtractedEvent } from "./types";

// 把一段网页文本喂给 LLM 抽取，并用 zod 逐条校验。无效条目丢弃（不阻塞整批）。
export async function extractFromText(pageText: string): Promise<ExtractedEvent[]> {
  const raw = await extractEventsFromText(pageText);
  const out: ExtractedEvent[] = [];
  for (const item of raw) {
    const parsed = ExtractedEventSchema.safeParse(item);
    if (parsed.success) {
      out.push(parsed.data);
    } else {
      console.warn("  ⚠️  丢弃一条无效抽取结果：", parsed.error.issues[0]?.message);
    }
  }
  return out;
}
