import { prisma } from "@/lib/db";

type FeaturedCandidate = {
  id: string;
  title: string;
  category: string;
  venueName: string | null;
  summary: string | null;
  description: string | null;
  startTime: Date | null;
  trustLevel: number;
  imageUrl: string | null;
};

type FeaturedResult = {
  date: string;
  candidates: number;
  selected: number;
};

function isEnabled(): boolean {
  const flag = (process.env.FEATURE_DAILY_WITH_LLM ?? "").toLowerCase();
  return ["1", "true", "yes", "on"].includes(flag) && Boolean(process.env.LLM_API_KEY);
}

function tokyoTodayRange(date = new Date()): { key: string; start: Date; end: Date } {
  const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  return {
    key,
    start: new Date(`${key}T00:00:00.000+09:00`),
    end: new Date(`${key}T23:59:59.999+09:00`),
  };
}

function compactCandidate(event: FeaturedCandidate) {
  return {
    id: event.id,
    title: event.title,
    category: event.category,
    venue: event.venueName,
    startsAt: event.startTime?.toISOString() ?? null,
    trustLevel: event.trustLevel,
    hasImage: Boolean(event.imageUrl),
    summary: event.summary ?? event.description?.slice(0, 180) ?? "",
  };
}

async function selectWithLlm(dateKey: string, candidates: FeaturedCandidate[]): Promise<string[]> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return [];

  const baseUrl = (process.env.LLM_BASE_URL ?? "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.LLM_MODEL ?? "deepseek-chat";
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You curate a Tokyo local event app. Pick at most 5 events that deserve today's featured banner. Prefer events starting today, strong visual appeal, cultural/local interest, clear venue/time, variety across categories, and avoid near-duplicates. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            date: dateKey,
            outputShape: { ids: ["event_id"] },
            candidates: candidates.map(compactCandidate),
          }),
        },
      ],
    }),
  });

  if (!response.ok) throw new Error(`featured LLM failed: ${response.status} ${response.statusText}`);
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as { ids?: unknown };
  return Array.isArray(parsed.ids) ? parsed.ids.filter((id): id is string => typeof id === "string") : [];
}

export async function maybeSelectDailyFeatured(): Promise<FeaturedResult> {
  const { key, start, end } = tokyoTodayRange();
  if (!isEnabled()) {
    console.log("  今日精选：未启用 FEATURE_DAILY_WITH_LLM，保留现有标记");
    return { date: key, candidates: 0, selected: 0 };
  }

  const candidates = await prisma.event.findMany({
    where: {
      sourceType: { not: "USER" },
      startTime: { gte: start, lte: end },
    },
    select: {
      id: true,
      title: true,
      category: true,
      venueName: true,
      summary: true,
      description: true,
      startTime: true,
      trustLevel: true,
      imageUrl: true,
    },
    orderBy: [{ trustLevel: "desc" }, { startTime: "asc" }],
    take: 40,
  });

  if (candidates.length === 0) {
    await prisma.event.updateMany({ where: { featuredToday: true }, data: { featuredToday: false } });
    console.log(`  今日精选：${key} 无当天开始活动，已清空标记`);
    return { date: key, candidates: 0, selected: 0 };
  }

  try {
    const allowed = new Set(candidates.map((event) => event.id));
    const selectedIds = (await selectWithLlm(key, candidates))
      .filter((id) => allowed.has(id))
      .filter((id, index, list) => list.indexOf(id) === index)
      .slice(0, 5);

    if (selectedIds.length === 0) {
      console.log(`  今日精选：LLM 未返回有效结果，前端将使用热度兜底`);
      return { date: key, candidates: candidates.length, selected: 0 };
    }

    await prisma.event.updateMany({ where: { featuredToday: true }, data: { featuredToday: false } });
    await prisma.event.updateMany({ where: { id: { in: selectedIds } }, data: { featuredToday: true } });
    console.log(`  今日精选：候选 ${candidates.length}，已标记 ${selectedIds.length}`);
    return { date: key, candidates: candidates.length, selected: selectedIds.length };
  } catch (error) {
    console.warn("  今日精选：LLM 筛选失败，保留现有标记，前端将使用热度兜底", error);
    return { date: key, candidates: candidates.length, selected: 0 };
  }
}
