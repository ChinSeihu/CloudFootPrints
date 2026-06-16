import { NextResponse } from "next/server";
import { chatWithGuide, type ChatMessage } from "@/lib/llm";
import { buildGuideEventsContext } from "@/services/guideEvents";

// 薄 handler：AI 导游多轮对话交给 lib/llm。只保留最近若干轮，控制上下文与成本。
export async function POST(req: Request) {
  let messages: ChatMessage[];
  try {
    const body = (await req.json()) as { messages?: ChatMessage[] };
    messages = Array.isArray(body.messages) ? body.messages : [];
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  if (messages.length === 0) {
    return NextResponse.json({ error: "缺少消息" }, { status: 400 });
  }
  try {
    // 注入本站数据库的近期真实活动，让导游能回答“今天/近期有什么活动”（失败则空串、不阻塞）。
    const eventsContext = await buildGuideEventsContext().catch(() => "");
    const { reply, suggestions } = await chatWithGuide(messages.slice(-12), eventsContext);
    return NextResponse.json({ reply, suggestions });
  } catch {
    return NextResponse.json({ error: "AI 导游暂时不可用（可能未配置 LLM_API_KEY），请稍后再试。" }, { status: 502 });
  }
}
