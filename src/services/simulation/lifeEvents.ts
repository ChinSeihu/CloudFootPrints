import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { personaLifeStageText, personaOf, personaVoiceText } from "@/lib/personas";

// 重大人生事件（V7 Phase 3c）：每月对每人低概率触发一次「罕见、有意义、有后果」的事件，
// 写一条 MILESTONE 记忆 + 刷新当前状态（status）+（可选）新增一个目标。
// 罕见 + 可信：基于人物与最近经历，克制、不狗血。恋爱类极低概率、慢热（Romance 规则）。

const EVENT_PROB = 0.12; // 每人每月触发概率

const TYPES = [
  { k: "achievement", w: 3, desc: "达成某个目标 / 作品被认可 / 比赛或考证通过" },
  { k: "career", w: 3, desc: "工作变动：项目里程碑 / 升职 / 萌生跳槽或转行念头 / 倦怠加重" },
  { k: "growth", w: 3, desc: "某个兴趣玩出了名堂 / 学会一项新技能" },
  { k: "setback", w: 2, desc: "一次挫折 / 被否定 / 阶段性低谷" },
  { k: "life", w: 2, desc: "生活变动：考虑搬家 / 换租 / 家人来访 / 旧友重逢" },
  { k: "relationship", w: 1, desc: "感情上的细微进展（暧昧 / 心动 / 也可能是结束）——克制、慢热" },
] as const;

function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pickType(rnd: () => number): (typeof TYPES)[number] {
  const total = TYPES.reduce((s, t) => s + t.w, 0);
  let r = rnd() * total;
  for (const t of TYPES) { if ((r -= t.w) <= 0) return t; }
  return TYPES[0];
}

function getApiKey(): string {
  const k = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!k) throw new Error("缺少 LLM_API_KEY");
  return k;
}
function shouldUseAnthropic(): boolean {
  const p = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (p === "anthropic" || p === "claude") return true;
  if (p === "deepseek" || p === "openai") return false;
  return (process.env.LLM_MODEL || "").toLowerCase().startsWith("claude");
}
function safeParse(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { return null; }
}

export type LifeEvent = { type: string; memory: string; status: string; goal: string | null };

// 月度入口：按概率决定是否触发；触发则生成并落库，返回事件（未触发返回 null）。
export async function maybeLifeEvent(username: string, when: Date): Promise<LifeEvent | null> {
  const persona = personaOf(username);
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!persona || !user) return null;
  const ym = `${when.getUTCFullYear()}-${when.getUTCMonth() + 1}`;
  const rnd = seeded(`life|${ym}|${username}`);
  if (rnd() > EVENT_PROB) return null;
  const type = pickType(rnd);

  const mems = await prisma.memory.findMany({ where: { userId: user.id }, orderBy: { happenedAt: "desc" }, take: 6, select: { text: true } });
  const recent = mems.map((m) => m.text).join("；") || "（无）";
  const system = `你在为一个真实生活在东京的年轻人，生成一次「重大但可信」的人生事件。要求：罕见、有意义、有后果，但克制、不狗血、不突兀；贴合 ta 的人物设定、人生阶段与最近经历，并保持其口吻。恋爱类要极慢极淡。`;
  const u = `人物：${username}，${persona.age}岁 ${persona.occupation}。人生阶段：${personaLifeStageText(persona)}。最大矛盾：${persona.coreConflict}。口吻：${personaVoiceText(persona)}
最近经历：${recent}
本次事件类型：${type.desc}
请输出 JSON：{"memory":"第一人称、1~2句、点出这件事与心情的 MILESTONE 记忆","status":"一句新的当前状态(≤16字,口语,可带1个emoji)","goal":"由此产生的一个新目标(可选,没有就空字符串)"}`;

  let raw: string | null = null;
  try {
    if (shouldUseAnthropic()) {
      const client = new Anthropic({ apiKey: getApiKey() });
      const res = await client.messages.create({ model: process.env.LLM_MODEL || "claude-haiku-4-5", max_tokens: 400, system, messages: [{ role: "user", content: u }] });
      raw = res.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? null;
    } else {
      const baseUrl = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
        body: JSON.stringify({ model: process.env.LLM_MODEL || "deepseek-chat", messages: [{ role: "system", content: system }, { role: "user", content: u }], response_format: { type: "json_object" }, temperature: 0.9, max_tokens: 400 }),
      });
      if (res.ok) raw = ((await res.json()) as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content ?? null;
    }
  } catch { return null; }
  const parsed = safeParse(raw ?? "") as { memory?: unknown; status?: unknown; goal?: unknown } | null;
  const memory = parsed && typeof parsed.memory === "string" ? parsed.memory.trim() : "";
  if (!memory) return null;
  const status = parsed && typeof parsed.status === "string" ? parsed.status.trim().slice(0, 24) : "";
  const goal = parsed && typeof parsed.goal === "string" && parsed.goal.trim() ? parsed.goal.trim() : null;

  // 落库：MILESTONE 记忆（importance 3）+ 刷新 status +（可选）新增目标。
  await prisma.memory.create({ data: { userId: user.id, text: memory, type: "MILESTONE", importance: 3, happenedAt: when } });
  if (status) await prisma.user.update({ where: { id: user.id }, data: { status } });
  if (goal) {
    const st = await prisma.characterState.findUnique({ where: { userId: user.id }, select: { goals: true } });
    const goals = st?.goals ?? [];
    if (!goals.includes(goal)) {
      await prisma.characterState.update({ where: { userId: user.id }, data: { goals: [goal, ...goals].slice(0, 4) } });
    }
  }
  return { type: type.k, memory, status, goal };
}
