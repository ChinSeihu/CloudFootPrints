import { prisma } from "@/lib/db";
import { CATEGORY_META } from "@/lib/categories";
import { dedupeEvents } from "@/lib/eventDedup";

export type GuideEventRef = { token: string; id: string; title: string };
export type GuideEventsContext = { context: string; refs: GuideEventRef[] };

// 为 AI 导游提供「近期真实活动」上下文（每日抓取入库，比通用网搜更准、零成本）。
// 每条带编号 token（E1、E2…），并返回 token→{id,title} 映射；导游回传它提到的 token，
// 前端据此渲染可点击的活动卡片 → 打开详情。返回空 context 表示无数据。
export async function buildGuideEventsContext(limit = 40): Promise<GuideEventsContext> {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 3600 * 1000); // 含昨天起、仍在进行的
  const to = new Date(now.getTime() + 21 * 24 * 3600 * 1000); // 未来约三周
  const sel = { id: true, title: true, category: true, startTime: true, endTime: true, venueName: true, address: true, summary: true, description: true } as const;

  let rows;
  try {
    // 分两桶，避免长期展览占满名额把“近期开始”的挤掉：
    // ① 近期开始（startTime 在 from..to）按开始时间升序；② 进行中长期展（早已开始、仍在展期）按结束时间升序（快结束的更紧迫）。
    const [upcoming, ongoing] = await Promise.all([
      prisma.event.findMany({
        where: { startTime: { gte: from, lte: to } },
        orderBy: { startTime: "asc" },
        take: Math.ceil(limit * 0.7),
        select: sel,
      }),
      prisma.event.findMany({
        where: { startTime: { lt: from }, endTime: { gte: now } },
        orderBy: { endTime: "asc" },
        take: Math.floor(limit * 0.3),
        select: sel,
      }),
    ]);
    // 先按 (标题,开始时间) 精确去重，再跨源去重（同一天 + 标题包含关系）；保留信息更全的一条。
    const seen = new Set<string>();
    const merged = [...upcoming, ...ongoing].filter((e) => {
      const k = `${e.title}|${e.startTime?.toISOString() ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    rows = dedupeEvents(merged, (a, b) => {
      // 保留更“值得点”的：有摘要 > 描述更长 > 标题更短（更像规范名）。
      const score = (e: typeof a) => (e.summary ? 2 : 0) + Math.min((e.description?.length ?? 0) / 200, 1);
      if (score(b) > score(a)) return b;
      if (score(a) > score(b)) return a;
      return a.title.length <= b.title.length ? a : b;
    });
  } catch {
    return { context: "", refs: [] };
  }
  if (rows.length === 0) return { context: "", refs: [] };

  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("zh-CN", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }) : "时间未定";

  const refs: GuideEventRef[] = [];
  const lines = rows.map((e, i) => {
    const token = `E${i + 1}`;
    refs.push({ token, id: e.id, title: e.title });
    const cat = CATEGORY_META[e.category]?.label ?? e.category;
    const when = e.endTime && e.startTime && e.endTime > e.startTime ? `${fmt(e.startTime)}–${fmt(e.endTime)}` : fmt(e.startTime);
    const where = e.venueName || e.address || "";
    const desc = e.summary ? `（${e.summary}）` : "";
    return `${token}) ${when}｜${cat}｜${e.title}${desc}${where ? ` @ ${where}` : ""}`;
  });

  const context = `【你已掌握的近期/进行中活动（东京时区，仅供你参考，回答时当作自己的了解自然说出）】
回答“今天/本周/近期有什么活动”等问题时，优先依据下面这些真实活动；不要臆造未列出的活动。
每条前面的编号（E1、E2…）仅用于标识：**回答正文里绝不能出现这些编号**；若你的回答提到了其中某些活动，请把它们的编号填进 referenced 字段。
**重要：不要向用户提及这份清单的来源或形式**——不要出现“数据库/数据/清单/条目/系统”等字眼，像本地向导一样直接介绍即可；未列出的具体细节提示以官方信息为准。
${lines.join("\n")}`;
  return { context, refs };
}
