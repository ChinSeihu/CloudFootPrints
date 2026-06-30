import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { personaOf } from "@/lib/personas";
import { generateCheckinImage } from "./image";
import { getOrCreateWorldState } from "./world";
import type { ImageCameraType, ImageSpec, ImageSubjectRole } from "./decide";

type RegenResult =
  | { ok: true; imageUrl: string; imageUrls: string[] }
  | { ok: false; error: string };

const CAMERA_TYPES: ImageCameraType[] = [
  "pov",
  "object",
  "mirror",
  "reflection",
  "friend",
  "tripod",
  "timer",
  "back_view",
  "side_view",
  "group",
  "environment",
];

const SUBJECT_ROLES: ImageSubjectRole[] = [
  "protagonist",
  "friends",
  "observed_people",
  "object",
  "environment",
];

function tokyoDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function stringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function parseImageSpec(value: Prisma.JsonValue | null | undefined): ImageSpec | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  const camera = typeof raw.camera === "string" ? raw.camera : "";
  const subjectRole = typeof raw.subjectRole === "string" ? raw.subjectRole : "";
  const action = typeof raw.action === "string" ? raw.action.trim() : "";
  const environment = typeof raw.environment === "string" ? raw.environment.trim() : "";

  if (
    !summary ||
    !CAMERA_TYPES.includes(camera as ImageCameraType) ||
    !SUBJECT_ROLES.includes(subjectRole as ImageSubjectRole) ||
    !action ||
    !environment
  ) {
    return null;
  }

  return {
    summary,
    camera: camera as ImageCameraType,
    subjectVisible: raw.subjectVisible === true,
    subjectRole: subjectRole as ImageSubjectRole,
    action,
    environment,
    outfit: typeof raw.outfit === "string" ? raw.outfit.trim() || undefined : undefined,
    props: stringList(raw.props),
    lighting: typeof raw.lighting === "string" ? raw.lighting.trim() || undefined : undefined,
    mood: typeof raw.mood === "string" ? raw.mood.trim() || undefined : undefined,
    avoid: stringList(raw.avoid),
  };
}

async function personaForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  const persona = user ? personaOf(user.username) : undefined;
  return { user, persona };
}

export async function regenerateCheckinImage(
  checkinId: string,
  userId: string,
): Promise<RegenResult> {
  const { persona } = await personaForUser(userId);
  if (!persona) return { ok: false, error: "仅测试账号支持重新生图" };

  const row = await prisma.checkIn.findUnique({
    where: { id: checkinId },
    select: { id: true, userId: true, createdAt: true, imageSpec: true },
  });

  if (!row) return { ok: false, error: "足迹不存在" };
  if (row.userId !== userId) return { ok: false, error: "无权操作这条足迹" };

  const imageSpec = parseImageSpec(row.imageSpec);
  if (!imageSpec) {
    return { ok: false, error: "这条足迹没有保存图片记忆，无法按原设定重新生图" };
  }

  const world = await getOrCreateWorldState(tokyoDateKey(row.createdAt));
  const imageUrl = await generateCheckinImage({ persona, imageSpec, world });

  if (!imageUrl) {
    return { ok: false, error: "生图失败，请检查图片服务配置" };
  }

  await prisma.checkIn.update({
    where: { id: checkinId },
    data: {
      photoUrl: imageUrl,
      photoUrls: [imageUrl],
    },
  });

  return { ok: true, imageUrl, imageUrls: [imageUrl] };
}

export async function regeneratePostImage(
  postId: string,
  userId: string,
): Promise<RegenResult> {
  const { persona } = await personaForUser(userId);
  if (!persona) return { ok: false, error: "仅测试账号支持重新生图" };

  const row = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, createdAt: true, startTime: true, imageSpec: true },
  });

  if (!row) return { ok: false, error: "发帖不存在" };
  if (row.userId !== userId) return { ok: false, error: "无权操作这条发帖" };

  const imageSpec = parseImageSpec(row.imageSpec);
  if (!imageSpec) {
    return { ok: false, error: "这条发帖没有保存图片记忆，无法按原设定重新生图" };
  }

  const basisDate = row.startTime ?? row.createdAt;
  const world = await getOrCreateWorldState(tokyoDateKey(basisDate));
  const imageUrl = await generateCheckinImage({ persona, imageSpec, world });

  if (!imageUrl) {
    return { ok: false, error: "生图失败，请检查图片服务配置" };
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      imageUrl,
      imageUrls: [imageUrl],
    },
  });

  return { ok: true, imageUrl, imageUrls: [imageUrl] };
}
