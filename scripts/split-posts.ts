// 一次性迁移：把抓取的官方活动(Event)与用户发帖分表。
// 把现有 Event 中 sourceType="USER" 的行搬到新 Post 表（复用同一 id，保证旧深链/外键无缝），
// 并把它们的评论/点赞/打卡从 eventId 改指向 postId，最后删掉这些 USER 的 Event 行。
// 顺序：① 建 Post ② 重指互动(set postId, 清 eventId) ③ 删 USER Event。
// 预览： npx tsx scripts/split-posts.ts --dry
// 执行： npx tsx scripts/split-posts.ts

import "./loadEnv";
import { prisma } from "../src/lib/db";

const dry = process.argv.includes("--dry");

async function main() {
  const userEvents = await prisma.event.findMany({ where: { sourceType: "USER" } });
  console.log(`找到 ${userEvents.length} 条用户发帖(Event.sourceType=USER)`);
  if (userEvents.length === 0) {
    console.log("无需迁移。");
    return;
  }

  let posts = 0, comments = 0, reactions = 0, checkins = 0;
  for (const e of userEvents as Array<Record<string, unknown>>) {
    const id = e.id as string;
    const userId = (e.userId as string | null) ?? "me"; // 兜底：极旧无作者数据归到 "me"

    if (dry) {
      console.log(`  [dry] Post ${id} ｜ ${(e.title as string)} ｜ user=${userId}`);
      posts++;
      continue;
    }

    // 同一事务内：建 Post(复用 id) + 重指该目标的所有互动 + 删旧 Event。
    const [, c, r, ci] = await prisma.$transaction([
      prisma.post.create({
        data: {
          id, // 复用原 Event.id：旧 /recommend?event=<id> 深链与外键无缝迁移
          title: e.title as string,
          description: (e.description as string | null) ?? null,
          category: e.category as never,
          venueName: (e.venueName as string | null) ?? null,
          imageUrl: (e.imageUrl as string | null) ?? null,
          imageUrls: (e.imageUrls as string[] | undefined) ?? [],
          lat: e.lat as number,
          lng: e.lng as number,
          startTime: (e.startTime as Date | null) ?? null,
          endTime: (e.endTime as Date | null) ?? null,
          tags: (e.tags as string[] | undefined) ?? [],
          signupEnabled: (e.signupEnabled as boolean | undefined) ?? false,
          userId,
          createdAt: e.createdAt as Date,
          updatedAt: e.updatedAt as Date,
        },
      }),
      prisma.comment.updateMany({ where: { eventId: id }, data: { postId: id, eventId: null } }),
      prisma.reaction.updateMany({ where: { eventId: id }, data: { postId: id, eventId: null } }),
      prisma.checkIn.updateMany({ where: { eventId: id }, data: { postId: id, eventId: null } }),
      prisma.event.delete({ where: { id } }),
    ]);
    posts++;
    comments += c.count;
    reactions += r.count;
    checkins += ci.count;
  }

  console.log(
    dry
      ? `\n[dry] 将迁移 ${posts} 条发帖（未改库）。`
      : `\n✓ 迁移完成：Post ${posts} 条；重指 评论 ${comments}、点赞/收藏/报名 ${reactions}、打卡 ${checkins}。`,
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
