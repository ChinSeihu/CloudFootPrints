import Anthropic from "@anthropic-ai/sdk";
import { Prisma, ReactionType, type EventCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  PERSONAS,
  knownAreaSpotInText,
  personaGoals,
  personaInterestList,
  personaOf,
  personaSpots,
  personaVoiceText,
  type PersonaV2,
} from "@/lib/personas";
import { getOrCreateWorldState } from "./world";
import { generateCheckinImage } from "./image";
import type { ImageSpec } from "./decide";

type SocialActionType = "post" | "comment" | "reply" | "react" | "none";

type SocialCandidate = {
  id: string;
  kind: "event" | "post" | "checkin";
  title: string;
  authorUsername?: string | null;
  description?: string | null;
};

type ReplyCandidate = SocialCandidate & {
  commentId: string;
  commentText: string;
  commentAuthorUsername?: string | null;
};

type SocialDecision = {
  action: SocialActionType;
  targetId?: string;
  commentId?: string;
  title?: string;
  text?: string;
  category?: EventCategory;
  signupEnabled?: boolean;
  reaction?: "LIKE" | "FAVORITE" | "SIGNUP";
  memoryText?: string;
};

type SocialPostSpot = { name: string; lat: number; lng: number };

export type SocialResult = {
  posts: number;
  comments: number;
  replies: number;
  reactions: number;
  skipped: boolean;
  notes: string[];
};

const EVENT_CATEGORIES: EventCategory[] = [
  "EXHIBITION",
  "MARKET",
  "LIVE",
  "FESTIVAL",
  "TALK",
  "SPORTS",
  "OTHER",
];

function getApiKey(): string {
  const key = process.env.LLM_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("Missing LLM_API_KEY");
  return key;
}

function getProvider(): "anthropic" | "openai" {
  const p = (process.env.LLM_PROVIDER || "").toLowerCase();
  if (p === "anthropic" || p === "claude") return "anthropic";
  if (p === "deepseek" || p === "openai") return "openai";
  const model = (process.env.LLM_MODEL || "").toLowerCase();
  if (model.startsWith("claude") || (process.env.LLM_API_KEY || "").startsWith("sk-ant-")) {
    return "anthropic";
  }
  return "openai";
}

function safeParse(text: string): unknown {
  let t = text.trim();
  if (t.startsWith("```")) t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function clampText(text: string | undefined, max: number): string {
  return (text ?? "").trim().slice(0, max);
}

function seeded(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayBounds(dateKey: string) {
  return {
    start: new Date(`${dateKey}T00:00:00+09:00`),
    end: new Date(`${dateKey}T23:59:59+09:00`),
  };
}

function dateAt(dateKey: string, hour: number, minute: number): Date {
  return new Date(`${dateKey}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`);
}

function categoryOrDefault(value: unknown): EventCategory {
  return typeof value === "string" && EVENT_CATEGORIES.includes(value as EventCategory)
    ? (value as EventCategory)
    : "OTHER";
}

function normalizeDecision(raw: unknown): SocialDecision {
  if (!raw || typeof raw !== "object") return { action: "none" };
  const o = raw as Record<string, unknown>;
  const action = typeof o.action === "string" ? o.action : "none";
  if (!["post", "comment", "reply", "react", "none"].includes(action)) return { action: "none" };
  const reaction = typeof o.reaction === "string" && ["LIKE", "FAVORITE", "SIGNUP"].includes(o.reaction)
    ? (o.reaction as SocialDecision["reaction"])
    : undefined;
  return {
    action: action as SocialActionType,
    targetId: typeof o.targetId === "string" ? o.targetId : undefined,
    commentId: typeof o.commentId === "string" ? o.commentId : undefined,
    title: clampText(typeof o.title === "string" ? o.title : undefined, 48),
    text: clampText(typeof o.text === "string" ? o.text : undefined, 220),
    category: categoryOrDefault(o.category),
    signupEnabled: o.signupEnabled === true,
    reaction,
    memoryText: clampText(typeof o.memoryText === "string" ? o.memoryText : undefined, 100),
  };
}

function personLine(persona: PersonaV2): string {
  return [
    `${persona.username}, ${persona.age}, ${persona.occupation}`,
    `archetype: ${persona.archetype}`,
    `voice: ${personaVoiceText(persona)}`,
    `interests: ${personaInterestList(persona).join(", ")}`,
    `goals: ${personaGoals(persona).join(", ")}`,
  ].join("\n");
}

function buildPrompt(input: {
  persona: PersonaV2;
  dateKey: string;
  world: Awaited<ReturnType<typeof getOrCreateWorldState>>;
  recentMemories: string[];
  recentOwnPosts: string[];
  candidates: SocialCandidate[];
  replies: ReplyCandidate[];
  preferPost: boolean;
}) {
  const candidates = input.candidates.map((c) => {
    const by = c.authorUsername ? ` by ${c.authorUsername}` : "";
    return `- ${c.kind}:${c.id}${by} | ${c.title}${c.description ? ` | ${c.description.slice(0, 80)}` : ""}`;
  }).join("\n") || "(none)";
  const replies = input.replies.map((c) => {
    const by = c.commentAuthorUsername ? ` by ${c.commentAuthorUsername}` : "";
    return `- ${c.kind}:${c.id} comment:${c.commentId}${by} | ${c.title} | ${c.commentText.slice(0, 80)}`;
  }).join("\n") || "(none)";
  const memories = input.recentMemories.map((m) => `- ${m}`).join("\n") || "(none)";
  const own = input.recentOwnPosts.map((m) => `- ${m}`).join("\n") || "(none)";
  const spotList = personaSpots(input.persona).map((s) => `- ${s.name}`).join("\n") || "(none)";

  return `
You are simulating one Tokyo community account. Produce exactly one small social action for today.

Person:
${personLine(input.persona)}

Date: ${input.dateKey}
World: ${input.world.season}, ${input.world.weather}, ${input.world.cityMood}
Viral topics: ${(input.world.viralTopics as string[]).join(", ")}

Recent memories:
${memories}

Recent public writing by this person:
${own}

Targets for comments/reactions:
${candidates}

Targets for replies:
${replies}

Location candidates for a new post:
${spotList}

Rules:
- Match the person's voice model. Do not use a generic friendly assistant tone.
- If action is "post", create a normal community post, not a footprint/check-in.
- Posts can be casual plans, invitations, small thoughts, questions, or recommendations.
- Comments should be 8-60 Chinese/Japanese-mixed natural characters when possible.
- Replies should be shorter and feel like a real reply in a thread.
- Do not overuse "一起去", "好棒", "下次带我", or motivational endings.
- Avoid system/backend words.
- Prefer action "post" if preferPost is true: ${input.preferPost}.
- If a new post mentions a concrete place or neighborhood, use a name from Location candidates so stored venue/coordinates match the text.
- Do not write about one area while implying the post happened in another area.
- Use only a targetId/commentId shown above.
- Output JSON only.

Schema:
{
  "action": "post" | "comment" | "reply" | "react" | "none",
  "targetId": "id for comment/react/reply target",
  "commentId": "comment id only for reply",
  "title": "required for post, <=24 Chinese chars",
  "text": "post body/comment/reply text",
  "category": "EXHIBITION|MARKET|LIVE|FESTIVAL|TALK|SPORTS|OTHER",
  "signupEnabled": false,
  "reaction": "LIKE|FAVORITE|SIGNUP",
  "memoryText": "optional first-person memory of this social action"
}
`;
}

async function callSocialLLM(input: Parameters<typeof buildPrompt>[0]): Promise<SocialDecision> {
  const prompt = buildPrompt(input);
  const system = "You generate terse JSON for a Japanese/Chinese Tokyo social simulation. Respect persona voice.";

  if (getProvider() === "anthropic") {
    const client = new Anthropic({ apiKey: getApiKey() });
    const res = await client.messages.create({
      model: process.env.LLM_MODEL || "claude-haiku-4-5",
      max_tokens: 500,
      temperature: 0.9,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return normalizeDecision(safeParse(text));
  }

  const baseUrl = (process.env.LLM_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || "deepseek-chat",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.9,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`social LLM ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return normalizeDecision(safeParse(data.choices?.[0]?.message?.content ?? ""));
}

async function loadDemoUsers() {
  const usernames = PERSONAS.map((p) => p.username);
  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true },
  });
  return users;
}

async function loadCandidates(dateKey: string, demoUserIds: string[]): Promise<{
  candidates: SocialCandidate[];
  replies: ReplyCandidate[];
}> {
  const { start, end } = dayBounds(dateKey);
  const since = new Date(start.getTime() - 5 * 86_400_000);
  const [posts, events, checkins, comments] = await Promise.all([
    prisma.post.findMany({
      where: { createdAt: { gte: since, lte: end } },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: { comments: { orderBy: { createdAt: "desc" }, take: 3 }, },
    }),
    prisma.event.findMany({
      where: {
        OR: [
          { startTime: { gte: start, lte: new Date(end.getTime() + 14 * 86_400_000) } },
          { featuredToday: true },
        ],
      },
      orderBy: [{ featuredToday: "desc" }, { startTime: "asc" }],
      take: 12,
    }),
    prisma.checkIn.findMany({
      where: {
        isPublic: true,
        createdAt: { gte: since, lte: end },
      },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: {
        event: { select: { title: true } },
        post: { select: { title: true } },
      },
    }),
    prisma.comment.findMany({
      where: {
        userId: { in: demoUserIds },
        createdAt: { gte: since, lte: end },
        parentId: null,
        OR: [{ postId: { not: null } }, { eventId: { not: null } }, { checkInId: { not: null } }],
      },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
  ]);

  const users = await prisma.user.findMany({
    where: { id: { in: [...new Set(posts.map((p) => p.userId).concat(checkins.map((c) => c.userId), comments.map((c) => c.userId)))] } },
    select: { id: true, username: true },
  });
  const usernameById = new Map(users.map((u) => [u.id, u.username]));

  const candidates: SocialCandidate[] = [
    ...posts.map((p) => ({
      id: p.id,
      kind: "post" as const,
      title: p.title,
      authorUsername: usernameById.get(p.userId) ?? null,
      description: p.description,
    })),
    ...events.map((e) => ({
      id: e.id,
      kind: "event" as const,
      title: e.title,
      authorUsername: null,
      description: e.summary ?? e.description,
    })),
    ...checkins.map((c) => ({
      id: c.id,
      kind: "checkin" as const,
      title: `${usernameById.get(c.userId) ?? "someone"}'s footprint: ${c.event?.title ?? c.post?.title ?? "Tokyo"}`,
      authorUsername: usernameById.get(c.userId) ?? null,
      description: c.note,
    })),
  ];

  const postById = new Map(posts.map((p) => [p.id, p]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  const checkinById = new Map(checkins.map((c) => [c.id, c]));
  const replies: ReplyCandidate[] = comments.flatMap((c) => {
    const post = c.postId ? postById.get(c.postId) : null;
    const event = c.eventId ? eventById.get(c.eventId) : null;
    const checkin = c.checkInId ? checkinById.get(c.checkInId) : null;
    if (!post && !event && !checkin) return [];
    return [{
      id: (post?.id ?? event?.id ?? checkin!.id),
      kind: post ? "post" as const : event ? "event" as const : "checkin" as const,
      title: post?.title ?? event?.title ?? `${usernameById.get(checkin!.userId) ?? "someone"}'s footprint`,
      authorUsername: post ? usernameById.get(post.userId) ?? null : checkin ? usernameById.get(checkin.userId) ?? null : null,
      description: post?.description ?? event?.summary ?? event?.description ?? checkin?.note ?? null,
      commentId: c.id,
      commentText: c.text,
      commentAuthorUsername: usernameById.get(c.userId) ?? null,
    }];
  });

  return { candidates, replies };
}

function targetData(kind: "event" | "post" | "checkin", id: string): { eventId: string } | { postId: string } | { checkInId: string } {
  if (kind === "event") return { eventId: id };
  if (kind === "post") return { postId: id };
  return { checkInId: id };
}

const CATEGORY_LOCATION_KEYWORDS: Record<string, string[]> = {
  EXHIBITION: ["gallery", "museum", "art", "展", "展示", "美術館", "ギャラリー"],
  MARKET: ["market", "shop", "store", "買い物", "市集", "マーケット"],
  LIVE: ["live", "music", "ライブ", "音楽"],
  FESTIVAL: ["festival", "matsuri", "祭", "花火", "まつり"],
  TALK: ["book", "study", "talk", "本", "書店", "学校", "講座"],
  SPORTS: ["sport", "run", "gym", "yoga", "運動", "スポーツ", "ヨガ"],
  OTHER: [],
};

function scoreSpotForPost(
  spot: { name: string; lat: number; lng: number },
  decision: SocialDecision
): number {
  const query = [
    decision.title ?? "",
    decision.text ?? "",
    decision.category ?? "",
  ].join(" ").toLowerCase();
  const name = spot.name.toLowerCase();
  let score = 0;

  if (query.includes(name)) score += 30;
  for (const token of name.split(/[\s、,，/・]+/).filter((x) => x.length >= 2)) {
    if (query.includes(token)) score += 8;
  }

  for (const kw of CATEGORY_LOCATION_KEYWORDS[decision.category ?? "OTHER"] ?? []) {
    if (name.includes(kw.toLowerCase()) || query.includes(kw.toLowerCase())) score += 3;
  }

  return score;
}

/**
 * Signature: `function pickPostSpot(persona: PersonaV2, userId: string, decision: SocialDecision, when: Date): SocialPostSpot`
 * Purpose: Chooses a verified post coordinate, prioritizing a place explicitly mentioned in the generated text and distributing tied candidates deterministically.
 */
function pickPostSpot(persona: PersonaV2, userId: string, decision: SocialDecision, when: Date): SocialPostSpot {
  const spots = personaSpots(persona);
  const fallback = spots[0] ?? { name: "Tokyo", lat: 35.681236, lng: 139.767125 };
  if (!spots.length) return fallback;

  const mentionedArea = knownAreaSpotInText(`${decision.title ?? ""} ${decision.text ?? ""}`);
  if (mentionedArea) return mentionedArea;

  const scored = spots.map((spot) => ({
    spot,
    score: scoreSpotForPost(spot, decision),
  }));
  const bestScore = Math.max(...scored.map((x) => x.score));
  const r = seeded(`${userId}|post-location|${when.toISOString()}|${decision.title ?? ""}`)();
  if (bestScore > 0) {
    const best = scored.filter((x) => x.score === bestScore);
    return best[Math.floor(r * best.length)]?.spot ?? fallback;
  }
  return spots[Math.floor(r * spots.length)] ?? fallback;
}

function shouldGeneratePostImage(persona: PersonaV2, userId: string, decision: SocialDecision, when: Date): boolean {
  const text = `${decision.title ?? ""} ${decision.text ?? ""}`.trim();
  if (text.length < 12) return false;
  if (decision.category === "TALK" && !/[本書店講座展示ギャラリーカフェ散歩街]/.test(text)) return false;
  const base = persona.photoSkill === "pro" ? 0.72 : persona.photoSkill === "hobby" ? 0.58 : 0.42;
  return seeded(`${userId}|post-image|${when.toISOString()}|${decision.title ?? ""}`)() < base;
}

function postImageSpec(persona: PersonaV2, decision: SocialDecision, spot: SocialPostSpot): ImageSpec {
  const title = decision.title?.trim() || "community post";
  const text = decision.text?.trim() || title;
  const protagonist = persona.photoSkill === "pro" || /私|わたし|自分|行った|歩い|寄った|撮/.test(text);

  return {
    summary: `A casual lifestyle image for ${persona.username}'s community post: ${title}`,
    camera: protagonist ? "friend" : "environment",
    subjectVisible: protagonist,
    subjectRole: protagonist ? "protagonist" : "environment",
    action: protagonist
      ? `The protagonist is naturally spending time around ${spot.name}, matching the post about: ${text}`
      : `A natural Tokyo scene around ${spot.name}, matching the post about: ${text}`,
    environment: `${spot.name} in Tokyo. The image should feel like a real photo attached to a casual community post, not an advertisement.`,
    props: ["street details", "small everyday objects", "seasonal atmosphere"].slice(0, 2),
    lighting: "natural available light, realistic smartphone exposure",
    mood: "casual, lived-in, slightly imperfect, social diary feeling",
    avoid: [
      "Do not add unrelated landmarks",
      "Do not show a different neighborhood from the stored venue",
      "Do not make it look like an event poster or commercial campaign",
    ],
  };
}

function findCandidate(id: string | undefined, candidates: SocialCandidate[]) {
  if (!id) return null;
  return candidates.find((c) => c.id === id) ?? null;
}

function findReply(id: string | undefined, commentId: string | undefined, replies: ReplyCandidate[]) {
  if (!id || !commentId) return null;
  return replies.find((c) => c.id === id && c.commentId === commentId) ?? null;
}

async function writePost(
  persona: PersonaV2,
  userId: string,
  decision: SocialDecision,
  when: Date,
  world: Awaited<ReturnType<typeof getOrCreateWorldState>>,
) {
  const spot = pickPostSpot(persona, userId, decision, when);
  const title = decision.title?.trim() || `${persona.username}???`;
  const text = decision.text?.trim();
  if (!text) return null;

  const imageSpec = shouldGeneratePostImage(persona, userId, decision, when)
    ? postImageSpec(persona, decision, spot)
    : null;

  const post = await prisma.post.create({
    data: {
      title,
      description: text,
      category: decision.category ?? "OTHER",
      venueName: spot.name,
      lat: spot.lat,
      lng: spot.lng,
      startTime: when,
      tags: ["demo", "social"],
      signupEnabled: decision.signupEnabled === true,
      userId,
      imageSpec: imageSpec ? (JSON.parse(JSON.stringify(imageSpec)) as Prisma.InputJsonValue) : undefined,
      createdAt: when,
      updatedAt: when,
    },
  });

  if (imageSpec) {
    try {
      const imageUrl = await generateCheckinImage({ persona, imageSpec, world });
      if (imageUrl) {
        await prisma.post.update({
          where: { id: post.id },
          data: { imageUrl, imageUrls: [imageUrl] },
        });
        return { ...post, imageUrl, imageUrls: [imageUrl] };
      }
    } catch {
      // Image generation should never block social text generation.
    }
  }

  return post;
}

async function writeComment(userId: string, target: SocialCandidate, text: string, when: Date) {
  return prisma.comment.create({
    data: {
      ...targetData(target.kind, target.id),
      userId,
      text,
      createdAt: when,
    },
  });
}

async function writeReply(userId: string, target: ReplyCandidate, text: string, when: Date) {
  return prisma.comment.create({
    data: {
      ...targetData(target.kind, target.id),
      userId,
      text,
      parentId: target.commentId,
      createdAt: when,
    },
  });
}

async function writeReaction(userId: string, target: SocialCandidate, reaction: SocialDecision["reaction"]) {
  if (!reaction) return false;
  if (target.kind === "checkin" && reaction !== "LIKE") return false;
  try {
    await prisma.reaction.create({
      data: {
        ...targetData(target.kind, target.id),
        userId,
        type: ReactionType[reaction],
      },
    });
    return true;
  } catch {
    return false;
  }
}

async function writeSocialMemory(userId: string, text: string | undefined, when: Date) {
  const clean = text?.trim();
  if (!clean) return;
  await prisma.memory.create({
    data: {
      userId,
      text: clean,
      type: "RELATIONSHIP",
      importance: 1,
      happenedAt: when,
    },
  });
}

function fallbackPost(persona: PersonaV2): SocialDecision {
  const interests = personaInterestList(persona);
  const topic = interests[0] ?? "散歩";
  return {
    action: "post",
    title: `${topic}メモ`,
    text: `${topic}の予定、そろそろちゃんと決めたい。誰か最近よかった場所ある？`,
    category: "OTHER",
    signupEnabled: false,
    memoryText: `${topic}のことを少し人に聞いてみた。`,
  };
}

async function alreadyRan(dateKey: string, demoUserIds: string[]) {
  const { start, end } = dayBounds(dateKey);
  const [posts, comments] = await Promise.all([
    prisma.post.count({ where: { userId: { in: demoUserIds }, tags: { has: "social" }, createdAt: { gte: start, lte: end } } }),
    prisma.comment.count({ where: { userId: { in: demoUserIds }, createdAt: { gte: start, lte: end } } }),
  ]);
  return posts + comments > 0;
}

export async function simulateSocialDay(dateKey: string, opts: { dry?: boolean; only?: string[] } = {}): Promise<SocialResult> {
  const demoUsers = await loadDemoUsers();
  const userByName = new Map(demoUsers.map((u) => [u.username, u]));
  const demoUserIds = demoUsers.map((u) => u.id);
  if (!demoUserIds.length) return { posts: 0, comments: 0, replies: 0, reactions: 0, skipped: true, notes: [] };
  if (!opts.dry && await alreadyRan(dateKey, demoUserIds)) {
    return { posts: 0, comments: 0, replies: 0, reactions: 0, skipped: true, notes: ["social already exists"] };
  }

  const world = await getOrCreateWorldState(dateKey);
  const { candidates, replies } = await loadCandidates(dateKey, demoUserIds);
  const names = (opts.only?.length ? PERSONAS.filter((p) => opts.only!.includes(p.username)) : PERSONAS)
    .map((p) => p.username);
  const result: SocialResult = { posts: 0, comments: 0, replies: 0, reactions: 0, skipped: false, notes: [] };

  let postCount = 0;
  for (const username of names) {
    const persona = personaOf(username);
    const user = userByName.get(username);
    if (!persona || !user) continue;

    const rnd = seeded(`social|${dateKey}|${username}`);
    const shouldAct = rnd() < Math.max(0.25, Math.min(0.85, 0.35 + persona.socialProfile.socialNeed / 180));
    const needPost = postCount < Math.max(1, Math.ceil(names.length / 5));
    if (!shouldAct && !needPost) continue;

    const [recentMemories, recentOwnPosts] = await Promise.all([
      prisma.memory.findMany({ where: { userId: user.id }, orderBy: { happenedAt: "desc" }, take: 6, select: { text: true } }),
      prisma.post.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 4, select: { title: true, description: true } }),
    ]);
    const when = dateAt(dateKey, 11 + Math.floor(rnd() * 11), Math.floor(rnd() * 60));
    if (opts.dry) {
      const target = candidates.find((c) => c.authorUsername !== username);
      const action = needPost ? fallbackPost(persona) : target ? { action: "comment", text: `would comment on ${target.title}` } : fallbackPost(persona);
      if (needPost) postCount++;
      result.notes.push(`${username}: ${action.action}${"title" in action && action.title ? ` ${action.title}` : ""}${action.text ? ` ${action.text}` : ""}`);
      continue;
    }

    let decision = await callSocialLLM({
      persona,
      dateKey,
      world,
      recentMemories: recentMemories.map((m) => m.text),
      recentOwnPosts: recentOwnPosts.map((p) => `${p.title}: ${p.description ?? ""}`),
      candidates: candidates.filter((c) => c.authorUsername !== username).slice(0, 28),
      replies: replies.filter((r) => r.commentAuthorUsername !== username).slice(0, 18),
      preferPost: needPost,
    });

    if (needPost && decision.action !== "post") decision = fallbackPost(persona);

    if (decision.action === "post") {
      const post = await writePost(persona, user.id, decision, when, world);
      if (post) {
        postCount++;
        result.posts++;
        result.notes.push(`${username} posted: ${post.title}`);
        candidates.unshift({ id: post.id, kind: "post", title: post.title, authorUsername: username, description: post.description });
        await writeSocialMemory(user.id, decision.memoryText ?? `社区里发了一条关于「${post.title}」的动态。`, when);
      }
      continue;
    }

    if (decision.action === "comment") {
      const target = findCandidate(decision.targetId, candidates);
      if (target && decision.text) {
        await writeComment(user.id, target, decision.text, when);
        result.comments++;
        result.notes.push(`${username} commented: ${decision.text}`);
        await writeSocialMemory(user.id, decision.memoryText ?? `回复了${target.title}。`, when);
      }
      continue;
    }

    if (decision.action === "reply") {
      const target = findReply(decision.targetId, decision.commentId, replies);
      if (target && decision.text) {
        await writeReply(user.id, target, decision.text, when);
        result.replies++;
        result.notes.push(`${username} replied: ${decision.text}`);
        await writeSocialMemory(user.id, decision.memoryText ?? `在评论里接了一句话。`, when);
      }
      continue;
    }

    if (decision.action === "react") {
      const target = findCandidate(decision.targetId, candidates);
      if (target && await writeReaction(user.id, target, decision.reaction)) {
        result.reactions++;
        result.notes.push(`${username} reacted: ${decision.reaction}`);
      }
    }
  }

  return result;
}
