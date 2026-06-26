"use client";

import { useEffect, useRef, useState } from "react";
import { IconSparkles, IconPin } from "@/components/icons";
import { useGuide, type GuideTopic } from "./GuideContext";
import { EventDetail } from "@/components/Recommend/EventDetail";
import type { ChatMessage } from "@/lib/llm";
import type { EventDTO } from "@/lib/types";

// 导游回答里提到的活动（可点击进入详情）。
type GuideEventLink = { id: string; title: string };
// 聊天消息 + AI 推测的后续问题建议 + 提到的活动（仅 assistant 消息带）。
type UIMessage = ChatMessage & { suggestions?: string[]; events?: GuideEventLink[] };

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
    case "station":
      return [
        `从「${n}」怎么换乘去主要景点？`,
        `「${n}」周边有什么好吃好玩的？`,
        `「${n}」附近近期有什么活动？`,
      ];
    case "route":
      return [
        "帮我规划附近 2-3 小时游玩路线",
        "按轻松散步节奏推荐几个顺路点",
        "如果我想拍照和休息，怎么安排更舒服？",
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
  const label = t.kind === "food" ? "用户正在查看的餐厅" : t.kind === "landmark" ? "用户正在查看的景点" : t.kind === "station" ? "用户正在查看的车站" : t.kind === "route" ? "用户正在地图上查看的附近活动" : "用户正在查看的活动";
  return `【${label}】${parts.join("；")}`;
}

// 全局 AI 导游聊天面板（受 GuideContext 控制）。可带活动话题聚焦对话。
export function GuideChat() {
  const { open, topic, closeGuide } = useGuide();
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<EventDTO | null>(null); // 点击导游提到的活动 → 打开详情
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
    const next: UIMessage[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setLoading(true);
    // 第一条带活动上下文（仅发给 API，UI 显示原话）；只发 role/content，不带 suggestions。
    const apiMessages = next.map((m, i) =>
      i === 0 && topicRef.current && m.role === "user"
        ? { role: m.role, content: `${topicInfo(topicRef.current)}\n\n${m.content}` }
        : { role: m.role, content: m.content },
    );
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: (typeof data.reply === "string" && data.reply.trim()) || "抱歉，刚才没答上来，请再问一次或换个问法。",
            suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
            events: Array.isArray(data.events) ? data.events : [],
          },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", content: data.error || "出错了" }]);
      }
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "网络错误，请稍后再试。" }]);
    } finally {
      setLoading(false);
    }
  }

  // 点击导游提到的活动 → 拉取详情并打开 EventDetail（叠在聊天面板之上）。
  async function openEventDetail(id: string) {
    try {
      const d = await fetch(`/api/events/${id}`).then((r) => (r.ok ? r.json() : null));
      if (d?.event) setDetail(d.event);
    } catch { /* 忽略 */ }
  }

  const quick = topic ? topicQuick(topic) : GENERAL_QUICK;
  // 最新一条 assistant 回复附带的「后续问题」建议（推测用户意图，≥3 个）
  const last = messages[messages.length - 1];
  const lastSuggestions = last?.role === "assistant" ? last.suggestions ?? [] : [];

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
                <p>{topic.kind === "route" ? "我已经看到你当前位置附近的活动，可以帮你按距离、节奏和兴趣串成一条游玩路线。" : "想了解它的看点、历史文化背景，或怎么去、周边推荐？选一个问题开始："}</p>
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
          <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-violet-600 text-white" : "bg-neutral-100 text-neutral-800"
              }`}
            >
              {m.content}
            </div>
            {/* 导游提到的活动：可点击进入详情 */}
            {m.role === "assistant" && m.events && m.events.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5 max-w-[85%]">
                {m.events.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => openEventDetail(ev.id)}
                    className="inline-flex items-center gap-1.5 text-left text-sm px-3 py-2 rounded-xl border border-violet-200 bg-white text-violet-700 hover:bg-violet-50 transition"
                  >
                    <IconPin className="w-3.5 h-3.5 shrink-0 text-violet-500" />
                    <span className="truncate">{ev.title}</span>
                    <span className="ml-auto shrink-0 text-violet-400 text-xs">详情 ›</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-100 rounded-2xl px-3.5 py-2.5 text-sm text-neutral-400">
              导游思考中…
            </div>
          </div>
        )}
        {/* 每次回答后，展示 AI 推测用户意图给出的后续问题，点击即追问 */}
        {!loading && lastSuggestions.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-neutral-400 px-1">猜你接下来想问 · 点选继续</p>
            {lastSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="text-left text-sm px-3 py-2 rounded-xl border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="shrink-0 px-4 pb-2 flex flex-col gap-2">
          {topic?.kind === "route" && topic.routePrompt && (
            <button
              type="button"
              onClick={() => send(topic.routePrompt ?? "")}
              className="text-left rounded-2xl border border-violet-200 bg-violet-600 px-3.5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(124,58,237,0.22)]"
            >
              <span className="block">AI 规划附近游玩路线</span>
              <span className="mt-1 block text-xs font-normal text-white/75">根据附近活动，给我一条顺路、有节奏的 City Walk</span>
            </button>
          )}
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

      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
