import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { personaOf } from "@/lib/personas";

// Memory Agent · 压缩（V7 Phase 3）：每 ~月把"很多条琐碎旧记忆"压成一条"生活摘要"，
// 既省 token 又制造"成长感"（例：20 条咖啡店 → "最近迷上手冲，开始追产地"）。
// 只压缩 45 天以前的 EVENT 记忆（避免与近期日推演的幂等标记冲突）。

const COMPRESS_AFTER_DAYS = 45;
const MIN_BATCH = 12; // 旧记忆少于这个数不压缩
const MAX_BATCH = 24; // 一次最多压这么多条

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

const SYSTEM = `你在帮一个东京年轻人「回顾过去这段日子」。给你 ta 这段时间的一串零碎记忆，
请压缩成 1~2 句「生活摘要」，点出这段时间 ta 在经历什么、心境/兴趣有何变化（成长或起伏）。
要求：第一人称、自然口语、像本人的回顾；不要罗列流水账，不要鸡汤；保留连续性与变化感。`;

async function summarizeLife(username: string, texts: string[]): Promise<string | null> {
  const persona = personaOf(username);
  const voice = persona ? `（${username} 的口吻：${persona.voice}）` : "";
  const user = `${voice}\n这段时间的零碎记忆：\n${texts.map((t) => `- ${t}`).join("\n")}\n\n请压缩成 1~2 句生活摘要。`;
  if (getProvider() === "anthropic") {
    const client = new Anthropic({ apiKey: getApiKey() });
    const res = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-haiku-4-5",
      max_tokens: 300,
      system: SYSTEM,
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
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (data.choices?.[0]?.message?.content ?? "").trim() || null;
}

// 压缩某人最旧的一批 EVENT 记忆为一条 SUMMARY。返回摘要文本（无可压则 null）。
export async function compressMemories(username: string, now: Date): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (!user) return null;
  const userId = user.id;
  const cutoff = new Date(now.getTime() - COMPRESS_AFTER_DAYS * 86_400_000);
  const old = await prisma.memory.findMany({
    where: { userId, type: "EVENT", happenedAt: { lt: cutoff } },
    orderBy: { happenedAt: "asc" },
    take: MAX_BATCH,
  });
  if (old.length < MIN_BATCH) return null;

  const summary = await summarizeLife(username, old.map((m) => m.text));
  if (!summary) return null;

  const mid = old[Math.floor(old.length / 2)].happenedAt;
  await prisma.$transaction([
    prisma.memory.create({ data: { userId, text: summary, type: "SUMMARY", importance: 2, happenedAt: mid } }),
    prisma.memory.deleteMany({ where: { id: { in: old.map((m) => m.id) } } }),
  ]);
  return summary;
}
