// 跑一次提取管线：采集 → LLM 抽取 → 地理编码 → 入库。
// 用法：npm run extract
// 默认跑全部已注册源（东京都开放数据 / connpass / 样例 fixtures）。
// 未配置 key/resource id 的源会优雅跳过；样例源保证闭环可跑通。

import "./loadEnv"; // 必须第一个 import：先加载 .env，再求值会读 env 的模块
import { runExtractionPipeline } from "@/services/extraction";
import { prisma } from "@/lib/db";

async function main() {
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
