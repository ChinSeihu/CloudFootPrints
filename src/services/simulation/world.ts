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

function seasonOf(month: number): "Spring" | "Summer" | "Autumn" | "Winter" {
  if (month >= 3 && month <= 5) return "Spring";
  if (month >= 6 && month <= 8) return "Summer";
  if (month >= 9 && month <= 11) return "Autumn";
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

export type World = {
  date: string;
  season: string;
  weather: string;
  cityMood: string;
  viralTopics: string[];
};

// 取（或生成并落库）某天的世界状态。dateKey = YYYY-MM-DD（东京）。
export async function getOrCreateWorldState(dateKey: string): Promise<World> {
  const existing = await prisma.worldState.findUnique({ where: { date: dateKey } });
  if (existing) {
    return {
      date: existing.date,
      season: existing.season,
      weather: existing.weather,
      cityMood: existing.cityMood,
      viralTopics: Array.isArray(existing.viralTopics) ? (existing.viralTopics as string[]) : [],
    };
  }
  const month = Number(dateKey.slice(5, 7));
  const season = seasonOf(month);
  const rnd = seededRand(dateKey);
  const weather = pick(rnd, WEATHER[season]);
  const cityMood = pick(rnd, MOOD[season]);
  const pool = VIRAL[season];
  const viralTopics = [pick(rnd, pool)];
  const t2 = pick(rnd, pool);
  if (!viralTopics.includes(t2)) viralTopics.push(t2);

  await prisma.worldState.create({ data: { date: dateKey, season, weather, cityMood, viralTopics } });
  return { date: dateKey, season, weather, cityMood, viralTopics };
}
