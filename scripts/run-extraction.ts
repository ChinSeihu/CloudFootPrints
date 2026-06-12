// 跑一次提取管线：采集 → LLM 抽取 → 地理编码 → 入库。
// 用法：
//   npm run extract              跑全部已注册源（增量入库，去重）
//   npm run extract -- --reset   先清掉旧的「抓取来的」活动再重抓（用户发帖/打卡保留）
// 改了来源/地址/坐标逻辑后用 --reset，避免旧坏数据（如定位错的点）残留 + sourceUrl 变化导致重复。
// 未配置 key/resource id 的源会优雅跳过；样例源保证闭环可跑通。

import "./loadEnv"; // 必须第一个 import：先加载 .env，再求值会读 env 的模块
import { runExtractionPipeline } from "@/services/extraction";
import { prisma } from "@/lib/db";

// 清理所有「抓取来的」活动（sourceType != USER），保留用户发帖。
// 打卡对将删活动的引用先置空（保留打卡本身）；评论随活动 Cascade 删除。
async function resetScraped() {
  const scraped = await prisma.event.findMany({
    where: { sourceType: { not: "USER" } },
    select: { id: true },
  });
  if (scraped.length === 0) {
    console.log("无抓取数据可清理。");
    return;
  }
  const ids = scraped.map((e) => e.id);
  await prisma.checkIn.updateMany({ where: { eventId: { in: ids } }, data: { eventId: null } });
  const del = await prisma.event.deleteMany({ where: { sourceType: { not: "USER" } } });
  console.log(`已清理抓取活动 ${del.count} 条（用户发帖/打卡保留）。`);
}

async function main() {
  if (process.argv.includes("--reset")) {
    console.log("=== --reset：清理旧抓取数据 ===");
    await resetScraped();
  }
  console.log("=== 提取管线开始 ===");
  const total = await runExtractionPipeline();
  console.log("\n=== 汇总 ===");
  console.table(total);
}

main()
  .catch((err) => {
    console.error("提取管线失败：", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
