import { readSSE } from "../src/lib/guideStream";
import { requestDeepSeekContent } from "../src/lib/deepSeek";
import { buildGuideWeatherContext, type WeatherForecast } from "../src/services/weather";

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
 * Purpose: Verifies guide weather grounding plus SSE and model-fallback behavior.
 */
async function main(): Promise<void> {
  const weatherFixture: WeatherForecast = {
    source: "jma",
    current: { temp: 22, code: 2, kind: "cloudy", label: "多云" },
    daily: [{ date: "2026-09-24", code: 61, kind: "rain", label: "雨", tempMin: 20, tempMax: 27, precipProb: 70, reliability: "A" }],
  };
  const weatherContext = buildGuideWeatherContext(weatherFixture);
  if (!weatherContext.includes("2026-09-24") || !weatherContext.includes("降水概率 70%") || !weatherContext.includes("可信度 A")) {
    throw new Error(`guide weather context regression: ${weatherContext}`);
  }
  const events = await collect('data: {"ok":1}\n\ndata: \n\ndata: {"unfinished":\n');
  const expected = ['{"ok":1}'];
  if (JSON.stringify(events) !== JSON.stringify(expected)) {
    throw new Error(`guide SSE regression: ${JSON.stringify(events)}`);
  }
  const originalFetch = globalThis.fetch;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const choice = bodies.length < 3
      ? { finish_reason: "stop", message: { content: "", reasoning_content: bodies.length === 1 ? "thinking" : null } }
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
    if (content !== "usable answer" || bodies.length !== 3
      || JSON.stringify(bodies[1].thinking) !== JSON.stringify({ type: "disabled" })
      || "reasoning_effort" in bodies[1] || !("response_format" in bodies[1])
      || "response_format" in bodies[2]) {
      throw new Error(`DeepSeek fallback regression: ${JSON.stringify({ content, bodies })}`);
    }
  } finally { globalThis.fetch = originalFetch; }
  console.log("guide SSE regression passed");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
