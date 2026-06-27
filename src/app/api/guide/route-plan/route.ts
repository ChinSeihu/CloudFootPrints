import { NextResponse } from "next/server";
import { CATEGORY_META } from "@/lib/categories";
import type { GuideRouteCandidate, GuideRoutePlan, GuideRouteStop } from "@/lib/guideRoute";

function apiKey() {
  return process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY || "";
}

function parseJson(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function distanceKm(a: GuideRouteCandidate, b: GuideRouteCandidate): number {
  const r = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function fallbackPlan(candidates: GuideRouteCandidate[]): GuideRoutePlan {
  const stops: GuideRouteStop[] = candidates.slice(0, 4).map((event) => ({
    id: event.id,
    title: event.title,
    venueName: event.venueName ?? null,
    note: `${CATEGORY_META[event.category]?.label ?? "活动"}，适合作为附近散步的一站。`,
    stayMinutes: 35,
  }));
  const byId = new Map(candidates.map((event) => [event.id, event]));
  const walkKm = stops.reduce((sum, stop, index) => {
    if (index === 0) return sum;
    const prev = byId.get(stops[index - 1].id);
    const current = byId.get(stop.id);
    return prev && current ? sum + distanceKm(prev, current) : sum;
  }, 0);
  return {
    title: "AI 导游为你规划的附近 City Walk",
    summary: "按附近活动顺路串联，适合先轻松逛一圈，再根据兴趣决定停留时间。",
    mood: "轻松探索",
    totalMinutes: Math.max(60, stops.length * 35 + Math.round(walkKm / 4 * 60)),
    walkKm: Number(walkKm.toFixed(1)),
    stops,
  };
}

function normalizePlan(raw: unknown, candidates: GuideRouteCandidate[]): GuideRoutePlan | null {
  const obj = raw as Partial<GuideRoutePlan> | null;
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.stops)) return null;
  const allowed = new Map(candidates.map((event) => [event.id, event]));
  const seen = new Set<string>();
  const stops = obj.stops
    .map((stop) => stop as Partial<GuideRouteStop>)
    .filter((stop): stop is Partial<GuideRouteStop> & { id: string } => typeof stop.id === "string" && allowed.has(stop.id))
    .filter((stop) => {
      if (seen.has(stop.id)) return false;
      seen.add(stop.id);
      return true;
    })
    .slice(0, 5)
    .map((stop) => {
      const event = allowed.get(stop.id)!;
      return {
        id: event.id,
        title: event.title,
        venueName: event.venueName ?? null,
        note: typeof stop.note === "string" && stop.note.trim() ? stop.note.trim().slice(0, 80) : "顺路停留，感受附近氛围。",
        stayMinutes: Math.min(90, Math.max(15, Number(stop.stayMinutes) || 35)),
      };
    });
  if (stops.length < 2) return null;
  const walkKm = stops.reduce((sum, stop, index) => {
    if (index === 0) return sum;
    const prev = allowed.get(stops[index - 1].id);
    const current = allowed.get(stop.id);
    return prev && current ? sum + distanceKm(prev, current) : sum;
  }, 0);
  return {
    title: typeof obj.title === "string" && obj.title.trim() ? obj.title.trim().slice(0, 40) : "AI 导游为你规划的附近 City Walk",
    summary: typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim().slice(0, 140) : "把附近活动串成一条轻松可逛的路线。",
    mood: typeof obj.mood === "string" && obj.mood.trim() ? obj.mood.trim().slice(0, 16) : "轻松探索",
    totalMinutes: Math.min(360, Math.max(45, Number(obj.totalMinutes) || stops.length * 35 + Math.round(walkKm / 4 * 60))),
    walkKm: Number(walkKm.toFixed(1)),
    stops,
  };
}

async function llmPlan(candidates: GuideRouteCandidate[], intentPrompt?: string): Promise<GuideRoutePlan | null> {
  const key = apiKey();
  if (!key) return null;
  const baseUrl = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = process.env.LLM_MODEL || "deepseek-chat";
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是东京本地 AI 导游。请基于候选活动设计一条附近周游路线，语气自然，不提数据库、后端、算法等系统词。路线要像朋友建议 city walk，考虑距离顺路、类型变化、时间节奏和适合拍照/休息的停留点。只输出 JSON。",
        },
        {
          role: "user",
          content: JSON.stringify({
            outputShape: {
              title: "string",
              summary: "string",
              mood: "string",
              totalMinutes: 180,
              stops: [{ id: "event id", note: "why this stop", stayMinutes: 35 }],
            },
            userIntent: intentPrompt || "规划一条附近游玩路线",
            rules: ["从候选中选 3 到 5 个 id", "尽量避免同类型连续出现", "note 用中文且不要超过 40 字", "不要编造候选外地点"],
            candidates: candidates.slice(0, 10).map((event) => ({
              id: event.id,
              title: event.title,
              category: CATEGORY_META[event.category]?.label ?? event.category,
              venueName: event.venueName,
              summary: event.summary ?? event.description?.slice(0, 100) ?? "",
              startTime: event.startTime,
            })),
          }),
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return normalizePlan(parseJson(data.choices?.[0]?.message?.content ?? ""), candidates);
}

export async function POST(req: Request) {
  let body: { candidates?: GuideRouteCandidate[]; intentPrompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }
  const candidates = Array.isArray(body.candidates)
    ? body.candidates.filter((event) => event?.id && event?.title && Number.isFinite(event.lat) && Number.isFinite(event.lng)).slice(0, 12)
    : [];
  if (candidates.length < 2) return NextResponse.json({ error: "附近活动不足，暂时无法规划路线" }, { status: 400 });
  const intentPrompt = typeof body.intentPrompt === "string" ? body.intentPrompt.trim() : "";
  const plan = await llmPlan(candidates, intentPrompt).catch(() => null);
  return NextResponse.json({ plan: plan ?? fallbackPlan(candidates) });
}
