import Anthropic from "@anthropic-ai/sdk";
import { EVENT_CATEGORIES } from "@/lib/categories";

// LLM 调用封装。支持可切换 provider：
//   - LLM_PROVIDER=deepseek（或任意 OpenAI 兼容端点）→ 用 chat/completions + JSON 模式
//   - LLM_PROVIDER=anthropic → 用 Claude tool use 强制结构化
// 两条路径都返回"未校验的活动对象数组"，由 ingest/extract 侧用 zod 校验兜底。

const ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5";
const DEEPSEEK_DEFAULT_MODEL = "deepseek-chat";
const DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com";

function getApiKey(): string {
  const apiKey = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 LLM_API_KEY。请在 .env 中填入对应 provider 的 API key。");
  }
  return apiKey;
}

// 解析 provider：显式 LLM_PROVIDER 优先；否则按 key/model 猜测。
function getProvider(): "anthropic" | "openai" {
  const p = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (p === "anthropic" || p === "claude") return "anthropic";
  if (p === "deepseek" || p === "openai") return "openai";
  // 未显式指定：claude 模型或 sk-ant- 开头的 key → anthropic，否则按 OpenAI 兼容处理。
  const model = (process.env.LLM_MODEL || "").toLowerCase();
  if (model.startsWith("claude") || (process.env.LLM_API_KEY || "").startsWith("sk-ant-")) {
    return "anthropic";
  }
  return "openai";
}

const CATEGORY_LIST = EVENT_CATEGORIES.join(" | ");

const SYSTEM_PROMPT = `你是一个活动信息抽取器。从给定的东京活动相关网页文本中，抽取所有"具体的活动"（展览/市集/live/祭典/讲座等）。
规则：
- category 只能是 ${CATEGORY_LIST}，选最贴近的一个（EXHIBITION=展览, MARKET=市集, LIVE=演出/现场, FESTIVAL=祭典, TALK=讲座/技术活动/勉强会, OTHER=其他）。
- 时间用 ISO 8601 字符串；若只有日期没有时间，补 T00:00:00。
- imageUrl：活动主图/海报的**完整 http(s) 链接**（页面里有就带上，相对路径或不确定则填 null）。
- 无法确定的字段填 null。
- 一页可能含多个活动；没有具体活动时返回空数组。`;

// 抽取器返回的原始对象（未经 zod 校验）。
export type RawExtractedEvent = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  venueName?: unknown;
  address?: unknown;
  imageUrl?: unknown;
  startTime?: unknown;
  endTime?: unknown;
};

// 去掉可能的 Markdown 围栏后安全 JSON.parse。
function safeJsonParse(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

// ---------- Anthropic（Claude tool use）----------

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: getApiKey() });
  return anthropicClient;
}

const EXTRACT_TOOL: Anthropic.Tool = {
  name: "emit_events",
  description: "输出从网页文本中抽取到的所有具体活动。",
  input_schema: {
    type: "object",
    properties: {
      events: {
        type: "array",
        description: "抽取到的活动列表，没有则返回空数组。",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: ["string", "null"] },
            category: { type: "string", enum: [...EVENT_CATEGORIES] },
            venueName: { type: ["string", "null"] },
            address: { type: ["string", "null"] },
            imageUrl: { type: ["string", "null"] },
            startTime: { type: ["string", "null"] },
            endTime: { type: ["string", "null"] },
          },
          required: ["title", "category"],
          additionalProperties: false,
        },
      },
    },
    required: ["events"],
    additionalProperties: false,
  },
};

async function extractViaAnthropic(pageText: string): Promise<RawExtractedEvent[]> {
  const model = process.env.LLM_MODEL || ANTHROPIC_DEFAULT_MODEL;
  const res = await getAnthropic().messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "emit_events" },
    messages: [{ role: "user", content: `网页文本：\n"""\n${pageText}\n"""` }],
  });
  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) return [];
  const input = toolUse.input as { events?: RawExtractedEvent[] };
  return Array.isArray(input?.events) ? input.events : [];
}

// ---------- OpenAI 兼容（DeepSeek 等，JSON 模式）----------

const JSON_INSTRUCTION = `只输出一个 JSON 对象，形如 {"events": [ ... ]}，不要任何解释或 Markdown 代码围栏。
events 数组中每个对象的字段：
{
  "title": string,
  "description": string | null,
  "category": ${CATEGORY_LIST},
  "venueName": string | null,
  "address": string | null,   // 尽量是可用于地理编码的完整日文地址
  "imageUrl": string | null,  // 活动主图的完整 http(s) 链接，没有则 null
  "startTime": string | null, // ISO 8601
  "endTime": string | null
}
没有活动时输出 {"events": []}。`;

async function extractViaOpenAICompatible(pageText: string): Promise<RawExtractedEvent[]> {
  const baseUrl = (process.env.LLM_BASE_URL || DEEPSEEK_DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.LLM_MODEL || DEEPSEEK_DEFAULT_MODEL;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${JSON_INSTRUCTION}` },
        { role: "user", content: `网页文本：\n"""\n${pageText}\n"""` },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM 请求失败 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = safeJsonParse(content) as { events?: RawExtractedEvent[] } | null;
  return Array.isArray(parsed?.events) ? parsed!.events : [];
}

// ---------- 对外统一入口 ----------

export async function extractEventsFromText(
  pageText: string,
): Promise<RawExtractedEvent[]> {
  return getProvider() === "anthropic"
    ? extractViaAnthropic(pageText)
    : extractViaOpenAICompatible(pageText);
}
