// 提取质量评测（eval）—— 把"感觉还行"变成"可量化"。
// 用法：npm run eval
// 读取 scripts/eval/dataset.json（人工标注的真实页面 + 期望抽取结果），
// 跑当前 prompt/模型，输出条目召回/精确率与关键字段准确率。
// 每次改 prompt 后重跑，看指标变化。

import "./loadEnv"; // 必须第一个 import：先加载 .env
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractFromText } from "@/services/extraction/extract";
import type { ExtractedEvent } from "@/services/extraction/types";

type EvalCase = {
  name: string;
  text: string;
  expected: Array<Partial<ExtractedEvent> & { title: string }>;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");
function titleMatch(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x === y || x.includes(y) || y.includes(x);
}
const datePart = (s: string | null | undefined) => (s ? s.slice(0, 10) : null);

async function main() {
  const file = path.join(process.cwd(), "scripts", "eval", "dataset.json");
  const cases = JSON.parse(await readFile(file, "utf8")) as EvalCase[];

  let truePos = 0; // 正确抽出的活动
  let predicted = 0; // 抽出的活动总数
  let expectedTotal = 0; // 标注的活动总数
  let catMatched = 0;
  let catTotal = 0;
  let timeMatched = 0;
  let timeTotal = 0;

  for (const c of cases) {
    const preds = await extractFromText(c.text);
    predicted += preds.length;
    expectedTotal += c.expected.length;

    const usedPred = new Set<number>();
    for (const exp of c.expected) {
      const idx = preds.findIndex((p, i) => !usedPred.has(i) && titleMatch(p.title, exp.title));
      if (idx === -1) {
        console.log(`  ✗ [${c.name}] 漏抽："${exp.title}"`);
        continue;
      }
      usedPred.add(idx);
      truePos++;
      const pred = preds[idx];

      if (exp.category != null) {
        catTotal++;
        if (pred.category === exp.category) catMatched++;
        else console.log(`  · 分类不符："${exp.title}" 期望 ${exp.category} 得到 ${pred.category}`);
      }
      if (exp.startTime != null) {
        timeTotal++;
        if (datePart(pred.startTime) === datePart(exp.startTime)) timeMatched++;
        else console.log(`  · 时间不符："${exp.title}" 期望 ${exp.startTime} 得到 ${pred.startTime}`);
      }
    }
  }

  const recall = expectedTotal ? truePos / expectedTotal : 0;
  const precision = predicted ? truePos / predicted : 0;
  const f1 = recall + precision ? (2 * recall * precision) / (recall + precision) : 0;

  console.log("\n=== 评测结果 ===");
  console.table({
    样本页数: cases.length,
    标注活动数: expectedTotal,
    抽出活动数: predicted,
    "召回率 recall": recall.toFixed(3),
    "精确率 precision": precision.toFixed(3),
    F1: f1.toFixed(3),
    分类准确率: catTotal ? (catMatched / catTotal).toFixed(3) : "—",
    时间准确率: timeTotal ? (timeMatched / timeTotal).toFixed(3) : "—",
  });
}

main().catch((err) => {
  console.error("评测失败：", err);
  process.exitCode = 1;
});
