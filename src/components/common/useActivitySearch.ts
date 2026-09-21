"use client";

import { useEffect, useState } from "react";
import type { EventDTO } from "@/lib/types";

type ActivitySearchState = {
  results: EventDTO[] | null;
  loading: boolean;
};

/**
 * Signature: `function useActivitySearch(query: string, enabled?: boolean, limit?: number): ActivitySearchState`
 * Purpose: Debounces full-database activity searches and cancels stale requests as the user types.
 */
export function useActivitySearch(query: string, enabled = true, limit = 80): ActivitySearchState {
  const [results, setResults] = useState<EventDTO[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const keyword = query.trim();
    if (!enabled || !keyword) {
      setResults(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/events?search=${encodeURIComponent(keyword)}&limit=${limit}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("activity search failed");
        const data = await response.json() as { events?: EventDTO[] };
        setResults(data.events ?? []);
      } catch (error) {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled, limit, query]);

  return { results, loading };
}
