import "./loadEnv";
import { prisma } from "../src/lib/db";
import { PERSONAS } from "../src/lib/personas";
import { DEMO_USERS } from "../src/lib/demoUsers";

/**
 * 清空 demo 账号的内容与模拟状态，用于「清空重灌」。
 * 只动 demo 用户（personas 里的 12 人），保留账号本身与真实用户数据。
 *
 *   npx tsx scripts/sim-reset.ts            # 干跑：只打印将删除的数量，不动数据
 *   npx tsx scripts/sim-reset.ts --yes      # 真正执行清空
 *
 * 重灌流程（清空后依次跑）：
 *   npx tsx scripts/seed-demo.ts                              # 初始背景(足迹/发帖)
 *   npx tsx scripts/sim-init.ts                               # 回填记忆/状态/关系
 *   npx tsx scripts/sim-run.ts --from=2026-02-01 --to=<今天>  # 向前推演(出图)
 */

const YES = process.argv.includes("--yes");

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { in: PERSONAS.map((p) => p.username) } },
    select: { id: true, username: true },
  });
  const ids = users.map((u) => u.id);
  if (!ids.length) { console.log("没找到 demo 用户。"); return; }

  // 统计将删除的量
  const [ci, po, co, re, me, cs, rel, ws] = await Promise.all([
    prisma.checkIn.count({ where: { userId: { in: ids } } }),
    prisma.post.count({ where: { userId: { in: ids } } }),
    prisma.comment.count({ where: { userId: { in: ids } } }),
    prisma.reaction.count({ where: { userId: { in: ids } } }),
    prisma.memory.count({ where: { userId: { in: ids } } }),
    prisma.characterState.count({ where: { userId: { in: ids } } }),
    prisma.relationship.count({ where: { OR: [{ aId: { in: ids } }, { bId: { in: ids } }] } }),
    prisma.worldState.count(),
  ]);
  console.log(`demo 用户 ${ids.length} 人。将清空：`);
  console.log(`  足迹 ${ci} · 发帖 ${po} · 评论 ${co} · 点赞收藏 ${re}`);
  console.log(`  记忆 ${me} · 角色状态 ${cs} · 关系 ${rel} · 世界状态 ${ws}（全局）`);
  console.log(`  并把 ${ids.length} 人的 status/signature 重置为初始值。User 账号/头像保留。`);

  if (!YES) { console.log("\n(干跑，未删除。确认后加 --yes 执行。)"); return; }

  // 删除内容（顺序：先 demo 的评论/点赞/足迹，再发帖[级联清其上评论/点赞]，再模拟状态）
  await prisma.reaction.deleteMany({ where: { userId: { in: ids } } });
  await prisma.comment.deleteMany({ where: { userId: { in: ids } } });
  await prisma.checkIn.deleteMany({ where: { userId: { in: ids } } });
  await prisma.post.deleteMany({ where: { userId: { in: ids } } });
  await prisma.memory.deleteMany({ where: { userId: { in: ids } } });
  await prisma.characterState.deleteMany({ where: { userId: { in: ids } } });
  await prisma.relationship.deleteMany({ where: { OR: [{ aId: { in: ids } }, { bId: { in: ids } }] } });
  await prisma.worldState.deleteMany({});

  // 重置 status/signature 为 demoUsers 初始值（其余字段如头像/封面不动）
  for (const u of users) {
    const demo = DEMO_USERS.find((d) => d.username === u.username);
    if (demo) await prisma.user.update({ where: { id: u.id }, data: { status: demo.status, signature: demo.signature } });
  }

  console.log("\n✅ 已清空。下一步：seed-demo → sim-init → sim-run(回填)。");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
