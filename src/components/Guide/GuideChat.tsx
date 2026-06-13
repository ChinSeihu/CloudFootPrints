"use client";

import { useEffect, useRef, useState } from "react";
import { IconSparkles } from "@/components/icons";
import type { ChatMessage } from "@/lib/llm";

// 默认快捷问题：用户点一下即开始对话，降低使用门槛。
const QUICK = [
  "今天东京有什么值得去的活动？",
  "推荐适合周末的展览或市集",
  "帮我规划一条东京一日游路线",
  "讲讲东京祭典的历史与文化渊源",
];

// AI 导游：地图页浮动入口 + 全屏聊天面板。资深导游讲解活动 / 历史文化 / 推荐 / 路线。
export function GuideChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
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

  return (
    <>
      {/* 入口按钮：地图页右侧、天气按钮下方 */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="AI 导游"
        className="absolute top-40 right-3 z-20 h-10 px-3 rounded-full shadow-md flex items-center gap-1.5 text-sm font-medium bg-violet-600 text-white active:scale-95 transition"
      >
        <IconSparkles className="w-5 h-5" />
        AI 导游
      </button>

      {/* 全屏聊天面板 */}
      {open && (
        <div className="fixed inset-0 z-[999] flex flex-col bg-white">
          <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-black/5">
            <div className="flex items-center gap-2 font-semibold">
              <IconSparkles className="w-5 h-5 text-violet-600" />
              AI 导游
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="关闭"
              className="w-8 h-8 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none"
            >
              ×
            </button>
          </div>

          {/* 消息区 */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-sm text-neutral-500 leading-relaxed">
                <p className="font-medium text-neutral-700 mb-1">你好，我是你的东京 AI 导游 🗼</p>
                <p>
                  展览、市集、live、祭典——想了解活动信息、历史文化渊源，或要路线与推荐，随时问我。
                  下面有几个常见问题，点一下就能开始：
                </p>
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

          {/* 默认快捷问题（仅初始显示） */}
          {messages.length === 0 && (
            <div className="shrink-0 px-4 pb-2 flex flex-col gap-2">
              {QUICK.map((q) => (
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

          {/* 输入栏 */}
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
      )}
    </>
  );
}
