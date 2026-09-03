import "./loadEnv";
import { prisma } from "../src/lib/db";
import { personaOf } from "../src/lib/personas";
import {
  regenerateCheckinImage,
  regeneratePostImage,
} from "../src/services/simulation/regenerate";

type ImageTarget = {
  id: string;
  kind: "checkin" | "post";
  userId: string;
  username: string;
};

/**
 * Signature: `function arg(name: string): string | undefined`
 * Purpose: Reads a named `--key=value` command-line argument.
 */
function arg(name: string): string | undefined {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

/**
 * Signature: `function tokyoDayBounds(date: string): { start: Date; end: Date }`
 * Purpose: Converts one Tokyo calendar date into an exclusive UTC database range.
 */
function tokyoDayBounds(date: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("--date 必须使用 YYYY-MM-DD 格式");
  }
  const start = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(start.getTime())) throw new Error("--date 不是有效日期");
  return { start, end: new Date(start.getTime() + 86_400_000) };
}

/**
 * Signature: `async function findTargets(date: string): Promise<ImageTarget[]>`
 * Purpose: Finds image-bearing simulated posts and check-ins created on one Tokyo calendar date.
 */
async function findTargets(date: string): Promise<ImageTarget[]> {
  const { start, end } = tokyoDayBounds(date);
  const [checkins, posts] = await Promise.all([
    prisma.checkIn.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        id: true,
        userId: true,
        imageSpec: true,
        photoUrl: true,
        photoUrls: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.post.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: {
        id: true,
        userId: true,
        imageSpec: true,
        imageUrl: true,
        imageUrls: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const userIds = [...new Set([...checkins, ...posts].map((row) => row.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });
  const usernameById = new Map(users.map((user) => [user.id, user.username]));
  const checkinTargets: ImageTarget[] = checkins.flatMap((row) => {
    const username = usernameById.get(row.userId);
    return row.imageSpec && (row.photoUrl || row.photoUrls.length > 0) && username && personaOf(username)
      ? [{ id: row.id, kind: "checkin" as const, userId: row.userId, username }]
      : [];
  });
  const postTargets: ImageTarget[] = posts.flatMap((row) => {
    const username = usernameById.get(row.userId);
    return row.imageSpec && (row.imageUrl || row.imageUrls.length > 0) && username && personaOf(username)
      ? [{ id: row.id, kind: "post" as const, userId: row.userId, username }]
      : [];
  });
  return [...checkinTargets, ...postTargets];
}

/**
 * Signature: `async function main(): Promise<void>`
 * Purpose: Previews or replaces every simulated image created on a selected Tokyo date.
 */
async function main(): Promise<void> {
  const date = arg("date");
  const apply = process.argv.includes("--apply");
  if (!date) throw new Error("请传入 --date=YYYY-MM-DD");

  const targets = await findTargets(date);
  console.log(`${date} 找到 ${targets.length} 张可重新生成的模拟内容图片${apply ? "" : " [仅预览]"}`);
  for (const target of targets) console.log(`- ${target.kind} ${target.username} ${target.id}`);
  if (!apply || targets.length === 0) return;

  let succeeded = 0;
  for (const target of targets) {
    const result = target.kind === "checkin"
      ? await regenerateCheckinImage(target.id, target.userId, [])
      : await regeneratePostImage(target.id, target.userId);
    console.log(`${result.ok ? "✓" : "✗"} ${target.kind} ${target.username}: ${result.ok ? result.imageUrl : result.error}`);
    if (result.ok) succeeded += 1;
  }
  console.log(`完成：${succeeded}/${targets.length}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
