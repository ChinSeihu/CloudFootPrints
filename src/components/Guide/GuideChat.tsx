"use client";

import { readSSE } from "@/lib/guideStream";

import { useEffect, useRef, useState } from "react";
import { IconSparkles, IconPin } from "@/components/icons";
import { useGuide, type GuideTopic } from "./GuideContext";
import { EventDetail } from "@/components/Recommend/EventDetail";
import { MASCOT_OPTIONS, MascotNavIcon, useMascotIdentity } from "@/components/Mascot/Mascot";
import { LoadingFeedback } from "@/components/Mascot/LoadingFeedback";
import { MascotAnimation } from "@/components/Mascot/MascotFeedback";
import { useAuth } from "@/components/Auth/AuthContext";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useGuideHistory, type GuideMessage as UIMessage } from "./useGuideHistory";
import type { GuideRoutePlan } from "@/lib/guideRoute";
import type { EventDTO } from "@/lib/types";
import { useLanguage, type TranslationKey } from "@/components/I18n/LanguageProvider";

// 导游回答里提到的活动（可点击进入详情）。
type GuideEventLink = { id: string; title: string };
// 聊天消息 + AI 推测的后续问题建议 + 提到的活动（仅 assistant 消息带）。


type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

/**
 * Signature: `function visibleMessageContent(message: UIMessage): string`
 * Purpose: Hides candidate lists from route prompts already stored by older clients while preserving them as model context.
 */
function visibleMessageContent(message: UIMessage): string {
  if (message.role !== "user") return message.content;
  const candidateListAt = message.content.indexOf("\n\n附近活动：");
  return candidateListAt >= 0 ? message.content.slice(0, candidateListAt).trim() : message.content;
}

function topicQuick(topic: GuideTopic, t: Translate): string[] {
  const values = { name: topic.title };
  switch (topic.kind) {
    case "food":
      return [t("guide.quick.foodReviews", values), t("guide.quick.foodOccasion", values), t("guide.quick.foodSignature", values), t("guide.quick.foodBudget", values)];
    case "landmark":
      return [t("guide.quick.landmarkHighlights", values), t("guide.quick.landmarkAccess", values), t("guide.quick.landmarkNearby", values)];
    case "station":
      return [t("guide.quick.stationTransfer", values), t("guide.quick.stationNearby", values), t("guide.quick.stationEvents", values)];
    case "route":
      return [t("guide.quick.routeHours"), t("guide.quick.routeRelaxed"), t("guide.quick.routePhoto")];
    default: // event
      return [t("guide.quick.eventHighlights", values), t("guide.quick.eventAccess", values), t("guide.quick.eventSimilar", values)];
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

function RoutePlanCard({ plan, onOpen }: { plan: GuideRoutePlan; onOpen: (id: string) => void }) {
  const { t } = useLanguage();
  return (
    <div className="mt-2 w-[min(24rem,85vw)] overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="relative h-20 bg-[linear-gradient(135deg,#eef2ff,#f5f3ff)]">
        <div className="absolute left-7 right-7 top-1/2 h-0.5 -translate-y-1/2 border-t-2 border-dashed border-violet-300" />
        {plan.stops.map((stop, index) => (
          <button
            key={stop.id}
            type="button"
            onClick={() => onOpen(stop.id)}
            className="absolute top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-violet-600 text-[11px] font-black text-white shadow-md"
            style={{ left: `${8 + (index * 84) / Math.max(1, plan.stops.length - 1)}%` }}
          >
            {index + 1}
          </button>
        ))}
      </div>
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-violet-100 text-violet-600">
            <IconSparkles className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black text-neutral-950">{plan.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">{plan.summary}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2 text-[11px] font-semibold text-neutral-500">
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-600">{plan.mood}</span>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1">{t("guide.routeMinutes", { count: plan.totalMinutes })}</span>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1">{plan.walkKm}km</span>
        </div>
        <ol className="mt-3 space-y-3">
          {plan.stops.map((stop, index) => (
            <li key={stop.id} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 text-[11px] font-black text-white">{index + 1}</span>
              <button type="button" onClick={() => onOpen(stop.id)} className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-bold text-neutral-900">{stop.title}</div>
                <div className="mt-0.5 text-xs text-neutral-500">{stop.venueName ?? t("guide.nearbyPlace")} · {t("guide.stayMinutes", { count: stop.stayMinutes })}</div>
                <div className="mt-1 text-xs leading-relaxed text-neutral-600">{stop.note}</div>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * Signature: `function GuideChat(): React.JSX.Element | null`
 * Purpose: Renders the selected IP as a topic-aware guide with welcome, reply and thinking feedback while keeping the composer above mobile keyboards.
 */
export function GuideChat() {
  const { user, loading } = useAuth();
  if (loading) return null;
  const scope = user ? `user:${user.id}` : "guest";
  return <GuideChatSession key={scope} storageKey={`tem_guide_history_v1:${scope}`} />;
}

/**
 * Signature: `function GuideChatSession({ storageKey }: { storageKey: string }): React.JSX.Element | null`
 * Purpose: Keeps one account-scoped conversation alive across panel closes and restores it after refresh.
 */
function GuideChatSession({ storageKey }: { storageKey: string }) {
  const { t } = useLanguage();
  const { open, openNonce, topic, closeGuide } = useGuide();
  const identity = useMascotIdentity();
  const hasMascot = identity !== "none";
  const guideName = MASCOT_OPTIONS.find((option) => option.id === identity)?.name ?? t("guide.name");
  const isMichiru = identity.startsWith("michiru");
  const { messages, setMessages, ready, storageError } = useGuideHistory(storageKey);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dismissedEntryNonce, setDismissedEntryNonce] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"thinking" | "map">("thinking");
  const [thinkingStatus, setThinkingStatus] = useState(t("guide.thinking"));
  const [detail, setDetail] = useState<EventDTO | null>(null); // 点击导游提到的活动 → 打开详情
  const [detailRequest, setDetailRequest] = useState<string | null>(null);
  const [detailError, setDetailError] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const topicRef = useRef<GuideTopic | null>(null);
  topicRef.current = topic;

  useEffect(() => {
    if (!open || !detailRequest) return;
    const controller = new AbortController();
    fetch(`/api/events/${encodeURIComponent(detailRequest)}`, { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("detail"); return r.json(); })
      .then((data) => { if (!data?.event) throw new Error("detail"); if (!controller.signal.aborted) setDetail(data.event); })
      .catch(() => { if (!controller.signal.aborted) setDetailError(true); })
      .finally(() => { if (!controller.signal.aborted) setDetailRequest(null); });
    return () => controller.abort();
  }, [detailRequest, open]);

  // Panel visibility must not erase the conversation or a pending reply.
  useEffect(() => { setDetailRequest(null); setDetailError(false); setConfirmClear(false); }, [open, topic]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, openNonce]);

  useEffect(() => {
    if (!open || !ready) return;
    const panel = panelRef.current;
    const viewport = window.visualViewport;
    if (!panel || !viewport) return;
    let frame = 0;
    // Runtime geometry is needed because software keyboards can resize only the visual viewport.
    const updateViewport = () => {
      panel.style.setProperty("--guide-height", `${viewport.height}px`);
      panel.style.setProperty("--guide-top", `${viewport.offsetTop}px`);
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateViewport);
    };
    updateViewport();
    viewport.addEventListener("resize", scheduleUpdate);
    viewport.addEventListener("scroll", scheduleUpdate);
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", scheduleUpdate);
      viewport.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [open, ready]);

  if (!open || !ready) return null;

  /**
   * Signature: `async function send(text: string, privateContext?: string): Promise<void>`
   * Purpose: Streams guide text while keeping route candidates in model-only context and restoring the visible question on failure.
   */
  async function send(text: string, privateContext?: string) {
    const question = text.trim();
    if (!question || loading) return;
    setDismissedEntryNonce(openNonce);
    const topicContext = !privateContext && topicRef.current ? topicInfo(topicRef.current) : "";
    const context = [topicContext, privateContext ?? ""].filter(Boolean).join("\n\n");
    const next: UIMessage[] = [...messages, { role: "user", content: question, context: context || undefined }];
    setMessages(next);
    setInput("");
    setLoadingAction("thinking");
    setThinkingStatus(t("guide.thinking"));
    setLoading(true);
    const apiMessages = next.slice(-12).map((m) => ({ role: m.role, content: m.context ? `${m.context}\n\n${m.content}` : m.content }));
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error("guide unavailable");
      let hasReply = false;
      let completed = false;
      let lastPaint = 0;
      let latest = "";
      const paint = (content: string, extra: Partial<UIMessage> = {}) => {
        if (!content) return;
        const message: UIMessage = { role: "assistant", content, ...extra };
        if (!hasReply) { setMessages(m => [...m, message]); hasReply = true; }
        else setMessages(m => [...m.slice(0, -1), message]);
        lastPaint = Date.now();
      };
      try {
        for await (const frame of readSSE(res.body)) {
          const data = JSON.parse(frame) as { type: string; statusKey?: TranslationKey; reply?: string; suggestions?: string[]; events?: { id: string; title: string }[] };
          if (data.type === "reply" && typeof data.reply === "string") {
            latest = data.reply;
            if (Date.now() - lastPaint >= 80) paint(latest);
          } else if (data.type === "status" && data.statusKey) {
            setThinkingStatus(t(data.statusKey));
          } else if (data.type === "done" && typeof data.reply === "string") {
            latest = data.reply;
            paint(latest, { suggestions: data.suggestions ?? [], events: data.events ?? [] });
            completed = true;
          } else if (data.type === "error") throw new Error("guide interrupted");
        }
        if (!completed) throw new Error("stream interrupted");
      } finally { if (!completed && latest) paint(latest); }
    } catch {
      if (controller.signal.aborted) return;
      setMessages((m) => [...m, { role: "assistant", content: t("guide.interrupted") }]);
      setInput(current => current || question);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Signature: `async function planNearbyRoute(intentPrompt?: string): Promise<void>`
   * Purpose: Requests an itinerary with route-specific feedback and appends its result to the conversation.
   */
  async function planNearbyRoute(intentPrompt?: string) {
    const candidates = topicRef.current?.routeCandidates ?? [];
    if (loading) return;
    setDismissedEntryNonce(openNonce);
    if (candidates.length < 2) {
      await send(intentPrompt ?? t("guide.fewEventsQuestion"));
      return;
    }
    const next: UIMessage[] = [...messages, { role: "user", content: t("guide.planNearby") }];
    setMessages(next);
    setLoadingAction("map");
    setLoading(true);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const res = await fetch("/api/guide/route-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidates, intentPrompt }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok || !data.plan) throw new Error(data.error ?? "规划失败");
      const plan = data.plan as GuideRoutePlan;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `${plan.summary}\n\n${t("guide.routeCardHint")}`,
          routePlan: plan,
          suggestions: [t("guide.routeSuggestionPhoto"), t("guide.routeSuggestionHour"), t("guide.routeSuggestionRest")],
        },
      ]);
    } catch {
      if (controller.signal.aborted) return;
      setMessages((m) => [...m, { role: "assistant", content: t("guide.routeFailed") }]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Signature: `function openEventDetail(id: string): void`
   * Purpose: Starts a cancellable detail request with visible loading and failure feedback.
   */
  function openEventDetail(id: string) {
    setDetailError(false);
    setDetailRequest(id);
  }

  const quick = topic ? topicQuick(topic, t) : [t("guide.quick.today"), t("guide.quick.weekend"), t("guide.quick.dayTrip"), t("guide.quick.festivalHistory")];
  const showEntryGuide = dismissedEntryNonce !== openNonce;
  // 最新一条 assistant 回复附带的「后续问题」建议（推测用户意图，≥3 个）
  const last = messages[messages.length - 1];
  const lastSuggestions = last?.role === "assistant" ? last.suggestions ?? [] : [];

  return (
    <div ref={panelRef} className="fixed inset-x-0 top-[var(--guide-top,0px)] z-[1000] flex h-[var(--guide-height,100dvh)] flex-col overflow-hidden bg-white">
      <div className="shrink-0 flex items-center justify-between px-4 h-14 border-b border-black/5">
        <div className="flex items-center gap-2 font-semibold">
          {hasMascot ? <MascotNavIcon identity={identity} role="discover" className="h-10 w-10" /> : <IconSparkles className="w-5 h-5 text-violet-600" />}
          <span>{hasMascot ? guideName : t("guide.name")}{hasMascot && <span className="ml-2 text-xs font-normal text-neutral-400">{t("guide.name")}</span>}</span>
        </div>
        <button
          type="button"
          onClick={closeGuide}
          aria-label={t("common.close")}
          className="w-8 h-8 grid place-items-center rounded-full text-neutral-400 hover:bg-neutral-100 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-black/5 px-4 py-2 text-xs text-neutral-500"><span>{storageError ? t("guide.storageError") : t("guide.storageHint")}</span><button type="button" disabled={loading || messages.length === 0} onClick={() => setConfirmClear(true)} className="shrink-0 rounded-full px-3 py-1 text-violet-600 disabled:opacity-40">{t("guide.clear")}</button></div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
            {m.role === "assistant" && hasMascot && (
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <MascotNavIcon identity={identity} role="discover" className="h-8 w-8" />
                <span>{guideName}</span>
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-violet-600 text-white" : "bg-neutral-100 text-neutral-800"
              }`}
            >
              {visibleMessageContent(m)}
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
                    <span className="ml-auto shrink-0 text-violet-400 text-xs">{t("guide.details")} ›</span>
                  </button>
                ))}
              </div>
            )}
            {m.role === "assistant" && m.routePlan && (
              <RoutePlanCard plan={m.routePlan} onOpen={openEventDetail} />
            )}
          </div>
        ))}
        {detailError && <p role="alert" className="text-sm text-rose-600">{t("guide.detailFailed")}</p>}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <LoadingFeedback compact scene={loadingAction} text={loadingAction === "map" ? t("guide.planningRoute") : thinkingStatus} />
        )}
        {showEntryGuide && !loading && (
          <div className="text-sm text-neutral-500 leading-relaxed">
            {hasMascot && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl bg-violet-50/70 p-3">
                <MascotAnimation animated kind="welcome" className="h-20 w-20" />
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-800">{t("guide.mascotIntro", { name: guideName })}</p>
                  <p className="mt-1 text-xs leading-5 text-violet-700">{isMichiru ? t("guide.michiruWelcome") : t("guide.welcome")}</p>
                </div>
              </div>
            )}
            {topic ? (
              <>
                <p className="font-medium text-neutral-700 mb-1">{t("guide.about", { title: topic.title })}</p>
                <p>{topic.kind === "route" ? (topic.routeCandidates && topic.routeCandidates.length >= 2 ? t("guide.routeReady") : t("guide.routeEmpty")) : t("guide.topicPrompt")}</p>
              </>
            ) : (
              <>
                {!hasMascot && <p className="font-medium text-neutral-700 mb-1">{t("guide.hello")}</p>}
                <p>{t("guide.generalPrompt")}</p>
              </>
            )}
          </div>
        )}
        {/* 每次回答后，展示 AI 推测用户意图给出的后续问题，点击即追问 */}
        {!showEntryGuide && !loading && lastSuggestions.length > 0 && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="text-xs text-neutral-400 px-1">{t("guide.followupHint")}</p>
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
      {showEntryGuide && !loading && (
        <div className="pb-2 flex flex-col gap-2">
          {topic?.kind === "route" && topic.routeActions && topic.routeActions.map((action, index) => (
              <button
                key={action.label}
                type="button"
                onClick={() => action.mode === "chat" ? send(action.label, action.prompt) : planNearbyRoute(action.prompt)}
                className={`text-left rounded-2xl border px-3.5 py-3 text-sm font-semibold shadow-[0_10px_24px_rgba(124,58,237,0.18)] ${index === 0 ? "border-violet-200 bg-violet-600 text-white" : "border-violet-200 bg-violet-50 text-violet-700"}`}
              >
                <span className="block">{action.label}</span>
                {action.description && <span className={`mt-1 block text-xs font-normal ${index === 0 ? "text-white/75" : "text-violet-500"}`}>{action.description}</span>}
              </button>
            ))}
          {topic?.kind === "route" && !topic.routeActions && topic.routePrompt && (
              <button
                type="button"
                onClick={() => planNearbyRoute(topic.routePrompt ?? undefined)}
                className="text-left rounded-2xl border border-violet-200 bg-violet-600 px-3.5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(124,58,237,0.22)]"
              >
                <span className="block">{t("guide.planNearby")}</span>
                <span className="mt-1 block text-xs font-normal text-white/75">{t("guide.planNearbyHint")}</span>
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
        <div ref={endRef} />
      </div>

      <div
        className="shrink-0 p-3 border-t border-black/5 flex gap-2"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) send(input); }}
          aria-label={t("guide.askLabel")}
          placeholder={t("guide.placeholder")}
          className="min-w-0 flex-1 border border-neutral-300 rounded-full px-4 py-2 text-base sm:text-sm"
        />
        {loading && <button type="button" onClick={() => requestRef.current?.abort()} className="px-3 py-2 text-sm text-neutral-600">{t("guide.stop")}</button>}
        <button
          type="button"
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          className="px-4 py-2 text-sm rounded-full bg-violet-600 text-white disabled:opacity-40"
        >
          {t("guide.send")}
        </button>
      </div>

      {detailRequest && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-white/70 px-6 backdrop-blur-[2px]" role="status" aria-live="polite">
          <div className="w-full max-w-xs rounded-3xl border border-violet-100 bg-white p-5 text-center shadow-[0_20px_60px_rgba(76,29,149,0.18)]">
            <LoadingFeedback compact scene="calendar" text={t("guide.openingEvent")} />
            <p className="mt-2 text-xs text-neutral-400">{t("guide.readingEvent")}</p>
            <button type="button" onClick={() => setDetailRequest(null)} className="mt-3 rounded-full px-4 py-2 text-xs font-medium text-neutral-500 hover:bg-neutral-100">{t("guide.cancelOpen")}</button>
          </div>
        </div>
      )}

      <ConfirmDialog open={confirmClear} title={t("guide.clearTitle")} message={t("guide.clearMessage")} confirmText={t("guide.clear")} onCancel={() => setConfirmClear(false)} onConfirm={() => { setMessages([]); setInput(""); setDismissedEntryNonce(Math.max(0, openNonce - 1)); setConfirmClear(false); }} />
      {detail && <EventDetail event={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
