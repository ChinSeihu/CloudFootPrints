"use client";

import { useCallback, useEffect, useState, type SetStateAction } from "react";
import { z } from "zod";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(50000),
  context: z.string().max(50000).optional(),
  suggestions: z.array(z.string().max(2000)).max(30).optional(),
  events: z.array(z.object({ id: z.string(), title: z.string() })).max(100).optional(),
  routePlan: z.object({
    title: z.string(), summary: z.string(), mood: z.string(), totalMinutes: z.number().finite(), walkKm: z.number().finite(),
    stops: z.array(z.object({ id: z.string(), title: z.string(), venueName: z.string().nullable(), note: z.string(), stayMinutes: z.number().finite() })).max(30),
  }).optional(),
});
const historySchema = z.object({ version: z.literal(1), messages: z.array(messageSchema).max(100) });
export type GuideMessage = z.infer<typeof messageSchema>;

/**
 * Signature: `function readGuideHistory(storageKey: string): GuideMessage[]`
 * Purpose: Restores only validated, size-bounded local messages; invalid or inaccessible storage never prevents opening the guide.
 */
export function readGuideHistory(storageKey: string): GuideMessage[] {
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];
  if (raw.length > 2500000) throw new Error("history size");
  const parsed = historySchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("invalid history");
  return parsed.data.messages;
}

/**
 * Signature: `function useGuideHistory(storageKey: string): { messages: GuideMessage[]; setMessages: (next: SetStateAction<GuideMessage[]>) => void; ready: boolean; storageError: boolean }`
 * Purpose: Keeps the latest 100 messages across closing, navigation and refresh, with a storage key scoped to the current account.
 */
export function useGuideHistory(storageKey: string) {
  const [messages, updateMessages] = useState<GuideMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try { updateMessages(readGuideHistory(storageKey)); }
      catch { setStorageError(true); }
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [storageKey]);
  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify({ version: 1, messages })); }
    catch { queueMicrotask(() => setStorageError(true)); }
  }, [messages, ready, storageKey]);
  const setMessages = useCallback((next: SetStateAction<GuideMessage[]>) => {
    updateMessages((previous) => (typeof next === "function" ? next(previous) : next).slice(-100));
  }, []);
  return { messages, setMessages, ready, storageError };
}
