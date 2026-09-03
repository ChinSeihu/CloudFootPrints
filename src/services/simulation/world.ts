import { prisma } from "@/lib/db";

// World Agent（V7）：模拟「东京当天」。规则化、零 LLM、按日期可复现（幂等）。
// 产出 WorldState（季节/天气/城市情绪/热点），作为各角色决策的 Layer-1 情境。

// 由日期串派生稳定随机数（同一天多次运行结果一致）。
function seededRand(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rnd: () => number, arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

/**
 * Signature: `function seasonOf(month: number): "Spring" | "Summer" | "Autumn" | "Winter"`
 * Purpose: Maps Tokyo months to visually realistic climate seasons, treating September as late summer rather than autumn foliage season.
 */
function seasonOf(month: number): "Spring" | "Summer" | "Autumn" | "Winter" {
  if (month >= 3 && month <= 5) return "Spring";
  if (month >= 6 && month <= 9) return "Summer";
  if (month >= 10 && month <= 11) return "Autumn";
  return "Winter";
}

const WEATHER: Record<string, readonly string[]> = {
  // 加权：晴/多云占多数，雨少量；夏多雷阵雨、梅雨，冬偶有寒潮。
  Spring: ["晴", "晴", "多云", "多云", "小雨", "樱花晴"],
  Summer: ["晴", "晴", "闷热", "多云", "雷阵雨", "梅雨"],
  Autumn: ["晴", "晴", "舒爽", "多云", "多云", "小雨"],
  Winter: ["晴", "晴", "干冷", "多云", "阴", "寒潮"],
};

const MOOD: Record<string, readonly string[]> = {
  Spring: ["樱花季的雀跃", "新年度的忙碌与期待", "春日慵懒"],
  Summer: ["祭典与花火的热烈", "盛夏的倦怠", "海边与纳凉的向往"],
  Autumn: ["艺术之秋的充实", "舒爽出行季", "年末将近的微妙感伤"],
  Winter: ["年末年始的忙乱与团聚", "凛冬的安静内省", "新年立 flag 的劲头"],
};

const VIRAL: Record<string, readonly string[]> = {
  Spring: ["目黑川夜樱", "新展开幕", "草莓甜品季"],
  Summer: ["隅田川花火", "屋上啤酒花园", "纳凉怪谈展"],
  Autumn: ["美术馆秋季特展", "红叶 light up", "艺术祭"],
  Winter: ["冬季 illumination", "初詣与年末市集", "热红酒与火锅"],
};

const SEPTEMBER_WEATHER = ["晴", "晴", "残暑闷热", "多云", "午后阵雨"] as const;
const SEPTEMBER_MOOD = ["夏末残暑里的缓慢节奏", "傍晚稍有凉意的轻松", "换季前仍想抓住夏天"] as const;
const SEPTEMBER_VIRAL = ["夏末限定甜品", "傍晚露台散步", "九月艺术展"] as const;

export type World = {
  date: string;
  season: string;
  weather: string;
  cityMood: string;
  viralTopics: string[];
  climateContext: string;
};

/**
 * Signature: `function climateContextOf(dateKey: string): string`
 * Purpose: Describes Tokyo's date-sensitive temperature feel, vegetation, and foliage so content does not rely on four-season stereotypes.
 */
function climateContextOf(dateKey: string): string {
  const month = Number(dateKey.slice(5, 7));
  const day = Number(dateKey.slice(8, 10));
  if (month === 1) return "东京隆冬，空气干燥偏冷；落叶树多为裸枝，常绿植物仍绿，普通晴天不应擅自出现积雪。";
  if (month === 2) return "东京冬末，落叶树大多仍是裸枝，偶有梅花；樱花尚未开放，也没有春季浓绿树冠。";
  if (month === 3) return day < 20
    ? "东京早春，气温仍有凉意，枝头以嫩芽和梅花为主；不要提前出现满树樱花或成熟浓绿树冠。"
    : "东京春分后逐渐转暖，樱花可能开始开放，树木刚抽嫩芽；花期强弱应克制，不要把所有街道都画成满开。";
  if (month === 4) return day <= 12
    ? "东京春季，樱花通常处于开放至飘落阶段，嫩叶开始出现；樱花只应在合适树种和地点出现。"
    : "东京春末，樱花季基本结束，街道以明亮嫩绿的新叶为主，不要继续大面积表现满开樱花。";
  if (month === 5) return "东京初夏前的新绿期，树木枝叶清新茂盛，体感温暖但并非酷暑，也没有秋色。";
  if (month === 6) return "东京梅雨期，湿度高、植被茂密鲜绿，常见阴天或雨后湿润路面；没有黄叶和红叶。";
  if (month === 7 || month === 8) return "东京盛夏，炎热潮湿，树冠浓密深绿、阳光强烈；不要出现秋叶、春樱或凉季穿着。";
  if (month === 9) return "东京夏末残暑，依然炎热潮湿，银杏及多数落叶树保持浓绿；禁止黄银杏、红叶、秋季落叶和秋色街景。";
  if (month === 10) return day < 20
    ? "东京初秋，体感逐渐舒适但多数树叶仍然绿色；不要提前出现成片黄银杏或红叶。"
    : "东京深秋前段，多数街道仍以绿色为主，少量树叶可轻微转黄；尚未进入红叶和银杏盛期。";
  if (month === 11) return day < 15
    ? "东京秋季物候渐变，绿色与少量黄红叶混合；避免把整座城市画成红叶盛景。"
    : "东京晚秋进入银杏和红叶观赏期，可出现自然的金黄与红叶，但应符合具体树种和地点。";
  return day <= 10
    ? "东京初冬仍可能保留晚季金黄银杏，随后逐步落叶；气温偏凉，通常无雪。"
    : "东京冬季，晚秋彩叶大多落尽，落叶树逐渐裸枝、常绿植物仍绿；普通场景不要擅自加入积雪。";
}

/**
 * Signature: `function worldSnapshot(dateKey: string): World`
 * Purpose: Builds the deterministic Tokyo weather, mood, and trend snapshot for one date under the current season rules.
 */
function worldSnapshot(dateKey: string): World {
  const month = Number(dateKey.slice(5, 7));
  const season = seasonOf(month);
  const rnd = seededRand(dateKey);
  const weatherPool = month === 9 ? SEPTEMBER_WEATHER : WEATHER[season];
  const moodPool = month === 9 ? SEPTEMBER_MOOD : MOOD[season];
  const pool = month === 9 ? SEPTEMBER_VIRAL : VIRAL[season];
  const weather = pick(rnd, weatherPool);
  const cityMood = pick(rnd, moodPool);
  const viralTopics = [pick(rnd, pool)];
  const t2 = pick(rnd, pool);
  if (!viralTopics.includes(t2)) viralTopics.push(t2);
  return { date: dateKey, season, weather, cityMood, viralTopics, climateContext: climateContextOf(dateKey) };
}

// 取（或生成并落库）某天的世界状态。dateKey = YYYY-MM-DD（东京）。
/**
 * Signature: `async function getOrCreateWorldState(dateKey: string): Promise<World>`
 * Purpose: Loads a deterministic Tokyo world state and refreshes cached rows when seasonal rules have changed.
 */
export async function getOrCreateWorldState(dateKey: string): Promise<World> {
  const expected = worldSnapshot(dateKey);
  const existing = await prisma.worldState.findUnique({ where: { date: dateKey } });
  if (existing) {
    const existingTopics = Array.isArray(existing.viralTopics) ? existing.viralTopics as string[] : [];
    const needsRefresh =
      existing.season !== expected.season ||
      existing.weather !== expected.weather ||
      existing.cityMood !== expected.cityMood ||
      JSON.stringify(existingTopics) !== JSON.stringify(expected.viralTopics);
    if (needsRefresh) {
      await prisma.worldState.update({
        where: { date: dateKey },
        data: {
          season: expected.season,
          weather: expected.weather,
          cityMood: expected.cityMood,
          viralTopics: expected.viralTopics,
        },
      });
      return expected;
    }
    return {
      date: existing.date,
      season: existing.season,
      weather: existing.weather,
      cityMood: existing.cityMood,
      viralTopics: existingTopics,
      climateContext: expected.climateContext,
    };
  }
  await prisma.worldState.create({
    data: {
      date: expected.date,
      season: expected.season,
      weather: expected.weather,
      cityMood: expected.cityMood,
      viralTopics: expected.viralTopics,
    },
  });
  return expected;
}
