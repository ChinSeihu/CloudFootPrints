import { NextResponse } from "next/server";
import { streamGuideReply, type ChatMessage } from "@/lib/llm";
import { buildGuideEventsContext } from "@/services/guideEvents";

export const maxDuration = 240;

/**
 * Signature: `async function POST(req: Request): Promise<Response>`
 * Purpose: Streams guide text and final activity cards, propagating client cancellation to the model.
 */
export async function POST(req: Request): Promise<Response> {
  const startedAt = Date.now();
  const requestId = req.headers.get("x-vercel-id") ?? crypto.randomUUID();
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
      let phase = "context";
      let statusTimer: ReturnType<typeof setInterval> | null = null;
      try {
        emit({ type: "start" });
        emit({ type: "status", status: "正在理解你的问题…" });
        console.log(JSON.stringify({ level: "info", message: "guide request started", requestId }));
        const { context, refs } = await buildGuideEventsContext().catch(() => ({ context: "", refs: [] }));
        if (controller.signal.aborted) return;
        phase = "model";
        const statuses = ["正在比较适合你的活动…", "正在核对时间和地点…", "正在整理更顺手的建议…"];
        let statusIndex = 0;
        emit({ type: "status", status: statuses[statusIndex] });
        statusTimer = setInterval(() => {
          if (statusIndex >= statuses.length - 1) return;
          statusIndex++;
          emit({ type: "status", status: statuses[statusIndex] });
        }, 5000);
        const result = await streamGuideReply(messages, context, controller.signal, reply => emit({ type: "reply", reply }));
        phase = "complete";
        const refMap = new Map(refs.map(r => [r.token, r]));
        const events = result.referenced.flatMap(token => { const ref = refMap.get(token); return ref ? [{ id: ref.id, title: ref.title }] : []; });
        emit({ type: "done", reply: result.reply, suggestions: result.suggestions, events });
        console.log(JSON.stringify({ level: "info", message: "guide request completed", requestId, durationMs: Date.now() - startedAt }));
      } catch (error) {
        console.error(JSON.stringify({ level: "error", message: "guide request failed", requestId, phase, durationMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error) }));
        emit({ type: "error", error: "回答中断了，请稍后重试。" });
      }
      finally { if (statusTimer) clearInterval(statusTimer); req.signal.removeEventListener("abort", abort); if (!controller.signal.aborted) output.close(); }
    },
    cancel() { controller.abort(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
