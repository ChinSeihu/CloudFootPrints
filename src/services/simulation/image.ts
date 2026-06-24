import { existsSync, readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import type { Persona } from "@/lib/personas";
import type { World } from "./world";
import { judgeImage } from "./imageQA";

// 读取人物单人参考图（public/refs/NN.png，由 scripts/crop-refs.ts 从 person.png 裁出）→ data URI。
// 作为 Agnes img2img 的图参锁定人脸/外观。缺图返回 null（回退纯文本）。
function loadRefImage(refIndex: number): string | null {
  const p = `public/refs/${String(refIndex).padStart(2, "0")}.png`;
  try {
    if (!existsSync(p)) return null;
    return `data:image/png;base64,${readFileSync(p).toString("base64")}`;
  } catch {
    return null;
  }
}

// Image Agent（V7 Phase 4）：把"生活"转成生活化照片。统一 ImageProvider 接口，
// 当前可选 provider：none（默认，不出图）/ agnes（外部生成 API，按 env 接入）。
// 设计目标：接口先行、provider 可替换；外观以 public/person.png + personas.appearance 为基准；
// 默认主观镜头（手机随手拍），仅摄影强者用客观构图。生成图统一上传 Cloudinary（CORS + 持久）。

export type ImageRequest = {
  persona: Persona;
  photoDesc: string; // 来自决策：一句话画面描述（中文，主观视角倾向）
  world: World;
};

export interface ImageProvider {
  readonly name: string;
  // 传入最终 prompt + （可选）人物参考图 data URI（img2img 锁脸）；返回图片 URL 或 data URI；失败返回 null。
  generate(prompt: string, refImage?: string): Promise<string | null>;
}

// 带超时的 fetch：避免出图/质检的网络请求卡住整条回填或每日 workflow。超时即 abort → 上层按失败处理。
export async function fetchT(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

// 视角语气：casual 日常一律主观；hobby 平时主观（作品才客观，这里日常按主观）；pro 客观构图。
function povClause(persona: Persona): string {
  if (persona.photoSkill === "pro") {
    return "considered composition, photographer's eye, deliberate framing and light";
  }
  return "first-person point of view, casual smartphone snapshot, slightly imperfect candid framing; the scene as the person sees it (hands, objects, food, street), face not necessarily visible";
}

// 我们的「生图规则」：附加在 LLM 写的场景 prompt 之后，强制写实 / 表情自然 / 视角 / 外观一致 / 无水印。
// Agnes 无负向提示参数，这些约束全靠措辞。
function buildRules(persona: Persona): string {
  return [
    "[Constraints]",
    povClause(persona) + ".",
    "Photorealistic candid smartphone snapshot of ordinary daily life in Tokyo, not a professional shoot.",
    "People are ordinary young Asian people in Tokyo with calm, natural, subtle expressions, relaxed and unposed; no exaggerated smiles or dramatic faces; an unaware candid instant.",
    `Recurring individual — keep the SAME face, hairstyle and body type consistent (identity: ${persona.appearance}). But VARY the clothing, outfit and accessories each time to fit this scene, season and weather; do NOT reuse the same outfit.`,
    "Natural available light, true-to-life muted colors, realistic skin texture with minor imperfections, faint grain, slightly imperfect casual framing.",
    "Avoid an AI/CGI look: no 3D render, no hyperreal over-sharpening, no glossy plastic skin, no cinematic dramatic lighting, no studio portrait, no posed shot, no exaggerated expression. No text, no watermark, no logo.",
  ].join(" ");
}

// 用 LLM 写一段「专业、详细」的英文场景 prompt（只描述画面：主体/动作/构图/景别/光线/镜头/环境/氛围）。
// 不含风格约束——约束由 buildRules 附加。LLM 失败返回 null（上层回退）。
async function scenePromptLLM(req: ImageRequest): Promise<string | null> {
  const { persona, photoDesc, world } = req;
  const key = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const useAnthropic = provider === "anthropic" || provider === "claude" || (process.env.LLM_MODEL || "").toLowerCase().startsWith("claude");
  const system = `你是专业的摄影指导兼 AI 绘图提示词工程师。根据给定的生活场景，写一段**详细、专业的英文图片生成 prompt**，只描述画面本身：主体与动作、构图与景别、前景/背景层次、光线方向与质感、镜头/相机感（焦段、景深）、环境与道具细节、氛围与时间。具体、有画面感，60~110 词。
若画面里有该人物出镜：为 ta 安排一套**符合当下场景/季节/天气的具体穿搭**（颜色/单品/配饰，**每次尽量不同、避免千篇一律**），但**长相/发型/体型保持不变**。
只输出这段英文 prompt，不要解释、不要加引号、不要写风格规则。`;
  const user = `场景（中文）：${photoDesc}
人物：${persona.age}岁 ${persona.job}；视角倾向：${persona.photoSkill === "pro" ? "讲究构图（摄影师）" : "第一人称手机随手拍"}。
季节天气：${world.season} / ${world.weather}。
请写英文图片生成 prompt。`;
  try {
    if (useAnthropic) {
      const client = new Anthropic({ apiKey: key });
      const res = await client.messages.create({
        model: process.env.LLM_MODEL || "claude-haiku-4-5",
        max_tokens: 400, system, messages: [{ role: "user", content: user }],
      });
      const t = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
      return t?.text.trim() || null;
    }
    const baseUrl = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
    const res = await fetchT(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "deepseek-chat",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        temperature: 0.7, max_tokens: 400,
      }),
    }, 45000);
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content ?? "").trim() || null;
  } catch {
    return null;
  }
}

// 组合最终 prompt = LLM 专业场景描述 + 我们的生图规则。LLM 失败则回退（photoDesc + 规则）。
export async function composePrompt(req: ImageRequest): Promise<string> {
  const scene = await scenePromptLLM(req);
  const rules = buildRules(req.persona);
  if (scene) return `${scene}\n\n${rules}`;
  return `Scene: ${req.photoDesc}. Season ${req.world.season}, ${req.world.weather}.\n\n${rules}`;
}

// 把生成图（远程 URL 或 data URI）上传 Cloudinary（服务端抓取），得到自带 CORS 的持久链接。
// 未配置 Cloudinary 时：若是 http(s) URL 直接返回原链；data URI 无法直接展示则返回 null。
export async function persistToCloudinary(src: string): Promise<string | null> {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloud || !preset) return /^https?:\/\//.test(src) ? src : null;
  try {
    const form = new FormData();
    form.append("file", src); // 接受远程 URL 或 data URI
    form.append("upload_preset", preset);
    form.append("folder", "cloudfootprints/sim");
    const res = await fetchT(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form }, 60000);
    if (!res.ok) return /^https?:\/\//.test(src) ? src : null;
    return ((await res.json()) as { secure_url: string }).secure_url;
  } catch {
    return /^https?:\/\//.test(src) ? src : null;
  }
}

// ── Provider：none（默认，不出图）──
class NoopProvider implements ImageProvider {
  readonly name = "none";
  async generate(_prompt: string, _ref?: string): Promise<string | null> {
    void _prompt; void _ref;
    return null;
  }
}

// ── Provider：Agnes（OpenAI images 兼容，已实测）──
// 鉴权 Bearer；endpoint = <base>/images/generations；返回 data[0].url（或 b64_json）。
// 需要 env：IMAGE_PROVIDER=agnes、AGNES_API_URL(base，如 https://apihub.agnes-ai.com/v1)、
//          AGNES_API_KEY、(可选) AGNES_MODEL(默认 agnes-image-2.1-flash)。任何失败→null。
class AgnesProvider implements ImageProvider {
  readonly name = "agnes";
  async generate(prompt: string, refImage?: string): Promise<string | null> {
    const base = process.env.AGNES_API_URL;
    const key = process.env.AGNES_API_KEY;
    if (!base || !key) return null;
    const endpoint = /\/images\/generations$/.test(base)
      ? base
      : `${base.replace(/\/$/, "")}/images/generations`;
    try {
      const res = await fetchT(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.AGNES_MODEL || "agnes-image-2.1-flash",
          prompt,
          size: "1024x1024",
          n: 1,
          // 人物参考图（img2img）：把该人物放进新场景，锁定脸/外观。
          ...(refImage ? { extra_body: { image: [refImage], response_format: "url" } } : {}),
        }),
      }, 120000);
      if (!res.ok) return null;
      const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
      const d = data.data?.[0];
      if (d?.b64_json) return `data:image/png;base64,${d.b64_json}`;
      return d?.url || null;
    } catch {
      return null;
    }
  }
}

// ── Provider：Google Gemini 2.5 Flash Image ──
// 鉴权 = x-goog-api-key 头（已实测确认）；返回图片在 candidates[0].content.parts[].inlineData(base64)。
// 需要 env：IMAGE_PROVIDER=gemini、GEMINI_API_KEY、(可选) GEMINI_IMAGE_MODEL。
// 账户无额度时返回 429 → 本方法返回 null（不出图、不打断模拟）。
class GeminiProvider implements ImageProvider {
  readonly name = "gemini";
  async generate(prompt: string, refImage?: string): Promise<string | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    const model = (process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image").replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const reqParts: Array<Record<string, unknown>> = [{ text: prompt }];
    const m = refImage?.match(/^data:(image\/[a-z]+);base64,(.+)$/);
    if (m) reqParts.push({ inlineData: { mimeType: m[1], data: m[2] } });
    try {
      const res = await fetchT(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: reqParts }] }),
      }, 120000);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<Record<string, unknown>> } }>;
      };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      for (const p of parts) {
        const inline = (p as { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mimeType?: string; data?: string } });
        const dat = inline.inlineData || inline.inline_data;
        if (dat?.data) return `data:${dat.mimeType || "image/png"};base64,${dat.data}`;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export function getImageProvider(): ImageProvider {
  const p = (process.env.IMAGE_PROVIDER || "none").toLowerCase();
  if (p === "gemini") return new GeminiProvider();
  if (p === "agnes") return new AgnesProvider();
  return new NoopProvider();
}

// 高层入口：生成 →（可选）视觉质检 → 不合格用改进 prompt 重生成 → 持久化。引擎只调这个。
// 质检默认开（IMAGE_QA != false），重试次数 IMAGE_QA_RETRIES（默认 1）。质检需 Agnes chat（agnes-2.0-flash）。
export async function generateCheckinImage(req: ImageRequest): Promise<string | null> {
  const provider = getImageProvider();
  if (provider.name === "none") return null;

  const qaOn = (process.env.IMAGE_QA ?? "true").toLowerCase() !== "false";
  const retries = qaOn ? Math.max(0, Number(process.env.IMAGE_QA_RETRIES ?? 1)) : 0;
  // 先让 LLM 写专业详细 prompt + 附加生图规则；并加载人物参考图（img2img 锁脸）
  const basePrompt = await composePrompt(req);
  const refImage = loadRefImage(req.persona.refIndex) ?? undefined;

  let prompt = basePrompt;
  let lastRaw: string | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await provider.generate(prompt, refImage);
    if (!raw) break; // 生成失败，不再重试
    lastRaw = raw;
    if (!qaOn) break;
    const qa = await judgeImage(raw, req.photoDesc, basePrompt);
    if (qa.ok) break; // 合格
    if (qa.improvedPrompt && attempt < retries) { prompt = `${qa.improvedPrompt}\n\n${buildRules(req.persona)}`; continue; } // 改进 prompt + 规则重生成
    break; // 重试用尽：保留最后一张（兜底，有图胜过无图）
  }
  if (!lastRaw) return null;
  return persistToCloudinary(lastRaw);
}
