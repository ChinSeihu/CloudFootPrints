import { PERSONAS } from "../src/lib/personas";

try {
  process.loadEnvFile(".env");
} catch {
  // GitHub Actions / Vercel provide DATABASE_URL through environment variables.
}

async function main() {
  const { prisma } = await import("../src/lib/db");
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

  const beforePrivate = await prisma.checkIn.count({ where: { userId: { in: ids }, isPublic: false } });
  const result = await prisma.checkIn.updateMany({
    where: { userId: { in: ids }, isPublic: false },
    data: { isPublic: true },
  });
  const totalPublic = await prisma.checkIn.count({ where: { userId: { in: ids }, isPublic: true } });

  console.log(`PersonaV2 demo users: ${users.length}`);
  console.log(`Private demo checkins before update: ${beforePrivate}`);
  console.log(`Published demo checkins: ${result.count}`);
  console.log(`Total public demo checkins now: ${totalPublic}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
