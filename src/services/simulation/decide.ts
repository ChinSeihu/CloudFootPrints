import Anthropic from "@anthropic-ai/sdk";
import type { Persona } from "@/lib/personas";
import type { World } from "./world";

// 角色「当天决策」LLM。遵循 V7：先过日子→形成记忆→（按概率）才产内容；不是 prompt→帖子。
// provider 与 lib/llm.ts 一致：deepseek/openai 走 JSON 模式，anthropic 走 tool use。

export type SpotOption = { index: number; name: string };

export type DecideInput = {
  persona: Persona;
  world: World;
  dateLabel: string; // 人类可读日期（含星期）
  emotion: Record<string, number>;
  goals: string[];
  lifeStage: string;
  recentMemories: string[]; // 最近若干条记忆文本（旧→新）
  recentNotes: string[]; // 最近几条足迹正文（防重复/连续同题材）
  spots: SpotOption[]; // 可选打卡地点（home + roam），index 对应
  cast: { name: string; relation: string }[]; // 系统外常出现的熟人（让"又见到某人"有连续性）
};

export type DecideOutput = {
  memoryText: string;
  memoryImportance: number; // 1..3
  moodDelta: Record<string, number>; // 情绪增减（可空）
  post: null | {
    note: string;
    rating: number | null; // 1..5
    spotIndex: number; // 命中 spots 的 index；越界则回退据点
    photo: boolean; // 这条是否值得配图（有画面感/重要瞬间才配，琐碎日常不配）
    photoDesc: string; // 若配图：一句话描述照片画面（默认主观镜头/手机随手拍）
  };
  people: { name: string; relation: string }[]; // 今天内容里出现的系统外的人（已有的或新出现的）
};

function getApiKey(): string {
  const k = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error("缺少 LLM_API_KEY");
  return k;
}
function getProvider(): "anthropic" | "openai" {
  const p = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (p === "anthropic" || p === "claude") return "anthropic";
  if (p === "deepseek" || p === "openai") return "openai";
  const model = (process.env.LLM_MODEL || "").toLowerCase();
  if (model.startsWith("claude") || (process.env.LLM_API_KEY || "").startsWith("sk-ant-")) return "anthropic";
  return "openai";
}

const SYSTEM = `你在模拟一个真实生活在东京的年轻人「这一天」。你不是在写帖子，你是在替这个人过日子。
铁律：
- 先想：今天我什么心情、想干嘛、最近发生了什么、真人会怎么做。再决定今天是否值得发一条「足迹」。
- 内容分布：日常 40% / 工作学习 20% / 兴趣 15% / 社交 15% / 随机 10%。**兴趣只是生活一部分，别每天都围着兴趣转。**
- 情绪允许低落（疲惫/孤独/迷茫），不要每天都正能量；禁止极端绝望/自残。
- 必须像真人：有不确定、有琐碎、有小情绪；禁止鸡汤、人生感悟、营销腔、AI 味。
- 必须贴合该人物的「笔触口吻」和当前情绪/目标/最近记忆，体现连续与缓慢成长。
- 不是每天都发内容；平淡的一天可以只在心里留个记忆（post 置 null）。
- 若发足迹：第一人称、50~150 字、写一个具体瞬间与感受，地点只能从给定清单里选。
- 社交对象**不限于 App 用户**：现实里你会遇到室友、同事、老同学、老乡、店主、家人、陌生人。能自然带入「你生活里常出现的人」就带，保持连续（"又见到那个…"）；也可以出现新的人。把今天内容里出现的人填到 people（已有的沿用同名，新的也列上）。`;

function buildUserPrompt(inp: DecideInput): string {
  const spotList = inp.spots.map((s) => `${s.index}. ${s.name}`).join("\n");
  const mem = inp.recentMemories.length ? inp.recentMemories.map((m) => `- ${m}`).join("\n") : "（暂无）";
  const notes = inp.recentNotes.length ? inp.recentNotes.map((m) => `- ${m}`).join("\n") : "（暂无）";
  const emo = Object.entries(inp.emotion).map(([k, v]) => `${k}:${v}`).join(" ");
  return `【人物】${inp.persona.username}，${inp.persona.age}岁，${inp.persona.job}。
性格倾向：${Object.entries(inp.persona.personality).map(([k, v]) => `${k}${v}`).join("/")}。
人生阶段：${inp.lifeStage}
最大矛盾：${inp.persona.conflict}
兴趣：${inp.persona.interests.join("、")}
笔触口吻（务必遵守）：${inp.persona.voice}
当前情绪(0-100)：${emo}
当前目标：${inp.goals.join("；") || "（无）"}

【今天】${inp.dateLabel}，东京${inp.world.season}，天气${inp.world.weather}，城市氛围：${inp.world.cityMood}。近期热点：${inp.world.viralTopics.join("、")}。

【最近的记忆】（旧→新，用于保持连续与成长）
${mem}

【最近发的足迹】（避免重复题材/用词；若连续同一兴趣，今天换别的）
${notes}

【你生活里常出现的人】（系统外的现实熟人，可自然带入、保持连续；也可出现新的人）
${inp.cast.length ? inp.cast.map((c) => `- ${c.name}（${c.relation}）`).join("\n") : "（暂无，按需自然引入）"}

【可选打卡地点】（post.spotIndex 只能取下列编号）
${spotList}

请决定这个人「今天」过得怎样：必产出一条今天的记忆(memoryText, 第一人称, 简短一句)，给出情绪微调(moodDelta, 可空), 决定是否发一条足迹(post)，并把今天内容里出现的系统外的人填到 people。`;
}

const JSON_INSTRUCTION = `只输出一个 JSON 对象，不要解释或代码围栏：
{
  "memoryText": "今天发生/感受的一句话（第一人称，简短）",
  "memoryImportance": 1,                 // 1普通 2较重要 3重大
  "moodDelta": {"stress": -5, "loneliness": 3},  // 情绪增减，可空对象 {}
  "post": null,                          // 平淡的一天用 null
  // 或发足迹：
  "post": {"note": "50~150字第一人称足迹", "rating": 4, "spotIndex": 0, "photo": true, "photoDesc": "手机随手拍：窗边的手冲咖啡，目黑川的绿意在杯子后面虚化"},  // rating 1-5 或 null；photo 仅在有画面感/重要瞬间为 true；photoDesc 默认主观镜头
  "people": [{"name": "酒井さん", "relation": "常去店的老板"}]  // 今天出现的系统外的人，没有就 []
}`;

const TOOL: Anthropic.Tool = {
  name: "emit_day",
  description: "输出这个人今天的记忆、情绪变化与（可选）足迹。",
  input_schema: {
    type: "object",
    properties: {
      memoryText: { type: "string" },
      memoryImportance: { type: "integer", enum: [1, 2, 3] },
      moodDelta: { type: "object", additionalProperties: { type: "number" } },
      post: {
        type: ["object", "null"],
        properties: {
          note: { type: "string" },
          rating: { type: ["integer", "null"], enum: [1, 2, 3, 4, 5, null] },
          spotIndex: { type: "integer" },
          photo: { type: "boolean" },
          photoDesc: { type: "string" },
        },
        required: ["note", "spotIndex"],
        additionalProperties: false,
      },
      people: {
        type: "array",
        items: {
          type: "object",
          properties: { name: { type: "string" }, relation: { type: "string" } },
          required: ["name", "relation"],
          additionalProperties: false,
        },
      },
    },
    required: ["memoryText", "memoryImportance"],
    additionalProperties: false,
  },
};

function safeParse(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(t); } catch { return null; }
}

function normalize(raw: unknown): DecideOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const memoryText = typeof o.memoryText === "string" ? o.memoryText.trim() : "";
  if (!memoryText) return null;
  const imp = Number(o.memoryImportance);
  const memoryImportance = imp >= 1 && imp <= 3 ? Math.round(imp) : 1;
  const moodDelta: Record<string, number> = {};
  if (o.moodDelta && typeof o.moodDelta === "object") {
    for (const [k, v] of Object.entries(o.moodDelta as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) moodDelta[k] = v;
    }
  }
  let post: DecideOutput["post"] = null;
  if (o.post && typeof o.post === "object") {
    const p = o.post as Record<string, unknown>;
    const note = typeof p.note === "string" ? p.note.trim() : "";
    if (note) {
      const r = Number(p.rating);
      const photoDesc = typeof p.photoDesc === "string" ? p.photoDesc.trim() : "";
      post = {
        note,
        rating: r >= 1 && r <= 5 ? Math.round(r) : null,
        spotIndex: Number.isFinite(Number(p.spotIndex)) ? Math.max(0, Math.round(Number(p.spotIndex))) : 0,
        photo: p.photo === true && !!photoDesc, // 仅当明确要配图且给了画面描述
        photoDesc,
      };
    }
  }
  const people: { name: string; relation: string }[] = [];
  if (Array.isArray(o.people)) {
    for (const it of o.people) {
      if (it && typeof it === "object") {
        const name = typeof (it as Record<string, unknown>).name === "string" ? ((it as Record<string, unknown>).name as string).trim() : "";
        const relation = typeof (it as Record<string, unknown>).relation === "string" ? ((it as Record<string, unknown>).relation as string).trim() : "";
        if (name) people.push({ name, relation: relation || "熟人" });
      }
    }
  }
  return { memoryText, memoryImportance, moodDelta, post, people };
}

export async function decideDay(inp: DecideInput): Promise<DecideOutput | null> {
  const user = buildUserPrompt(inp);
  if (getProvider() === "anthropic") {
    const client = new Anthropic({ apiKey: getApiKey() });
    const res = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-haiku-4-5",
      max_tokens: 800,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: "emit_day" },
      messages: [{ role: "user", content: user }],
    });
    const tu = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    return tu ? normalize(tu.input) : null;
  }
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: `${SYSTEM}\n\n${JSON_INSTRUCTION}` },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.95,
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`sim LLM ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return normalize(safeParse(data.choices?.[0]?.message?.content ?? ""));
}
