"use client";

import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";

import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/common/Avatar";
import { IconChevronLeft } from "@/components/icons";
import type { DirectConversationDTO, DirectMessageDTO, DirectMessageUserDTO } from "@/lib/types";

function chatTime(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}

function uniqueMessages(messages: DirectMessageDTO[]) {
  return [...new Map(messages.map((message) => [message.id, message])).values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/**
 * Signature: `function DirectMessages(props: { currentUserId: string; initialConversations: DirectConversationDTO[]; initialTargetId: string | null; openNonce: number; onUnreadChange: (count: number) => void; onClose?: () => void }): React.JSX.Element`
 * Purpose: Displays conversation loading with a letter animation while keeping background refresh quiet.
 */
export function DirectMessages({
  currentUserId,
  initialConversations,
  initialTargetId,
  openNonce,
  onUnreadChange,
  onClose,
}: {
  currentUserId: string;
  initialConversations: DirectConversationDTO[];
  initialTargetId: string | null;
  openNonce: number;
  onUnreadChange: (count: number) => void;
  onClose?: () => void;
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [active, setActive] = useState<{ id: string; other: DirectMessageUserDTO } | null>(null);
  const [messages, setMessages] = useState<DirectMessageDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(() => conversations.reduce((sum, item) => sum + item.unreadCount, 0), [conversations]);
  useEffect(() => onUnreadChange(unreadCount), [onUnreadChange, unreadCount]);

  async function refreshConversations() {
    const res = await fetch("/api/messages");
    if (!res.ok) return;
    const data = (await res.json()) as { conversations?: DirectConversationDTO[] };
    setConversations(data.conversations ?? []);
  }

  async function loadConversation(conversation: { id: string; other: DirectMessageUserDTO }, quiet = false) {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/messages/${conversation.id}`);
      if (!res.ok) throw new Error("load failed");
      const data = (await res.json()) as { messages?: DirectMessageDTO[]; other?: DirectMessageUserDTO };
      setMessages(data.messages ?? []);
      if (data.other) setActive({ id: conversation.id, other: data.other });
      await fetch(`/api/messages/${conversation.id}`, { method: "PATCH" });
      setConversations((current) => current.map((item) => item.id === conversation.id ? { ...item, unreadCount: 0 } : item));
    } catch {
      if (!quiet) setError("暂时无法加载这段对话");
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  useEffect(() => {
    if (!initialTargetId) return;
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: initialTargetId }),
      });
      const data = (await res.json().catch(() => ({}))) as { conversationId?: string; other?: DirectMessageUserDTO };
      if (res.ok && data.conversationId && data.other) {
        const conversation = { id: data.conversationId, other: data.other };
        setActive(conversation);
        await loadConversation(conversation, true);
        await refreshConversations();
      } else {
        setError("无法发起私信");
      }
      setLoading(false);
    })();
  }, [initialTargetId, openNonce]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void loadConversation(active, true), 3000);
    return () => window.clearInterval(timer);
  }, [active]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send() {
    const text = draft.trim();
    if (!active || !text || sending) return;
    const optimistic: DirectMessageDTO = {
      id: `pending-${Date.now()}`,
      conversationId: active.id,
      senderId: currentUserId,
      text,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setDraft("");
    setError(null);
    setSending(true);
    setMessages((current) => [...current, optimistic]);
    try {
      const res = await fetch(`/api/messages/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: DirectMessageDTO; reply?: DirectMessageDTO; error?: string };
      if (!res.ok || !data.message) throw new Error(data.error || "发送失败");
      setMessages((current) => uniqueMessages([
        ...current.filter((message) => message.id !== optimistic.id),
        data.message!,
        ...(data.reply ? [data.reply] : []),
      ]));
      await refreshConversations();
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id));
      setDraft(text);
      setError(sendError instanceof Error ? sendError.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  if (active) {
    return (
      <section className="fixed inset-0 z-[90] flex flex-col bg-neutral-50">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-100 bg-white/95 px-3 py-2.5 backdrop-blur">
          <button type="button" onClick={() => { if (onClose) onClose(); else { setActive(null); setMessages([]); void refreshConversations(); } }} aria-label={onClose ? "关闭私聊" : "返回会话列表"} className="grid size-8 shrink-0 place-items-center text-neutral-600">
            <IconChevronLeft className="size-5" />
          </button>
          <Avatar user={active.other} size={36} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-neutral-950">{active.other.username}</h3>
            <p className="truncate text-[11px] text-neutral-400">{active.other.status || active.other.signature || "东京生活中"}</p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-neutral-50/70 px-3 py-4">
          {loading && <LoadingFeedback compact scene="message" text="打开信件，看看你们聊到了哪里…" />}
          {!loading && messages.length === 0 && <p className="m-auto text-center text-xs text-neutral-400">打个招呼，开始你们的对话。</p>}
          <div className="mt-auto space-y-3">
            {messages.map((message) => {
              const mine = message.senderId === currentUserId;
              return (
                <div key={message.id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                  {!mine && <Avatar user={active.other} size={26} />}
                  <div className={`max-w-[78%] ${mine ? "text-right" : "text-left"}`}>
                    <div className={`inline-block rounded-lg px-3 py-2 text-left text-[13px] leading-5 shadow-sm ${mine ? "bg-blue-600 text-white" : "bg-white text-neutral-800 ring-1 ring-black/5"}`}>
                      {message.text}
                    </div>
                    <p className="mt-1 px-1 text-[9px] text-neutral-300">{chatTime(message.createdAt)}</p>
                  </div>
                </div>
              );
            })}
            {sending && active.other.virtual && (
              <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                <Avatar user={active.other} size={26} />
                <span className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">正在输入...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-neutral-100 bg-white px-3 py-3">
          {error && <p className="mb-2 text-xs text-rose-500">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={1} maxLength={1000} placeholder="输入消息" className="max-h-28 min-h-10 min-w-0 flex-1 resize-none rounded-lg bg-neutral-100 px-3 py-2.5 text-[13px] outline-none focus:ring-2 focus:ring-blue-100" />
            <button type="button" onClick={() => void send()} disabled={!draft.trim() || sending} className="h-10 shrink-0 rounded-lg bg-blue-600 px-4 text-xs font-bold text-white disabled:opacity-40">发送</button>
          </div>
        </div>
      </section>
    );
  }

  if (initialTargetId && onClose) {
    return (
      <section className="fixed inset-0 z-[90] flex flex-col bg-neutral-50">
        <header className="flex items-center gap-3 border-b border-neutral-100 bg-white px-3 py-2.5">
          <button type="button" onClick={onClose} aria-label="关闭私聊" className="grid size-8 shrink-0 place-items-center text-neutral-600">
            <IconChevronLeft className="size-5" />
          </button>
          <h3 className="text-sm font-bold text-neutral-950">私信</h3>
        </header>
        <div className="grid flex-1 place-items-center px-6 text-center text-xs text-neutral-400">
          <p>{error || "正在打开对话..."}</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      {error && <p className="mb-3 text-xs text-rose-500">{error}</p>}
      {conversations.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-neutral-700">还没有私信</p>
          <p className="mt-1 text-xs text-neutral-400">可以从用户帖子或关注列表发起对话。</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {conversations.map((conversation) => (
            <li key={conversation.id}>
              <button type="button" onClick={() => { const next = { id: conversation.id, other: conversation.other }; setActive(next); void loadConversation(next); }} className="flex w-full items-center gap-3 py-3 text-left">
                <div className="relative shrink-0">
                  <Avatar user={conversation.other} size={46} />
                  {conversation.other.virtual && <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-white bg-emerald-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-neutral-900">{conversation.other.username}</h3>
                    <time className="ml-auto shrink-0 text-[10px] text-neutral-300">{chatTime(conversation.lastMessageAt)}</time>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <p className={`truncate text-xs ${conversation.unreadCount ? "font-semibold text-neutral-700" : "text-neutral-400"}`}>{conversation.lastMessage?.text || "新会话"}</p>
                    {conversation.unreadCount > 0 && <span className="ml-auto grid min-w-5 shrink-0 place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{Math.min(99, conversation.unreadCount)}</span>}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
