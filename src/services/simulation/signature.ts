import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { personaOf, personaVoiceText } from "@/lib/personas";

// 动态签名/状态（V7 Phase 3b）：随人生状态/情绪/最近经历刷新（见 docs/demo-personas.md）。
//  - status（近况）：变化较快，每周刷新活跃角色。
//  - signature（个性签名）：变化缓慢，每月刷新一次。
// 直接写 prisma.user（只改目标字段），不用 updateProfile（它会把未传字段置 null，抹掉头像等）。

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

async function oneLine(system: string, user: string, maxTokens: number): Promise<string | null> {
  if (getProvider() === "anthropic") {
    const client = new Anthropic({ apiKey: getApiKey() });
    const res = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-haiku-4-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });
    const t = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    return t?.text.trim() || null;
  }
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getApiKey()}` },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-chat",
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.85,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (data.choices?.[0]?.message?.content ?? "").trim() || null;
}

// 去掉引号/书名号/多余空白，截断到上限。
function clean(s: string, max: number): string {
  const t = s.replace(/^[「『"'“]+|[」』"'”]+$/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) : t;
}

async function context(userId: string): Promise<{ mems: string[]; emo: string; lifeStage: string }> {
  const mems = await prisma.memory.findMany({ where: { userId }, orderBy: { happenedAt: "desc" }, take: 6, select: { text: true } });
  const st = await prisma.characterState.findUnique({ where: { userId }, select: { emotion: true, lifeStage: true } });
  const emo = Object.entries((st?.emotion as Record<string, number>) ?? {}).map(([k, v]) => `${k}:${v}`).join(" ");
  return { mems: mems.map((m) => m.text), emo, lifeStage: st?.lifeStage ?? "" };
}

export async function refreshStatus(username: string): Promise<string | null> {
  const persona = personaOf(username);
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!persona || !user) return null;
  const { mems, emo, lifeStage } = await context(user.id);
  if (!mems.length) return null;
  const system = `你在替一个东京年轻人更新 SNS 的「当前状态」——一句很短的近况（此刻在干嘛/最近心情）。口语、具体、≤16 字，符合 ta 的口吻，可带 1 个 emoji。只输出这句话，不要引号或解释。`;
  const u = `人物：${username}，${persona.occupation}。口吻：${personaVoiceText(persona)}\n人生阶段：${lifeStage}\n情绪：${emo}\n最近经历：\n${mems.map((m) => `- ${m}`).join("\n")}\n\n据此写一句新的当前状态。`;
  const out = await oneLine(system, u, 80);
  if (!out) return null;
  const status = clean(out, 24);
  await prisma.user.update({ where: { id: user.id }, data: { status } });
  return status;
}

export async function refreshSignature(username: string): Promise<string | null> {
  const persona = personaOf(username);
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!persona || !user) return null;
  const { mems, emo, lifeStage } = await context(user.id);
  if (!mems.length) return null;
  const system = `你在替一个东京年轻人更新「个性签名」——较稳定的自我定位/心境，概括、像一句 slogan，≤20 字，符合 ta 的口吻。只输出这句话，不要引号或解释。`;
  const u = `人物：${username}，${persona.occupation}。口吻：${personaVoiceText(persona)}\n人生阶段：${lifeStage}\n情绪：${emo}\n最近经历：\n${mems.map((m) => `- ${m}`).join("\n")}\n\n据此写一句新的个性签名。`;
  const out = await oneLine(system, u, 80);
  if (!out) return null;
  const signature = clean(out, 30);
  await prisma.user.update({ where: { id: user.id }, data: { signature } });
  return signature;
}
