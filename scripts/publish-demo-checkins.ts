import { PERSONAS } from "../src/lib/personas";

try {
  process.loadEnvFile(".env");
} catch {
  // GitHub Actions / Vercel provide DATABASE_URL through environment variables.
}

async function main() {
  const { prisma } = await import("../src/lib/db");
  const monthArg = process.argv.find((arg) => arg.startsWith("--month="));
  const month = monthArg?.slice("--month=".length) || "2026-06";
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Invalid --month value: ${month}`);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, -9, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, -9, 0, 0));
  const usernames = PERSONAS.map((persona) => persona.username);
  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true },
  });
  const ids = users.map((user) => user.id);

  if (ids.length === 0) {
    console.log("No PersonaV2 demo users found.");
    await prisma.$disconnect();
    return;
  }

  const scope = { userId: { in: ids }, createdAt: { gte: start, lt: end } };
  const beforePrivate = await prisma.checkIn.count({ where: { ...scope, isPublic: false } });
  const result = await prisma.checkIn.updateMany({
    where: { ...scope, isPublic: false },
    data: { isPublic: true },
  });
  const totalPublic = await prisma.checkIn.count({ where: { ...scope, isPublic: true } });

  console.log(`PersonaV2 demo users: ${users.length}`);
  console.log(`Month: ${month} (Tokyo time)`);
  console.log(`Private demo checkins before update: ${beforePrivate}`);
  console.log(`Published demo checkins: ${result.count}`);
  console.log(`Total public demo checkins in month now: ${totalPublic}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
