import { existsSync, readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { personaRefIndex, type PersonaV2, FASHION_STYLE_PROMPTS,PERSONA_FASHION_STYLE,type FashionTrendTag,  type PersonaFashionStyle, type FashionStyle } from "@/lib/personas";
import type { World } from "./world";
import { judgeImage } from "./imageQA";
import { imageSpecToText, type ImageSpec } from "./decide"

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

export function fashionClause(
  persona: PersonaV2,
  world: ImageRequest["world"]
): string {
  const fashion =
    (persona.fashionStyle as PersonaFashionStyle | undefined) ??
    PERSONA_FASHION_STYLE[persona.id];

  if (!fashion) {
    return [
      "[Fashion Direction]",
      `Season/weather: ${world.season} / ${world.weather}.`,
      "Create a fresh contemporary Tokyo outfit.",
      "Use the identity reference only for face, hairstyle, body type and identity.",
      "Do not copy the reference outfit.",
    ].join(" ");
  }

  return [
    "[Fashion Direction]",
    `Season/weather: ${world.season} / ${world.weather}.`,
    `Fashion level: ${fashion.fashionLevel}.`,
    `Primary fashion identity: ${FASHION_STYLE_PROMPTS[fashion.primary]}.`,
    `Secondary styles: ${fashion.secondary
      .map((s) => FASHION_STYLE_PROMPTS[s])
      .join(" / ")}.`,
    `Current trend tags to use when suitable: ${fashion.trendTags.join(", ")}.`,
    "Keep this person's fashion taste consistent across images.",
    "Create a fresh outfit every time.",
    "Do not copy the identity reference outfit.",
    "The outfit should be recognizable as this person's taste even when the face is not visible.",
  ].join(" ");
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
      "Avoid commercial advertising, luxury editorial, studio portrait, or overly cinematic drama.",
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
    "Feels spontaneous rather than planned.",
  ].join(" ");
}

function shouldUseIdentityReference(req: GenerateCheckinImageInput): boolean {
  const { persona, imageSpec } = req;

  if (persona.photoSkill === "pro") return true;

  if (!imageSpec.subjectVisible) return false;

  return imageSpec.subjectRole === "protagonist" ||
         imageSpec.subjectRole === "friends";
}

const anatomyRules = [
  "Natural hands and anatomy.",
  "Only show hands that clearly belong to visible people in the frame.",
  "Do not show anonymous extra hands entering from outside the frame.",
  "Do not show a random third hand near the protagonist.",
  "Do not show disembodied hands, floating hands, cropped stranger hands, or unexplained hands.",
  "If the protagonist is alone, only the protagonist's own hands may appear.",
  "If another person's hand appears, that person's body or arm connection must be clearly visible and physically plausible.",
  "If hands are visible, fingers should be relaxed, correctly counted, naturally posed, and realistically holding objects.",
  "Avoid showing detailed hands unless they are necessary for the scene.",
  "No malformed hands.",
  "No extra fingers.",
  "No fused fingers.",
  "No twisted wrists.",
  "No broken anatomy.",
  "No impossible object grip.",
  "No random extra hands.",
  "No disembodied hands.",
  "No floating hands.",
  "No stranger's hand entering the frame without context.",
];

// Agnes 无负向提示参数，所以把负向约束写进正向 prompt 里。
// 重点：强调“最终发布照片”，避免生成拍摄过程本身。
function buildRules(persona: PersonaV2, world: World): string {
  return [
    "[Constraints]",

    povClause(persona),
    fashionClause(persona, world),
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

    `Recurring individual — keep the SAME face, body type, height and overall identity consistent (identity: ${persona.appearance}).`,
    "The face must remain recognizable across different images.",
    "Do not change the person's facial identity, height, body type, or overall impression.",

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

    ...anatomyRules,

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
async function scenePromptLLM(
  req: ImagePromptRequest
): Promise<string | null> {
  const { persona, imageSpec, world } = req;

  const key = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const provider = (process.env.LLM_PROVIDER || "").toLowerCase();

  const useAnthropic =
    provider === "anthropic" ||
    provider === "claude" ||
    (process.env.LLM_MODEL || "").toLowerCase().startsWith("claude");

  const system = `
你是专业摄影导演兼 AI 图片提示词工程师。

根据结构化 imageSpec 生成一段英文图片生成 prompt。

目标：
生成一张像东京年轻 INS 生活博主真实发布出来的最终照片，而不是拍照过程、拍摄现场、幕后花絮。
发帖人本人出镜率为80%
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

不要描述“正在自拍”“正在架三脚架”“朋友正在拍她”“有人拿着相机拍她”。

不要让手机、三脚架、自拍杆、相机、多余的手、补光灯无意义出现在画面里。

如果 imageSpec.subjectRole 是 observed_people：
这些人是被观察到的人，不是发帖人本人。

如果主角出镜：
可以描述穿搭、动作、姿态，但不要改变人物长相。

不要输出：
photorealistic, candid, smartphone photo, Kodak, film grain, CGI,
professional photography, negative prompt, quality tags, masterpiece, best quality, 8k。

这些由系统统一附加。

输出 70~130 词英文 prompt。
只输出英文，不要解释，不要标题，不要引号。
`;

  const user = `
【ImageSpec】
${imageSpecToText(imageSpec)}

【人物】
${persona.age}岁 ${persona.occupation}

【季节天气】
${world.season} / ${world.weather}

请生成英文图片 prompt。
`;

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

    const baseUrl = (
      process.env.LLM_BASE_URL || "https://api.deepseek.com"
    ).replace(/\/$/, "");

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

type OutfitPalette = {
  id: string;
  text: string;
  styles?: FashionStyle[];
};

type OutfitSilhouette = {
  id: string;
  text: string;
  styles?: FashionStyle[];
  tags?: FashionTrendTag[];
};

export type DailyOutfit = {
  palette: string;
  silhouette: string;
  items: string;
};

const PALETTES: OutfitPalette[] = [
  { id: "clear_white_blush", text: "clear white, blush pink and soft beige", styles: ["clean_girl", "sweet_soft", "japanese_fresh"] },
  { id: "ivory_greige_brown", text: "ivory, greige and warm brown", styles: ["intellectual", "office_chic", "french_vintage"] },
  { id: "cream_sage_oatmeal", text: "cream, sage green and oatmeal", styles: ["natural_clean", "clean_girl", "japanese_fresh"] },
  { id: "soft_blue_white_gray", text: "soft blue, white and light gray", styles: ["japanese_fresh", "campus_academic", "clean_girl"] },
  { id: "dusty_pink_mocha", text: "dusty pink, mocha brown and ivory", styles: ["sweet_soft", "korean_casual", "light_sensual"] },
  { id: "black_ivory_gold", text: "black, ivory and muted gold", styles: ["light_sensual", "office_chic", "french_vintage"] },
  { id: "navy_white_silver", text: "navy, white and silver", styles: ["intellectual", "campus_academic", "minimal_chic"] },
  { id: "wine_beige_black", text: "wine red, beige and black", styles: ["french_vintage", "light_sensual", "vintage_used"] },
  { id: "charcoal_denim_black", text: "charcoal, denim blue and black", styles: ["street_livehouse", "city_boy", "workwear"] },
  { id: "celadon_ivory_ink", text: "celadon green, ivory and ink black", styles: ["modern_chinese", "natural_clean", "intellectual"] },
  { id: "all_white_texture", text: "mostly white with subtle lace, knit or sheer texture differences", styles: ["clean_girl", "sweet_soft", "japanese_fresh"] },
  { id: "rose_brown_cream", text: "rose brown, cream and soft cocoa", styles: ["french_vintage", "sweet_soft", "korean_casual"] },
  { id: "olive_gray_black", text: "olive, gray and black", styles: ["athflow", "workwear", "street_livehouse"] },
  { id: "camel_black_ivory", text: "camel, black and ivory", styles: ["office_chic", "intellectual", "minimal_chic"] },
];

const SILHOUETTES: OutfitSilhouette[] = [
  { id: "lace_blouse_mermaid_skirt", text: "lace blouse with a clean mermaid skirt", styles: ["clean_girl", "sweet_soft", "light_sensual"], tags: ["lace", "mermaid_skirt"] },
  { id: "sheer_blouse_wide_trousers", text: "sheer blouse with elegant wide-leg trousers", styles: ["office_chic", "clean_girl", "intellectual"], tags: ["sheer", "wide_pants"] },
  { id: "cropped_cardigan_satin_skirt", text: "cropped cardigan with a satin long skirt", styles: ["korean_casual", "sweet_soft", "light_sensual"], tags: ["cropped_cardigan", "satin_skirt"] },
  { id: "soft_blazer_lace_inner", text: "soft blazer with a delicate lace inner top and straight bottoms", styles: ["office_chic", "intellectual", "clean_girl"], tags: ["lace"] },
  { id: "knit_mermaid_skirt", text: "fine knit top with a mermaid skirt", styles: ["clean_girl", "light_sensual", "korean_clean"], tags: ["knit", "mermaid_skirt"] },
  { id: "one_piece_sheer_cardigan", text: "simple one-piece dress with a sheer cardigan", styles: ["japanese_fresh", "sweet_soft", "clean_girl"], tags: ["sheer_cardigan"] },
  { id: "lace_top_denim", text: "lace top with straight denim", styles: ["french_vintage", "japanese_fresh", "vintage_used"], tags: ["lace", "denim"] },
  { id: "blouse_pleated_skirt", text: "clean blouse with a long pleated skirt", styles: ["campus_academic", "intellectual", "clean_girl"], tags: ["pleated_skirt"] },
  { id: "wrap_dress_light_cardigan", text: "wrap dress with a light cardigan", styles: ["french_vintage", "sweet_soft"], tags: ["cropped_cardigan"] },
  { id: "linen_dress_light_outerwear", text: "linen dress with light outerwear", styles: ["natural_clean", "japanese_fresh"], tags: ["linen"] },
  { id: "trench_knit_skirt", text: "trench coat with a fine knit and long skirt", styles: ["office_chic", "french_vintage", "intellectual"], tags: ["trench", "knit", "long_skirt"] },
  { id: "oxford_knit_vest", text: "oxford shirt with a knit vest and straight bottoms", styles: ["campus_academic", "intellectual"], tags: ["knit"] },
  { id: "minimal_set_up", text: "minimal matching set-up with relaxed lines", styles: ["minimal_chic", "office_chic", "city_boy"] },
  { id: "band_tee_black_denim", text: "band T-shirt with black denim and a light outer layer", styles: ["street_livehouse", "vintage_used"], tags: ["band_tshirt", "denim"] },
  { id: "work_jacket_cargo", text: "work jacket with cargo pants", styles: ["workwear", "city_boy"], tags: ["cargo"] },
  { id: "mandarin_blouse_skirt", text: "modern mandarin-collar blouse with a flowing skirt", styles: ["modern_chinese", "intellectual"] },
  { id: "hoodie_clean_skirt", text: "clean hoodie with a simple skirt", styles: ["athflow", "japanese_fresh"], tags: ["hoodie"] },
];

function pickOne<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function personaFashionStyles(persona: PersonaV2): FashionStyle[] {
  const fashion =
    (persona.fashionStyle as PersonaFashionStyle | undefined) ??
    PERSONA_FASHION_STYLE[persona.id];

  if (!fashion) return [];

  return [fashion.primary, ...fashion.secondary];
}

function personaTrendTags(persona: PersonaV2): FashionTrendTag[] {
  const fashion =
    (persona.fashionStyle as PersonaFashionStyle | undefined) ??
    PERSONA_FASHION_STYLE[persona.id];

  return fashion?.trendTags ?? [];
}

function filterByPersonaStyle<T extends { styles?: FashionStyle[] }>(
  items: T[],
  persona: PersonaV2
): T[] {
  const styles = personaFashionStyles(persona);
  if (!styles.length) return items;

  const matched = items.filter((item) =>
    item.styles?.some((s) => styles.includes(s))
  );

  return matched.length ? matched : items;
}

function filterByTrendTags(
  items: OutfitSilhouette[],
  persona: PersonaV2
): OutfitSilhouette[] {
  const tags = personaTrendTags(persona);
  if (!tags.length) return items;

  const matched = items.filter((item) =>
    item.tags?.some((tag) => tags.includes(tag))
  );

  return matched.length ? matched : items;
}

function pickUnused<T extends { id: string }>(
  items: T[],
  used: Set<string>
): T {
  const unused = items.filter((item) => !used.has(item.id));
  return pickOne(unused.length ? unused : items);
}

export function buildDailyOutfitPlan(
  requests: ImageRequest[]
): Record<string, DailyOutfit> {
  const usedPalette = new Set<string>();
  const usedSilhouette = new Set<string>();
  const plan: Record<string, DailyOutfit> = {};

  for (const req of requests) {
    const paletteCandidates = filterByPersonaStyle(PALETTES, req.persona);

    const styleMatchedSilhouettes = filterByPersonaStyle(SILHOUETTES, req.persona);
    const trendMatchedSilhouettes = filterByTrendTags(
      styleMatchedSilhouettes,
      req.persona
    );

    const palette = pickUnused(paletteCandidates, usedPalette);
    const silhouette = pickUnused(trendMatchedSilhouettes, usedSilhouette);

    usedPalette.add(palette.id);
    usedSilhouette.add(silhouette.id);

    plan[req.persona.id] = {
      palette: palette.text,
      silhouette: silhouette.text,
      items: [
        `Use a ${silhouette.text} outfit.`,
        `Color palette: ${palette.text}.`,
        "Use ONE contemporary Japanese fashion highlight only.",
        "Everything else should stay simple, clean and balanced.",
      ].join(" "),
    };
  }

  return plan;
}

export function outfitClause(
  persona: PersonaV2,
  world: ImageRequest["world"],
  outfit?: DailyOutfit
): string {
  const outfitSeed = Math.floor(Math.random() * 1_000_000);

  return [
    "[Outfit Variation]",
    `Outfit seed: ${outfitSeed}.`,
    `Season/weather: ${world.season} / ${world.weather}.`,

    outfit
      ? `Today's assigned outfit direction: ${outfit.items}`
      : "Create today's outfit as a fresh variation based on this person's fashion identity.",

    "This assigned outfit direction is mandatory when the protagonist appears.",
    "The outfit should feel like current Tokyo Instagram fashion, especially around Omotesando, Daikanyama, Nakameguro, Ebisu and Jiyugaoka.",
    "Aim for a clean, feminine, slightly eye-catching look when suitable.",
    "Do not treat the identity reference image as an outfit reference.",
    "Use the identity reference ONLY for face, hairstyle, body type, height and overall identity.",
    "Do NOT copy clothing, colors, shoes, bag or accessories from the identity reference.",

    "The outfit must be simple, well-balanced and realistically stylish.",
    "Use a clean coordinated outfit, not a pile of fashion elements.",
    "Choose ONE main fashion focus only.",
    "Choose at most ONE small accessory.",
    "Keep the color palette limited to 2 or 3 harmonious colors.",
    "Do not combine too many statement pieces, excessive layering, mixed patterns, or mismatched colors.",

    "If multiple people appear, every person must wear clearly different clothing colors, silhouettes and accessories.",
    "Do not make two people wear matching outfits unless explicitly requested.",
    "Avoid duplicated outfits between the protagonist and background people.",

    "Not runway fashion.",
    "Not cosplay.",
    "Not idol costume.",
    "Not luxury campaign.",
  ].join(" ");
}
// 组合最终 prompt = LLM 专业场景描述 + 我们的生图规则。LLM 失败则回退（photoDesc + 规则）。
type ImagePromptRequest = {
  persona: PersonaV2;
  imageSpec: ImageSpec;
  world: ImageRequest["world"];
};

export async function composePrompt(
  req: ImagePromptRequest,
  outfit?: DailyOutfit
): Promise<string> {
  const scene = await scenePromptLLM(req);

  const fashion = fashionClause(req.persona, req.world);
  const outfitText = outfitClause(req.persona, req.world, outfit);
  const rules = buildRules(req.persona, req.world);

  return [
    scene ?? imageSpecToText(req.imageSpec),
    fashion,
    outfitText,
    rules,
  ].join("\n\n");
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

type GenerateCheckinImageInput = {
  persona: PersonaV2;
  imageSpec: ImageSpec;
  world: ImageRequest["world"];
  outfit?: DailyOutfit;
};

// 高层入口：生成 →（可选）视觉质检 → 不合格用改进 prompt 重生成 → 持久化。引擎只调这个。
// 质检默认开（IMAGE_QA != false），重试次数 IMAGE_QA_RETRIES（默认 2）。质检需 Agnes chat（agnes-2.0-flash）。
export async function generateCheckinImage(
  req: GenerateCheckinImageInput
): Promise<string | null> {
  const provider = getImageProvider();
  if (provider.name === "none") return null;

  if (!req.imageSpec) return null;

  const qaOn =
    (process.env.IMAGE_QA ?? "true").toLowerCase() !== "false";

  const retries = qaOn
    ? Math.max(0, Number(process.env.IMAGE_QA_RETRIES ?? 2))
    : 0;

  // 先让 LLM 写专业详细 prompt + 附加生图规则；
  // 并加载人物参考图（img2img 锁脸）
  const basePrompt = await composePrompt(req);

  const refImage = shouldUseIdentityReference(req)
    ? loadRefImage(personaRefIndex(req.persona)) ?? undefined
    : undefined;

  let prompt = basePrompt;
  let lastRaw: string | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const raw = await provider.generate(prompt, refImage);

    if (!raw) break;

    lastRaw = raw;

    if (!qaOn) break;

    const qa = await judgeImage(
      raw,
      req.imageSpec,
      prompt
    );

    if (qa.ok) break;

    if (qa.improvedPrompt && attempt < retries) {
      prompt = [
        qa.improvedPrompt,
        fashionClause(req.persona, req.world),
        outfitClause(req.persona, req.world, req.outfit),
        buildRules(req.persona, req.world),
      ].join("\n\n");

      continue;
    }

    break;
  }

  if (!lastRaw) return null;

  return persistToCloudinary(lastRaw);
}
