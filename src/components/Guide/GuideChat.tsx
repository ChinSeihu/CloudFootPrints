"use client";

import { useEffect, useRef, useState } from "react";
import { IconSparkles } from "@/components/icons";
import { useGuide, type GuideTopic } from "./GuideContext";
import type { ChatMessage } from "@/lib/llm";

const GENERAL_QUICK = [
  "今天东京有什么值得去的活动？",
  "推荐适合周末的展览或市集",
  "帮我规划一条东京一日游路线",
  "讲讲东京祭典的历史与文化渊源",
];

function topicQuick(t: GuideTopic): string[] {
  const n = t.title;
  switch (t.kind) {
    case "food":
      return [
        `「${n}」的口碑和评价怎么样？`,
        `「${n}」适合什么场合？（约会 / 聚餐 / 一人 / 商务）`,
        `「${n}」必点 / 招牌菜是什么？`,
        `「${n}」人均预算多少？需要预约吗？怎么去？`,
      ];
    case "landmark":
      return [
        `讲讲「${n}」的看点和历史`,
        `「${n}」怎么去？最佳游览时间？`,
        `「${n}」周边还有什么好玩的？`,
      ];
    default: // event
      return [
        `讲讲「${n}」的看点和文化背景`,
        `「${n}」怎么去？给我路线建议`,
        `和「${n}」类似或周边还有什么推荐？`,
      ];
  }
}

// 把活动信息作为上下文前缀注入第一条消息（UI 仍显示用户原话），让 AI 聚焦该活动。
function topicInfo(t: GuideTopic): string {
  const parts = [
    `标题：${t.title}`,
    t.category && `分类：${t.category}`,
    t.venueName && `地点：${t.venueName}`,
    t.startTime &&
      `时间：${new Date(t.startTime).toLocaleString("zh-CN", { timeZone: "Asia/Tokyo" })}`,
    t.description && `资料：${t.description}`,
  ].filter(Boolean);
  const label = t.kind === "food" ? "用户正在查看的餐厅" : t.kind === "landmark" ? "用户正在查看的景点" : "用户正在查看的活动";
  return `【${label}】${parts.join("；")}`;
}

// 全局 AI 导游聊天面板（受 GuideContext 控制）。可带活动话题聚焦对话。
export function GuideChat() {
  const { open, topic, closeGuide } = useGuide();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const topicRef = useRef<GuideTopic | null>(null);
  topicRef.current = topic;

  // 每次打开 / 切换活动话题都开新会话
  useEffect(() => { setMessages([]); setInput(""); }, [open, topic]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  if (!open) return null;

  async function send(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setLoading(true);
    // 第一条带活动上下文（仅发给 API，UI 显示原话）
    const apiMessages = next.map((m, i) =>
      i === 0 && topicRef.current && m.role === "user"
        ? { ...m, content: `${topicInfo(topicRef.current)}\n\n${m.content}` }
        : m,
    );
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      const reply = res.ok ? data.reply : data.error || "出错了";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "网络错误，请稍后再试。" }]);
    } finally {
      setLoading(false);
    }
  }

  const quick = topic ? topicQuick(topic) : GENERAL_QUICK;

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-white">
      <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-black/5">
        <div className="flex items-center gap-2 font-semibold">
          <IconSparkles className="w-5 h-5 text-violet-600" />
          AI 导游
        </div>
        <button
          type="button"
          onClick={closeGuide}
          aria-label="关闭"
          className="w-8 h-8 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm text-neutral-500 leading-relaxed">
            {topic ? (
              <>
                <p className="font-medium text-neutral-700 mb-1">关于「{topic.title}」</p>
                <p>想了解它的看点、历史文化背景，或怎么去、周边推荐？选一个问题开始：</p>
              </>
            ) : (
              <>
                <p className="font-medium text-neutral-700 mb-1">你好，我是你的东京 AI 导游 🗼</p>
                <p>展览、市集、live、祭典——想了解活动信息、历史文化渊源，或要路线与推荐，随时问我：</p>
              </>
            )}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-violet-600 text-white" : "bg-neutral-100 text-neutral-800"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 rounded-2xl px-3.5 py-2.5 text-sm text-neutral-400">
              导游思考中…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="shrink-0 px-4 pb-2 flex flex-col gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="text-left text-sm px-3 py-2 rounded-xl border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div
        className="shrink-0 p-3 border-t border-black/5 flex gap-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
          placeholder="问问东京的活动…"
          className="flex-1 border border-neutral-300 rounded-full px-4 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="px-4 py-2 text-sm rounded-full bg-violet-600 text-white disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  );
}
