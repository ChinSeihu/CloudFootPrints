import "./loadEnv";
import { prisma } from "../src/lib/db";
import { PERSONAS, personaOf } from "../src/lib/personas";

/**
 * 抽查模拟质量：打印某人物的状态 / 记忆 / 最近足迹 / 关系。
 *
 *   npx tsx scripts/sim-inspect.ts さくら          # 看某人
 *   npx tsx scripts/sim-inspect.ts さくら --mem=20  # 多看几条记忆
 *   npx tsx scripts/sim-inspect.ts                 # 不传名字 = 全员概览(各几条)
 */

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const fmt = (d: Date) =>
  new Date(d).toLocaleString("zh-CN", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

async function nameMap(): Promise<Map<string, string>> {
  const users = await prisma.user.findMany({ select: { id: true, username: true } });
  return new Map(users.map((u) => [u.id, u.username]));
}

async function inspectOne(username: string, memN: number, idToName: Map<string, string>) {
  const persona = personaOf(username);
  const user = await prisma.user.findUnique({ where: { username }, select: { id: true, status: true, signature: true } });
  if (!user) { console.log(`\n✗ ${username}：用户不存在`); return; }
  const userId = user.id;

  const state = await prisma.characterState.findUnique({ where: { userId } });
  const memTotal = await prisma.memory.count({ where: { userId } });
  const mems = await prisma.memory.findMany({ where: { userId }, orderBy: { happenedAt: "desc" }, take: memN });
  const ciTotal = await prisma.checkIn.count({ where: { userId } });
  const cis = await prisma.checkIn.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 6 });
  const rels = await prisma.relationship.findMany({ where: { OR: [{ aId: userId }, { bId: userId }] } });

  console.log(`\n${"═".repeat(56)}`);
  console.log(`● ${username}　${persona ? `${persona.age}岁 · ${persona.occupation}` : ""}`);
  console.log(`  状态: ${user.status ?? "—"}   签名: ${user.signature ?? "—"}`);
  if (state) {
    const emo = Object.entries((state.emotion as Record<string, number>) ?? {}).map(([k, v]) => `${k}:${v}`).join("  ");
    console.log(`  情绪: ${emo || "(无)"}`);
    console.log(`  目标: ${(state.goals ?? []).join("；") || "(无)"}`);
    console.log(`  人生阶段: ${state.lifeStage ?? "(无)"}`);
    console.log(`  最后活跃: ${state.lastActiveAt ? fmt(state.lastActiveAt) : "(无)"}`);
    const cast = Array.isArray(state.cast) ? (state.cast as { name: string; relation: string }[]) : [];
    if (cast.length) console.log(`  系统外熟人: ${cast.map((c) => `${c.name}(${c.relation})`).join("、")}`);
  } else {
    console.log("  (无 CharacterState —— 先跑 sim-init)");
  }

  console.log(`\n  记忆 (${memTotal} 条，显示最近 ${mems.length}):`);
  for (const m of mems) {
    const tag = m.type === "MILESTONE" ? "里程碑" : m.type === "SUMMARY" ? "摘要" : m.sourceCheckInId ? "足迹" : "推演";
    console.log(`   ${fmt(m.happenedAt)} [${"★".repeat(m.importance)}|${tag}] ${m.text}`);
  }

  console.log(`\n  足迹 (${ciTotal} 条，显示最近 ${cis.length}):`);
  for (const c of cis) {
    const hearts = c.rating ? "♥".repeat(c.rating) : "—";
    const photo = (c.photoUrls?.length ?? 0) > 0 ? " 📷" : "";
    console.log(`   ${fmt(c.createdAt)} [${hearts}]${photo} ${(c.note ?? "").slice(0, 70)}`);
  }

  if (rels.length) {
    console.log(`\n  关系 (${rels.length}):`);
    for (const r of rels) {
      const otherId = r.aId === userId ? r.bId : r.aId;
      console.log(`   ↔ ${idToName.get(otherId) ?? otherId}  强度${r.strength} 情感${r.sentiment}${r.lastInteractAt ? ` 最近${fmt(r.lastInteractAt)}` : ""}`);
    }
  }
}

async function main() {
  const idToName = await nameMap();
  const target = process.argv.slice(2).find((a) => !a.startsWith("--"));
  const memN = Math.max(1, Number(arg("mem") ?? 12));

  if (target) {
    await inspectOne(target, memN, idToName);
  } else {
    // 全员概览：每人状态 + 记忆/足迹条数 + 最后活跃
    console.log("全员概览（不传名字时）：\n");
    for (const p of PERSONAS) {
      const user = await prisma.user.findUnique({ where: { username: p.username }, select: { id: true } });
      if (!user) { console.log(`  ${p.username.padEnd(8)} ✗ 不存在`); continue; }
      const memTotal = await prisma.memory.count({ where: { userId: user.id } });
      const ciTotal = await prisma.checkIn.count({ where: { userId: user.id } });
      const st = await prisma.characterState.findUnique({ where: { userId: user.id }, select: { lastActiveAt: true } });
      console.log(`  ${p.username.padEnd(8)} 记忆 ${String(memTotal).padStart(3)} · 足迹 ${String(ciTotal).padStart(3)} · 最后活跃 ${st?.lastActiveAt ? fmt(st.lastActiveAt) : "—"}`);
    }
    console.log("\n看某人详情： npx tsx scripts/sim-inspect.ts <用户名>");
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
