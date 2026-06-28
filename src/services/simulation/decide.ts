import Anthropic from "@anthropic-ai/sdk";
import {
  personaInterestList,
  personaVoiceText,
  INITIAL_MEMORY_SEEDS,
  type MemoryKind,
  type PersonaV2,
  type ActivityType,
  type AreaHint,
  type SpotLike,
} from "@/lib/personas";
import type { World } from "./world";

// 角色「当天决策」LLM。遵循 V7：先过日子→形成记忆→（按概率）才产内容；不是 prompt→帖子。
// provider 与 lib/llm.ts 一致：deepseek/openai 走 JSON 模式，anthropic 走 tool use。

export type SpotOption = { index: number; name: string };

export type DecideInput = {
  persona: PersonaV2;
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
  post: {
    note: string;
    rating: number | null;
    activity: ActivityType;
    areaHint?: AreaHint;
    photo: boolean;
    photoDesc?: string;
    spotIndex?: number | null; // 后处理填入，不让 LLM 必填
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

const SYSTEM = `
你在模拟一个真实生活在东京的年轻人一天的生活。
你不是在写作文，也不是在写营销文案。

先在心里判断：
- 今天是什么天气？
- 最近发生了什么？
- 这个人现在的情绪和目标是什么？
- 今天有没有一个值得记录的小瞬间？

真实生活大部分时候很普通：
可以是工作、学习、通勤、吃饭、散步、购物、发呆、打扫、朋友、家人、兴趣。
兴趣只是生活的一部分，不要每天围绕兴趣。
不是每天都需要发足迹，平淡的一天 post 可以为 null。

如果发足迹：
- 第一人称
- 30~150 字
- 只写一个具体瞬间
- 不要完整起承转合
- 不要鸡汤、人生总结、营销腔
- 不要每条都以“今天……”开头
- 不要每条都以“果然/开心/治愈/继续加油”结尾
- 允许短句、碎片、吐槽、留白、半句话
- 文风必须服从该人物的 WritingDNA

连续性规则：
- 最近记忆会影响今天，但不要每天重复提
- 熟人可以出现，但不要频繁安排偶遇
- 不要频繁写“老板记得我 / 店员认出我 / 被送东西 / 被夸”
- 最近发过的题材、地点、句式，今天尽量换角度

配图规则：
- note 只写正文，不要写拍摄方式
- photoDesc 单独描述图片画面和拍摄方式

只根据输入输出 JSON，不要解释。
`;

function longTermMemoryText(personaId: string): string {
  const memories = INITIAL_MEMORY_SEEDS.filter(
    (m) => m.personaId === personaId
  );

  if (!memories.length) return "（暂无）";

  const groups = memories.reduce<Record<MemoryKind, string[]>>(
    (acc, m) => {
      acc[m.kind] ??= [];
      acc[m.kind].push(m.memory);
      return acc;
    },
    {
      relationship: [],
      goal: [],
      place: [],
      habit: [],
      life: [],
      work: [],
      interest: [],
    }
  );

  return Object.entries(groups)
    .filter(([, list]) => list.length > 0)
    .map(([kind, list]) => {
      return `【${kind}】\n${list.map((m) => `- ${m}`).join("\n")}`;
    })
    .join("\n\n");
}

const ACTIVITY_KEYWORDS: Record<ActivityType, string[]> = {
  coffee: ["咖啡", "cafe", "coffee", "喫茶", "カフェ"],
  dessert: ["甜品", "dessert", "cake", "草莓", "蛋糕", "パフェ", "スイーツ"],
  bookstore: ["书", "book", "書店", "本屋", "旧书"],
  walk: ["散步", "walk", "citywalk", "街", "路地", "川", "公园"],
  gallery: ["画廊", "gallery", "展", "美术馆", "ギャラリー"],
  livehouse: ["live", "音乐", "ライブ", "唱片", "演出"],
  restaurant: ["饭", "餐", "拉面", "居酒屋", "茶泡饭", "restaurant"],
  shopping: ["购物", "买", "店", "商场", "shopping"],
  park: ["公园", "park", "草地", "花", "散步"],
  pet: ["狗", "宠物", "pet", "dog", "モカ", "犬"],
  travel: ["旅行", "海", "车站", "温泉", "镰仓", "横滨", "江之电"],
  work: ["公司", "办公室", "提案", "仕事", "work"],
  study: ["学校", "大学", "图书馆", "study", "论文"],
  home: ["家", "房间", "home"],
  random: [],
};

function scoreSpotByActivity(spot: SpotLike, activity: ActivityType): number {
  const text = [
    spot.name,
    spot.area ?? "",
    ...(spot.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const keywords = ACTIVITY_KEYWORDS[activity] ?? [];

  let score = 0;

  for (const kw of keywords) {
    if (text.includes(kw.toLowerCase())) score += 3;
  }

  if (activity === "random") score += 1;

  return score;
}

function pickWeighted<T>(items: Array<{ item: T; score: number }>): T | null {
  if (!items.length) return null;

  const total = items.reduce((sum, x) => sum + Math.max(1, x.score), 0);
  let r = Math.random() * total;

  for (const x of items) {
    r -= Math.max(1, x.score);
    if (r <= 0) return x.item;
  }

  return items[0].item;
}

export function resolveSpotIndex(
  post: { activity?: ActivityType; spotIndex?: number | null },
  spots: SpotLike[]
): number | null {
  if (!post) return null;

  // LLM 偶尔给了合法 spotIndex，也可以保留
  if (
    typeof post.spotIndex === "number" &&
    spots.some((s) => s.index === post.spotIndex)
  ) {
    return post.spotIndex;
  }

  const activity = post.activity ?? "random";

  const scored = spots.map((spot) => ({
    item: spot,
    score: scoreSpotByActivity(spot, activity),
  }));

  const picked = pickWeighted(scored);

  return picked?.index ?? null;
}

function buildUserPrompt(inp: DecideInput): string {
  const spotList = inp.spots.map((s) => `${s.index}. ${s.name}`).join("\n");
  const mem = inp.recentMemories.length ? inp.recentMemories.map((m) => `- ${m}`).join("\n") : "（暂无）";
  const notes = inp.recentNotes.length ? inp.recentNotes.map((m) => `- ${m}`).join("\n") : "（暂无）";
  const emo = Object.entries(inp.emotion).map(([k, v]) => `${k}:${v}`).join(" ");
  const longTermMem = longTermMemoryText(inp.persona.id);
  
  return `【人物】${inp.persona.username}，${inp.persona.age}岁，${inp.persona.occupation}。
性格倾向：${Object.entries(inp.persona.personality).map(([k, v]) => `${k}${v}`).join("/")}。
人生阶段：${inp.lifeStage}
最大矛盾：${inp.persona.coreConflict}
兴趣：${personaInterestList(inp.persona).join("、")}
笔触口吻（务必遵守）：${personaVoiceText(inp.persona)}
当前情绪(0-100)：${emo}
当前目标：${inp.goals.join("；") || "（无）"}

【今天】${inp.dateLabel}，东京${inp.world.season}，天气${inp.world.weather}，城市氛围：${inp.world.cityMood}。近期热点：${inp.world.viralTopics.join("、")}。

【人物长期记忆】（长期稳定存在，会影响行为、人际关系和兴趣；不需要每天提起，但场景合适时应自然延续）
${longTermMem}

【最近的记忆】（旧→新，用于保持连续与成长）
${mem}

【最近发的足迹】（避免重复题材/用词；若连续同一兴趣，今天换别的）
${notes}

【你生活里常出现的人】
${inp.cast.length ? inp.cast.map((c) => `- ${c.name}（${c.relation}）`).join("\n") : "（暂无，按需自然引入）"}

【今天可参考的活动类型】
coffee / dessert / bookstore / walk / gallery / livehouse / restaurant / shopping / park / pet / travel / work / study / home / random

不要直接为了地点而出门。
请先根据人物、心情、天气、最近记忆决定今天想做什么，再输出 activity。
spotIndex 可以不填，系统会根据 activity 自动匹配地点。

请决定这个人「今天/最近」过得怎样：必产出一条今天的记忆(memoryText, 第一人称, 简短一句)，给出情绪微调(moodDelta, 可空), 决定是否发一条足迹(post)，并把内容里出现的系统外的人填到 people。`;
}

const JSON_INSTRUCTION = `只输出一个 JSON 对象，不要解释或代码围栏：
{
  "memoryText": "今天发生/感受的一句话（第一人称，简短）",
  "memoryImportance": 1,
  "moodDelta": {"stress": -5, "loneliness": 3},
  "post": null,
  // 或发足迹：
  "post": {
    "note": "50~150字第一人称足迹",
    "rating": 4,
    "activity": "dessert",
    "areaHint": "central_tokyo",
    "photo": true,
    "photoDesc": "最终发布照片：窗边桌上的草莓拿铁和贴纸，杯子后方是表参道街景虚化，画面里不出现拍照动作"
  },
  "people": [{"name": "佐藤さん", "relation": "同事"}]
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
          activity: {
            type: "string",
            enum: [
              "coffee",
              "dessert",
              "bookstore",
              "walk",
              "gallery",
              "livehouse",
              "restaurant",
              "shopping",
              "park",
              "pet",
              "travel",
              "work",
              "study",
              "home",
              "random",
            ],
          },
          areaHint: {
            type: "string",
            enum: [
              "near_home",
              "central_tokyo",
              "east_tokyo",
              "west_tokyo",
              "quiet_area",
              "busy_area",
              "any",
            ],
          },
          photo: { type: "boolean" },
          photoDesc: { type: "string" },
          spotIndex: { type: "integer" },
        },
        required: ["note", "activity"],
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

function isActivityType(v: string): v is ActivityType {
  return [
    "coffee",
    "dessert",
    "bookstore",
    "walk",
    "gallery",
    "livehouse",
    "restaurant",
    "shopping",
    "park",
    "pet",
    "travel",
    "work",
    "study",
    "home",
    "random",
  ].includes(v);
}

function isAreaHint(v: string): v is AreaHint {
  return [
    "near_home",
    "central_tokyo",
    "east_tokyo",
    "west_tokyo",
    "quiet_area",
    "busy_area",
    "any",
  ].includes(v);
}

function normalize(raw: unknown): DecideOutput | null {
  if (!raw || typeof raw !== "object") return null;

  const o = raw as Record<string, unknown>;

  const memoryText =
    typeof o.memoryText === "string" ? o.memoryText.trim() : "";

  if (!memoryText) return null;

  const imp = Number(o.memoryImportance);
  const memoryImportance = imp >= 1 && imp <= 3 ? Math.round(imp) : 1;

  const moodDelta: Record<string, number> = {};
  if (o.moodDelta && typeof o.moodDelta === "object") {
    for (const [k, v] of Object.entries(o.moodDelta as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) {
        moodDelta[k] = v;
      }
    }
  }

  let post: DecideOutput["post"] = {} as DecideOutput["post"];

  if (o.post && typeof o.post === "object") {
    const p = o.post as Record<string, unknown>;

    const note = typeof p.note === "string" ? p.note.trim() : "";
    const photoDesc =
      typeof p.photoDesc === "string" ? p.photoDesc.trim() : "";

    if (note) {
      const r = Number(p.rating);

      const activity =
        typeof p.activity === "string" && isActivityType(p.activity)
          ? p.activity
          : "random";

      const areaHint =
        typeof p.areaHint === "string" && isAreaHint(p.areaHint)
          ? p.areaHint
          : "any";

      const rawSpotIndex = Number(p.spotIndex);

      post = {
        note,
        rating: r >= 1 && r <= 5 ? Math.round(r) : null,
        activity,
        areaHint,
        spotIndex: Number.isFinite(rawSpotIndex)
          ? Math.max(0, Math.round(rawSpotIndex))
          : undefined,
        photo: p.photo === true && !!photoDesc,
        photoDesc,
      };
    }
  }

  const people: { name: string; relation: string }[] = [];

  if (Array.isArray(o.people)) {
    for (const it of o.people) {
      if (it && typeof it === "object") {
        const obj = it as Record<string, unknown>;

        const name =
          typeof obj.name === "string" ? obj.name.trim() : "";

        const relation =
          typeof obj.relation === "string" ? obj.relation.trim() : "";

        if (name) {
          people.push({
            name,
            relation: relation || "熟人",
          });
        }
      }
    }
  }

  return {
    memoryText,
    memoryImportance,
    moodDelta,
    post,
    people,
  };
}

export async function decideDay(inp: DecideInput): Promise<DecideOutput | null> {
  const user = buildUserPrompt(inp);

  let result: DecideOutput | null = null;

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

    const tu = res.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    result = tu ? normalize(tu.input) : null;
  } else {
    const baseUrl = (
      process.env.LLM_BASE_URL || "https://api.deepseek.com"
    ).replace(/\/$/, "");

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getApiKey()}`,
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `${SYSTEM}\n\n${JSON_INSTRUCTION}`,
          },
          {
            role: "user",
            content: user,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.95,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      throw new Error(`sim LLM ${res.status}: ${await res.text()}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    result = normalize(safeParse(data.choices?.[0]?.message?.content ?? ""));
  }

  if (result?.post) {
    result.post.spotIndex = resolveSpotIndex(result.post, inp.spots);
  }

  return result;
}