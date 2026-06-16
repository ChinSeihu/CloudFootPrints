// 一次性：清理库中已存在的跨源重复活动（同一天 + 标题包含关系）。
// 每组保留信息更全的一条，删除其余；带打卡的那条一定保留，避免外键报错。
// 仅统计： npx tsx scripts/dedupe-events.ts --dry
// 执行删除：npx tsx scripts/dedupe-events.ts

import "./loadEnv";
import { prisma } from "../src/lib/db";
import { isSameEvent } from "../src/lib/eventDedup";

const dry = process.argv.includes("--dry");

type Row = {
  id: string; title: string; startTime: Date | null; summary: string | null;
  description: string | null; trustLevel: number; sourceType: string; _count: { checkIns: number };
};

function score(e: Row): number {
  // 有打卡 > 有摘要 > 描述更长 > 信任度更高
  return (e._count.checkIns > 0 ? 100 : 0) + (e.summary ? 4 : 0) + Math.min((e.description?.length ?? 0) / 200, 2) + e.trustLevel / 100;
}

async function main() {
  const rows = (await prisma.event.findMany({
    where: { startTime: { not: null } },
    select: { id: true, title: true, startTime: true, summary: true, description: true, trustLevel: true, sourceType: true, _count: { select: { checkIns: true } } },
    orderBy: { startTime: "asc" },
  })) as Row[];

  // 贪心分组：每条尝试并入已有组（与组内任一判同）。
  const groups: Row[][] = [];
  for (const e of rows) {
    const g = groups.find((grp) => grp.some((x) => isSameEvent(x, e)));
    if (g) g.push(e);
    else groups.push([e]);
  }

  const toDelete: Row[] = [];
  let dupGroups = 0;
  for (const g of groups) {
    if (g.length < 2) continue;
    dupGroups++;
    const keeper = g.reduce((a, b) => (score(b) > score(a) ? b : a));
    for (const e of g) {
      if (e.id === keeper.id) continue;
      if (e._count.checkIns > 0) { console.log(`  ⚠️ 保留(有打卡)：${e.title}`); continue; }
      toDelete.push(e);
    }
    console.log(`组(${g.length})保留「${keeper.title}」←删 ${g.filter((e) => e.id !== keeper.id && e._count.checkIns === 0).map((e) => e.title).join(" / ")}`);
  }

  console.log(`\n重复组 ${dupGroups}，待删 ${toDelete.length} 条（总 ${rows.length}）。${dry ? "（dry，未删除）" : ""}`);
  if (!dry && toDelete.length) {
    const ids = toDelete.map((e) => e.id);
    await prisma.reaction.deleteMany({ where: { eventId: { in: ids } } });
    await prisma.comment.deleteMany({ where: { eventId: { in: ids } } });
    const r = await prisma.event.deleteMany({ where: { id: { in: ids } } });
    console.log(`✓ 已删除 ${r.count} 条重复活动。`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
