import { readSSE } from "../src/lib/guideStream";
import { requestDeepSeekContent } from "../src/lib/deepSeek";

/**
 * Signature: `async function collect(source: string): Promise<string[]>`
 * Purpose: Feeds one synthetic byte stream through the shared SSE decoder for regression assertions.
 */
async function collect(source: string): Promise<string[]> {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const bytes = encoder.encode(source);
      controller.enqueue(bytes.slice(0, 9));
      controller.enqueue(bytes.slice(9));
      controller.close();
    },
  });
  const events: string[] = [];
  for await (const event of readSSE(body)) events.push(event);
  return events;
}

/**
 * Signature: `async function main(): Promise<void>`
 * Purpose: Verifies that complete SSE events survive chunking while empty events and unfinished tail frames are ignored.
 */
async function main(): Promise<void> {
  const events = await collect('data: {"ok":1}\n\ndata: \n\ndata: {"unfinished":\n');
  const expected = ['{"ok":1}'];
  if (JSON.stringify(events) !== JSON.stringify(expected)) {
    throw new Error(`guide SSE regression: ${JSON.stringify(events)}`);
  }
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const choice = bodies.length === 1
      ? { finish_reason: "stop", message: { content: "", reasoning_content: "thinking" } }
      : { finish_reason: "stop", message: { content: "usable answer" } };
    return new Response(JSON.stringify({ choices: [choice] }), { status: 200 });
  };
  try {
    const content = await requestDeepSeekContent("https://example.test", "test-key", {
      model: "deepseek-flash",
      thinking: { type: "enabled" },
      reasoning_effort: "high",
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: "test" }],
    });
    if (content !== "usable answer" || bodies.length !== 2 || JSON.stringify(bodies[1].thinking) !== JSON.stringify({ type: "disabled" }) || "reasoning_effort" in bodies[1] || "response_format" in bodies[1]) {
      throw new Error(`DeepSeek fallback regression: ${JSON.stringify({ content, bodies })}`);
    }
  } finally { globalThis.fetch = originalFetch; }
  console.log("guide SSE regression passed");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
