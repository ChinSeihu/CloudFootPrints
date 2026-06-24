import type { Persona } from "@/lib/personas";
import type { World } from "./world";

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
  generate(req: ImageRequest): Promise<string | null>; // 返回图片 URL 或 data URI；失败/未配置返回 null
}

// 视角语气：casual 日常一律主观；hobby 平时主观（作品才客观，这里日常按主观）；pro 客观构图。
function povClause(persona: Persona): string {
  if (persona.photoSkill === "pro") {
    return "considered composition, photographer's eye, deliberate framing and light";
  }
  return "first-person point of view, casual smartphone snapshot, slightly imperfect candid framing; the scene as the person sees it (hands, objects, food, street), face not necessarily visible";
}

// 拼最终英文 prompt：写实生活流 + 主/客观视角 + 画面 + 人物外观基准 + 季节天气。
export function buildPrompt(req: ImageRequest): string {
  const { persona, photoDesc, world } = req;
  return [
    "Tokyo lifestyle photography, natural lighting, authentic candid moment, realistic everyday environment, non-influencer aesthetic, photorealistic.",
    povClause(persona),
    `Scene: ${photoDesc}`,
    `If a person appears, a young Asian person in Tokyo (appearance reference: ${persona.appearance}); keep appearance consistent.`,
    `Season ${world.season}, weather ${world.weather}.`,
    "No text, no watermark, no logo.",
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
  async generate(): Promise<string | null> {
    return null;
  }
}

// ── Provider：Agnes（外部生成 API）──
// 按 env 接入，对未知细节保持防御性（任何失败→null，绝不打断模拟）。
// 需要的 env：IMAGE_PROVIDER=agnes、AGNES_API_URL、AGNES_API_KEY、(可选) AGNES_MODEL。
// 注意：Agnes 的确切请求/响应字段以其官方文档为准，下面用常见形态（OpenAI images 风格）兜底解析，
// 接入时若不符再按文档调整这一处即可（其余管线无需改动）。
class AgnesProvider implements ImageProvider {
  readonly name = "agnes";
  async generate(req: ImageRequest): Promise<string | null> {
    const url = process.env.AGNES_API_URL;
    const key = process.env.AGNES_API_KEY;
    if (!url || !key) return null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: process.env.AGNES_MODEL || "agnes-image",
          prompt: buildPrompt(req),
          size: "1024x1024",
          n: 1,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, unknown>;
      // 兼容多种返回形态：{data:[{url|b64_json}]} / {url} / {image} / {images:[...]}
      const d = (data.data as Array<Record<string, unknown>> | undefined)?.[0];
      const b64 = d?.b64_json as string | undefined;
      if (b64) return `data:image/png;base64,${b64}`;
      const candidate =
        (d?.url as string) ||
        (data.url as string) ||
        (data.image as string) ||
        ((data.images as string[] | undefined)?.[0]);
      return typeof candidate === "string" && candidate ? candidate : null;
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
  async generate(req: ImageRequest): Promise<string | null> {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    const model = (process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image").replace(/^models\//, "");
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: buildPrompt(req) }] }] }),
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

// 高层入口：生成 + 持久化。引擎只调这个。none provider 直接返回 null（不出图）。
export async function generateCheckinImage(req: ImageRequest): Promise<string | null> {
  const provider = getImageProvider();
  if (provider.name === "none") return null;
  const raw = await provider.generate(req);
  if (!raw) return null;
  return persistToCloudinary(raw);
}
