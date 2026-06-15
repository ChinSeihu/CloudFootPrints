// 回填：为库中 summary 为空的活动用 LLM 生成一句话摘要并原地更新。
// 抓取管线只在「新入库」时写 summary，存量活动需此脚本补。
// 运行（需 .env 的 DATABASE_URL + LLM_API_KEY）：
//   仅统计： npx tsx scripts/backfill-summaries.ts --count
//   执行回填：LLM_PROVIDER=deepseek npx tsx scripts/backfill-summaries.ts

import "./loadEnv";
import { prisma } from "../src/lib/db";
import { summarizeEvents } from "../src/lib/llm";

const BATCH = 30;
const countOnly = process.argv.includes("--count");

async function main() {
  const rows = await prisma.event.findMany({
    where: { summary: null },
    select: { id: true, title: true, description: true },
  });
  console.log(`待回填（summary 为空）：${rows.length} 条`);
  if (countOnly || rows.length === 0) return;

  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const sums = await summarizeEvents(batch.map((r) => ({ title: r.title, description: r.description })));
    for (let j = 0; j < batch.length; j++) {
      const s = sums[j];
      if (s) {
        await prisma.event.update({ where: { id: batch[j].id }, data: { summary: s } });
        updated++;
      }
    }
    console.log(`  进度 ${Math.min(i + BATCH, rows.length)}/${rows.length}，已写入 ${updated}`);
  }
  console.log(`✓ 回填完成：${updated}/${rows.length} 条写入摘要`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
