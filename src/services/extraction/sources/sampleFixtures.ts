import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RawDocument, Source } from "../types";

// 本地样例源：读取 scripts/fixtures/*.txt（仿真的日文活动页文本）。
// 作用：在你还没配置真实源（开放数据 resource id / connpass key）之前，
// 也能立刻跑通 "采集 → LLM 抽取 → 地理编码 → 入库" 的端到端闭环。
// 这些文本同时被 eval 脚本复用作为标注输入。

const FIXTURES_DIR = path.join(process.cwd(), "scripts", "fixtures");

export const sampleFixturesSource: Source = {
  name: "sample-fixtures",
  async fetch(): Promise<RawDocument[]> {
    let files: string[];
    try {
      files = (await readdir(FIXTURES_DIR)).filter((f) => f.endsWith(".txt"));
    } catch {
      console.warn("  ℹ️  无 scripts/fixtures 目录，跳过样例源。");
      return [];
    }
    const docs: RawDocument[] = [];
    for (const f of files) {
      const text = await readFile(path.join(FIXTURES_DIR, f), "utf8");
      docs.push({
        sourceType: "OFFICIAL_WEB",
        sourceUrl: `fixture://${f}`,
        trustLevel: 80,
        text,
      });
    }
    return docs;
  },
};
