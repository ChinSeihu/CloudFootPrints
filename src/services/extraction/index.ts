import { extractFromText } from "./extract";
import { ingestEvents, type IngestStats } from "./ingest";
import { getSources } from "./sources";
import type { Source } from "./types";

export type { Source } from "./types";
export { getSources } from "./sources";

function emptyStats(): IngestStats {
  return { considered: 0, geocodeFailed: 0, duplicates: 0, inserted: 0 };
}

function addStats(a: IngestStats, b: IngestStats): IngestStats {
  return {
    considered: a.considered + b.considered,
    geocodeFailed: a.geocodeFailed + b.geocodeFailed,
    duplicates: a.duplicates + b.duplicates,
    inserted: a.inserted + b.inserted,
  };
}

// 跑单个源的完整管线：采集 → (LLM 抽取 | 直接用结构化) → 地理编码+入库。
export async function runSource(source: Source): Promise<IngestStats> {
  console.log(`\n▶ 源：${source.name}`);
  const docs = await source.fetch();
  console.log(`  采集到 ${docs.length} 个文档`);

  let total = emptyStats();
  for (const doc of docs) {
    const events = doc.prestructured ?? (doc.text ? await extractFromText(doc.text) : []);
    if (events.length === 0) continue;
    const stats = await ingestEvents(
      events,
      {
        sourceType: doc.sourceType,
        sourceUrl: doc.sourceUrl,
        trustLevel: doc.trustLevel,
      },
      doc.text ?? null,
    );
    total = addStats(total, stats);
  }
  console.log(
    `  ✓ ${source.name}：考察 ${total.considered}，入库 ${total.inserted}，` +
      `去重 ${total.duplicates}，地理编码失败 ${total.geocodeFailed}`,
  );
  return total;
}

// 跑全部已注册源。
export async function runExtractionPipeline(): Promise<IngestStats> {
  let total = emptyStats();
  for (const source of getSources()) {
    const stats = await runSource(source);
    total = addStats(total, stats);
  }
  return total;
}
