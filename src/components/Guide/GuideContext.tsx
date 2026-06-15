"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// 一个话题：从活动详情 / 名胜 / 美食 带进 AI 导游，让对话聚焦。
// kind 决定快捷问题的方向（活动 / 景区 / 餐厅）。
export type GuideKind = "event" | "landmark" | "food";

export type GuideTopic = {
  title: string;
  kind?: GuideKind; // 默认 event
  category?: string;
  venueName?: string | null;
  startTime?: string | null;
  description?: string | null;
};

type GuideContextValue = {
  open: boolean;
  topic: GuideTopic | null;
  openGuide: (topic?: GuideTopic | null) => void;
  closeGuide: () => void;
};

const GuideContext = createContext<GuideContextValue | null>(null);

export function useGuide(): GuideContextValue {
  const ctx = useContext(GuideContext);
  if (!ctx) throw new Error("useGuide 必须在 GuideProvider 内使用");
  return ctx;
}

// 全局 Provider（在 layout 包裹），让任何页面/组件都能打开 AI 导游并带上活动话题。
export function GuideProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<GuideTopic | null>(null);
  return (
    <GuideContext.Provider
      value={{
        open,
        topic,
        openGuide: (t = null) => {
          setTopic(t ?? null);
          setOpen(true);
        },
        closeGuide: () => setOpen(false),
      }}
    >
      {children}
    </GuideContext.Provider>
  );
}
