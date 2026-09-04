import { NextResponse } from "next/server";
import { streamGuideReply, type ChatMessage } from "@/lib/llm";
import { buildGuideEventsContext } from "@/services/guideEvents";
/**
 * Signature: `async function POST(req: Request): Promise<Response>`
 * Purpose: Streams guide text and final activity cards, propagating client cancellation to the model.
 */
export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.messages) || !body.messages.length || body.messages.length > 100 || !body.messages.every((m: ChatMessage) => m && ["user", "assistant"].includes(m.role) && typeof m.content === "string" && m.content.length <= 100000)) {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const messages = (body.messages as ChatMessage[]).slice(-12);
  const controller = new AbortController();
  const abort = () => controller.abort();
  req.signal.addEventListener("abort", abort, { once: true });
  if (req.signal.aborted) controller.abort();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(output) {
      const emit = (data: unknown) => { if (!controller.signal.aborted) output.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
      try {
        emit({ type: "start" });
        const { context, refs } = await buildGuideEventsContext().catch(() => ({ context: "", refs: [] }));
        if (controller.signal.aborted) return;
        const result = await streamGuideReply(messages, context, controller.signal, reply => emit({ type: "reply", reply }));
        const refMap = new Map(refs.map(r => [r.token, r]));
        const events = result.referenced.flatMap(token => { const ref = refMap.get(token); return ref ? [{ id: ref.id, title: ref.title }] : []; });
        emit({ type: "done", reply: result.reply, suggestions: result.suggestions, events });
      } catch { emit({ type: "error", error: "回答中断了，请稍后重试。" }); }
      finally { req.signal.removeEventListener("abort", abort); if (!controller.signal.aborted) output.close(); }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
