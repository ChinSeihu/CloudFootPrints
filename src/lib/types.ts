import type { EventCategory } from "@/lib/categories";

// 用户公开信息（用于显示发帖人 / 评论作者）。
export type UserBrief = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

// 经 JSON 序列化后给前端用的 DTO（日期为 ISO 字符串）。
export type EventDTO = {
  id: string;
  title: string;
  description: string | null;
  summary: string | null; // LLM 一句话摘要（地图标签用）
  category: EventCategory;
  venueName: string | null;
  address: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  lat: number;
  lng: number;
  startTime: string | null;
  endTime: string | null;
  sourceType: string;
  postKind: "LIFE" | "ACTIVITY" | null;
  sourceUrl: string | null;
  trustLevel: number;
  featuredToday?: boolean;
  tags: string[];
  signupEnabled: boolean;
  metrics?: EventMetrics;
  author?: UserBrief | null; // USER 发帖的作者；抓取来源为 null
  createdAt?: string;
  updatedAt?: string;
};

export type EventMetrics = {
  likeCount: number;
  favoriteCount: number;
  signupCount: number;
  clickCount: number;
};

export type CommentDTO = {
  id: string;
  eventId?: string | null;
  postId?: string | null;
  checkInId?: string | null;
  userId: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  author?: UserBrief | null;
};

export type ReplyNoticeDTO = {
  id: string;
  type: "reply" | "post" | "checkin_comment" | "checkin_like";
  targetType: "event" | "checkin";
  text: string;
  author?: UserBrief | null;
  eventId: string;
  eventTitle: string;
  parentText: string | null;
  createdAt: string;
};

export type CheckInDTO = {
  id: string;
  userId: string;
  eventId: string | null;
  postId: string | null;
  lat: number;
  lng: number;
  note: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  rating: number | null;
  moodTags: number[];
  isPublic: boolean;
  isMine?: boolean;
  author?: UserBrief | null;
  metrics?: {
    likeCount: number;
    commentCount: number;
  };
  createdAt: string;
  event?: { id: string; title: string; category: EventCategory } | null;
};

export type DirectMessageUserDTO = UserBrief & {
  signature: string | null;
  status: string | null;
  lastLoginAt: string | null;
  virtual: boolean;
};

export type DirectMessageDTO = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  readAt: string | null;
  createdAt: string;
};

export type DirectConversationDTO = {
  id: string;
  other: DirectMessageUserDTO;
  lastMessage: DirectMessageDTO | null;
  unreadCount: number;
  lastMessageAt: string;
};
