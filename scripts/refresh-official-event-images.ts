import "./loadEnv";
import { prisma } from "@/lib/db";
import {
  findHighResolutionOfficialImage,
  isWalkerplusPage,
  isWalkerplusThumbnail,
} from "@/services/extraction/officialImage";

const apply = process.argv.includes("--apply");
const includeEnded = process.argv.includes("--include-ended");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Math.min(2_000, Number(limitArg?.split("=")[1] ?? 1_000) || 1_000));
const concurrencyArg = process.argv.find((arg) => arg.startsWith("--concurrency="));
const concurrency = Math.max(1, Math.min(6, Number(concurrencyArg?.split("=")[1] ?? 4) || 4));

type RefreshableEvent = {
  id: string;
  title: string;
  imageUrl: string | null;
  sourceUrl: string | null;
};

type RefreshStats = {
  eligible: number;
  refreshed: number;
  skipped: number;
};

/**
 * Signature: `async function refreshEvent(event: RefreshableEvent, stats: RefreshStats): Promise<void>`
 * Purpose: Validates and optionally applies one official image replacement while preserving the existing URL on every failure.
 */
async function refreshEvent(event: RefreshableEvent, stats: RefreshStats): Promise<void> {
  if (!isWalkerplusThumbnail(event.imageUrl) || !event.sourceUrl || isWalkerplusPage(event.sourceUrl)) {
    stats.skipped++;
    return;
  }
  stats.eligible++;
  const candidate = await findHighResolutionOfficialImage(event.sourceUrl);
  if (!candidate || candidate.url === event.imageUrl) {
    stats.skipped++;
    console.log(`— ${event.title}`);
    return;
  }
  if (apply) {
    await prisma.event.update({ where: { id: event.id }, data: { imageUrl: candidate.url } });
  }
  stats.refreshed++;
  console.log(`${apply ? "✓" : "预览"} ${candidate.width}×${candidate.height ?? "?"} ${event.title}`);
}

/**
 * Signature: `async function main(): Promise<void>`
 * Purpose: Previews or applies verified high-resolution official images to events currently using WalkerPlus thumbnails.
 */
async function main(): Promise<void> {
  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      imageUrl: { contains: "ms-cache.walkerplus.com/walkertouch/wtd/event/" },
      sourceUrl: { not: null },
      ...(includeEnded ? {} : { OR: [{ endTime: { gte: now } }, { endTime: null, startTime: { gte: now } }, { startTime: null }] }),
    },
    orderBy: { startTime: "asc" },
    take: limit,
    select: { id: true, title: true, imageUrl: true, sourceUrl: true },
  });

  const stats: RefreshStats = { eligible: 0, refreshed: 0, skipped: 0 };
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, events.length) }, async () => {
    while (cursor < events.length) {
      const event = events[cursor++];
      await refreshEvent(event, stats);
    }
  });
  await Promise.all(workers);

  console.log(`\n${apply ? "已更新" : "可更新"} ${stats.refreshed}/${stats.eligible}，跳过 ${stats.skipped}；扫描 ${events.length} 条`);
  if (!apply) console.log("确认后使用 --apply 写入数据库。");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
