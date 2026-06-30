import { prisma } from "@/lib/db";
import { PUBLIC_SELECT, toPublicUser, type PublicUser } from "@/lib/auth";
import { PERSONAS, friendPairs } from "@/lib/personas";

export type FollowStats = {
  followingCount: number;
  followerCount: number;
};

export type FollowListItem = {
  user: PublicUser;
  mutual: boolean;
};

export async function getFollowStats(userId: string): Promise<FollowStats> {
  const [followingCount, followerCount] = await Promise.all([
    prisma.userFollow.count({ where: { followerId: userId } }),
    prisma.userFollow.count({ where: { followingId: userId } }),
  ]);
  return { followingCount, followerCount };
}

export async function getFollowState(viewerId: string, targetId: string) {
  if (viewerId === targetId) return { active: false, mutual: false };
  const [active, back] = await Promise.all([
    prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      select: { id: true },
    }),
    prisma.userFollow.findUnique({
      where: { followerId_followingId: { followerId: targetId, followingId: viewerId } },
      select: { id: true },
    }),
  ]);
  return { active: !!active, mutual: !!active && !!back };
}

export async function listFollows(userId: string, type: "following" | "followers"): Promise<FollowListItem[]> {
  if (type === "following") {
    const rows = await prisma.userFollow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: "desc" },
      include: { following: { select: PUBLIC_SELECT } },
    });
    if (!rows.length) return [];
    const followedBack = new Set(
      (await prisma.userFollow.findMany({
        where: {
          followingId: userId,
          followerId: { in: rows.map((row) => row.followingId) },
        },
        select: { followerId: true },
      })).map((row) => row.followerId),
    );
    return rows.map((row) => ({ user: toPublicUser(row.following), mutual: followedBack.has(row.followingId) }));
  }

  const rows = await prisma.userFollow.findMany({
    where: { followingId: userId },
    orderBy: { createdAt: "desc" },
    include: { follower: { select: PUBLIC_SELECT } },
  });
  if (!rows.length) return [];
  const followingBack = new Set(
    (await prisma.userFollow.findMany({
      where: {
        followerId: userId,
        followingId: { in: rows.map((row) => row.followerId) },
      },
      select: { followingId: true },
    })).map((row) => row.followingId),
  );
  return rows.map((row) => ({ user: toPublicUser(row.follower), mutual: followingBack.has(row.followerId) }));
}

export async function setFollow(followerId: string, followingId: string, active: boolean) {
  if (followerId === followingId) return { active: false };
  if (!active) {
    await prisma.userFollow.deleteMany({ where: { followerId, followingId } });
    return { active: false };
  }
  await prisma.userFollow.upsert({
    where: { followerId_followingId: { followerId, followingId } },
    create: { followerId, followingId },
    update: {},
  });
  return { active: true };
}

export async function ensureDemoMutualFollows(): Promise<number> {
  const users = await prisma.user.findMany({
    where: { username: { in: PERSONAS.map((persona) => persona.username) } },
    select: { id: true, username: true },
  });
  const idOf = new Map(users.map((user) => [user.username, user.id]));
  const data: Array<{ followerId: string; followingId: string }> = [];

  for (const [usernameA, usernameB] of friendPairs()) {
    const idA = idOf.get(usernameA);
    const idB = idOf.get(usernameB);
    if (!idA || !idB || idA === idB) continue;
    data.push({ followerId: idA, followingId: idB }, { followerId: idB, followingId: idA });
  }

  if (!data.length) return 0;
  const result = await prisma.userFollow.createMany({ data, skipDuplicates: true });
  return result.count;
}
