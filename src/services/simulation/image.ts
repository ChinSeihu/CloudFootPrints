import { existsSync, readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { personaRefIndex, type PersonaV2 } from "@/lib/personas";
import type { World } from "./world";
import { judgeImage } from "./imageQA";

// 读取人物单人参考图（public/refs/NN.png，由 scripts/crop-refs.ts 从 personV2.png 裁出）→ data URI。
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
// 设计目标：接口先行、provider 可替换；外观以 public/personV2.png + personas.appearance 为基准；
// 默认主观镜头（手机随手拍），仅摄影强者用客观构图。生成图统一上传 Cloudinary（CORS + 持久）。

export type ImageRequest = {
  persona: PersonaV2;
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

// 视角语气：
// casual / hobby：偏 INS 生活博主，允许经常出镜，但只描述“最终成片”，不描述“拍照过程”。
// pro：可客观构图，但仍保持真实生活感。
function povClause(persona: PersonaV2): string {
  if (persona.photoSkill === "pro") {
    return [
      "Photographed with a photographer's eye.",
      "Thoughtful composition and natural environmental storytelling.",
      "Deliberate framing and natural available light.",
      "Feels like refined Japanese lifestyle photography, but still realistic and grounded in everyday life.",
      "The image represents the final published photo, not the behind-the-scenes process of capturing it.",
      "Avoid commercial advertising, luxury editorial, studio portrait, or overly cinematic drama."
    ].join(" ");
  }

  return [
    "Instagram-style casual lifestyle snapshot.",
    "The image represents the final published photo, not the behind-the-scenes process of capturing it.",
    "The protagonist may appear often because this is an Instagram-style lifestyle account, but not in every image.",
    "Prefer natural daily-life framing: food, drinks, tickets, books, shop interiors, streets, stage, park, train window, hands, objects, reflections, back view, side view, or relaxed full-body moments.",
    "When the protagonist appears, the framing should naturally imply a plausible capture method, such as a friend-taken photo, timer photo, reflection, side view, back view, group photo, or a phone placed somewhere out of frame.",
    "These capture methods should be implied only.",
    "Do not explicitly show cameras, phones, selfie sticks, tripods, ring lights, or the act of taking a photo unless the scene specifically requires it.",
    "Avoid showing the protagonist holding a phone to take a picture unless the scene explicitly requires a mirror selfie.",
    "Avoid unexplained third-person portraits that look like a stranger is constantly following them.",
    "For first-person shots, show at most one hand unless the scene is physically plausible.",
    "Slightly imperfect framing.",
    "Feels spontaneous rather than planned."
  ].join(" ");
}

function shouldUseIdentityReference(req: ImageRequest): boolean {
  const text = `${req.photoDesc} ${req.persona.photoSkill}`.toLowerCase();

  if (req.persona.photoSkill === "pro") return true;

  return [
    "selfie",
    "portrait",
    "friend took",
    "friends took",
    "taken by a friend",
    "timer shot",
    "tripod",
    "phone placed",
    "placed on a table",
    "placed on the table",
    "placed on the floor",
    "floor timer",
    "photo of me",
    "me in the frame",
    "my face",
    "mirror",
    "reflection",
    "back view",
    "side view",
    "group photo",
    "自拍",
    "合照",
    "定时",
    "延时",
    "三脚架",
    "手机放",
    "放在桌",
    "放在地",
    "朋友拍",
    "被朋友拍",
    "帮我拍",
    "我出镜",
    "正面",
    "露脸",
    "背影",
    "侧脸",
    "镜子",
    "倒影",
    "全身",
    "穿搭",
    "ootd",
  ].some((keyword) => text.includes(keyword));
}

// Agnes 无负向提示参数，所以把负向约束写进正向 prompt 里。
// 重点：强调“最终发布照片”，避免生成拍摄过程本身。
function buildRules(persona: PersonaV2): string {
  return [
    "[Constraints]",

    povClause(persona),

    "Photorealistic candid smartphone snapshot of ordinary daily life in Tokyo.",
    "Authentic Japanese lifestyle photography with a subtle Japanese drama daily-life atmosphere.",
    "Inspired by contemporary Japanese lifestyle magazines and everyday photo diaries, but not a professional shoot.",
    "Looks like a real final photo shared on Threads or Instagram by a young person living in Tokyo.",
    "The image should depict the captured moment itself, not the process of taking the photo.",

    "People are ordinary young Asian people living in Tokyo.",
    "Calm, natural and subtle expressions.",
    "Relaxed natural poses are allowed, like walking, looking aside, leaning on a railing, sitting at a cafe table, adjusting hair, holding a drink, or casually talking with friends.",
    "Unposed moment.",
    "An unaware candid instant.",
    "Ordinary happiness rather than dramatic emotion.",

    `Recurring individual — keep the SAME face, hairstyle, body type, height and overall identity consistent (identity: ${persona.appearance}).`,
    "The face must remain recognizable across different images.",
    "Do not change the person's facial identity, hairstyle, height, body type, or overall impression.",

    "Every image should feature a fresh outfit when the protagonist appears.",
    "Choose age-appropriate contemporary Japanese street fashion that naturally matches the season, weather, location and activity.",
    "The outfit should feel young, current, tasteful and effortlessly stylish rather than overly fashionable.",
    "Looks like what a real stylish young person in Tokyo would genuinely wear that day.",
    "Vary clothing colors, layers, outerwear, accessories, bags and shoes.",
    "Include thoughtful styling details such as layered outfits, seasonal outerwear, jewelry, hair accessories, manicured nails, bags or shoes when appropriate.",
    "Avoid repeating similar outfits or color combinations across images.",

    "Natural hands and anatomy.",
    "If hands are visible, fingers should be relaxed, correctly counted, naturally posed, and realistically holding objects.",
    "For close-up hands, show young natural hands with slender fingers, soft skin texture, neat nails, not rough, oversized, bulky, or masculine.",
    "In first-person smartphone POV, avoid showing both of the protagonist's hands at the same time unless it is physically plausible.",
    "Avoid showing detailed hands unless they are necessary for the scene.",

    "Natural available light.",
    "Realistic skin texture with minor imperfections.",
    "Realistic smartphone camera quality.",
    "True-to-life muted colors.",
    "Slightly imperfect composition.",
    "Subtle motion blur.",
    "Smartphone auto exposure.",
    "Social media snapshot quality.",
    "Documentary smartphone photo.",
    "35mm consumer film snapshot feeling.",
    "Kodak Portra 400 color tone.",
    "Fujifilm Superia-style muted greens and soft contrast.",
    "Subtle film grain.",
    "Gentle halation in highlights.",
    "Mild lens softness.",
    "Atmospheric storytelling.",

    "Avoid AI-generated appearance.",
    "No CGI.",
    "No 3D render.",
    "No glossy plastic skin.",
    "No waxy skin.",
    "No over-smoothed beauty filter.",
    "No hyper-sharpening.",
    "No malformed hands.",
    "No extra fingers.",
    "No fused fingers.",
    "No twisted wrists.",
    "No broken anatomy.",
    "No impossible object grip.",
    "No two-handed POV unless explicitly plausible.",
    "No phone-taking-photo gesture unless explicitly required.",
    "No visible camera equipment.",
    "No visible tripod.",
    "No visible selfie stick.",
    "No visible ring light.",
    "No behind-the-scenes shooting setup.",
    "No cinematic dramatic lighting.",
    "No studio portrait.",
    "No glossy fashion editorial.",
    "No luxury brand campaign.",
    "No advertisement.",
    "No exaggerated influencer pose.",
    "No professional model pose.",
    "No exaggerated smile.",
    "No exaggerated facial expression.",
    "No perfect symmetry.",
    "No unrealistic beauty-filter look.",
    "No text.",
    "No watermark.",
    "No logo."
  ].join(" ");
}

// 用 LLM 写一段英文场景 prompt。
// 注意：这里也禁止 LLM 描述“正在自拍 / 正在架三脚架 / 正在被拍”这种过程。
// 只描述最终照片画面。
async function scenePromptLLM(req: ImageRequest): Promise<string | null> {
  const { persona, photoDesc, world } = req;
  const key = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();
  const useAnthropic =
    provider === "anthropic" ||
    provider === "claude" ||
    (process.env.LLM_MODEL || "").toLowerCase().startsWith("claude");

  const system = `
你是专业摄影导演兼生活方式内容策划。

根据给定生活场景生成一段英文图片描述。

目标：
生成一张像东京年轻 INS 生活博主真实发布出来的最终照片，而不是拍照过程、拍摄现场、幕后花絮。

只描述最终画面本身：

- 场景
- 主体
- 动作
- 环境
- 道具
- 时间
- 天气
- 构图
- 景别
- 前景与背景关系
- 光线方向与环境氛围
- 人物是否出镜
- 合理但隐含的成片视角

重要规则：

1. 可以让人物较常出镜，因为这是 INS 风格生活博主账号。

2. 如果人物出镜：
   - 只描述最终照片里的状态。
   - 可以是自然站立、走路、坐着、看向旁边、背影、侧脸、镜中倒影、窗中倒影、朋友视角、定时成片感、桌边自然全身或半身构图。
   - 不要描述“正在自拍”“正在摆三脚架”“朋友正在拍她”“有人拿着相机拍她”。
   - 不要让手机、三脚架、自拍杆、相机、补光灯出现在画面里，除非场景明确需要镜子自拍。

3. 如果内容主要是食物、咖啡、票、书、物品：
   优先描述物品或桌面视角，人物可以不出镜，也可以只出现手或衣袖。

4. 如果内容主要是街道、公园、河边、演出、天空、夜景：
   优先描述环境或自然生活场景，人物可以不出镜，也可以是背影、侧影或自然远景。

5. 如果内容是“看到情侣、朋友、路人、老夫妻、排队的人”等：
   这些人是被观察到的人，不是发帖人本人。
   不要让用户误会成发帖人的恋爱或朋友关系。

6. 如果人物出镜：
   - 为人物安排符合季节、天气、地点和场景的具体穿搭。
   - 穿搭要年轻、自然、有东京生活感。
   - 可以参考日系生活写真或日剧日常穿搭的感觉，但不要变成电影海报或商业写真。
   - 不要描述人物长相。
   - 不要改变人物身份特征。

7. 如果人物不出镜：
   重点描述环境、物品、光线、道具和当下氛围。

不要输出以下风格词：

- photorealistic
- candid
- smartphone photo
- Kodak
- film grain
- CGI
- professional photography
- negative prompt
- quality tags
- masterpiece
- best quality
- 8k

这些内容由系统统一附加。

输出 70~130 词英文画面描述。

只输出英文 prompt，不要解释，不要加标题，不要加引号。
`;

  const user = `场景（中文）：${photoDesc}
人物：${persona.age}岁 ${persona.occupation}
账号定位：东京 INS 风格生活博主，允许较常出镜，但画面必须是最终发布照片，不是拍摄过程。
视角倾向：${persona.photoSkill === "pro" ? "讲究构图（摄影师）" : "自然生活成片 / 本人可出镜 / 朋友视角成片感 / 主观物品或环境视角"}
季节天气：${world.season} / ${world.weather}

请写英文图片生成 prompt。`;

  try {
    if (useAnthropic) {
      const client = new Anthropic({ apiKey: key });
      const res = await client.messages.create({
        model: process.env.LLM_MODEL || "claude-haiku-4-5",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: user }],
      });

      const t = res.content.find(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );

      return t?.text.trim() || null;
    }

    const baseUrl = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");

    const res = await fetchT(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: process.env.LLM_MODEL || "deepseek-chat",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.75,
          max_tokens: 500,
        }),
      },
      45000
    );

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

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
// 质检默认开（IMAGE_QA != false），重试次数 IMAGE_QA_RETRIES（默认 2）。质检需 Agnes chat（agnes-2.0-flash）。
export async function generateCheckinImage(req: ImageRequest): Promise<string | null> {
  const provider = getImageProvider();
  if (provider.name === "none") return null;

  const qaOn = (process.env.IMAGE_QA ?? "true").toLowerCase() !== "false";
  const retries = qaOn ? Math.max(0, Number(process.env.IMAGE_QA_RETRIES ?? 2)) : 0;
  // 先让 LLM 写专业详细 prompt + 附加生图规则；并加载人物参考图（img2img 锁脸）
  const basePrompt = await composePrompt(req);
  const refImage = shouldUseIdentityReference(req) ? loadRefImage(personaRefIndex(req.persona)) ?? undefined : undefined;

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
