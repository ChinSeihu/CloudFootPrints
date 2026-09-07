"use client";
import { useCallback, useRef, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { readBrowseSession, writeBrowseSession } from "@/lib/browseSession";

const values = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

type BrowseStateOptions = { persist?: boolean };

/**
 * Signature: `subscribe(key: string, listener: () => void): () => void`
 * Purpose: Connects React subscribers to one tab-local browse-state key and removes empty listener groups.
 */
function subscribe(key: string, listener: () => void): () => void {
  const keyListeners = listeners.get(key) ?? new Set();
  keyListeners.add(listener);
  listeners.set(key, keyListeners);
  return () => {
    keyListeners.delete(listener);
    if (keyListeners.size === 0) listeners.delete(key);
  };
}

/**
 * Signature: `function useBrowseState<T>(key: string, initial: T | (() => T), options?: BrowseStateOptions): [T, Dispatch<SetStateAction<T>>]`
 * Purpose: Retains tab-local browsing state across route unmounts and browser reloads without server persistence.
 */
export function useBrowseState<T>(key: string, initial: T | (() => T), options: BrowseStateOptions = {}): [T, Dispatch<SetStateAction<T>>] {
  const initialRef = useRef<{ value: T } | null>(null);
  if (initialRef.current === null) initialRef.current = { value: typeof initial === "function" ? (initial as () => T)() : initial };
  const persist = options.persist !== false;
  const getSnapshot = useCallback(() => {
    if (values.has(key)) return values.get(key) as T;
    const restored = persist && typeof window !== "undefined" ? readBrowseSession<T>(window.sessionStorage, key) : undefined;
    const resolved = restored === undefined ? initialRef.current?.value as T : restored;
    values.set(key, resolved);
    return resolved;
  }, [key, persist]);
  const value = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    getSnapshot,
    () => initialRef.current?.value as T,
  );
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    const previous = values.has(key) ? values.get(key) as T : getSnapshot();
    const resolved = typeof next === "function" ? (next as (value: T) => T)(previous) : next;
    values.set(key, resolved);
    if (persist && typeof window !== "undefined") writeBrowseSession(window.sessionStorage, key, resolved);
    listeners.get(key)?.forEach((listener) => listener());
  }, [getSnapshot, key, persist]);
  return [value, setValue];
}
