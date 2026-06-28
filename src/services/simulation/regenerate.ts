import { prisma } from "@/lib/db";
import { personaOf } from "@/lib/personas";
import { generateCheckinImage } from "./image";
import { getOrCreateWorldState } from "./world";
import { ImageSpec } from "./decide"

type RegenResult =
  | { ok: true; imageUrl: string; imageUrls: string[] }
  | { ok: false; error: string };

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

function photoDescForCheckin(row: {
  note: string | null;
  event: { title: string; venueName: string | null; category: string } | null;
  post: { title: string; venueName: string | null; category: string } | null;
  createdAt: Date;
}): string {
  const target = row.event ?? row.post;
  const where = target?.venueName ? ` at ${target.venueName}` : "";
  const title = target?.title ? `related to "${target.title}"` : "a Tokyo outing";
  return [row.note, `A lifestyle footprint photo ${title}${where}.`].filter(Boolean).join(" ");
}

function photoDescForPost(row: {
  title: string;
  description: string | null;
  venueName: string | null;
  category: string;
}): string {
  const where = row.venueName ? ` at ${row.venueName}` : "";
  return [row.description, `A stylish event post cover photo for "${row.title}"${where}.`].filter(Boolean).join(" ");
}

async function personaForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
  const persona = user ? personaOf(user.username) : undefined;
  return { user, persona };
}

export async function regenerateCheckinImage(
  checkinId: string,
  userId: string
): Promise<RegenResult> {
  const { persona } = await personaForUser(userId);
  if (!persona) return { ok: false, error: "仅测试账号支持重新生图" };

  const row = await prisma.checkIn.findUnique({
    where: { id: checkinId },
    include: {
      event: { select: { title: true, venueName: true, category: true } },
      post: { select: { title: true, venueName: true, category: true } },
    },
  });

  if (!row) return { ok: false, error: "足迹不存在" };
  if (row.userId !== userId) return { ok: false, error: "无权操作这条足迹" };

  const world = await getOrCreateWorldState(tokyoDateKey(row.createdAt));

  const imageSpec = imageSpecForCheckin(row);

  const imageUrl = await generateCheckinImage({
    persona,
    imageSpec,
    world,
  });

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

  return {
    ok: true,
    imageUrl,
    imageUrls: [imageUrl],
  };
}

function imageSpecForCheckin(row: {
  note: string | null;
  event?: { title: string | null; venueName: string | null; category: string | null } | null;
  post?: { title: string | null; venueName: string | null; category: string | null } | null;
}): ImageSpec {
  const title =
    row.event?.title ||
    row.post?.title ||
    row.event?.venueName ||
    row.post?.venueName ||
    "东京日常生活瞬间";

  const venue =
    row.event?.venueName ||
    row.post?.venueName ||
    "东京街头或店内";

  const category =
    row.event?.category ||
    row.post?.category ||
    "daily_life";

  const note = row.note?.trim() || "";

  const lower = `${title} ${venue} ${category} ${note}`.toLowerCase();

  if (
    lower.includes("甜品") ||
    lower.includes("dessert") ||
    lower.includes("cake") ||
    lower.includes("草莓") ||
    lower.includes("パフェ") ||
    lower.includes("スイーツ")
  ) {
    return {
      summary: `${venue} 的甜品和饮品桌面照`,
      camera: "object",
      subjectVisible: false,
      subjectRole: "object",
      action: "桌上摆着甜品、饮品、小票或餐具，背景是店内空间",
      environment: `${venue}，东京的甜品店或咖啡店`,
      props: ["甜品", "饮品", "餐具"],
      lighting: "自然窗光或柔和店内光",
      mood: "轻松、精致、日常",
      avoid: ["不要出现多余的手", "不要出现拍照动作"],
    };
  }

  if (
    lower.includes("咖啡") ||
    lower.includes("coffee") ||
    lower.includes("cafe") ||
    lower.includes("カフェ")
  ) {
    return {
      summary: `${venue} 的咖啡店日常照片`,
      camera: "object",
      subjectVisible: false,
      subjectRole: "object",
      action: "桌上放着咖啡杯、随身物品或菜单，窗外街景虚化",
      environment: `${venue}，东京的咖啡店窗边或吧台`,
      props: ["咖啡", "菜单", "随身物品"],
      lighting: "自然光",
      mood: "安静、生活感",
      avoid: ["不要出现多余的手", "不要出现拍照动作"],
    };
  }

  if (
    lower.includes("live") ||
    lower.includes("ライブ") ||
    lower.includes("演出") ||
    lower.includes("音乐") ||
    lower.includes("唱片")
  ) {
    return {
      summary: `${venue} 的 Live House 或音乐现场`,
      camera: "environment",
      subjectVisible: false,
      subjectRole: "environment",
      action: "舞台灯光、观众背影、音箱或唱片架构成画面",
      environment: `${venue}，东京的 Live House、唱片店或音乐空间`,
      props: ["舞台灯", "音箱", "唱片"],
      lighting: "昏暗室内光和舞台灯",
      mood: "有现场感、略微嘈杂",
      avoid: ["不要出现夸张舞台海报感", "不要出现文字水印"],
    };
  }

  if (
    lower.includes("公园") ||
    lower.includes("park") ||
    lower.includes("散步") ||
    lower.includes("walk") ||
    lower.includes("川") ||
    lower.includes("海")
  ) {
    return {
      summary: `${venue} 的散步视角`,
      camera: "environment",
      subjectVisible: false,
      subjectRole: "environment",
      action: "街道、树影、水边或行人背影构成日常画面",
      environment: `${venue}，东京或近郊的户外空间`,
      props: ["街景", "树影", "水边"],
      lighting: "自然光",
      mood: "轻松、普通、生活感",
      avoid: ["不要旅游宣传片感", "不要航拍"],
    };
  }

  if (
    lower.includes("狗") ||
    lower.includes("モカ") ||
    lower.includes("pet") ||
    lower.includes("犬")
  ) {
    return {
      summary: "豆柴モカ的日常照片",
      camera: "friend",
      subjectVisible: false,
      subjectRole: "object",
      action: "豆柴モカ在散步、看海、趴在椅子下或靠近主人的脚边",
      environment: `${venue}，宠物友好的东京日常场景`,
      props: ["豆柴", "牵引绳", "随身包"],
      lighting: "自然光",
      mood: "可爱、轻松、生活感",
      avoid: ["不要拟人化", "不要出现多余的手"],
    };
  }

  return {
    summary: title,
    camera: "environment",
    subjectVisible: false,
    subjectRole: "environment",
    action: note || "记录东京日常里的一个普通瞬间",
    environment: venue,
    props: [],
    lighting: "自然光或真实环境光",
    mood: "普通、自然、生活感",
    avoid: ["不要出现拍摄过程", "不要文字", "不要水印"],
  };
}

export async function regeneratePostImage(
  postId: string,
  userId: string
): Promise<RegenResult> {
  const { persona } = await personaForUser(userId);
  if (!persona) return { ok: false, error: "仅测试账号支持重新生图" };

  const row = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!row) return { ok: false, error: "发帖不存在" };
  if (row.userId !== userId) return { ok: false, error: "无权操作这条发帖" };

  const basisDate = row.startTime ?? row.createdAt;
  const world = await getOrCreateWorldState(tokyoDateKey(basisDate));

  const imageSpec = imageSpecForPost(row);

  const imageUrl = await generateCheckinImage({
    persona,
    imageSpec,
    world,
  });

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

  return {
    ok: true,
    imageUrl,
    imageUrls: [imageUrl],
  };
}

function imageSpecForPost(row: {
  title: string | null;
  body?: string | null;
  content?: string | null;
  venueName: string | null;
  category: string | null;
  startTime?: Date | null;
  createdAt: Date;
}): ImageSpec {
  const title = row.title?.trim() || "东京活动分享";
  const venue = row.venueName?.trim() || "东京";
  const category = row.category?.trim() || "daily_life";
  const text = `${title} ${row.body ?? ""} ${row.content ?? ""} ${venue} ${category}`.toLowerCase();

  if (
    text.includes("甜品") ||
    text.includes("dessert") ||
    text.includes("cake") ||
    text.includes("草莓") ||
    text.includes("スイーツ") ||
    text.includes("パフェ")
  ) {
    return {
      summary: `${venue} 的甜品活动封面`,
      camera: "object",
      subjectVisible: false,
      subjectRole: "object",
      action: "桌上摆着精致甜品、饮品、小票或餐具，背景是店内空间",
      environment: `${venue}，东京甜品店或咖啡店`,
      props: ["甜品", "饮品", "餐具"],
      lighting: "自然窗光或柔和店内光",
      mood: "精致、轻松、适合社交媒体封面",
      avoid: ["不要出现多余的手", "不要出现拍照动作", "不要文字水印"],
    };
  }

  if (
    text.includes("live") ||
    text.includes("ライブ") ||
    text.includes("音乐") ||
    text.includes("演出") ||
    text.includes("唱片")
  ) {
    return {
      summary: `${venue} 的音乐现场封面`,
      camera: "environment",
      subjectVisible: false,
      subjectRole: "environment",
      action: "舞台灯光、观众背影、音箱或唱片架形成画面",
      environment: `${venue}，东京 Live House、唱片店或音乐空间`,
      props: ["舞台灯", "音箱", "唱片"],
      lighting: "昏暗室内光和舞台灯",
      mood: "有现场感、年轻、稍微嘈杂",
      avoid: ["不要出现夸张海报感", "不要文字水印", "不要过度商业摄影"],
    };
  }

  if (
    text.includes("画廊") ||
    text.includes("gallery") ||
    text.includes("展") ||
    text.includes("美术館") ||
    text.includes("ギャラリー")
  ) {
    return {
      summary: `${venue} 的展览或画廊封面`,
      camera: "environment",
      subjectVisible: false,
      subjectRole: "environment",
      action: "白墙、画作、展览空间和少量观众背影构成安静画面",
      environment: `${venue}，东京画廊或展览空间`,
      props: ["画作", "展览空间", "展签"],
      lighting: "柔和室内展厅光",
      mood: "安静、知性、有设计感",
      avoid: ["不要出现可读文字", "不要出现商业广告感"],
    };
  }

  if (
    text.includes("公园") ||
    text.includes("park") ||
    text.includes("散步") ||
    text.includes("walk") ||
    text.includes("川") ||
    text.includes("海")
  ) {
    return {
      summary: `${venue} 的户外活动封面`,
      camera: "environment",
      subjectVisible: false,
      subjectRole: "environment",
      action: "街道、树影、水边、天空或行人背影构成自然生活画面",
      environment: `${venue}，东京或近郊的户外空间`,
      props: ["街景", "树影", "水边"],
      lighting: "自然光",
      mood: "轻松、开放、真实生活感",
      avoid: ["不要旅游宣传片感", "不要航拍", "不要文字水印"],
    };
  }

  if (
    text.includes("咖啡") ||
    text.includes("coffee") ||
    text.includes("cafe") ||
    text.includes("カフェ")
  ) {
    return {
      summary: `${venue} 的咖啡活动封面`,
      camera: "object",
      subjectVisible: false,
      subjectRole: "object",
      action: "桌上放着咖啡杯、菜单、随身物品，窗外街景虚化",
      environment: `${venue}，东京咖啡店窗边或吧台`,
      props: ["咖啡", "菜单", "随身物品"],
      lighting: "自然光",
      mood: "安静、日常、有生活方式感",
      avoid: ["不要出现多余的手", "不要出现拍照动作", "不要文字水印"],
    };
  }

  return {
    summary: `${venue} 的东京活动封面：${title}`,
    camera: "environment",
    subjectVisible: false,
    subjectRole: "environment",
    action: "记录活动场地、街景、店内空间或现场氛围",
    environment: venue,
    props: [],
    lighting: "自然光或真实环境光",
    mood: "真实、自然、适合活动封面",
    avoid: ["不要出现拍摄过程", "不要文字", "不要水印", "不要商业广告感"],
  };
}