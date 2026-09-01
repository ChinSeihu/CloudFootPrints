import "./loadEnv";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { DEMO_USERS } from "../src/lib/demoUsers";
import {
  PERSONAS,
  friendPairs,
  personaGoals,
  personaLifeStageText,
} from "../src/lib/personas";
import { ensureDemoMutualFollows } from "../src/services/follows";

const DEMO_PASSWORD = "demo-pass-1234";

/**
 * Signature: `async function main(): Promise<void>`
 * Purpose: Synchronizes persona identities, including safe legacy-username renames, state snapshots, relationships, and mutual follows.
 */
async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  let created = 0;
  let updated = 0;
  let states = 0;
  let relationships = 0;

  for (const persona of PERSONAS) {
    const demo = DEMO_USERS.find((user) => user.username === persona.username);
    if (!demo) continue;

    const currentUser = await prisma.user.findUnique({
      where: { username: demo.username },
      select: { id: true },
    });
    const legacyUser = currentUser || !persona.legacyUsernames?.length
      ? null
      : await prisma.user.findFirst({
          where: { username: { in: persona.legacyUsernames } },
          select: { id: true },
        });
    const existing = currentUser ?? legacyUser;

    const user = existing
      ? await prisma.user.update({
          where: { id: existing.id },
          data: {
            username: demo.username,
            signature: demo.signature,
            hometown: demo.hometown,
            status: demo.status,
            coverUrl: demo.coverUrl,
            avatarUrl: demo.avatarUrl,
          },
          select: { id: true },
        })
      : await prisma.user.create({
          data: {
            username: demo.username,
            passwordHash,
            signature: demo.signature,
            hometown: demo.hometown,
            status: demo.status,
            coverUrl: demo.coverUrl,
            avatarUrl: demo.avatarUrl,
          },
          select: { id: true },
        });

    if (existing) updated++;
    else created++;

    await prisma.characterState.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        emotion: persona.emotionBaseline,
        goals: personaGoals(persona),
        lifeStage: personaLifeStageText(persona),
      },
      update: {
        emotion: persona.emotionBaseline,
        goals: personaGoals(persona),
        lifeStage: personaLifeStageText(persona),
      },
    });
    states++;
  }

  const users = await prisma.user.findMany({
    where: { username: { in: PERSONAS.map((persona) => persona.username) } },
    select: { id: true, username: true },
  });
  const idOf = new Map(users.map((user) => [user.username, user.id]));

  for (const [usernameA, usernameB] of friendPairs()) {
    const idA = idOf.get(usernameA);
    const idB = idOf.get(usernameB);
    if (!idA || !idB) continue;

    const [aId, bId] = idA < idB ? [idA, idB] : [idB, idA];
    await prisma.relationship.upsert({
      where: { aId_bId: { aId, bId } },
      create: { aId, bId, strength: 15, sentiment: 10 },
      update: {},
    });
    relationships++;
  }

  const follows = await ensureDemoMutualFollows();

  console.log(
    `PersonaV2 demo users synced: ${created} created, ${updated} updated, ${states} character states, ${relationships} relationships, ${follows} new mutual follows.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
