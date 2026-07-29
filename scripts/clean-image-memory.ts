import "./loadEnv";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { PERSONAS } from "../src/lib/personas";

type Candidate = {
  entity: "checkin" | "post";
  id: string;
  username: string;
  createdAt: string;
  imageSpec: Prisma.JsonValue;
};

function arg(name: string): string | undefined {
  return process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
}

function tokyoDayStart(value: string, name: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid --${name}; expected YYYY-MM-DD`);
  }
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -9));
}

async function main() {
  const fromValue = arg("from");
  const toValue = arg("to");
  const apply = process.argv.includes("--apply");

  if (!fromValue || !toValue) {
    throw new Error(
      "Usage: yarn tsx scripts/clean-image-memory.ts --from=YYYY-MM-DD --to=YYYY-MM-DD [--apply]",
    );
  }

  const from = tokyoDayStart(fromValue, "from");
  const to = tokyoDayStart(toValue, "to");
  if (from >= to) throw new Error("--to must be later than --from");

  const { prisma } = await import("../src/lib/db");
  const users = await prisma.user.findMany({
    where: { username: { in: PERSONAS.map((persona) => persona.username) } },
    select: { id: true, username: true },
  });
  const usernameById = new Map(users.map((user) => [user.id, user.username]));
  const userIds = users.map((user) => user.id);
  const dateScope = { gte: from, lt: to };

  const [checkins, posts] = await Promise.all([
    prisma.checkIn.findMany({
      where: {
        userId: { in: userIds },
        createdAt: dateScope,
        photoUrl: null,
        photoUrls: { isEmpty: true },
      },
      select: { id: true, userId: true, createdAt: true, imageSpec: true },
    }),
    prisma.post.findMany({
      where: {
        userId: { in: userIds },
        createdAt: dateScope,
        imageUrl: null,
        imageUrls: { isEmpty: true },
      },
      select: { id: true, userId: true, createdAt: true, imageSpec: true },
    }),
  ]);

  const candidates: Candidate[] = [
    ...checkins
      .filter(
        (row): row is typeof row & { imageSpec: Prisma.JsonValue } =>
          row.imageSpec !== null,
      )
      .map((row) => ({
        entity: "checkin" as const,
        id: row.id,
        username: usernameById.get(row.userId) ?? row.userId,
        createdAt: row.createdAt.toISOString(),
        imageSpec: row.imageSpec,
      })),
    ...posts
      .filter(
        (row): row is typeof row & { imageSpec: Prisma.JsonValue } =>
          row.imageSpec !== null,
      )
      .map((row) => ({
        entity: "post" as const,
        id: row.id,
        username: usernameById.get(row.userId) ?? row.userId,
        createdAt: row.createdAt.toISOString(),
        imageSpec: row.imageSpec,
      })),
  ];

  const counts = {
    checkins: candidates.filter((row) => row.entity === "checkin").length,
    posts: candidates.filter((row) => row.entity === "post").length,
  };
  console.log(
    `Scope: ${fromValue} through ${toValue} (exclusive), Tokyo time`,
  );
  console.log(
    `Image-less records with stored image memory: ${candidates.length} (${counts.checkins} checkins, ${counts.posts} posts)`,
  );

  if (!apply || candidates.length === 0) {
    console.log(
      apply ? "Nothing to clean." : "Dry run only. Add --apply to clean.",
    );
    await prisma.$disconnect();
    return;
  }

  const backupPath = join(
    tmpdir(),
    `cloudfootprints-image-memory-${Date.now()}.json`,
  );
  await writeFile(
    backupPath,
    JSON.stringify({ from: fromValue, to: toValue, candidates }, null, 2),
    "utf8",
  );

  await prisma.$transaction([
    prisma.checkIn.updateMany({
      where: {
        id: {
          in: candidates
            .filter((row) => row.entity === "checkin")
            .map((row) => row.id),
        },
      },
      data: { imageSpec: Prisma.DbNull },
    }),
    prisma.post.updateMany({
      where: {
        id: {
          in: candidates
            .filter((row) => row.entity === "post")
            .map((row) => row.id),
        },
      },
      data: { imageSpec: Prisma.DbNull },
    }),
  ]);

  console.log(`Cleaned ${candidates.length} image-memory records.`);
  console.log(`Backup: ${backupPath}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
