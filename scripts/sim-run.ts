import "./loadEnv";
import { prisma } from "../src/lib/db";
import { simulateDay } from "../src/services/simulation/engine";

/**
 * 社区模拟 Phase 2 运行器（每日推演）。
 *
 *   npx tsx scripts/sim-run.ts                      # 模拟「今天」(东京)全员
 *   npx tsx scripts/sim-run.ts --date=2026-06-20    # 模拟某天
 *   npx tsx scripts/sim-run.ts --from=2026-02-01 --to=2026-06-22   # 回填一段(Feb→现在)
 *   npx tsx scripts/sim-run.ts --only=さくら,葵      # 仅某些角色
 *   npx tsx scripts/sim-run.ts --date=2026-06-20 --dry   # 干跑(不调 LLM/不写库,看谁会参与)
 *
 * 幂等：已模拟过的 (角色,日期) 会跳过，可安全断点续跑。
 */

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function tokyoToday(): string {
  const yesterday = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toLocaleDateString("en-CA", {
    timeZone: "Asia/Tokyo"
  });
  // return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
  return yesterday;
}

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let t = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  let guard = 0;
  while (t <= end && guard < 800) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86_400_000;
    guard++;
  }
  return out;
}

async function main() {
  const dry = hasFlag("dry");
  const only = arg("only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const from = arg("from");
  const to = arg("to");
  const single = arg("date");

  const dates = from && to ? dateRange(from, to) : [single ?? tokyoToday()];
  console.log(`模拟 ${dates.length} 天（${dates[0]}${dates.length > 1 ? `…${dates[dates.length - 1]}` : ""}）${dry ? " [dry]" : ""}${only ? ` 仅:${only.join(",")}` : ""}\n`);

  let totalPosts = 0, totalMem = 0;
  for (const date of dates) {
    const r = await simulateDay(date, { only, dry });
    const posted = r.results.filter((x) => x.status === "posted");
    const mem = r.results.filter((x) => x.status === "memory");
    const quiet = r.results.filter((x) => x.status === "skipped-quiet" || x.status === "skipped-done");
    totalPosts += posted.length;
    totalMem += mem.length;
    console.log(`▸ ${date}  [${r.world}]  发帖 ${posted.length} / 记忆 ${mem.length} / 平静 ${quiet.length}${r.maintenance ? `  ｜ ${r.maintenance}` : ""}`);
    for (const p of posted) console.log(`   📍 ${p.username}: ${p.note?.slice(0, 60)}`);
  }
  console.log(`\n合计：足迹 ${totalPosts} 条、纯记忆 ${totalMem} 条。`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
