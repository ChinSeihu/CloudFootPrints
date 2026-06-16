import { prisma } from "@/lib/db";
import { CATEGORY_META } from "@/lib/categories";

// 为 AI 导游提供「本站数据库的近期真实活动」上下文，使其能据此回答“今天/近期有什么活动”
// （数据每日抓取入库，比通用网搜更准、零成本）。返回拼好的纯文本块，路由注入到 system。
export async function buildGuideEventsContext(limit = 40): Promise<string> {
  const now = new Date();
  const from = new Date(now.getTime() - 24 * 3600 * 1000); // 含昨天起、仍在进行的
  const to = new Date(now.getTime() + 21 * 24 * 3600 * 1000); // 未来约三周
  const sel = { title: true, category: true, startTime: true, endTime: true, venueName: true, address: true, summary: true } as const;

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
    const seen = new Set<string>();
    rows = [...upcoming, ...ongoing].filter((e) => {
      const k = `${e.title}|${e.startTime?.toISOString() ?? ""}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  } catch {
    return "";
  }
  if (rows.length === 0) return "";

  const fmt = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("zh-CN", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" }) : "时间未定";

  const lines = rows.map((e) => {
    const cat = CATEGORY_META[e.category]?.label ?? e.category;
    const when = e.endTime && e.startTime && e.endTime > e.startTime ? `${fmt(e.startTime)}–${fmt(e.endTime)}` : fmt(e.startTime);
    const where = e.venueName || e.address || "";
    const desc = e.summary ? `（${e.summary}）` : "";
    return `- ${when}｜${cat}｜${e.title}${desc}${where ? ` @ ${where}` : ""}`;
  });

  return `【你已掌握的近期/进行中活动（东京时区，仅供你参考，回答时当作自己的了解自然说出）】
回答“今天/本周/近期有什么活动”等问题时，优先依据下面这些真实活动；不要臆造未列出的活动。
**重要：不要向用户提及这份清单的来源或形式**——不要出现“数据库/数据/清单/条目/系统”等字眼，像本地向导一样直接介绍即可；未列出的具体细节提示以官方信息为准。
${lines.join("\n")}`;
}
