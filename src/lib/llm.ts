import Anthropic from "@anthropic-ai/sdk";
import { EVENT_CATEGORIES, isEventCategory, type EventCategory } from "@/lib/categories";

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
- category 只能是 ${CATEGORY_LIST}，选最贴近的一个（EXHIBITION=展览, MARKET=市集, LIVE=演出/现场, FESTIVAL=祭典, TALK=讲座/技术活动/勉强会, SPORTS=体育/运动/比赛/马拉松/健身, OTHER=其他）。
- 时间用 ISO 8601 字符串；若只有日期没有时间，补 T00:00:00。
- tags：整理 2-5 个短标签，直接描述活动属性/看点/适合人群，例如「亲子」「雨天」「夜间」「免费」「赏花」「沉浸体验」「摄影」「市集」。不要写编号，不要写长句。
- imageUrl：活动主图/海报的**完整 http(s) 链接**（页面里有就带上，相对路径或不确定则填 null）。
- 无法确定的字段填 null。
- 一页可能含多个活动；没有具体活动时返回空数组。`;

// 抽取器返回的原始对象（未经 zod 校验）。
const TIME_EXTRACTION_RULES = `Time extraction rules:
- If the page text contains times such as 10:00, 10時, 午後2時, 開場18:30, 10:00-18:00, use those hours/minutes in startTime/endTime.
- Use Asia/Tokyo offset (+09:00) when the page omits a timezone.
- Only use T00:00:00+09:00 when the page truly provides a date but no time anywhere near that event.
- For ranges, startTime is the opening/start time and endTime is the closing/end time on the same date unless another date is explicitly shown.`;

export type RawExtractedEvent = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  venueName?: unknown;
  address?: unknown;
  tags?: unknown;
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
            tags: { type: "array", items: { type: "string" } },
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
    system: `${SYSTEM_PROMPT}\n\n${TIME_EXTRACTION_RULES}`,
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
  "tags": string[],           // 2-5 个短标签，如「亲子」「雨天」「免费」「沉浸体验」
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
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${TIME_EXTRACTION_RULES}\n\n${JSON_INSTRUCTION}` },
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

// ---------- 对外统一入口（抽取）----------

export async function extractEventsFromText(
  pageText: string,
): Promise<RawExtractedEvent[]> {
  return getProvider() === "anthropic"
    ? extractViaAnthropic(pageText)
    : extractViaOpenAICompatible(pageText);
}

// ---------- 批量分类（给已知活动补/纠 category）----------
// 用于 prestructured 源（如 walkerplus 关键词分类偏弱）：把一批活动交给 LLM
// 统一重判分类。比逐条调用省 token。provider 切换与抽取一致。

export type ClassifyItem = { title: string; description?: string | null };

const CLASSIFY_SYSTEM = `你是东京活动分类器。给定一批活动（标题 + 可选简介），为每条选出最贴切的分类。
分类含义：
- EXHIBITION：展览 / 美术馆 / 艺术 / 摄影 / IP 主题展 / 体验型展览（沉浸展、角色快闪、企划展）
- MARKET：市集 / 集市 / 跳蚤市场 / 骨董市 / 手作市
- LIVE：演唱会 / 音乐现场 / 演奏会 / 音乐节
- FESTIVAL：祭典 / 庙会 / 花火大会 / 盆踊 / 季节性庆典
- TALK：讲座 / 研讨会 / 工作坊 / 勉强会 / 演讲
- SPORTS：体育 / 运动 / 比赛 / 马拉松 / 跑步 / 健身 / 球类 / 瑜伽
- OTHER：明显不属于以上任何一类时才用
尽量避免 OTHER：体验展 / 快闪 / IP 企划活动多归 EXHIBITION。`;

function buildClassifyList(items: ClassifyItem[]): string {
  return items
    .map((it, i) => `${i + 1}. ${it.title}${it.description ? `（${it.description.slice(0, 120)}）` : ""}`)
    .join("\n");
}

const CLASSIFY_TOOL: Anthropic.Tool = {
  name: "emit_categories",
  description: "按输入顺序输出每条活动的分类。",
  input_schema: {
    type: "object",
    properties: {
      categories: {
        type: "array",
        description: "与输入等长、同顺序的分类数组。",
        items: { type: "string", enum: [...EVENT_CATEGORIES] },
      },
    },
    required: ["categories"],
    additionalProperties: false,
  },
};

async function classifyViaAnthropic(items: ClassifyItem[]): Promise<string[]> {
  const model = process.env.LLM_MODEL || ANTHROPIC_DEFAULT_MODEL;
  const res = await getAnthropic().messages.create({
    model,
    max_tokens: 1024,
    system: CLASSIFY_SYSTEM,
    tools: [CLASSIFY_TOOL],
    tool_choice: { type: "tool", name: "emit_categories" },
    messages: [
      {
        role: "user",
        content: `共 ${items.length} 条，按 1..${items.length} 顺序输出分类（数组长度必须为 ${items.length}）：\n${buildClassifyList(items)}`,
      },
    ],
  });
  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  const input = toolUse?.input as { categories?: string[] } | undefined;
  return Array.isArray(input?.categories) ? input.categories : [];
}

async function classifyViaOpenAICompatible(items: ClassifyItem[]): Promise<string[]> {
  const baseUrl = (process.env.LLM_BASE_URL || DEEPSEEK_DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.LLM_MODEL || DEEPSEEK_DEFAULT_MODEL;
  const instruction = `只输出 JSON：{"categories": ["...", ...]}，数组与输入等长、同顺序，每项是 ${CATEGORY_LIST} 之一。不要解释或 Markdown 围栏。`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${CLASSIFY_SYSTEM}\n\n${instruction}` },
        { role: "user", content: `共 ${items.length} 条：\n${buildClassifyList(items)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM 分类请求失败 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const parsed = safeJsonParse(data.choices?.[0]?.message?.content ?? "") as
    | { categories?: string[] }
    | null;
  return Array.isArray(parsed?.categories) ? parsed.categories : [];
}

// ---------- 地址规范化（GSI 地理编码失败时的兜底）----------
// walkerplus/jalan 的地址常带建筑名/设施名，GSI 可能匹配不到。让 LLM 转成
// 「国土地理院地址检索」能识别的标准日文住所；不确定就到町级，不编造番地。

const GEOCODE_NORMALIZE_SYSTEM = `你是日本地址规范化器。把给定的活动地址转成「国土地理院地址検索」能精确匹配的标准日文住所。
规则：
- 输出格式：都道府県 + 市区町村 + 町名 +（可选）丁目・番地，例如「東京都江東区有明3-3-8」。
- 去掉建筑名/设施名/店铺名/楼层（如「TOKYO DREAM PARK」「○○ビル3F」「△△駅前」）。
- 若能确定该设施的准确番地就输出到番地；**不确定就只输出到「都道府県+市区町村+町名」，绝不编造番地**。
- 只输出一行地址字符串，不要任何解释、引号或多余文字。`;

export async function normalizeAddressForGeocode(raw: string): Promise<string | null> {
  const addr = raw?.trim();
  if (!addr) return null;
  try {
    if (getProvider() === "anthropic") {
      const res = await getAnthropic().messages.create({
        model: process.env.LLM_MODEL || ANTHROPIC_DEFAULT_MODEL,
        max_tokens: 128,
        system: GEOCODE_NORMALIZE_SYSTEM,
        messages: [{ role: "user", content: addr }],
      });
      const block = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      return block ? block.text.trim() : null;
    }
    const baseUrl = (process.env.LLM_BASE_URL || DEEPSEEK_DEFAULT_BASE).replace(/\/$/, "");
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || DEEPSEEK_DEFAULT_MODEL,
        messages: [
          { role: "system", content: GEOCODE_NORMALIZE_SYSTEM },
          { role: "user", content: addr },
        ],
        temperature: 0,
        max_tokens: 128,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    return content ? String(content).trim() : null;
  } catch {
    return null;
  }
}

const CLASSIFY_BATCH = 40;

// 批量分类。返回与输入等长的数组；个别无法判定处填 null（调用方回退原分类）。
export async function classifyEvents(
  items: ClassifyItem[],
): Promise<(EventCategory | null)[]> {
  const out: (EventCategory | null)[] = [];
  const useAnthropic = getProvider() === "anthropic";
  for (let i = 0; i < items.length; i += CLASSIFY_BATCH) {
    const batch = items.slice(i, i + CLASSIFY_BATCH);
    let cats: string[] = [];
    try {
      cats = useAnthropic
        ? await classifyViaAnthropic(batch)
        : await classifyViaOpenAICompatible(batch);
    } catch (err) {
      console.warn("  ⚠️  LLM 分类失败，本批回退原分类：", (err as Error).message);
    }
    for (let j = 0; j < batch.length; j++) {
      out.push(isEventCategory(cats[j]) ? (cats[j] as EventCategory) : null);
    }
  }
  return out;
}

// ---------- 批量一句话摘要（给活动生成地图标签用的短摘要）----------
// 活动 description 常冗长/缺失，直接截取效果差。让 LLM 为一批活动各生成一句
// ≤14 字、点明看点/特色的中文短摘要，存入 Event.summary，地图标签直接用。

export type SummarizeItem = { title: string; description?: string | null };

const SUMMARIZE_SYSTEM = `你是东京活动文案编辑。给定一批活动（标题 + 可选简介），为每条写一句**极短的中文摘要**，用作地图标签。
要求：
- 每条**不超过 14 个字**，越短越好，点明这是什么 / 看点 / 特色。
- 是名词性短语或一句话，不要标点结尾，不要书名号/引号，不要编号。
- 不要照抄标题；提炼其内容或类型（如「teamLab 沉浸光影展」「隅田川夏夜花火」「草间弥生回顾展」）。
- 信息不足时，用分类层面的简短描述（如「现代艺术展览」「地方特色市集」）。`;

function buildSummarizeList(items: SummarizeItem[]): string {
  return items
    .map((it, i) => `${i + 1}. ${it.title}${it.description ? `（${it.description.slice(0, 160)}）` : ""}`)
    .join("\n");
}

const SUMMARIZE_TOOL: Anthropic.Tool = {
  name: "emit_summaries",
  description: "按输入顺序输出每条活动的一句话短摘要。",
  input_schema: {
    type: "object",
    properties: {
      summaries: {
        type: "array",
        description: "与输入等长、同顺序的短摘要数组，每条 ≤14 字。",
        items: { type: "string" },
      },
    },
    required: ["summaries"],
    additionalProperties: false,
  },
};

async function summarizeViaAnthropic(items: SummarizeItem[]): Promise<string[]> {
  const model = process.env.LLM_MODEL || ANTHROPIC_DEFAULT_MODEL;
  const res = await getAnthropic().messages.create({
    model,
    max_tokens: 1024,
    system: SUMMARIZE_SYSTEM,
    tools: [SUMMARIZE_TOOL],
    tool_choice: { type: "tool", name: "emit_summaries" },
    messages: [
      {
        role: "user",
        content: `共 ${items.length} 条，按 1..${items.length} 顺序输出摘要（数组长度必须为 ${items.length}）：\n${buildSummarizeList(items)}`,
      },
    ],
  });
  const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const input = toolUse?.input as { summaries?: string[] } | undefined;
  return Array.isArray(input?.summaries) ? input.summaries : [];
}

async function summarizeViaOpenAICompatible(items: SummarizeItem[]): Promise<string[]> {
  const baseUrl = (process.env.LLM_BASE_URL || DEEPSEEK_DEFAULT_BASE).replace(/\/$/, "");
  const model = process.env.LLM_MODEL || DEEPSEEK_DEFAULT_MODEL;
  const instruction = `只输出 JSON：{"summaries": ["...", ...]}，数组与输入等长、同顺序，每项是 ≤14 字的中文短摘要。不要解释或 Markdown 围栏。`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${SUMMARIZE_SYSTEM}\n\n${instruction}` },
        { role: "user", content: `共 ${items.length} 条：\n${buildSummarizeList(items)}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    throw new Error(`LLM 摘要请求失败 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = safeJsonParse(data.choices?.[0]?.message?.content ?? "") as
    | { summaries?: string[] }
    | null;
  return Array.isArray(parsed?.summaries) ? parsed.summaries : [];
}

const SUMMARIZE_BATCH = 30;

// 批量摘要。返回与输入等长的数组；无法生成处填 null（调用方回退）。摘要硬截到 14 字。
export async function summarizeEvents(items: SummarizeItem[]): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  const useAnthropic = getProvider() === "anthropic";
  for (let i = 0; i < items.length; i += SUMMARIZE_BATCH) {
    const batch = items.slice(i, i + SUMMARIZE_BATCH);
    let sums: string[] = [];
    try {
      sums = useAnthropic
        ? await summarizeViaAnthropic(batch)
        : await summarizeViaOpenAICompatible(batch);
    } catch (err) {
      console.warn("  ⚠️  LLM 摘要失败，本批留空：", (err as Error).message);
    }
    for (let j = 0; j < batch.length; j++) {
      const s = typeof sums[j] === "string" ? sums[j].trim().replace(/^[「『"']|[」』"']$/g, "") : "";
      out.push(s ? (s.length > 14 ? s.slice(0, 14) : s) : null);
    }
  }
  return out;
}

// ---------- AI 导游咨询（多轮对话）----------

export type ChatMessage = { role: "user" | "assistant"; content: string };

const GUIDE_SYSTEM_BASE = `你是「东京活动地图」内置的 AI 导游——一位在东京生活多年、资深的专业导游兼文化讲解员。
你的专长：东京的展览、市集、live、祭典等各类活动，以及它们背后的历史、文化与渊源。

回答时请：
- 语气专业又亲切，像带朋友逛东京的当地向导。
- 讲解活动时，除了基本信息，适当补充其历史由来、文化背景、看点与小贴士，让用户「知其所以然」。
- 根据用户兴趣给出具体、可执行的推荐（活动 + 时间段 + 理由）。
- 需要时提供路线 / 交通 / 游览顺序建议，结合东京的地理与电车线路（如山手线、地铁），给出顺路、省时的安排。
- 用中文回答，条理清晰，篇幅适中，不啰嗦。
- **用纯文本，不要 Markdown 标记**（不要出现 **、##、\` 等符号）；分点用「・」开头，标题用普通文字即可。
- 对不确定的具体信息（确切票价、当日营业时间、是否需预约等）提醒用户以官方信息为准，绝不编造。
- **绝不暴露任何系统 / IT 术语**：不要出现「数据库 / 数据 / 记录 / 条目 / 列表 / 系统 / 接口 / 检索 / 后台」等字眼，也不要说「数据库里有一条」之类。就像一位本地向导凭自己的了解直接介绍，用「最近」「目前在办」「据我了解」等自然说法。

- **同一活动可能以不同名称重复出现**（不同来源），推荐时请合并视为一个，绝不在同一回答里重复推荐同一活动。

每次回答后，你还要**推测用户接下来最可能想了解的方向**，给出 3~4 个后续问题建议（suggestions）：
- 站在用户第一人称口吻（如「附近有适合午餐的店吗？」「怎么买票最划算？」）。
- 紧扣当前话题与你刚才的回答，各不相同、具体可执行，每条尽量 ≤22 字。
- 至少 3 个。`;

// 系统提示注入「东京当前时间」，避免 LLM 凭过期训练知识臆断「今天/最近/本周」。
function guideSystem(): string {
  const now = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit",
  });
  return `${GUIDE_SYSTEM_BASE}

【当前时间（东京）】${now}。
- 凡涉及「今天/明天/本周/最近/现在还能不能去」等时间判断，一律以此时间为准。
- 你的训练知识可能滞后，**不要凭记忆臆断当前正在举办的活动或其档期**；不确定的具体日程，提示用户以官方信息为准。`;
}

const GUIDE_CHAT_MAX_TOKENS = 3000; // 提高上限，避免回答+建议被截断导致空白（尤其多轮追问）

export type GuideReply = { reply: string; suggestions: string[]; referenced: string[] };

// 清洗活动编号（E1、E2…）：去空、去重、最多 8 个。
function cleanTokens(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const x of arr) {
    if (typeof x !== "string") continue;
    const m = x.trim().match(/E\d+/i);
    if (m) { const t = m[0].toUpperCase(); if (!out.includes(t)) out.push(t); }
  }
  return out.slice(0, 8);
}

// 清洗后续问题建议：去前导编号/引号、去空、最多 4 条。
function cleanSuggestions(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().replace(/^\s*\d+[.、)]\s*/, "").replace(/^[「『"']|[」』"']$/g, "").trim())
    .filter(Boolean)
    .slice(0, 4);
}

const GUIDE_TOOL: Anthropic.Tool = {
  name: "emit_guide_reply",
  description: "输出导游的回答，以及推测用户接下来最可能想问的后续问题建议。",
  input_schema: {
    type: "object",
    properties: {
      reply: { type: "string", description: "给用户的完整回答（纯文本，不要 Markdown 标记）。" },
      suggestions: {
        type: "array",
        description: "推测用户接下来最可能想问的后续问题，3~4 条，第一人称口吻，各不相同，每条≤22字。",
        items: { type: "string" },
        minItems: 3,
      },
      referenced: {
        type: "array",
        description: "你的回答中提到的、来自参考活动清单的活动编号（如 E1、E5）；没有提到则空数组。",
        items: { type: "string" },
      },
    },
    required: ["reply", "suggestions"],
    additionalProperties: false,
  },
};

export async function chatWithGuide(messages: ChatMessage[], eventsContext?: string): Promise<GuideReply> {
  const system = eventsContext ? `${guideSystem()}\n\n${eventsContext}` : guideSystem();
  if (getProvider() === "anthropic") {
    const res = await getAnthropic().messages.create({
      model: process.env.LLM_MODEL || ANTHROPIC_DEFAULT_MODEL,
      max_tokens: GUIDE_CHAT_MAX_TOKENS,
      system,
      tools: [GUIDE_TOOL],
      tool_choice: { type: "tool", name: "emit_guide_reply" },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const toolUse = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const input = toolUse?.input as { reply?: string; suggestions?: string[]; referenced?: string[] } | undefined;
    let reply = (input?.reply ?? "").trim();
    // 工具输出被 max_tokens 截断时 input 可能解析不出 reply → 回退取文本块，避免空白。
    if (!reply) {
      const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      reply = (text?.text ?? "").trim();
    }
    if (!reply) reply = await plainAnthropicReply(system, messages); // 仍空 → 不带工具再答一次
    const suggestions = await ensureSuggestions(messages, reply, cleanSuggestions(input?.suggestions));
    return { reply, suggestions, referenced: cleanTokens(input?.referenced) };
  }
  const baseUrl = (process.env.LLM_BASE_URL || DEEPSEEK_DEFAULT_BASE).replace(/\/$/, "");
  const instruction = `只输出一个 JSON 对象：{"reply": "回答正文（纯文本，不要 Markdown 围栏/标记，正文里不要出现 E1 这类编号）", "suggestions": ["后续问题1","后续问题2","后续问题3"], "referenced": ["E1","E5"]}。
suggestions 是你推测用户接下来最可能想问的 3~4 个问题，第一人称口吻、各不相同、紧扣当前话题，每条≤22字。
**无论是首次提问还是多轮追问，每一轮回答都必须给出至少 3 条 suggestions，绝不能省略或返回空数组。**
referenced 是你回答中提到的、来自上方参考活动清单的活动编号（如 E1、E5）；没有提到就给空数组 []。
不要任何解释或代码围栏。`;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || DEEPSEEK_DEFAULT_MODEL,
      messages: [{ role: "system", content: `${system}\n\n${instruction}` }, ...messages],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: GUIDE_CHAT_MAX_TOKENS,
    }),
  });
  if (!res.ok) throw new Error(`AI 聊天请求失败 ${res.status}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = safeJsonParse(content) as { reply?: string; suggestions?: string[]; referenced?: string[] } | null;
  const reply = (parsed && typeof parsed.reply === "string" ? parsed.reply : content).trim();
  // 仍为空 → 不带 JSON 约束重答一次，保证不空白。
  if (!reply) {
    const r = await plainOpenAIReply(baseUrl, system, messages);
    return { reply: r, suggestions: await ensureSuggestions(messages, r, []), referenced: [] };
  }
  const suggestions = await ensureSuggestions(messages, reply, cleanSuggestions(parsed?.suggestions));
  return { reply, suggestions, referenced: cleanTokens(parsed?.referenced) };
}

// 保证每轮都有后续问题：主流程已给 ≥3 条则直接用；否则用一次轻量调用补足
// （DeepSeek 多轮时常漏掉 suggestions，这里兜底，确保每条回答都带「猜你接下来想问」）。
async function ensureSuggestions(messages: ChatMessage[], reply: string, current: string[]): Promise<string[]> {
  if (current.length >= 3) return current;
  try {
    const got = await generateSuggestions(messages, reply);
    const merged = [...current];
    for (const s of got) if (!merged.includes(s)) merged.push(s);
    return merged.slice(0, 4);
  } catch {
    return current;
  }
}

async function generateSuggestions(messages: ChatMessage[], reply: string): Promise<string[]> {
  const ask = `基于上面的对话和你刚才的回答，列出用户接下来最可能想问的 3~4 个问题。第一人称口吻、各不相同、紧扣回答、每条≤22字。只输出 JSON：{"suggestions":["问题1","问题2","问题3"]}，不要解释或代码围栏。`;
  const convo: ChatMessage[] = [...messages, { role: "assistant", content: reply }, { role: "user", content: ask }];
  if (getProvider() === "anthropic") {
    const res = await getAnthropic().messages.create({
      model: process.env.LLM_MODEL || ANTHROPIC_DEFAULT_MODEL,
      max_tokens: 400,
      system: "你是东京活动导游助手，只产出后续问题建议。",
      messages: convo.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const parsed = safeJsonParse(text?.text ?? "") as { suggestions?: string[] } | null;
    return cleanSuggestions(parsed?.suggestions);
  }
  const baseUrl = (process.env.LLM_BASE_URL || DEEPSEEK_DEFAULT_BASE).replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || DEEPSEEK_DEFAULT_MODEL,
      messages: convo,
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 400,
    }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = safeJsonParse(data.choices?.[0]?.message?.content ?? "") as { suggestions?: string[] } | null;
  return cleanSuggestions(parsed?.suggestions);
}

// 兜底：不带工具/JSON 约束，纯文本再答一次（仅在主流程拿到空回复时调用）。
async function plainAnthropicReply(system: string, messages: ChatMessage[]): Promise<string> {
  try {
    const res = await getAnthropic().messages.create({
      model: process.env.LLM_MODEL || ANTHROPIC_DEFAULT_MODEL,
      max_tokens: GUIDE_CHAT_MAX_TOKENS,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return (text?.text ?? "").trim() || "抱歉，刚才没答上来，请再问一次或换个问法。";
  } catch {
    return "抱歉，刚才没答上来，请再问一次或换个问法。";
  }
}

async function plainOpenAIReply(baseUrl: string, system: string, messages: ChatMessage[]): Promise<string> {
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || DEEPSEEK_DEFAULT_MODEL,
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0.7,
        max_tokens: GUIDE_CHAT_MAX_TOKENS,
      }),
    });
    if (!res.ok) return "抱歉，刚才没答上来，请再问一次或换个问法。";
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content ?? "").trim() || "抱歉，刚才没答上来，请再问一次或换个问法。";
  } catch {
    return "抱歉，刚才没答上来，请再问一次或换个问法。";
  }
}
