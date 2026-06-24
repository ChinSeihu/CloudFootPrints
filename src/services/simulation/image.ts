import type { Persona } from "@/lib/personas";
import type { World } from "./world";
import { judgeImage } from "./imageQA";

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
  generate(prompt: string): Promise<string | null>; // 传入最终 prompt，返回图片 URL 或 data URI；失败返回 null
}

// 视角语气：casual 日常一律主观；hobby 平时主观（作品才客观，这里日常按主观）；pro 客观构图。
function povClause(persona: Persona): string {
  if (persona.photoSkill === "pro") {
    return "considered composition, photographer's eye, deliberate framing and light";
  }
  return "first-person point of view, casual smartphone snapshot, slightly imperfect candid framing; the scene as the person sees it (hands, objects, food, street), face not necessarily visible";
}

// 拼最终英文 prompt：刻意压「AI 感」、表情自然不夸张 + 主/客观视角 + 画面 + 人物外观基准 + 季节天气。
// Agnes 无负向提示参数，写实度全靠这里措辞：强调手机随手拍、自然肌理、避免 CGI/戏剧光/摆拍。
export function buildPrompt(req: ImageRequest): string {
  const { persona, photoDesc, world } = req;
  return [
    "Candid everyday snapshot taken on a smartphone in Tokyo, ordinary daily life, unremarkable real moment.",
    povClause(persona),
    `Scene: ${photoDesc}.`,
    "If people appear: ordinary young Asian people in Tokyo with calm natural and subtle expressions, relaxed, NOT posing for the camera, no exaggerated smiles, no dramatic faces; an unaware candid instant.",
    `If a main person is clearly shown, keep appearance consistent with: ${persona.appearance}.`,
    `Season ${world.season}, weather ${world.weather}, natural available light, true-to-life muted colors, realistic skin texture with minor imperfections, faint grain, slightly imperfect casual framing.`,
    "Avoid an AI-generated or CGI look: no 3D render, no hyperreal over-sharpening, no glossy plastic skin, no cinematic dramatic lighting, no studio portrait, no posed shot, no exaggerated expression. No text, no watermark, no logo.",
  ].join(" ");
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
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, { method: "POST", body: form });
    if (!res.ok) return /^https?:\/\//.test(src) ? src : null;
    return ((await res.json()) as { secure_url: string }).secure_url;
  } catch {
    return /^https?:\/\//.test(src) ? src : null;
  }
}

// ── Provider：none（默认，不出图）──
class NoopProvider implements ImageProvider {
  readonly name = "none";
  async generate(_prompt: string): Promise<string | null> {
    void _prompt;
    return null;
  }
}

// ── Provider：Agnes（OpenAI images 兼容，已实测）──
// 鉴权 Bearer；endpoint = <base>/images/generations；返回 data[0].url（或 b64_json）。
// 需要 env：IMAGE_PROVIDER=agnes、AGNES_API_URL(base，如 https://apihub.agnes-ai.com/v1)、
//          AGNES_API_KEY、(可选) AGNES_MODEL(默认 agnes-image-2.1-flash)。任何失败→null。
class AgnesProvider implements ImageProvider {
  readonly name = "agnes";
  async generate(prompt: string): Promise<string | null> {
    const base = process.env.AGNES_API_URL;
    const key = process.env.AGNES_API_KEY;
    if (!base || !key) return null;
    const endpoint = /\/images\/generations$/.test(base)
      ? base
      : `${base.replace(/\/$/, "")}/images/generations`;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.AGNES_MODEL || "agnes-image-2.1-flash",
          prompt,
          size: "1024x1024",
          n: 1,
        }),
      });
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
  async generate(prompt: string): Promise<string | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    const model = (process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image").replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });
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
  const basePrompt = buildPrompt(req);

  let prompt = basePrompt;
  let lastRaw: string | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await provider.generate(prompt);
    if (!raw) break; // 生成失败，不再重试
    lastRaw = raw;
    if (!qaOn) break;
    const qa = await judgeImage(raw, req.photoDesc, basePrompt);
    if (qa.ok) break; // 合格
    if (qa.improvedPrompt && attempt < retries) { prompt = qa.improvedPrompt; continue; } // 用改进 prompt 重生成
    break; // 重试用尽：保留最后一张（兜底，有图胜过无图）
  }
  if (!lastRaw) return null;
  return persistToCloudinary(lastRaw);
}
