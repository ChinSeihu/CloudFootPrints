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
  sourceUrl: string | null;
  trustLevel: number;
  tags: string[];
  signupEnabled: boolean;
  author?: UserBrief | null; // USER 发帖的作者；抓取来源为 null
};

export type CommentDTO = {
  id: string;
  eventId: string;
  userId: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  author?: UserBrief | null;
};

export type ReplyNoticeDTO = {
  id: string;
  type: "reply" | "post";
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
  lat: number;
  lng: number;
  note: string | null;
  photoUrl: string | null;
  photoUrls: string[];
  rating: number | null;
  createdAt: string;
  event?: { id: string; title: string; category: EventCategory } | null;
};
