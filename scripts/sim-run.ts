import "./loadEnv";
import { prisma } from "../src/lib/db";
import { simulateDay } from "../src/services/simulation/engine";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function tokyoToday(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Tokyo",
  });
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
  const rangeText = dates.length > 1 ? `-${dates[dates.length - 1]}` : "";
  console.log(`模拟 ${dates.length} 天（${dates[0]}${rangeText}）${dry ? " [dry]" : ""}${only ? ` only=${only.join(",")}` : ""}\n`);

  let totalCheckins = 0;
  let totalMemories = 0;
  let totalSocialPosts = 0;
  let totalComments = 0;
  let totalReplies = 0;

  for (const date of dates) {
    const r = await simulateDay(date, { only, dry });
    const checkins = r.results.filter((x) => x.status === "posted");
    const memories = r.results.filter((x) => x.status === "memory");
    const quiet = r.results.filter((x) => x.status === "skipped-quiet" || x.status === "skipped-done");

    totalCheckins += checkins.length;
    totalMemories += memories.length;
    totalSocialPosts += r.social?.posts ?? 0;
    totalComments += r.social?.comments ?? 0;
    totalReplies += r.social?.replies ?? 0;

    const socialText = r.social
      ? ` / 社交 发帖${r.social.posts} 评论${r.social.comments} 回复${r.social.replies}${r.social.skipped ? " skipped" : ""}`
      : "";

    console.log(`■ ${date}  [${r.world}]  足迹 ${checkins.length} / 记忆 ${memories.length} / 平静 ${quiet.length}${socialText}${r.maintenance ? `  · ${r.maintenance}` : ""}`);
    for (const p of checkins) console.log(`   - 足迹 ${p.username}: ${p.note}`);
    for (const note of r.social?.notes ?? []) console.log(`   - ${note}`);
  }

  console.log(`\n合计：足迹 ${totalCheckins} 条、纯记忆 ${totalMemories} 条`);
  console.log(`社交合计：发帖 ${totalSocialPosts} 条、评论 ${totalComments} 条、回复 ${totalReplies} 条`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
